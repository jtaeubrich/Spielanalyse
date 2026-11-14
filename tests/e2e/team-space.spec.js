import {test,expect} from "@playwright/test";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const API="https://handball-season-sync-235703972531.europe-west1.run.app";
const SPACE="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const SEASON="88735513-5e3e-4a95-aa70-6a1a2fe94bfa";
const GAME="sg-first";
const READER="reader_"+("q".repeat(40));
const ADMIN="trainer_"+("t".repeat(44));
const PERSONAL="trainer_"+("p".repeat(44));
const original=JSON.parse(await readFile(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
const hash=text=>createHash("sha256").update(text).digest("hex");
function game(revision=1){
  const state=structuredClone(original);
  state.gameName="Kronshagen gegen Gegner";
  state.gameDate="2026-11-09T11:00:00Z";
  state.home.name="TSV Kronshagen";state.away.name="Gegner";
  state.isHistorical=false;state.isVideoscoutingFile=true;
  state.events=[{id:123,type:"goal",team:"home",time:60,scoreH:revision,
    scoreA:0,videoAnnotation:{comment:"",shapes:[]}}];
  return state;
}
const archive=(revision=1)=>({
  format:"handball-spielanalyse-season",version:1,name:"Kronshagen 2026/27",
  createdAt:"2026-11-09T21:00:00Z",preferredTeam:"TSV Kronshagen",
  games:[{id:GAME,fileName:"spiel.json",selected:true,data:game(revision)}]
});
const upload=(name,value)=>({name,mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify(value))});
function apiData(revision){
  const data=game(revision),season=archive(revision);
  return {catalog:{
    spaceId:SPACE,name:"TSV Kronshagen",revision,trainerAccess:"individual",
    seasons:[{id:SEASON,name:"Saison 2026/27",revision,gameCount:1,gameIds:[GAME]}],
    games:[{id:GAME,name:"Kronshagen gegen Gegner",date:"2026-11-09",
      revision,sha256:hash(JSON.stringify(data)),matchId:"",seasonIds:[SEASON]}]
  },season,game:data};
}
async function mockSpace(page){
  const cloud={revision:1,calls:[],lastPublish:null};
  await page.route(API+"/**",async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    cloud.calls.push({path:url.pathname,method,auth:request.headers().authorization});
    const headers={"Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Authorization,Content-Type",
      "Access-Control-Expose-Headers":"X-Item-Revision,X-Content-Sha256"};
    if(method==="OPTIONS")return route.fulfill({status:204,headers});
    if(url.pathname==="/spaces"&&method==="POST")
      return route.fulfill({status:201,headers,
        body:JSON.stringify({spaceId:SPACE,name:"TSV Kronshagen",
          readToken:READER,trainerToken:PERSONAL,revision:0})});
    const isWrite=method==="POST";
    if(request.headers().authorization!=="Bearer "+(isWrite?PERSONAL:READER))
      return route.fulfill({status:401,headers,
        body:JSON.stringify({error:{message:"Unauthorized"}})});
    const data=apiData(cloud.revision);
    if(url.pathname.endsWith("/catalog"))
      return route.fulfill({status:200,headers,body:JSON.stringify(data.catalog)});
    if(url.pathname.endsWith("/publish-season")&&isWrite){
      cloud.lastPublish=request.postDataJSON();
      return route.fulfill({status:200,headers,
        body:JSON.stringify({spaceId:SPACE,seasonId:SEASON,revision:2,
          itemRevision:1,gameCount:1})});
    }
    if(url.pathname.endsWith("/publish-game")&&isWrite){
      cloud.lastPublish=request.postDataJSON();
      return route.fulfill({status:200,headers,
        body:JSON.stringify({spaceId:SPACE,gameId:GAME,revision:2,itemRevision:1})});
    }
    let body,revision;
    if(url.pathname.endsWith("/games/"+GAME+"/download")){
      body=JSON.stringify(data.game);revision=cloud.revision;
    }else if(url.pathname.endsWith("/seasons/"+SEASON+"/download")){
      body=JSON.stringify(data.season);revision=cloud.revision;
    }else{return route.fulfill({status:404,headers})}
    return route.fulfill({status:200,headers:{...headers,
      "X-Content-Sha256":hash(body),"X-Item-Revision":String(revision)},body});
  });
  return cloud;
}
async function readStore(page,storeName,id){
  return page.evaluate(async({storeName,id})=>{
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("handball-spielanalyse",3);
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,"readonly"),r=tx.objectStore(storeName).get(id);
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
    }finally{db.close()}
  },{storeName,id});
}
test("Home offers Team Space as an independent third entry",async({page})=>{
  await page.goto("/");
  await expect(page.locator("#homeChoose .home-big-choice")).toHaveCount(3);
  await page.locator("#homeChooseTeamSpace").click();
  await expect(page.locator("#homeTeamSpace")).toBeVisible();
  await expect(page.locator("#homeChoose")).toBeHidden();
  await page.locator("#homeBack").click();
  await page.locator("#homeChooseSeason").click();
  await expect(page.locator("#homeActions")).toBeVisible();
  await page.locator("#homeBack").click();
  await page.locator("#homeChooseGame").click();
  await expect(page.locator("#homeActions")).toBeVisible();
});
test("invite opens catalog, season imports once and updates existing season",async({page})=>{
  const cloud=await mockSpace(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpace")).toBeVisible();
  await expect(page.locator("#teamSpaceSeasons .home-list-row")).toHaveCount(1);
  expect(await page.evaluate(()=>location.hash)).toBe("");
  await page.locator("#teamSpaceSeasons").getByRole("button",{name:"Importieren"}).click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  const localId=await page.locator("#seasonLibrarySelect").inputValue();
  expect(localId).toMatch(/^library-/);
  const link=await readStore(page,"seasons","teamspace-season-link-"+SPACE+"-"+SEASON);
  expect(link.localSeasonId).toBe(localId);
  cloud.revision=2;
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseTeamSpace").click();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Update verfügbar");
  await page.locator("#teamSpaceSeasons").getByRole("button",{name:"Aktualisieren"}).click();
  await expect(page.locator("#seasonRefreshDialog")).toBeVisible();
  await page.locator("#seasonRefreshConfirm").click();
  await expect(page.locator("#seasonRefreshDialog")).toBeHidden();
  const updated=await readStore(page,"seasons",localId);
  expect(updated.games).toHaveLength(1);
  expect(updated.games[0].data.events[0].scoreH).toBe(2);
  const mapped=await readStore(page,"seasons","teamspace-season-link-"+SPACE+"-"+SEASON);
  expect(mapped.revision).toBe(2);
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseTeamSpace").click();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Aktuell");
  expect(cloud.calls.filter(call=>call.method==="POST")).toHaveLength(0);
});
test("single game imports independently, preserves private note after update and survives reload",async({page})=>{
  const cloud=await mockSpace(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#teamSpaceGames .home-list-row")).toHaveCount(1);
  await page.locator("#teamSpaceGames").getByRole("button",{name:"Importieren"}).click();
  const key="teamspace-localgame-"+SPACE+"-"+GAME;
  await expect.poll(async()=>await readStore(page,"games",key)).not.toBeNull();
  const record=await readStore(page,"games",key);
  expect(JSON.parse(record.text).events).toHaveLength(1);
  await page.evaluate(async({key})=>{
    const req=indexedDB.open("handball-spielanalyse",3);
    const db=await new Promise((resolve,reject)=>{
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction("games","readwrite");
        const store=tx.objectStore("games"),get=store.get(key);
        get.onsuccess=()=>{
          const r=get.result,data=JSON.parse(r.text);
          data.events[0].videoAnnotation.comment="Mein privater Kommentar";
          r.text=JSON.stringify(data);store.put(r);
        };
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
    }finally{db.close()}
  },{key});
  await page.reload();
  await page.locator("#homeChooseTeamSpace").click();
  await expect(page.locator("#teamSpaceGames")).toContainText("Aktuell");
  cloud.revision=2;
  await page.locator("#teamSpaceRefresh").click();
  await expect(page.locator("#teamSpaceGames")).toContainText("Update verfügbar");
  await page.locator("#teamSpaceGames").getByRole("button",{name:"Aktualisieren"}).click();
  await expect.poll(async()=>{
    const data=await readStore(page,"games",key);
    return JSON.parse(data.text).events[0].scoreH;
  }).toBe(2);
  const merged=await readStore(page,"games",key);
  expect(JSON.parse(merged.text).events[0].videoAnnotation.comment).toBe("Mein privater Kommentar");
  expect(merged.source.events[0].videoAnnotation.comment).toBe("");
  await page.locator("#homeBack").click();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList")).toContainText("Kronshagen gegen Gegner");
  expect(cloud.calls.filter(call=>call.method==="POST")).toHaveLength(0);
});
test("trainer can publish a season without exposing the admin token in the invite",async({page})=>{
  const cloud=await mockSpace(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("season.json",archive()));
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#teamSpaceConnect summary").click();
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await expect(page.locator("#teamSpaceNewTrainerToken")).toHaveValue(PERSONAL);
  await expect(page.locator("#teamSpaceAdminToken")).toHaveValue(PERSONAL);
  await expect(page.locator("#teamSpaceRegistrationToken")).toHaveValue("");
  const stored=await readStore(page,"seasons","teamspace-link-"+SPACE);
  expect(stored.connection).not.toHaveProperty("trainerToken");
  expect(JSON.stringify(stored)).not.toContain(PERSONAL);
  await expect(page.locator("#teamSpaceInviteLink")).toHaveValue(/#teamspace=/);
  const invite=await page.locator("#teamSpaceInviteLink").inputValue();
  expect(invite).not.toContain(ADMIN);
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();
  expect(cloud.lastPublish.archive.version).toBe(1);
  expect(cloud.lastPublish.archive.games).toHaveLength(1);
  expect(cloud.calls.filter(call=>call.path.endsWith("/publish-season"))[0].auth)
    .toBe("Bearer "+PERSONAL);
});
