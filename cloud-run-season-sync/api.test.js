import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {createSeasonSyncHandler} from "./api.js";
class InMemoryStore{
  constructor(){this.items=new Map();this.archives=new Map()}
  async create(id,metadata){
    if(this.items.has(id))throw Object.assign(Error("duplicate"),{code:412});
    this.items.set(id,{metadata:structuredClone(metadata),generation:1});
  }
  async read(id){
    const record=this.items.get(id);
    return record?structuredClone(record):{metadata:null,generation:null};
  }
  async update(id,metadata,generation){
    const previous=this.items.get(id);
    if(!previous||previous.generation!==Number(generation))
      throw Object.assign(Error("conflict"),{code:412});
    this.items.set(id,{metadata:structuredClone(metadata),generation:previous.generation+1});
  }
  async writeArchive(path,bytes){
    if(this.archives.has(path))throw Object.assign(Error("duplicate"),{code:412});
    this.archives.set(path,Buffer.from(bytes));
  }
  async readArchive(path){return this.archives.get(path)}
}
const ADMIN="trainer-"+("T".repeat(50));
const UUID="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const ARCHIVE={format:"handball-spielanalyse-season",version:1,
  name:"TSV Kronshagen 2026/27",createdAt:"2026-11-11T20:00:00Z",
  preferredTeam:"TSV Kronshagen",games:[{
    id:"sg-001",fileName:"Spiel_1.json",selected:true,
    data:{gameName:"Spiel 1",home:{name:"TSV Kronshagen",players:[]},
      away:{name:"Gast",players:[]},events:[{id:101,type:"goal",time:10}]}
  }]
};
async function env(fn){
  const store=new InMemoryStore();
  const handler=createSeasonSyncHandler({store,adminToken:ADMIN,
    allowedOrigins:["https://jtaeubrich.github.io"],
    idFactory:()=>UUID,readerFactory:(()=>{let n=0;return ()=>"reader_"+(++n).toString().padStart(40,"a")})(),
    now:()=>new Date("2026-11-11T21:00:00Z")});
  const server=createServer(handler);server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const url="http://127.0.0.1:"+server.address().port;
  const call=async (method,path,secret="",data,extra={})=>{
    const response=await fetch(url+path,{method,
      headers:{...({"Origin":"https://jtaeubrich.github.io"}),
        ...(secret?{"Authorization":"Bearer "+secret}:{}),
        ...(data!==undefined?{"Content-Type":"application/json"}:{}),...extra},
      ...(data!==undefined?{body:JSON.stringify(data)}:{})});
    const payload=await response.json().catch(()=>null);
    return {status:response.status,payload,headers:response.headers};
  };
  try{await fn({call,store})}finally{await new Promise((resolve,reject)=>
    server.close(error=>error?reject(error):resolve()))}
}
test("only trainer may create/publish; reader only GET latest/download",()=>env(async({call})=>{
  let result=await call("POST","/seasons","reader_"+("a".repeat(40)));
  assert.equal(result.status,401);
  result=await call("POST","/seasons",ADMIN);
  assert.equal(result.status,201);
  assert.equal(result.payload.seasonId,UUID);
  const key=result.payload.readToken;
  result=await call("GET","/seasons/"+UUID+"/latest",key);
  assert.equal(result.status,200);assert.equal(result.payload.revision,0);
  result=await call("POST","/seasons/"+UUID+"/publish",key,
    {expectedRevision:0,archive:ARCHIVE});
  assert.equal(result.status,401);
  result=await call("POST","/seasons/"+UUID+"/publish",ADMIN,
    {expectedRevision:0,archive:ARCHIVE});
  assert.equal(result.status,200);assert.equal(result.payload.revision,1);
  result=await call("GET","/seasons/"+UUID+"/latest",key);
  assert.equal(result.status,200);assert.equal(result.payload.gameCount,1);
  const hash=result.payload.sha256;
  result=await call("GET","/seasons/"+UUID+"/download",key);
  assert.equal(result.status,200);assert.deepEqual(result.payload,ARCHIVE);
  assert.equal(result.headers.get("x-season-sha256"),hash);
  assert.equal(result.headers.get("cache-control"),"private, no-store");
  result=await call("GET","/seasons/"+UUID+"/download");
  assert.equal(result.status,401);
}));
test("reader key rotation revokes previous key without altering published snapshot",()=>env(async({call})=>{
  const created=(await call("POST","/seasons",ADMIN)).payload;
  await call("POST","/seasons/"+UUID+"/publish",ADMIN,{expectedRevision:0,archive:ARCHIVE});
  const rotated=await call("POST","/seasons/"+UUID+"/rotate-reader",ADMIN);
  assert.equal(rotated.status,200);
  assert.notEqual(created.readToken,rotated.payload.readToken);
  assert.equal((await call("GET","/seasons/"+UUID+"/latest",created.readToken)).status,401);
  assert.equal((await call("GET","/seasons/"+UUID+"/download",rotated.payload.readToken)).status,200);
}));
test("optimistic revisions reject concurrent publications and keep snapshot",()=>env(async({call})=>{
  const created=(await call("POST","/seasons",ADMIN)).payload;
  assert.equal((await call("POST","/seasons/"+UUID+"/publish",ADMIN,{expectedRevision:0,archive:ARCHIVE})).status,200);
  const changed=structuredClone(ARCHIVE);changed.name="Neue Saison";
  assert.equal((await call("POST","/seasons/"+UUID+"/publish",ADMIN,{expectedRevision:0,archive:changed})).status,409);
  const last=await call("GET","/seasons/"+UUID+"/download",created.readToken);
  assert.equal(last.payload.name,ARCHIVE.name);
}));
test("invalid season, forbidden origin, preflight headers and wrong method rejected",()=>env(async({call})=>{
  const created=(await call("POST","/seasons",ADMIN)).payload;
  const wrong={...ARCHIVE,games:[{...ARCHIVE.games[0],id:"bad/path"}]};
  assert.equal((await call("POST","/seasons/"+UUID+"/publish",ADMIN,{expectedRevision:0,archive:wrong})).status,400);
  assert.equal((await call("GET","/seasons/"+UUID+"/latest",created.readToken,undefined,
    {Origin:"https://evil.example"})).status,403);
  const preflight=await call("OPTIONS","/seasons/"+UUID+"/latest","",undefined,
    {"Access-Control-Request-Headers":"X-Admin","Access-Control-Request-Method":"GET"});
  assert.equal(preflight.status,403);
  assert.equal((await call("POST","/seasons/"+UUID+"/download",created.readToken)).status,405);
  assert.equal((await call("GET","/invalid/route")).status,404);
}));
