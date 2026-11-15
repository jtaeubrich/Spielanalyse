import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {createHash} from "node:crypto";
import {createSeasonSyncHandler} from "./api.js";
import {createTrainerAccountRegistry} from "./trainer-accounts.js";

const SPACE="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const SEASON="88735513-5e3e-4a95-aa70-6a1a2fe94bfa";
const NEXT="88735513-5e3e-4a95-aa70-6a1a2fe94bfb";
const MASTER="trainer_"+("M".repeat(44));
const token=name=>"eyJhbGciOiJSUzI1NiJ9."+name+("x".repeat(120))+"."+("y".repeat(60));
const T={admin:token("admin"),trainer:token("trainer"),other:token("other"),
  unverified:token("unverified"),changed:token("changed"),revoked:token("revoked")};
class Store{
  users=new Map();spaces=new Map();links=new Map();games=new Map();bootstrap=null;
  async readTrainerUser(id){
    const row=this.users.get(id);
    return row?structuredClone(row):{metadata:null,generation:null};
  }
  async createTrainerUser(id,metadata){
    if(this.users.has(id))throw Object.assign(Error("conflict"),{code:412});
    this.users.set(id,{metadata:structuredClone(metadata),generation:1});
  }
  async updateTrainerUser(id,metadata,generation){
    const prev=this.users.get(id);
    if(!prev||prev.generation!==Number(generation))
      throw Object.assign(Error("conflict"),{code:412});
    this.users.set(id,{metadata:structuredClone(metadata),generation:prev.generation+1});
  }
  async listTrainerUsers(){return [...this.users.values()].map(x=>structuredClone(x.metadata))}
  async readTrainerAdminBootstrap(){
    return this.bootstrap?structuredClone(this.bootstrap):{metadata:null,generation:null};
  }
  async createTrainerAdminBootstrap(data){
    if(this.bootstrap)throw Object.assign(Error("Already claimed"),{code:412});
    this.bootstrap={metadata:structuredClone(data),generation:1};
  }
  async createSpace(id,metadata){
    if(this.spaces.has(id))throw Object.assign(Error("conflict"),{code:412});
    this.spaces.set(id,{metadata:structuredClone(metadata),generation:1});
  }
  async readSpace(id){
    const row=this.spaces.get(id);
    return row?structuredClone(row):{metadata:null,generation:null};
  }
  async updateSpace(id,metadata,generation){
    const row=this.spaces.get(id);
    if(!row||row.generation!==Number(generation))
      throw Object.assign(Error("conflict"),{code:412});
    this.spaces.set(id,{metadata:structuredClone(metadata),generation:row.generation+1});
  }
  async createTrainerSpaceLink(uid,id){
    const list=this.links.get(uid)||new Set();
    list.add(id);this.links.set(uid,list);
  }
  async listTrainerSpaceLinks(uid){return [...(this.links.get(uid)||new Set())]}
  async writeSpaceGame(key,bytes){this.games.set(key,Buffer.from(bytes))}
  async readSpaceGame(key){return this.games.get(key)}
}
const users={
 [T.admin]:{uid:"admin-uid",email:"admin@example.org",email_verified:true},
 [T.trainer]:{uid:"trainer-uid",email:"trainer@example.org",email_verified:true},
 [T.other]:{uid:"other-uid",email:"other@example.org",email_verified:true},
 [T.unverified]:{uid:"trainer-uid",email:"trainer@example.org",email_verified:false},
 [T.changed]:{uid:"trainer-uid",email:"changed@example.org",email_verified:true}
};
async function environment(callback,{enabled=true,adminUids=["admin-uid"],bootstrapToken=MASTER}={}){
  const store=new Store(),ids=[SPACE,SEASON,NEXT],idx={value:0};let keys=0;
  const registry=createTrainerAccountRegistry({
    store,projectId:enabled?"spielanalyse-companion":"",
    webApiKey:enabled?"AIzaSyTestApiKeyForMockOnly":"",
    verifyIdToken:enabled?async value=>{
      if(value===T.revoked)throw Error("revoked");
      if(!users[value])throw Error("invalid token");
      return users[value];
    }:null,
    adminUids,adminToken:bootstrapToken,
    idFactory:()=>ids[idx.value++]||NEXT,
    trainerTokenFactory:()=>"trainer_"+String(++keys).padStart(43,"Q"),
    readTokenFactory:()=>"reader_"+("R".repeat(43)),
    now:()=>new Date("2026-11-14T12:00:00Z")
  });
  const server=createServer(createSeasonSyncHandler({
    store,adminToken:MASTER,trainerAccounts:registry,
    allowedOrigins:["https://jtaeubrich.github.io"]
  }));
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const base="http://127.0.0.1:"+server.address().port;
  async function call(method,path,identity="",data){
    const response=await fetch(base+path,{method,
      headers:{Origin:"https://jtaeubrich.github.io",
        ...(identity?{Authorization:"Bearer "+identity}:{}),
        ...(data!==undefined?{"Content-Type":"application/json"}:{})},
      ...(data!==undefined?{body:JSON.stringify(data)}:{})});
    const raw=await response.text();return {status:response.status,data:JSON.parse(raw),raw,headers:response.headers};
  }
  try{await callback({call,store})}finally{await new Promise(resolve=>server.close(resolve))}
}
const register=(call,jwt)=>call("POST","/trainer-auth/register",jwt,{});
const approve=(call,uid)=>call("POST","/trainer-auth/admin/users/"+uid,T.admin,{status:"approved"});

