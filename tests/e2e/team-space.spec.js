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
  const cloud={revision:1,calls:[],lastPublish:null,failUpload:false,hidePublished:false};
  await page.route(API+"/**",async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    cloud.calls.push({path:url.pathname,method,auth:request.headers().authorization});
    const headers={"Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Authorization,Content-Type",
      "Access-Control-Expose-Headers":"X-Item-Revision,X-Content-Sha256"};
    if(method==="OPTIONS")return route.fulfill({status:204,headers});
    if(url.pathname==="/spaces/v2"&&method==="POST")
      return route.fulfill({status:201,headers,
        body:JSON.stringify({spaceId:SPACE,name:"TSV Kronshagen",
          readToken:READER,trainerToken:PERSONAL,revision:0})});
    const isWrite=method==="POST";
    if(request.headers().authorization!=="Bearer "+(isWrite?PERSONAL:READER))
      return route.fulfill({status:401,headers,
        body:JSON.stringify({error:{message:"Unauthorized"}})});
    const data=apiData(cloud.revision);
    if(url.pathname.endsWith("/verify-trainer")&&isWrite)
      return route.fulfill({status:200,headers,
        body:JSON.stringify({spaceId:SPACE,trainerAccess:"individual"})});
    if(url.pathname.endsWith("/catalog")){
      if(cloud.hidePublished&&cloud.lastPublish){
        data.catalog.seasons=[];data.catalog.games=[];
      }
      return route.fulfill({status:200,headers,body:JSON.stringify(data.catalog)});
    }
    if(url.pathname.endsWith("/publish-season")&&isWrite){
      if(cloud.failUpload)return route.fulfill({status:403,headers,
        body:JSON.stringify({error:{code:"NOT_AUTHORIZED",
          message:"Keine Veröffentlichungsberechtigung"}})});
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
async function loadConnectedTeamSpace(page){
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList .home-list-row")
    .getByRole("button",{name:"Laden"}).click();
}
async function startTeamSpaceConnection(page){
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#homeNew").click();
}
async function openLegacyTeamSpaceTools(page){
  await startTeamSpaceConnection(page);
  await page.locator("#teamSpaceTrainerEntry").click();
  await page.locator("#teamSpaceLegacyEntry").click();
  await expect(page.locator("#teamSpaceConnect")).toHaveAttribute("open","");
}
async function unlockExistingTrainerSpace(page){
  // A previous local trainer role is not a login after a fresh PWA launch.
  await page.locator("#homeBack").click();
  await page.locator("#homeBack").click();
  await page.locator("#homeNew").click();
  await page.locator("#teamSpaceTrainerEntry").click();
  await page.locator("#teamSpaceLegacyEntry").click();
  await page.locator("#teamSpaceAdminToken").fill(PERSONAL);
  await page.locator("#teamSpaceLegacyVerify").click();
  await expect(page.locator("#teamSpaceTrainerDetails")).toBeVisible();
  await page.locator("#homeBack").click();
  await page.locator("#homeBack").click();
  await loadConnectedTeamSpace(page);
  await page.locator("#teamSpaceTrainerTools > summary").click();
  await expect(page.locator("#teamSpaceAuditPanel")).toBeVisible();
}
test("Home offers Team Space with separate connect and load actions",async({page})=>{
  await page.goto("/");
  await expect(page.locator("#homeChoose .home-big-choice")).toHaveCount(3);
  await page.locator("#homeChooseTeamSpace").click();
  await expect(page.locator("#homeActions")).toBeVisible();
  await expect(page.locator("#homeChoose")).toBeHidden();
  await expect(page.locator("#homeOpen")).toContainText("Team Space laden");
  await expect(page.locator("#homeNew")).toContainText("Team Space verbinden");
  await expect(page.locator("#homeImport")).toBeHidden();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibrary")).toBeVisible();
  await expect(page.locator("#homeLibraryList")).toContainText("Noch kein Team Space verbunden");
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeActions")).toBeVisible();
  await page.locator("#homeNew").click();
  await expect(page.locator("#teamSpaceJoinInput")).toBeVisible();
  await expect(page.locator("#teamSpaceTrainerTools")).toBeHidden();
  await expect(page.locator("#teamSpaceSelectedIdInfo")).toBeHidden();
  expect(await page.evaluate(()=>document.activeElement?.id)).not.toBe("teamSpaceJoinInput");
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeActions")).toBeVisible();
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
  await expect(page.locator("#homeChoose")).toBeVisible();
  await expect(page.locator("#homeTeamSpace")).toBeHidden();
  await expect(page.locator("#homeTeamSpaceJoined"))
    .toContainText("erfolgreich hinzugefügt");
  await expect(page.locator("#homeRecentOptions .home-list-row").filter({hasText:"TSV Kronshagen"}))
    .toContainText("Team Space verbunden");
  expect(await page.evaluate(()=>location.hash)).toBe("");
  // Joining an invite must not download or overwrite local games.
  expect(cloud.calls.filter(call=>call.path.includes("/download"))).toHaveLength(0);
  await page.locator("#homeRecentOptions .home-list-row").filter({hasText:"Team Space verbunden"})
    .getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpaceSeasons .home-list-row")).toHaveCount(1);
  await expect(page.locator("#teamSpaceGamesDetails")).not.toHaveAttribute("open","");
  await page.locator("#teamSpaceSeasons").getByRole("button",{name:"Saison laden"}).click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  const localId=await page.locator("#seasonLibrarySelect").inputValue();
  expect(localId).toMatch(/^library-/);
  const link=await readStore(page,"seasons","teamspace-season-link-"+SPACE+"-"+SEASON);
  expect(link.localSeasonId).toBe(localId);
  cloud.revision=2;
  await page.locator('[data-tab="home"]').click();
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Cloud-Version neuer");
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
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Aktuell");
  expect(cloud.calls.filter(call=>call.method==="POST")).toHaveLength(0);
});
test("Connected Team Space reappears in quick entry after a new app launch",async({page})=>{
  const cloud=await mockSpace(page);
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  const stored=await readStore(page,"seasons","teamspace-link-"+SPACE);
  expect(stored.connection.spaceId).toBe(SPACE);
  expect(stored.connection.role).toBe("reader");
  expect(stored.connection).not.toHaveProperty("trainerToken");
  const downloads=cloud.calls.filter(call=>call.path.endsWith("/download"));
  expect(downloads).toHaveLength(0);
  await page.reload();
  await expect(page.locator("#homeChoose")).toBeVisible();
  await expect(page.locator("#homeTeamSpaceJoined")).toBeHidden();
  const row=page.locator("#homeRecentOptions .home-list-row").filter({
    hasText:"Team Space verbunden"
  });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("TSV Kronshagen");
  await row.getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#homeTeamSpace")).toBeVisible();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Saison 2026/27");
  await expect(page.locator("#teamSpaceSeasons")).toContainText("1 Spiel");
  await expect(page.locator("#teamSpaceGamesDetails")).not.toHaveAttribute("open","");
  expect(cloud.calls.filter(call=>call.path.endsWith("/download"))).toHaveLength(0);
});
test("Team Space laden lists connected spaces and back returns to the list",async({page})=>{
  await mockSpace(page);
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList .home-list-row")).toHaveCount(1);
  await expect(page.locator("#homeLibraryList")).toContainText("TSV Kronshagen");
  await expect(page.locator("#homeLibraryList")).not.toContainText("ID …");
  await page.locator("#homeLibraryList .home-list-row")
    .getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#homeTeamSpace")).toBeVisible();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Saison 2026/27");
  await expect(page.locator("#teamSpaceTitle")).toHaveText("TSV Kronshagen");
  await expect(page.locator("#teamSpaceTrainerTools")).toBeHidden();
  await expect(page.locator("#teamSpaceStatus")).toBeHidden();
  await expect(page.locator("#teamSpaceSelectedIdInfo")).toBeHidden();
  await expect(page.locator("#teamSpacePlayerSummary")).toContainText("1 Saison · 1 Spiel");
  await expect(page.locator("#teamSpacePlayerStatus")).toContainText("Keine neueren Cloud-Versionen");
  await expect(page.locator("#teamSpaceSeasons")).not.toContainText("Version ");
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeLibrary")).toBeVisible();
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeActions")).toBeVisible();
});
test("Invite can be pasted from clipboard and connected without leaving the app",async({page})=>{
  await mockSpace(page);
  const invite="http://127.0.0.1:4173/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API);
  await page.addInitScript(value=>{
    Object.defineProperty(navigator,"clipboard",{
      configurable:true,value:{readText:()=>Promise.resolve(value)}
    });
  },invite);
  await page.goto("/");
  await startTeamSpaceConnection(page);
  await page.locator("#teamSpacePasteInvite").click();
  await expect(page.locator("#teamSpaceJoinInput")).toHaveValue(invite);
  await page.locator("#teamSpaceJoin").click();
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  await expect(page.locator("#homeChoose")).toBeVisible();
});
test("single game imports independently, preserves private note after update and survives reload",async({page})=>{
  const cloud=await mockSpace(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeChoose")).toBeVisible();
  await page.locator("#homeRecentOptions .home-list-row").filter({hasText:"Team Space verbunden"})
    .getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpaceGamesDetails")).not.toHaveAttribute("open","");
  await page.locator("#teamSpaceGamesDetails summary").click();
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
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpaceGames")).toContainText("Aktuell");
  cloud.revision=2;
  await page.locator("#teamSpaceRefresh").click();
  await expect(page.locator("#teamSpaceGames")).toContainText("Update verfügbar");
  await page.locator("#teamSpaceGamesDetails summary").click();
  await page.locator("#teamSpaceGames").getByRole("button",{name:"Aktualisieren"}).click();
  await expect.poll(async()=>{
    const data=await readStore(page,"games",key);
    return JSON.parse(data.text).events[0].scoreH;
  }).toBe(2);
  const merged=await readStore(page,"games",key);
  expect(JSON.parse(merged.text).events[0].videoAnnotation.comment).toBe("Mein privater Kommentar");
  expect(merged.source.events[0].videoAnnotation.comment).toBe("");
  await page.locator("#homeBack").click();
  await page.locator("#homeBack").click();
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
  await openLegacyTeamSpaceTools(page);
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
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Im Cloud-Katalog bestätigt: Saison");
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Cloud-Version 2");
  await expect(page.locator("#teamSpaceSelectedIdInfo")).toContainText(SPACE);
  // Reload must not erase a successful server receipt or its catalog proof.
  await page.reload();
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Im Cloud-Katalog bestätigt: Saison");
});


test("Trainer publishes shared commentary and drawings by default but excludes explicitly private items",async({page})=>{
  const cloud=await mockSpace(page);
  const season=archive();
  const event=season.games[0].data.events[0];
  event.note="Geheime taktische Anmerkung";
  event.comment="Nicht an Spieler weitergeben";
  event.highlight=true;
  event.videoAnnotation={comment:"Geheime Videoanalyse",
    shapes:[{tool:"arrow",points:[{x:0.1,y:0.1},{x:0.4,y:0.4}]},
      {tool:"circle",points:[{x:0.2,y:0.2},{x:0.3,y:0.3}],teamSpacePrivate:true}]};
  event.tags=["Deckung:3:2:1","Meine persönliche Bewertung"];
  event.teamSpacePrivate={note:true,comment:true,highlight:true,
    tags:["Meine persönliche Bewertung"]};
  season.games[0].data.events.push({id:"private-key",type:"keyMoment",
    team:"home",time:80,note:"Geheime Schlüsselszene",
    teamSpacePrivate:{moment:true}});
  season.games[0].data.events.push({id:"team-key",type:"keyMoment",
    team:"home",time:120,note:"Wichtige Freigabe für die Mannschaft"});
  season.games[0].data.videoFileName="private-video.mp4";
  const confirmations=[];
  page.on("dialog",dialog=>{
    confirmations.push(dialog.message());
    return dialog.accept();
  });
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("private.json",season));
  const localId=await page.locator("#seasonLibrarySelect").inputValue();
  await page.locator('[data-tab="home"]').click();
  await openLegacyTeamSpaceTools(page);
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();
  expect(confirmations.some(message=>message.includes("Standardmäßig wird alles freigegeben"))).toBe(true);
  expect(confirmations.some(message=>message.includes("Zeichnungen: 1"))).toBe(true);
  const publicGame=cloud.lastPublish.archive.games[0].data;
  expect(publicGame.events).toHaveLength(2);
  expect(publicGame.events[0]).toMatchObject({
    id:123,type:"goal",scoreH:1,tags:["Deckung:3:2:1"],
    videoAnnotation:{shapes:[{tool:"arrow"}]}
  });
  expect(publicGame.events[1]).toMatchObject({
    id:"team-key",type:"keyMoment",note:"Wichtige Freigabe für die Mannschaft"
  });
  expect(publicGame.events[0]).not.toHaveProperty("comment");
  expect(publicGame.events[0]).not.toHaveProperty("note");
  expect(publicGame.events[0]).not.toHaveProperty("highlight");
  expect(publicGame.events[0].videoAnnotation).not.toHaveProperty("comment");
  expect(publicGame).not.toHaveProperty("video");
  expect(publicGame).not.toHaveProperty("videoFileName");
  expect(JSON.stringify(publicGame)).not.toContain("Geheime");
  const stored=await readStore(page,"seasons",localId);
  const localGame=stored.games[0].data;
  expect(localGame.events.find(e=>e.id===123)?.note).toBe("Geheime taktische Anmerkung");
  expect(localGame.events.find(e=>e.id==="private-key")?.note).toBe("Geheime Schlüsselszene");
  await expect(page.locator("#teamSpaceAuditPanel")).toBeVisible();
});

test("Trainer sees unpublished scouting edits but not private note edits in Team Space and quick access",async({page})=>{
  const cloud=await mockSpace(page);
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("season.json",archive()));
  const localId=await page.locator("#seasonLibrarySelect").inputValue();
  await page.locator('[data-tab="home"]').click();
  await openLegacyTeamSpaceTools(page);
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();

  async function editLocal(field,value){
    await page.evaluate(async({localId,field,value})=>{
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open("handball-spielanalyse",3);
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      try{
        await new Promise((resolve,reject)=>{
          const transaction=db.transaction("seasons","readwrite");
          const store=transaction.objectStore("seasons");
          for(const id of [localId,"current"]){
            const req=store.get(id);
            req.onsuccess=()=>{
              const record=req.result;
              if(!record?.games?.length)return;
              const event=record.games[0].data?.events?.[0]||
                record.games[0].state?.events?.[0];
              if(event){
                event[field]=value;
                if(field==="note")event.teamSpacePrivate={...(event.teamSpacePrivate||{}),note:true};
                store.put(record);
              }
            };
          }
          transaction.oncomplete=resolve;
          transaction.onerror=()=>reject(transaction.error);
        });
      }finally{db.close()}
    },{localId,field,value});
  }

  await editLocal("note","Meine private Beobachtung");
  await page.reload();
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpaceAuditPanel")).toBeHidden();
  await unlockExistingTrainerSpace(page);
  await expect(page.locator("#teamSpaceAuditStatus")).toContainText("0 lokal geändert");
  await expect(page.locator("#teamSpaceAuditStatus")).toContainText("1 identisch");
  await editLocal("scoreH",5);
  await page.reload();
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpaceAuditPanel")).toBeHidden();
  await unlockExistingTrainerSpace(page);
  await expect(page.locator("#teamSpaceAuditStatus")).toContainText("1 lokal geändert");
  await page.locator("#teamSpaceAuditDetails summary").click();
  await expect(page.locator("#teamSpaceAuditRows")).toContainText("Lokal geändert");
  await expect(page.locator("#teamSpaceAuditRows")).toContainText("1 korrigiert");
  await page.locator("#homeBack").click();
  await page.locator("#homeBack").click();
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeChoose")).toBeVisible();
  await expect(page.locator("#homeRecentOptions")).toContainText("1 lokal geändert");
});
test("Server publication failure remains visible with the selected Team Space",async({page})=>{
  const cloud=await mockSpace(page);
  cloud.failUpload=true;
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("season.json",archive()));
  await page.locator('[data-tab="home"]').click();
  await openLegacyTeamSpaceTools(page);
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Veröffentlichung nicht bestätigt");
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Keine Veröffentlichungsberechtigung");
  await page.locator("#teamSpaceVerifyPublish").click();
  await expect(page.locator("#teamSpaceStatus")).toContainText("1 Saisons");
  expect(cloud.lastPublish).toBeNull();
});

