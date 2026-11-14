import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {createHash} from "node:crypto";
import {createSeasonSyncHandler} from "./api.js";

class FakeStore{
  spaces=new Map();
  games=new Map();
  async createSpace(id,data){
    if(this.spaces.has(id))throw Object.assign(Error("exists"),{code:412});
    this.spaces.set(id,{generation:1,metadata:structuredClone(data)});
  }
  async readSpace(id){
    const record=this.spaces.get(id);
    return record?structuredClone(record):{metadata:null,generation:null};
  }
  async updateSpace(id,data,generation){
    const current=this.spaces.get(id);
    if(!current||current.generation!==Number(generation))
      throw Object.assign(Error("conflict"),{code:412});
    this.spaces.set(id,{generation:current.generation+1,metadata:structuredClone(data)});
  }
  async writeSpaceGame(key,bytes){
    if(this.games.has(key))throw Object.assign(Error("duplicate"),{code:412});
    this.games.set(key,Buffer.from(bytes));
  }
  async readSpaceGame(key){return this.games.get(key)}
}
const ADMIN="trainer_"+("t".repeat(44));
const SPACE_ID="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const IDS=[SPACE_ID,"88735513-5e3e-4a95-aa70-6a1a2fe94bfa",
  "88735513-5e3e-4a95-aa70-6a1a2fe94bfb",
  "88735513-5e3e-4a95-aa70-6a1a2fe94bfc",
  "88735513-5e3e-4a95-aa70-6a1a2fe94bfd"];
const game=(n=1)=>({
  format:"handball-spielanalyse",version:1,gameName:"Kronshagen - Gegner",
  gameDate:"2026-11-13T12:00:00Z",
  home:{name:"TSV Kronshagen",players:[]},away:{name:"Gegner",players:[]},
  officialSource:{provider:"handball.net",matchId:"378123"},
  events:[{id:123,type:"goal",time:10,scoreH:n,scoreA:0}]
});
const season=()=>({format:"handball-spielanalyse-season",version:1,
  name:"TSV Kronshagen · 2026/27",preferredTeam:"TSV Kronshagen",
  games:[{id:"sg-localfirst",fileName:"spiel.json",selected:true,data:game()}]});
async function environment(callback){
  const store=new FakeStore();let index=0,keys=0,trainerKeys=0;
  const handler=createSeasonSyncHandler({
    store,adminToken:ADMIN,allowedOrigins:["https://jtaeubrich.github.io"],
    idFactory:()=>IDS[index++]||IDS[4],
    readerFactory:()=>"reader_"+String(++keys).padStart(46,"a"),
    trainerFactory:()=>"trainer_"+String(++trainerKeys).padStart(44,"t"),
    now:()=>new Date("2026-11-13T10:00:00Z")
  });
  const server=createServer(handler);
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const origin="http://127.0.0.1:"+server.address().port;
  const call=async(method,path,auth="",body,opts={})=>{
    const response=await fetch(origin+path,{
      method,headers:{Origin:"https://jtaeubrich.github.io",
        ...(auth?{Authorization:"Bearer "+auth}:{}),
        ...(body!==undefined?{"Content-Type":"application/json"}:{}),
        ...(opts.headers||{})},
      ...(body!==undefined?{body:JSON.stringify(body)}:{})
    });
    const raw=await response.text();let data;
    try{data=JSON.parse(raw)}catch{}
    return {status:response.status,raw,data,headers:response.headers};
  };
  try{await callback({call,store})}
  finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}