test("Firebase registration stays disabled without configuration; legacy health still works",()=>environment(async({call})=>{
  assert.deepEqual((await call("GET","/trainer-auth/config")).data,{enabled:false});
  assert.equal((await register(call,T.trainer)).status,503);
  assert.equal((await call("GET","/health")).status,200);
},{enabled:false}));

test("Unverified, missing and revoked tokens cannot request approval",()=>environment(async({call})=>{
  assert.equal((await register(call,T.unverified)).status,403);
  assert.equal((await register(call,T.revoked)).status,401);
  assert.equal((await register(call)).status,401);
  assert.equal((await call("GET","/trainer-auth/admin/users",T.trainer)).status,403);
  assert.equal((await call("POST","/trainer-auth/spaces",T.trainer,{name:"Bad"})).status,403);
}));

test("Only bootstrap administrator may approve; pending trainer cannot create spaces",()=>environment(async({call,store})=>{
  const created=await register(call,T.trainer);
  assert.equal(created.status,201);
  assert.equal(created.data.status,"pending");
  assert.equal((await call("POST","/trainer-auth/spaces",T.trainer,{name:"TSV"})).status,403);
  assert.equal((await call("POST","/trainer-auth/admin/users/trainer-uid",T.trainer,
    {status:"approved"})).status,403);
  assert.equal((await call("GET","/trainer-auth/admin/users",T.admin)).data.users.length,1);
  assert.equal((await approve(call,"trainer-uid")).status,200);
  const persisted=store.users.get("trainer-uid").metadata;
  assert.equal(persisted.status,"approved");
  assert.equal(persisted.approvedBy,"admin-uid");
  assert.equal((await call("GET","/trainer-auth/me",T.trainer)).data.status,"approved");
}));