test("A server accepted upload absent from the selected catalog is flagged, not falsely verified",async({page})=>{
  const cloud=await mockSpace(page);
  cloud.hidePublished=true;
  page.on("dialog",dialog=>dialog.accept());
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("season.json",archive()));
  await page.locator('[data-tab="home"]').click();
  await openLegacyTeamSpaceTools(page);
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("nicht nachweisbar");
  await expect(page.locator("#teamSpaceStatus"))
    .toContainText("0 Saisons · 0 Spiele");
  await page.reload();
  await loadConnectedTeamSpace(page);
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("nicht nachweisbar");
});


test("Single-game upload identifies the selected Team Space and online season, and confirms catalog proof",async({page})=>{
  const cloud=await mockSpace(page);
  let confirmation="";
  page.on("dialog",dialog=>{
    if(dialog.message().includes("Online-Saison:"))confirmation=dialog.message();
    return dialog.accept();
  });
  await page.goto("/");
  await page.locator("#continueGameInput").setInputFiles(upload("spiel.json",game()));
  await expect(page.locator("#matchTab")).toBeVisible();
  await page.locator('[data-tab="home"]').click();
  await openLegacyTeamSpaceTools(page);
  await page.locator("#teamSpaceApi").fill(API);
  await page.locator("#teamSpaceName").fill("TSV Kronshagen");
  await page.locator("#teamSpaceRegistrationToken").fill(ADMIN);
  await page.locator("#teamSpaceCreate").click();
  await expect(page.locator("#teamSpaceSelect")).toHaveValue(SPACE);
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishGame").selectOption("current");
  await page.locator("#teamSpacePublishTargetSeason").selectOption(SEASON);
  await page.locator("#teamSpacePublishGameBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();
  expect(cloud.lastPublish.seasonId).toBe(SEASON);
  expect(confirmation).toContain("TSV Kronshagen");
  expect(confirmation).toContain("ID …"+SPACE.slice(-8));
  expect(confirmation).toContain("Online-Saison: Saison 2026/27");
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Im Cloud-Katalog bestätigt: Spiel");
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Cloud-Version 2");
});


test("Team Space game list shows oldest matches above newer matches",async({page})=>{
  await mockSpace(page);
  const games=[
    {id:"sg-newest",name:"20.03.2027 | THW KIEL II - TSV KRONSHAGEN",date:"2027-03-20"},
    {id:"sg-middle",name:"23.01.2027 | HTS/BW96 HANDBALL",date:"2027-01-23"},
    {id:"sg-oldest",name:"12.09.2026 | TSV KRONSHAGEN - GAST",date:"2026-09-12"}
  ].map(game=>({...game,revision:1,sha256:"a".repeat(64),
    seasonIds:[SEASON],matchId:""}));
  // Cloud catalog is intentionally newest-first, as in the screenshot.
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>route.fulfill({
    status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},
    body:JSON.stringify({
      spaceId:SPACE,name:"TSV Kronshagen",revision:3,updatedAt:"2026-11-15",
      trainerAccess:"individual",seasons:[{
        id:SEASON,name:"Saison 2026/27",revision:1,
        gameCount:3,gameIds:games.map(g=>g.id)
      }],games
    })
  }));
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  await page.locator("#homeRecentOptions .home-list-row").filter({hasText:"Team Space verbunden"})
    .getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpaceGamesDetails")).not.toHaveAttribute("open","");
  await page.locator("#teamSpaceGamesDetails summary").click();
  const rows=page.locator("#teamSpaceGames .home-list-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("12.09.2026");
  await expect(rows.nth(1)).toContainText("23.01.2027");
  await expect(rows.nth(2)).toContainText("20.03.2027");
  await expect(page.locator("#teamSpaceGamesSummary")).toContainText("(3)");
  await page.locator("#teamSpaceRefresh").click();
  await expect(rows.nth(0)).toContainText("12.09.2026");
  await expect(rows.nth(2)).toContainText("20.03.2027");
});