test("Team Space requires a trainer to create/publish, reader for catalog",()=>environment(async({call})=>{
  const bad=await call("POST","/spaces","reader_"+("r".repeat(40)),{name:"TSV"});
  assert.equal(bad.status,401);
  const created=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV Kronshagen"})).data;
  assert.equal(created.spaceId,SPACE_ID);
  const root="/spaces/"+SPACE_ID;
  assert.equal((await call("GET",root+"/catalog")).status,401);
  const cat=await call("GET",root+"/catalog",created.readToken);
  assert.equal(cat.status,200);
  assert.equal(cat.data.seasons.length,0);
  assert.equal(cat.data.games.length,0);
  assert.equal(JSON.stringify(cat.data).includes(created.readToken),false);
  assert.equal((await call("POST",root+"/publish-game",created.readToken,
    {expectedRevision:0,game:game()})).status,401);
  assert.equal((await call("GET",root+"/catalog",created.readToken,undefined,
    {headers:{Origin:"https://untrusted.example"}})).status,403);
}));
test("One game can be published separately and inside a season without duplicates",()=>environment(async({call,store})=>{
  const root="/spaces/"+SPACE_ID;
  const created=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV"})).data;
  const standalone=await call("POST",root+"/publish-game",created.trainerToken,
    {expectedRevision:0,game:game(),fileName:"spiel.json"});
  assert.equal(standalone.status,200);
  const gameId=standalone.data.gameId;
  const uploaded=await call("POST",root+"/publish-season",created.trainerToken,
    {expectedRevision:1,archive:season()});
  assert.equal(uploaded.status,200);
  const catalog=(await call("GET",root+"/catalog",created.readToken)).data;
  assert.equal(catalog.games.length,1);
  assert.equal(catalog.seasons.length,1);
  assert.deepEqual(catalog.seasons[0].gameIds,[gameId]);
  const download=await call("GET",root+"/games/"+gameId+"/download",created.readToken);
  assert.equal(download.status,200);
  assert.deepEqual(download.data,game());
  assert.equal(download.headers.get("x-content-sha256"),
    createHash("sha256").update(download.raw).digest("hex"));
  const archive=await call("GET",root+"/seasons/"+uploaded.data.seasonId+"/download",created.readToken);
  assert.equal(archive.status,200);
  assert.equal(archive.data.games[0].id,gameId);
  assert.equal(archive.headers.get("x-content-sha256"),
    createHash("sha256").update(archive.raw).digest("hex"));
  assert.equal(store.games.size,1);
}));
test("Single-game publication advances the linked season, stale writes are rejected",()=>environment(async({call})=>{
  const root="/spaces/"+SPACE_ID;
  const created=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV"})).data;
  const published=(await call("POST",root+"/publish-season",created.trainerToken,
    {expectedRevision:0,archive:season()})).data;
  const first=(await call("GET",root+"/catalog",created.readToken)).data;
  const gameId=first.games[0].id;
  assert.equal(first.seasons[0].revision,1);
  const update=await call("POST",root+"/publish-game",created.trainerToken,
    {expectedRevision:1,game:game(2),gameId});
  assert.equal(update.status,200);
  const catalog=(await call("GET",root+"/catalog",created.readToken)).data;
  assert.equal(catalog.games[0].revision,2);
  assert.equal(catalog.seasons[0].revision,2);
  const archive=(await call("GET",root+"/seasons/"+published.seasonId+"/download",
    created.readToken)).data;
  assert.equal(archive.games[0].data.events[0].scoreH,2);
  assert.equal((await call("POST",root+"/publish-game",created.trainerToken,
    {expectedRevision:1,game:game(3),gameId})).status,409);
  const latest=(await call("GET",root+"/games/"+gameId+"/download",created.readToken)).data;
  assert.equal(latest.events[0].scoreH,2);
}));
test("Revoking team invite stops old reader without affecting published records",()=>environment(async({call})=>{
  const root="/spaces/"+SPACE_ID;
  const created=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV"})).data;
  assert.equal((await call("POST",root+"/publish-game",created.trainerToken,
    {expectedRevision:0,game:{not:"a game"}})).status,400);
  const rotated=await call("POST",root+"/rotate-reader",created.trainerToken);
  assert.equal(rotated.status,200);
  assert.notEqual(rotated.data.readToken,created.readToken);
  assert.equal((await call("GET",root+"/catalog",created.readToken)).status,401);
  assert.equal((await call("GET",root+"/catalog",rotated.data.readToken)).status,200);
}));

test("Older client cannot create a Team Space without support for one-time trainer keys",()=>environment(async({call})=>{
  const old=await call("POST","/spaces",ADMIN,{name:"Old app"});
  const notAware=await call("POST","/spaces/v2",ADMIN,{name:"Old app"});
  assert.equal(notAware.status,426);
  assert.equal(old.status,426);
  assert.equal(old.data.error.code,"CLIENT_UPDATE_REQUIRED");
}));

