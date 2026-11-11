import {test,expect} from "@playwright/test";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const API="https://handball-season-sync-235703972531.europe-west1.run.app";
const ID="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const READER="reader_"+("q".repeat(40));
const ADMIN="admin_"+("T".repeat(40));
const fixture=JSON.parse(await readFile(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
function game(day,events){
  const state=structuredClone(fixture);
  state.gameName="Kronshagen gegen Gegner";state.gameDate=day;
  state.home.name="TSV Kronshagen";state.away.name="Gegner";
  state.ownTeam="home";state.isHistorical=false;state.isVideoscoutingFile=true;
  state.events=structuredClone(events);return state;
}
const baseEvent={id:123,type:"goal",team:"home",time:60,scoreH:1,scoreA:0,
  realTime:64000,comment:"Trainerhinweis",videoAnnotation:{comment:"",shapes:[]}};
const archive=(revision)=>({
  format:"handball-spielanalyse-season",version:1,
  name:"Kronshagen Saison 2026/27",preferredTeam:"TSV Kronshagen",
  createdAt:revision===1?"2026-11-09T20:00:00Z":"2026-11-11T20:00:00Z",
  games:[
    {id:"sg-first",fileName:"eins.json",selected:true,
      data:game("2026-11-09",[{...baseEvent,
        comment:revision===1?"Trainerhinweis":"Korrigierter Trainerhinweis",
        scoreH:revision===1?1:2},
        ...(revision===2?[{id:124,type:"2min",team:"away",time:210}]:[])])},
    ...(revision===2?[{id:"sg-second",fileName:"zwei.json",selected:true,
      data:game("2026-11-11",[{id:201,type:"goal",team:"home",time:15,scoreH:1,scoreA:0}])}]:[])
  ]
});
const sha=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const upload=(name,obj)=>({name,mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify(obj))});
function mockCloud(page){
  const context={revision:1,calls:[],lastArchive:null};
  page.route(API+"/**",async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    context.calls.push({method,path:url.pathname,auth:req.headers().authorization||""});
    const headers={"Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Authorization,Content-Type",
      "Access-Control-Expose-Headers":"X-Season-Revision,X-Season-Sha256"};
    if(method==="OPTIONS")return route.fulfill({status:204,headers});
    if(url.pathname==="/seasons"&&method==="POST"){
      return route.fulfill({status:201,contentType:"application/json",headers,
        body:JSON.stringify({seasonId:ID,readToken:READER,revision:0})});
    }
    const connected=method==="GET"?READER:ADMIN;
    if(req.headers().authorization!=="Bearer "+connected)
      return route.fulfill({status:401,contentType:"application/json",headers,
        body:JSON.stringify({error:{message:"Unauthorized"}})});
    if(url.pathname.endsWith("/latest")){
      const item=context.lastArchive||archive(context.revision);
      return route.fulfill({status:200,contentType:"application/json",headers,
        body:JSON.stringify({seasonId:ID,revision:context.revision,
          sha256:sha(item),name:item.name,gameCount:item.games.length,
          publishedAt:"2026-11-11T20:00:00Z"})});
    }
    if(url.pathname.endsWith("/download")){
      const item=context.lastArchive||archive(context.revision);
      return route.fulfill({status:200,contentType:"application/json",headers:{
        ...headers,"X-Season-Revision":String(context.revision),
        "X-Season-Sha256":sha(item)},body:JSON.stringify(item)});
    }
    if(url.pathname.endsWith("/publish")&&method==="POST"){
      const data=req.postDataJSON();
      context.lastArchive=data.archive;
      context.revision=data.expectedRevision+1;
      return route.fulfill({status:200,contentType:"application/json",headers,
        body:JSON.stringify({seasonId:ID,revision:context.revision,
          sha256:sha(data.archive),publishedAt:"2026-11-11T20:00:00Z",
          gameCount:data.archive.games.length})});
    }
    return route.fulfill({status:404,headers});
  });
  return context;
}
async function readSeason(page,id){
  return page.evaluate(async key=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("handball-spielanalyse",3);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction("seasons","readonly");
        const req=tx.objectStore("seasons").get(key);
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  },id);
}
test("trainer publishes only with admin key and obtains a read-only invitation",async({page})=>{
  const cloud=mockCloud(page);
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("trainer.json",archive(1)));
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await page.locator("#homeSeasonManage").click();
  await page.locator("#seasonCloudPanel summary").click();
  await page.locator("#seasonCloudEndpoint").fill(API);
  await page.locator("#seasonCloudAdminToken").fill(ADMIN);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonCloudPublish").click();
  await expect(page.locator("#seasonCloudInvite")).toHaveValue(/#saison=/);
  const link=await page.locator("#seasonCloudInvite").inputValue();
  expect(link).toContain("key=");
  expect(link).not.toContain(ADMIN);
  const published=cloud.lastArchive;
  expect(published.format).toBe("handball-spielanalyse-season");
  expect(published.version).toBe(1);
  expect(published.games).toHaveLength(1);
  expect(cloud.calls.some(call=>call.method==="POST"&&call.path.endsWith("/publish")
    &&call.auth==="Bearer "+ADMIN)).toBe(true);
  const libraryId=await page.locator("#seasonLibrarySelect").inputValue();
  const meta=await readSeason(page,"sync-"+libraryId);
  expect(meta.connection.role).toBe("trainer");
  expect(JSON.stringify(meta)).not.toContain(ADMIN);
});