test("Approved Firebase trainer can create a private Team Space and publish games into its season",()=>environment(async({call,store})=>{
  await register(call,T.trainer);await approve(call,"trainer-uid");
  const created=await call("POST","/trainer-auth/spaces",T.trainer,{name:"TSV Kronshagen"});
  assert.equal(created.status,201);
  assert.equal(created.data.spaceId,SPACE);
  assert.ok(created.data.readToken);
  assert.equal(created.data.trainerToken,undefined);
  const record=store.spaces.get(SPACE).metadata;
  assert.equal(record.ownerUid,"trainer-uid");
  assert.equal(record.authMode,"firebase");
  assert.ok(record.trainerHash);
  assert.equal(record.readerHash,createHash("sha256").update(created.data.readToken).digest("hex"));
  assert.equal(JSON.stringify(record).includes(created.data.readToken),false);
  assert.deepEqual((await call("GET","/trainer-auth/spaces",T.trainer)).data.spaces.map(x=>x.spaceId),[SPACE]);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",MASTER,
    {expectedRevision:0,game:{home:{},away:{},events:[]}})).status,401);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-season",T.trainer,
    {expectedRevision:0,archive:{}})).status,400);
  const createdSeason=await call("POST","/trainer-auth/spaces/"+SPACE+"/seasons",T.trainer,
    {name:"B-Jugend 2027/28",expectedRevision:0});
  assert.equal(createdSeason.status,201);
  assert.equal(createdSeason.data.seasonId,SEASON);
  const cat=await call("GET","/spaces/"+SPACE+"/catalog",created.data.readToken);
  assert.equal(cat.status,200);
  assert.equal(cat.data.games.length,0);
  assert.equal(cat.data.seasons.length,1);
  assert.equal(cat.data.seasons[0].gameCount,0);
  assert.equal(cat.data.seasons[0].name,"B-Jugend 2027/28");
  const seasonDownload=await call("GET","/spaces/"+SPACE+"/seasons/"+SEASON+"/download",
    created.data.readToken);
  assert.equal(seasonDownload.status,200);
  assert.deepEqual(seasonDownload.data.games,[]);
  assert.equal((await call("POST","/trainer-auth/spaces/"+SPACE+"/seasons",T.trainer,
    {name:"Too late",expectedRevision:0})).status,409);
  const game={gameName:"Kronshagen – Gast",gameDate:"2026-11-14",
    home:{name:"Kronshagen"},away:{name:"Gast"},events:[]};
  const published=await call("POST","/spaces/"+SPACE+"/publish-game",T.trainer,
    {expectedRevision:1,seasonId:SEASON,game});
  assert.equal(published.status,200);
  assert.equal(published.data.gameId.startsWith("sg-"),true);
  const updated=await call("GET","/spaces/"+SPACE+"/catalog",created.data.readToken);
  assert.equal(updated.data.games.length,1);
  assert.equal(updated.data.seasons[0].gameCount,1);
}));

test("Trainer account permissions are isolated by owner and approval may be revoked",()=>environment(async({call})=>{
  await register(call,T.trainer);await approve(call,"trainer-uid");
  await register(call,T.other);await approve(call,"other-uid");
  assert.equal((await call("POST","/trainer-auth/spaces",T.trainer,{name:"TSV"})).status,201);
  assert.equal((await call("GET","/trainer-auth/spaces/"+SPACE+"/catalog",T.other)).status,403);
  assert.equal((await call("POST","/trainer-auth/spaces/"+SPACE+"/seasons",T.other,
    {name:"Unauthorized",expectedRevision:0})).status,403);
  const game={gameName:"Fremdes Spiel",home:{name:"A"},away:{name:"B"},events:[]};
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",T.other,
    {expectedRevision:0,game})).status,403);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",T.unverified,
    {expectedRevision:0,game})).status,403);
  assert.equal((await call("POST","/trainer-auth/admin/users/trainer-uid",T.admin,
    {status:"suspended"})).status,200);
  assert.equal((await call("GET","/trainer-auth/spaces",T.trainer)).status,403);
  assert.equal((await call("POST","/trainer-auth/spaces/"+SPACE+"/seasons",T.trainer,
    {name:"Suspended",expectedRevision:0})).status,403);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",T.trainer,
    {expectedRevision:0,game})).status,403);
  assert.equal((await call("GET","/trainer-auth/me",T.trainer)).data.status,"suspended");
}));