test("Independent trainer keys isolate writes across two Team Spaces",()=>environment(async({call,store})=>{
  const first=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV Kronshagen"})).data;
  const second=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"HC Bremen"})).data;
  assert.notEqual(first.spaceId,second.spaceId);
  assert.notEqual(first.trainerToken,second.trainerToken);
  assert.notEqual(first.readToken,second.readToken);
  for(const space of [first,second]){
    const record=(await store.readSpace(space.spaceId)).metadata;
    assert.equal(record.trainerHash,createHash("sha256").update(space.trainerToken).digest("hex"));
    assert.equal(record.readerHash,createHash("sha256").update(space.readToken).digest("hex"));
    assert.equal(JSON.stringify(record).includes(space.trainerToken),false);
    assert.equal(JSON.stringify(record).includes(space.readToken),false);
    assert.equal((await call("GET","/spaces/"+space.spaceId+"/catalog",space.readToken)).status,200);
    assert.equal((await call("POST","/spaces/"+space.spaceId+"/verify-trainer",space.trainerToken)).status,200);
  }
  const firstUrl="/spaces/"+first.spaceId,secondUrl="/spaces/"+second.spaceId;
  assert.equal((await call("POST",firstUrl+"/publish-game",ADMIN,
    {expectedRevision:0,game:game()})).status,401);
  assert.equal((await call("POST",firstUrl+"/publish-game",second.trainerToken,
    {expectedRevision:0,game:game()})).status,401);
  assert.equal((await call("POST",firstUrl+"/verify-trainer",first.readToken)).status,401);
  assert.equal((await call("GET",firstUrl+"/catalog",second.readToken)).status,401);
  assert.equal((await call("POST",firstUrl+"/claim-trainer",ADMIN)).status,409);
  assert.equal((await call("POST",secondUrl+"/publish-game",first.trainerToken,
    {expectedRevision:0,game:game()})).status,401);
  const published=await call("POST",firstUrl+"/publish-game",first.trainerToken,
    {expectedRevision:0,game:game()});
  assert.equal(published.status,200);
  assert.equal((await call("GET",firstUrl+"/catalog",first.readToken)).data.games.length,1);
  assert.equal((await call("GET",secondUrl+"/catalog",second.readToken)).data.games.length,0);
}));

test("Trainer rotation invalidates only the previous key, retaining reader access",()=>environment(async({call})=>{
  const first=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"TSV"})).data;
  const other=(await call("POST","/spaces/v2",ADMIN,{authVersion:2,name:"HC Bremen"})).data;
  const root="/spaces/"+first.spaceId;
  assert.equal((await call("POST",root+"/rotate-trainer",ADMIN)).status,401);
  assert.equal((await call("POST",root+"/rotate-trainer",other.trainerToken)).status,401);
  const rotated=await call("POST",root+"/rotate-trainer",first.trainerToken);
  assert.equal(rotated.status,200);
  assert.notEqual(rotated.data.trainerToken,first.trainerToken);
  assert.equal((await call("POST",root+"/verify-trainer",first.trainerToken)).status,401);
  assert.equal((await call("POST",root+"/verify-trainer",rotated.data.trainerToken)).status,200);
  assert.equal((await call("GET",root+"/catalog",first.readToken)).status,200);
  assert.equal((await call("POST","/spaces/"+other.spaceId+"/verify-trainer",
    other.trainerToken)).status,200);
}));

test("Legacy spaces can be claimed once without changing existing season or read keys",()=>environment(async({call,store})=>{
  const oldId=SPACE_ID;
  const read="reader_"+("x".repeat(43));
  await store.createSpace(oldId,{id:oldId,name:"Alter Team Space",
    readerHash:createHash("sha256").update(read).digest("hex"),
    revision:3,seasons:{},games:{},createdAt:"2026-11-01",updatedAt:"2026-11-01"});
  const root="/spaces/"+oldId;
  assert.equal((await call("GET",root+"/catalog",read)).data.trainerAccess,"legacy");
  assert.equal((await call("POST",root+"/verify-trainer",ADMIN)).status,200);
  assert.equal((await call("POST",root+"/claim-trainer",read)).status,401);
  const claim=await call("POST",root+"/claim-trainer",ADMIN);
  assert.equal(claim.status,200);
  assert.ok(claim.data.trainerToken);
  assert.equal((await call("POST",root+"/claim-trainer",ADMIN)).status,409);
  assert.equal((await call("POST",root+"/verify-trainer",ADMIN)).status,401);
  assert.equal((await call("POST",root+"/verify-trainer",claim.data.trainerToken)).status,200);
  const published=await call("POST",root+"/publish-game",claim.data.trainerToken,
    {expectedRevision:3,game:game()});
  assert.equal(published.status,200);
  assert.equal((await call("GET",root+"/catalog",read)).data.trainerAccess,"individual");
  const current=(await store.readSpace(oldId)).metadata;
  assert.equal(current.createdAt,"2026-11-01");
  assert.equal(current.readerHash,createHash("sha256").update(read).digest("hex"));
  assert.equal(current.revision,4);
}));