test("Team Space warns when a separately published game is not part of its cloud season",async({page})=>{
  await mockSpace(page);
  const extra={id:"sg-separate",name:"15.11.2026 | SG HAMBURG-NORD - TSV KRONSHAGEN",
    date:"2026-11-15",revision:1,sha256:"a".repeat(64),matchId:"",
    seasonIds:[]};
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>route.fulfill({
    status:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},
    body:JSON.stringify({
      ...apiData(1).catalog,
      games:[apiData(1).catalog.games[0],extra]
    })
  }));
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  await page.locator("#homeRecentOptions .home-list-row").filter({hasText:"Team Space verbunden"})
    .getByRole("button",{name:"Laden"}).click();
  const status=page.locator("#teamSpacePlayerStatus");
  await expect(status).toContainText("1 Einzelspiel ist keiner Online-Saison zugeordnet");
  await expect(status).toContainText("2026-11-15");
  await expect(status).not.toContainText("Alle Inhalte aktuell.");
  await expect(page.locator("#teamSpaceSeasons")).toContainText("1 Spiel");
  await expect(page.locator("#teamSpaceGamesSummary")).toContainText("(2)");
  await page.locator("#teamSpaceRefresh").click();
  await expect(status).toContainText("1 Einzelspiel ist keiner Online-Saison zugeordnet");
});