test("Changing a verified account email requires new administrator approval",()=>environment(async({call,store})=>{
  await register(call,T.trainer);await approve(call,"trainer-uid");
  assert.equal((await call("GET","/trainer-auth/spaces",T.changed)).status,403);
  assert.equal((await register(call,T.changed)).status,201);
  const record=store.users.get("trainer-uid").metadata;
  assert.equal(record.email,"changed@example.org");
  assert.equal(record.status,"pending");
  assert.equal((await call("GET","/trainer-auth/spaces",T.trainer)).status,403);
}));

test("Registration status changes are idempotent and do not allow self-suspension",()=>environment(async({call})=>{
  await register(call,T.trainer);
  assert.equal((await register(call,T.trainer)).data.status,"pending");
  assert.equal((await approve(call,"trainer-uid")).status,200);
  assert.equal((await register(call,T.trainer)).data.status,"approved");
  assert.equal((await call("POST","/trainer-auth/admin/users/admin-uid",T.admin,
    {status:"suspended"})).status,409);
}));

test("Only the bootstrap admin can issue a game publisher key; rotation revokes the old key",()=>environment(async({call,store})=>{
  await register(call,T.trainer);await approve(call,"trainer-uid");
  const created=(await call("POST","/trainer-auth/spaces",T.trainer,
    {name:"TSV Kronshagen"})).data;
  const path="/trainer-auth/admin/spaces/"+SPACE+"/publisher-key";
  assert.equal((await call("POST",path,T.trainer,{})).status,403);
  assert.equal((await call("POST",path,T.unverified,{})).status,403);
  assert.equal((await call("POST",path,T.admin,{})).status,200);
  // New key is returned only once, hash alone is stored.
  const issued=await call("POST",path,T.admin,{});
  assert.equal(issued.status,200);
  const key=issued.data.trainerToken;
  assert.match(key,/^trainer_[A-Za-z0-9_-]{32,256}$/);
  const stored=(await store.readSpace(SPACE)).metadata;
  assert.equal(stored.trainerHash,createHash("sha256").update(key).digest("hex"));
  assert.equal(JSON.stringify(stored).includes(key),false);
  assert.equal((await call("POST","/spaces/"+SPACE+"/verify-trainer",key)).status,200);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",T.trainer,
    {expectedRevision:99,game:{home:{},away:{},events:[]}})).status,409);
  const payload={expectedRevision:0,game:{
    gameName:"Spiel",gameDate:"2026-11-14",home:{name:"TSV"},away:{name:"Gast"},events:[]
  }};
  const publication=await call("POST","/spaces/"+SPACE+"/publish-game",key,payload);
  assert.equal(publication.status,200);
  assert.equal((await call("GET","/spaces/"+SPACE+"/catalog",created.readToken)).data.games.length,1);
  const rotated=(await call("POST",path,T.admin,{})).data.trainerToken;
  assert.notEqual(rotated,key);
  assert.equal((await call("POST","/spaces/"+SPACE+"/verify-trainer",key)).status,401);
  assert.equal((await call("POST","/spaces/"+SPACE+"/verify-trainer",rotated)).status,200);
}));

test("First administrator can claim once using verified Firebase account and central token",()=>environment(async({call,store})=>{
  const pending=await register(call,T.trainer);
  assert.equal(pending.status,201);
  const info=await call("GET","/trainer-auth/me",T.trainer);
  assert.equal(info.data.status,"pending");
  assert.equal(info.data.isAdmin,false);
  assert.equal(info.data.adminBootstrapAvailable,true);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.unverified,
    {registrationToken:MASTER})).status,403);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.other,
    {registrationToken:MASTER})).status,403);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:"trainer_"+("x".repeat(44))})).status,403);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:"garbage"})).status,403);
  assert.equal(store.bootstrap,null);
  const claim=await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:MASTER});
  assert.equal(claim.status,200);
  assert.equal(claim.data.isAdmin,true);
  assert.equal(claim.data.uid,"trainer-uid");
  assert.equal(JSON.stringify(store.bootstrap).includes(MASTER),false);
  assert.equal(store.bootstrap.metadata.email,"trainer@example.org");
  assert.equal(store.users.get("trainer-uid").metadata.status,"approved");
  const after=await call("GET","/trainer-auth/me",T.trainer);
  assert.equal(after.data.status,"approved");
  assert.equal(after.data.isAdmin,true);
  assert.equal(after.data.adminBootstrapAvailable,false);
  assert.equal((await call("GET","/trainer-auth/admin/users",T.trainer)).status,200);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:MASTER})).status,409);
  assert.equal((await call("GET","/trainer-auth/me",T.other)).data.isAdmin,false);
},{adminUids:[]}));