test("player subscribes with one invite, keeps local comments after cloud refresh and never uploads",async({page})=>{
  const cloud=mockCloud(page);
  page.on("dialog",dialog=>dialog.accept());
  const link="/#saison="+encodeURIComponent(ID)+"&key="+encodeURIComponent(READER)+
    "&api="+encodeURIComponent(API);
  await page.goto(link);
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  expect(await page.evaluate(()=>location.hash)).toBe("");
  const id=await page.locator("#seasonLibrarySelect").inputValue();
  expect((await readSeason(page,"sync-"+id)).connection.role).toBe("reader");
  await expect(page.locator("#seasonCloudPublish")).toBeDisabled();
  await page.locator("#homeSeasonGames .home-list-row").first()
    .getByRole("button",{name:"Fortsetzen",exact:true}).click();
  await page.locator('[data-tab="video"]').click();
  await page.locator("#videoPlaylist .clip").first().click();
  await page.locator("#videoTabEventComment").fill("Meine private Videoanalyse");
  const saved=await page.evaluate(()=>JSON.parse(
    localStorage.getItem("handballSpielanalyse.session")).state.events[0]);
  expect(saved.videoAnnotation.comment).toBe("Meine private Videoanalyse");
  cloud.revision=2;
  await page.locator("#homeSeasonRefresh").evaluate(button=>button.click());
  await expect(page.locator("#seasonRefreshDialog")).toBeVisible();
  await expect(page.locator("#seasonRefreshPreview")).toContainText("Neue Spiele");
  await page.locator("#seasonRefreshConfirm").click();
  await expect(page.locator("#seasonRefreshDialog")).toBeHidden();
  const library=await readSeason(page,id);
  expect(library.games).toHaveLength(2);
  expect(library.games[0].data.events[0].scoreH).toBe(2);
  expect(library.games[0].data.events[0].videoAnnotation.comment)
    .toBe("Meine private Videoanalyse");
  expect((await readSeason(page,"source-"+id)).source.games[0].state.events[0]
    .videoAnnotation.comment).toBe("");
  expect((await readSeason(page,"sync-"+id)).connection.revision).toBe(2);
  expect(cloud.calls.filter(call=>call.method==="POST")).toHaveLength(0);
  // Opening the same invitation again must reconnect to the existing season.
  await page.goto(link);
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await expect(page.locator("#seasonLibrarySelect option")).toHaveCount(1);
  expect((await readSeason(page,id)).games[0].data.events[0].videoAnnotation.comment)
    .toBe("Meine private Videoanalyse");
});