test("separate published game does not masquerade as a fully synced season",async({page})=>{
  await mockSpace(page);
  const base=apiData(1).catalog;
  base.games.push({id:"sg-unassigned",name:"15.11.2026 | TSV KRONSHAGEN – SG HAMBURG",
    date:"2026-11-15",revision:1,sha256:"b".repeat(64),
    matchId:"",seasonIds:[]});
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(base),
    headers:{"Access-Control-Allow-Origin":"*"}
  }));
  await page.goto("/#teamspace="+encodeURIComponent(SPACE)+
    "&key="+encodeURIComponent(READER)+"&api="+encodeURIComponent(API));
  await expect(page.locator("#homeTeamSpaceJoined")).toContainText("erfolgreich hinzugefügt");
  await page.locator("#homeRecentOptions .home-list-row").filter({
    hasText:"Team Space verbunden"
  }).getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpacePlayerSummary")).toContainText("2 Spiele");
  await expect(page.locator("#teamSpacePlayerStatus"))
    .toContainText("1 Einzelspiel ist keiner Online-Saison zugeordnet (2026-11-15)");
  await expect(page.locator("#teamSpacePlayerStatus"))
    .toContainText("Lokale Ereignisse werden nicht automatisch zwischen Geräten abgeglichen");
  await expect(page.locator("#teamSpacePlayerStatus")).not.toContainText("Alle Inhalte aktuell");
  await page.locator("#teamSpaceRefresh").click();
  await expect(page.locator("#teamSpacePlayerStatus"))
    .toContainText("1 Einzelspiel ist keiner Online-Saison zugeordnet");
  await page.locator("#teamSpaceGamesDetails summary").click();
  await expect(page.locator("#teamSpaceGames")).toContainText("15.11.2026");
  await expect(page.locator("#teamSpaceSeasons")).toContainText("1 Spiel");
});