test("A second and simultaneous first-administrator claim cannot take over",()=>environment(async({call,store})=>{
  await register(call,T.trainer);
  await register(call,T.other);
  const results=await Promise.all([
    call("POST","/trainer-auth/admin/bootstrap",T.trainer,{registrationToken:MASTER}),
    call("POST","/trainer-auth/admin/bootstrap",T.other,{registrationToken:MASTER})
  ]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  assert.ok(["trainer-uid","other-uid"].includes(store.bootstrap.metadata.uid));
  assert.equal(store.bootstrap.metadata.claimedAt,"2026-11-14T12:00:00.000Z");
  const winner=store.bootstrap.metadata.uid==="trainer-uid"?T.trainer:T.other;
  const loser=winner===T.trainer?T.other:T.trainer;
  assert.equal((await call("GET","/trainer-auth/me",winner)).data.isAdmin,true);
  assert.equal((await call("GET","/trainer-auth/me",loser)).data.isAdmin,false);
  assert.equal((await call("POST","/trainer-auth/admin/users/other-uid",loser,
    {status:"approved"})).status,403);
},{adminUids:[]}));

test("Existing configured admin prevents untrusted first-admin bootstrap",()=>environment(async({call})=>{
  await register(call,T.trainer);
  assert.equal((await call("GET","/trainer-auth/me",T.trainer))
    .data.adminBootstrapAvailable,false);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:MASTER})).status,409);
}));

test("Missing central token disables bootstrap; email change removes bootstrap admin role",()=>environment(async({call,store})=>{
  await register(call,T.trainer);
  assert.equal((await call("GET","/trainer-auth/me",T.trainer))
    .data.adminBootstrapAvailable,false);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:MASTER})).status,403);
},{adminUids:[],bootstrapToken:""}));

test("Persisted first-admin email cannot be changed to inherit administrator role",()=>environment(async({call})=>{
  await register(call,T.trainer);
  assert.equal((await call("POST","/trainer-auth/admin/bootstrap",T.trainer,
    {registrationToken:MASTER})).status,200);
  const changed=await call("GET","/trainer-auth/me",T.changed);
  assert.equal(changed.status,200);
  assert.equal(changed.data.isAdmin,false);
  assert.equal(changed.data.status,"not_registered");
  assert.equal((await call("GET","/trainer-auth/admin/users",T.changed)).status,403);
},{adminUids:[]}));

test("Approved trainer reads own account Team Space without reader key across devices",()=>environment(async({call})=>{
  await register(call,T.trainer);await approve(call,"trainer-uid");
  await register(call,T.other);await approve(call,"other-uid");
  const created=(await call("POST","/trainer-auth/spaces",T.trainer,{name:"TSV"})).data;
  const root="/spaces/"+SPACE;
  const game={gameName:"Test",home:{name:"Home"},away:{name:"Away"},events:[]};
  const pub=await call("POST",root+"/publish-game",T.trainer,{expectedRevision:0,game});
  assert.equal(pub.status,200);
  const id=pub.data.gameId;
  const ownCatalog=await call("GET",root+"/catalog",T.trainer);
  assert.equal(ownCatalog.status,200);
  assert.equal(ownCatalog.data.games[0].id,id);
  assert.equal(JSON.stringify(ownCatalog.data).includes(created.readToken),false);
  const downloaded=await call("GET",root+"/games/"+id+"/download",T.trainer);
  assert.equal(downloaded.status,200);
  assert.deepEqual(downloaded.data,game);
  assert.equal(downloaded.headers.get("x-content-sha256"),
    createHash("sha256").update(downloaded.raw).digest("hex"));
  assert.equal((await call("GET",root+"/catalog",T.other)).status,403);
  assert.equal((await call("GET",root+"/catalog",T.unverified)).status,403);
  assert.equal((await call("GET",root+"/catalog")).status,401);
  assert.equal((await call("GET",root+"/catalog",created.readToken)).status,200);
  await call("POST","/trainer-auth/admin/users/trainer-uid",T.admin,{status:"suspended"});
  assert.equal((await call("GET",root+"/catalog",T.trainer)).status,403);
}));

