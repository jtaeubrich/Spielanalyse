import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
const upload=(filename,content)=>({
  name:filename,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(content))
});
const game=(name,events,day="2026-11-08")=>{
  const g=structuredClone(fixture);
  g.gameName=name;g.gameDate=day;
  g.home.name="TSV Kronshagen";g.away.name="Gegner";
  g.ownTeam="home";
  g.isHistorical=false;g.isVideoscoutingFile=true;
  g.events=structuredClone(events);
  return g;
};
const originalEvent={id:100,type:"goal",team:"home",time:123,scoreH:1,scoreA:0,
  comment:"Trainer-Hinweis alt",note:"Alte Bewertung",realTime:140000,z:"RL-6m",gz:"UL",videoAnnotation:{shapes:[],comment:""}};
const archive=(games,date)=>({
  format:"handball-spielanalyse-season",version:1,
  name:"TSV Kronshagen · Saison 2026/27",
  preferredTeam:"TSV Kronshagen",createdAt:date,
  games:games.map(([id,details])=>({id,fileName:id+".json",selected:true,data:details}))
});
const first=archive([["sg-test-1",game("Spiel 1",[originalEvent])]],"2026-11-08T19:00:00Z");
const updated=archive([
  ["sg-test-1",game("Spiel 1",[{...originalEvent,scoreH:2,comment:"Trainer korrigiert",note:"Neue Bewertung"},{
    id:200,type:"2min",team:"away",time:180,realTime:200000
  }])],
  ["sg-test-2",game("Spiel 2",[{id:300,type:"goal",team:"home",time:80,scoreH:1,scoreA:0}],
    "2026-11-09")]
],"2026-11-11T20:00:00Z");

async function openSeason(page){
  await page.goto("/");
  await page.locator("#seasonImportInput").setInputFiles(upload("Kronshagen_alt.json",first));
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
}
async function readStore(page,id){
  return page.evaluate(async key=>{
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open("handball-spielanalyse",3);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
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
async function downloadSeason(page,id){
  await page.locator('[data-tab="setup"]').click();
  if(await page.locator("#setupExportPanel #seasonExportDownload").isVisible()){
    const [item]=await Promise.all([page.waitForEvent("download"),
      page.locator("#seasonExportDownload").click()]);
    return JSON.parse(await readFile(await item.path(),"utf8"));
  }
  const [item]=await Promise.all([page.waitForEvent("download"),
    page.locator("#seasonExport").click()]);
  return JSON.parse(await readFile(await item.path(),"utf8"));
}

test("season refresh preserves personal comment/marking, adds official updates, and publishes no private data",async({page})=>{
  await openSeason(page);
  await expect(page.locator("#homeSeasonRefresh")).toBeVisible();
  // Save personal annotations through the existing Video editor, so they
  // exercise exactly the same local-session path as a player on a phone.
  await page.locator("#homeSeasonGames .home-list-row").first()
    .getByRole("button",{name:"Fortsetzen",exact:true}).click();
  await page.locator('[data-tab="video"]').click();
  await page.locator("#videoPlaylist .clip").first().click();
  // The Video tab's own event-comment control is always reachable on phones.
  await page.locator("#videoTabEventComment").fill("Mein persönlicher Video-Kommentar");
  const before=await page.evaluate(()=>
    JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events[0]);
  expect(before.videoAnnotation.comment).toBe("Mein persönlicher Video-Kommentar");

  // Refresh button is also reachable without using advanced season controls.
  await page.locator("#seasonRefreshInput").setInputFiles(upload("Kronshagen_neu.json",updated));
  await expect(page.locator("#seasonRefreshDialog")).toBeVisible();
  await expect(page.locator("#seasonRefreshIdentity")).toContainText("Kronshagen");
  await expect(page.locator("#seasonRefreshPreview")).toContainText("Neue Spiele");
  await expect(page.locator("#seasonRefreshPreview")).toContainText("1");
  // Preview is strictly read-only.
  const currentSeasonId=await page.locator("#seasonLibrarySelect").inputValue();
  expect((await readStore(page,currentSeasonId)).games).toHaveLength(1);

  await page.locator("#seasonRefreshConfirm").click();
  await expect(page.locator("#seasonRefreshDialog")).toBeHidden();
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  const stored=await readStore(page,currentSeasonId);
  const event=stored.games.find(g=>g.id==="sg-test-1").data.events.find(e=>e.id===100);
  expect(event.scoreH).toBe(2);
  expect(event.comment).toBe("Trainer korrigiert");
  expect(event.note).toBe("Neue Bewertung");
  expect(event.videoAnnotation.comment).toBe("Mein persönlicher Video-Kommentar");
  expect(stored.games.find(g=>g.id==="sg-test-1").data.events.map(e=>e.id)).toContain(200);
  expect(stored.games.find(g=>g.id==="sg-test-2")).toBeDefined();

  const originalBackup=await readStore(page,"backup-"+currentSeasonId);
  expect(originalBackup.games).toHaveLength(1);
  const source=await readStore(page,"source-"+currentSeasonId);
  expect(source.source.games).toHaveLength(2);
  expect(source.source.games[0].state.events[0].videoAnnotation.comment).toBe("");

  const published=await downloadSeason(page);
  expect(published.version).toBe(1);
  expect(published.format).toBe("handball-spielanalyse-season");
  expect(published.games).toHaveLength(2);
  expect(published.games[0].data.events[0].scoreH).toBe(2);
  expect(published.games[0].data.events[0].comment).toBe("Trainer korrigiert");
  expect(published.games[0].data.events[0].videoAnnotation.comment).toBe("");

  await expect(page.locator("#seasonPersonalBackup")).toBeVisible();
  const [privateFile]=await Promise.all([page.waitForEvent("download"),
    page.locator("#seasonPersonalBackup").click()]);
  const privateArchive=JSON.parse(await readFile(await privateFile.path(),"utf8"));
  expect(privateArchive.games[0].data.events[0].videoAnnotation.comment)
    .toBe("Mein persönlicher Video-Kommentar");

  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#seasonPersonalBackup")).toBeVisible();
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  expect((await readStore(page,currentSeasonId)).games.find(g=>g.id==="sg-test-1")
    .data.events[0].videoAnnotation.comment).toBe("Mein persönlicher Video-Kommentar");
});

test("season refresh rejects wrong season and does not create a second season",async({page})=>{
  await openSeason(page);
  const current=await page.locator("#seasonLibrarySelect").inputValue();
  const wrong=structuredClone(updated);
  wrong.name="Andere · Saison 2027/28";
  wrong.preferredTeam="Andere";
  await page.locator("#seasonRefreshInput").setInputFiles(upload("falsch.json",wrong));
  await expect(page.locator("#seasonRefreshDialog")).toBeHidden();
  await expect(page.locator("#seasonLibrarySelect option")).toHaveCount(1);
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  expect(await page.locator("#seasonLibrarySelect").inputValue()).toBe(current);
});

test("canceling a preview never writes new season or source state",async({page})=>{
  await openSeason(page);
  const id=await page.locator("#seasonLibrarySelect").inputValue();
  await page.locator("#homeSeasonRefresh").click();
  await page.locator("#seasonRefreshInput").setInputFiles(upload("aktuell.json",updated));
  await expect(page.locator("#seasonRefreshDialog")).toBeVisible();
  await page.locator("#seasonRefreshCancel").click();
  await expect(page.locator("#seasonRefreshDialog")).toBeHidden();
  expect((await readStore(page,id)).games).toHaveLength(1);
  expect(await readStore(page,"source-"+id)).toBeNull();
});