test("Existing v2 Team Space can be securely linked once, preserving invitations and publications",()=>environment(async({call,store})=>{
  const key="trainer_"+("P".repeat(44)),reader="reader_"+("R".repeat(44));
  const digest=value=>createHash("sha256").update(value).digest("hex");
  await store.createSpace(SPACE,{id:SPACE,name:"Alter Space",
    authVersion:2,revision:0,createdAt:"2026-01-01T00:00:00Z",
    updatedAt:"2026-01-01T00:00:00Z",readerHash:digest(reader),trainerHash:digest(key),
    seasons:{},games:{}});
  await register(call,T.trainer);await approve(call,"trainer-uid");
  await register(call,T.other);await approve(call,"other-uid");
  const path="/trainer-auth/spaces/"+SPACE+"/link";
  assert.equal((await call("POST",path,T.unverified,{trainerToken:key})).status,403);
  assert.equal((await call("POST",path,T.other,{trainerToken:"trainer_"+("X".repeat(44))})).status,403);
  assert.equal((await call("GET","/trainer-auth/spaces",T.trainer)).data.spaces.length,0);
  const linked=await call("POST",path,T.trainer,{trainerToken:key});
  assert.equal(linked.status,200);
  const meta=(await store.readSpace(SPACE)).metadata;
  assert.equal(meta.ownerUid,"trainer-uid");
  assert.equal(meta.authMode,"firebase");
  assert.equal(meta.trainerHash,digest(key));
  assert.equal(meta.readerHash,digest(reader));
  assert.equal(JSON.stringify(meta).includes(key),false);
  assert.equal(JSON.stringify(meta).includes(reader),false);
  assert.deepEqual((await call("GET","/trainer-auth/spaces",T.trainer))
    .data.spaces.map(item=>item.spaceId),[SPACE]);
  assert.equal((await call("GET","/spaces/"+SPACE+"/catalog",T.trainer)).status,200);
  assert.equal((await call("GET","/spaces/"+SPACE+"/catalog",reader)).status,200);
  assert.equal((await call("GET","/spaces/"+SPACE+"/catalog",T.other)).status,403);
  assert.equal((await call("POST",path,T.other,{trainerToken:key})).status,409);
  assert.equal((await call("POST",path,T.trainer,{trainerToken:key})).status,200);
  const game={gameName:"Historisches Spiel",home:{},away:{},events:[]};
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",T.trainer,
    {expectedRevision:0,game})).status,200);
  assert.equal((await call("POST","/spaces/"+SPACE+"/publish-game",key,
    {expectedRevision:1,game})).status,200);
}));

test("Unmigrated v1 spaces cannot be linked using central registration credentials",()=>environment(async({call,store})=>{
  await store.createSpace(SPACE,{id:SPACE,name:"Vor Migration",readerHash:"a".repeat(64),
    revision:0,seasons:{},games:{}});
  await register(call,T.trainer);await approve(call,"trainer-uid");
  const result=await call("POST","/trainer-auth/spaces/"+SPACE+"/link",
    T.trainer,{trainerToken:MASTER});
  assert.equal(result.status,409);
  assert.equal(result.data.error.code,"TRAINER_KEY_REQUIRED");
  assert.equal((await store.readSpace(SPACE)).metadata.ownerUid,undefined);
}));
