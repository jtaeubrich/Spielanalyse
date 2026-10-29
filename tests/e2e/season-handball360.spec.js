import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHandball360SeasonGame } from "../../src/season-handball360.js";
import { seasonMatchFolder } from "../../src/season-archive.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const original = JSON.parse(await readFile(path.resolve(here,"../fixtures/handball360_378107.json"),"utf8"));
const teamId = "85814";
function payload(matchId, iso) {
  const raw = structuredClone(original);
  raw.match_id = matchId;
  raw.match.data[0].id = matchId;
  raw.match.data[0].date = iso;
  raw.match.data[0].local.id = 200;
  raw.match.data[0].visitor.id = Number(teamId);
  return raw;
}
const games = [
  payload("378107","2026-09-05T16:00:00Z"),
  payload("378112","2026-09-12T16:00:00Z"),
  payload("378122","2026-11-15T16:00:00Z")
];
const schedule = {
  teamId, dateFrom:"2026-07-01",dateTo:"2027-06-30",total:3,
  matches:games.map(x=>({
    id:String(x.match_id),date:x.match.data[0].date,status:"scheduled",
    local:{id:"200",name:x.match.data[0].local.name},
    visitor:{id:teamId,name:x.match.data[0].visitor.name},
    phase:{competition:{name:"Testliga"}}
  }))
};
function upload(name,data) {
  return { name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data)) };
}
async function openSeasonAdmin(page){
  await page.locator('[data-tab="setup"]').click();
  if(await page.locator("#setupModeSeason").isVisible())
    await page.locator("#setupModeSeason").click();
  else {
    await page.locator('[data-tab="home"]').click();
    await page.locator("#homeChooseSeason").click();
    await page.locator("#homeOpen").click();
    await page.locator("#homeAdvanced").click();
  }
  await expect(page.locator("#seasonName")).toBeVisible();
}
test.beforeEach(async({page})=>{
  await page.addInitScript(() => localStorage.setItem("handballSpielanalyse.proxyToken", "playwright-fake-proxy-token"));
  await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**",async route=>{
    const request = route.request();
    const cors={"access-control-allow-origin":"*","access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"Authorization"};
    if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:cors});
    const url=new URL(request.url());
    if(url.pathname.endsWith("/team/85814/matches"))
      return route.fulfill({status:200,headers:cors,contentType:"application/json",body:JSON.stringify(schedule)});
    const id=/\/match\/(\d+)$/.exec(url.pathname)?.[1];
    const raw=games.find(x=>String(x.match_id)===id);
    if(raw)return route.fulfill({status:200,headers:cors,contentType:"application/json",body:JSON.stringify(raw)});
    return route.fulfill({status:404,headers:cors,contentType:"application/json",body:'{"error":{"message":"Not found"}}'});
  });
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
});

async function preview(page) {
  await page.locator("#seasonHandball360Open").click();
  await page.locator("#seasonH360Team").fill("https://www.handball.net/team/85814");
  await page.locator("#seasonH360Preview").click();
  await expect(page.locator("#seasonH360Status")).toContainText("3 Spiele gefunden");
  await expect(page.locator("#seasonH360List input[data-match-id]")).toHaveCount(3);
}

test("imports past season games once and leaves future fixtures unchecked", async ({page})=>{
  await preview(page);
  await expect(page.locator('input[data-match-id="378107"]')).toBeChecked();
  await expect(page.locator('input[data-match-id="378112"]')).toBeChecked();
  await expect(page.locator('input[data-match-id="378122"]')).not.toBeChecked();
  await page.locator("#seasonH360Import").click();
  await expect(page.locator("#seasonH360Status")).toContainText("2 neu importiert");
  await page.locator("#seasonH360Close").click();
  await expect(page.locator("#seasonGameList .season-game-item")).toHaveCount(2);
  await expect(page.locator("#seasonPreferredTeam")).toHaveValue("MEIN TEAM");
  await page.locator("#seasonHandball360Open").click();
  await expect(page.locator('input[data-match-id="378107"]')).toBeDisabled();
  await expect(page.locator('input[data-match-id="378112"]')).toBeDisabled();
  await page.locator('input[data-match-id="378122"]').check();
  await page.locator("#seasonH360Import").click();
  await expect(page.locator("#seasonH360Status")).toContainText("1 neu importiert");
  await page.locator("#seasonH360Close").click();
  await expect(page.locator("#seasonGameList .season-game-item")).toHaveCount(3);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const exported=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(exported.games).toHaveLength(3);
  const future=exported.games.find(x=>x.data.officialSource.matchId==="378122");
  expect(future.selected).toBe(false);
  expect(future.data.shotCapture.attackerOrder).toBe("last");
});

test("season import saves both official club logos for matchday without modifying rosters",async({page})=>{
  const official=structuredClone(games[0]);
  official.match.data[0].local.club={
    id:"club-home",
    logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/square_home.jpg"
  };
  official.match.data[0].visitor.club={
    id:"club-away",
    logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/square_away.jpg"
  };
  const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a2iwAAAAASUVORK5CYII=","base64");
  let requested=0;
  await page.route(/\/logo\?url=/,route=>{
    requested++;
    return route.fulfill({status:200,contentType:"image/png",body:tinyPng});
  });
  await page.route("**/match/378107",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(official)
  }));
  await preview(page);
  await page.locator('input[data-match-id="378112"]').uncheck();
  await page.locator("#seasonH360Import").click();
  await expect(page.locator("#seasonH360Status")).toContainText("1 neu importiert");
  await expect(page.locator("#seasonH360Status")).toContainText("2 Vereinslogos übernommen");
  expect(requested).toBe(2);
  const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("handball-spielanalyse",3);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction("rosters","readonly");
      const get=tx.objectStore("rosters").getAll();
      get.onerror=()=>reject(get.error);
      get.onsuccess=()=>{db.close();resolve(get.result)};
    };
  }));
  expect(stored).toHaveLength(2);
  expect(stored.every(record=>record.logoDataUrl.startsWith("data:image/png;base64,"))).toBe(true);
  expect(stored.map(record=>record.handball360ClubId).sort()).toEqual(["club-away","club-home"]);
  expect(stored.every(record=>record.players.length===0)).toBe(true);
});


test("season-wide sync updates postponed fixtures and fills missing logos without touching scouting",async({page})=>{
  const archived=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  archived.state.events[0].comment="Meine Videoanalyse bleibt";
  archived.state.video.youtubeUrl="https://www.youtube.com/watch?v=owned";
  archived.state.home.players=[{id:"local-goalie",nr:1,vorname:"Theo",nachname:"Test",isTW:true,isTWOverride:true}];
  await page.locator("#seasonGameInput").setInputFiles(upload("tracked.json",archived.state));
  await preview(page);
  await expect(page.locator("#seasonH360Sync")).toBeEnabled();
  const rescheduled={...schedule,matches:schedule.matches.map(item=>item.id==="378107"
    ?{...item,date:"2026-11-07T15:00:00Z"}:item)};
  const official=payload("378107","2026-11-07T15:00:00Z");
  official.match.data[0].local.club={
    id:"home-club",logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/club1.jpg"
  };
  official.match.data[0].visitor.club={
    id:"away-club",logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/club2.jpg"
  };
  const tinyPng=Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a2iwAAAAASUVORK5CYII=",
    "base64");
  await page.route("**/team/85814/matches*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(rescheduled)
  }));
  await page.route("**/match/378107",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(official)
  }));
  await page.route(/\/logo\?url=/,route=>route.fulfill({status:200,contentType:"image/png",body:tinyPng}));
  await page.locator("#seasonH360Preview").click();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonH360Sync").click();
  await expect(page.locator("#seasonH360Status")).toContainText("1 Spiele geprüft");
  await expect(page.locator("#seasonH360Status")).toContainText("1 Terminänderungen");
  await expect(page.locator("#seasonH360Status")).toContainText("2 Vereinslogos geladen");
  await page.locator("#seasonH360Close").click();
  const [download]=await Promise.all([
    page.waitForEvent("download"),page.locator("#seasonExport").click()
  ]);
  const exported=JSON.parse(await readFile(await download.path(),"utf8"));
  const result=exported.games.find(item=>item.data.officialSource?.matchId==="378107");
  expect(result.data.gameDate).toBe("2026-11-07");
  expect(result.data.gameTimeOfDay).toBe("16:00");
  expect(result.data.officialSource.matchDate).toBe("2026-11-07T15:00:00Z");
  expect(result.data.events[0].comment).toBe("Meine Videoanalyse bleibt");
  expect(result.data.video.youtubeUrl).toContain("owned");
  expect(result.data.home.players[0].isTWOverride).toBe(true);
  expect(result.data.officialSource.clubLogos.home.logoUrl).toContain("club1.jpg");
  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  await expect(page.locator("#seasonGameList")).toContainText("HSG Herzhorn");
});

test("never replaces an existing manually enriched match",async({page})=>{
  const oldGame=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  oldGame.state.events[0].comment="Eigenes Scouting bleibt";
  oldGame.state.video.youtubeUrl="https://www.youtube.com/watch?v=example";
  await page.locator("#seasonGameInput").setInputFiles(upload("existing.json",oldGame.state));
  await expect(page.locator("#seasonGameList .season-game-item")).toHaveCount(1);
  await preview(page);
  await expect(page.locator('input[data-match-id="378107"]')).toBeDisabled();
  await expect(page.locator('input[data-match-id="378107"]')).not.toBeChecked();
  await page.locator("#seasonH360Import").click();
  await expect(page.locator("#seasonH360Status")).toContainText("1 neu importiert");
  await page.locator("#seasonH360Close").click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const exported=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(exported.games).toHaveLength(2);
  const originalGame=exported.games.find(x=>x.data.officialSource?.matchId==="378107");
  expect(originalGame.data.events[0].comment).toBe("Eigenes Scouting bleibt");
  expect(originalGame.data.video.youtubeUrl).toContain("example");
});


test("links manually scouted matches, refreshes safely and exports stable team/match ZIP",async({page})=>{
  const oldGame=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  delete oldGame.state.officialSource;
  oldGame.state.events[0].comment="Mein eigenes Scouting";
  oldGame.state.video.youtubeUrl="https://www.youtube.com/watch?v=mine";
  await page.locator("#seasonGameInput").setInputFiles(upload("manuell.json",oldGame.state));
  await preview(page);
  const row=page.locator("#seasonH360List .season-h360-row").filter({
    has:page.locator('input[data-match-id="378107"]')
  });
  await expect(row).toContainText("Möglicherweise vorhanden");
  await expect(row.locator(".season-h360-associate select")).not.toHaveValue("");
  page.once("dialog",dialog=>dialog.accept());
  await row.locator(".season-h360-associate button").click();
  await expect(row.locator("[data-h360-refresh]")).toHaveCount(1);
  await row.locator("[data-h360-refresh]").click();
  await expect(page.locator("#seasonH360Status")).toContainText("aktualisiert");
  await page.locator('input[data-match-id="378112"]').uncheck();
  await page.locator('input[data-match-id="378122"]').check();
  await page.locator("#seasonH360Import").click();
  await expect(page.locator("#seasonH360Status")).toContainText("1 neu importiert");
  await page.locator("#seasonH360Close").click();
  await page.locator("#seasonArchiveTeam").fill("TSV Kronshagen mB");
  await page.locator("#seasonArchiveTeam").dispatchEvent("change");
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.locator("#seasonArchiveExport").click()
  ]);
  const bytes=await readFile(await download.path());
  const paths=[];
  let offset=0;
  while(offset+30<=bytes.length && bytes.readUInt32LE(offset)===0x04034b50){
    const size=bytes.readUInt32LE(offset+18);
    const nameLength=bytes.readUInt16LE(offset+26);
    const extraLength=bytes.readUInt16LE(offset+28);
    paths.push(bytes.subarray(offset+30,offset+30+nameLength).toString("utf8"));
    offset+=30+nameLength+extraLength+size;
  }
  const firstFolder=seasonMatchFolder({...oldGame,state:{...oldGame.state,officialSource:{matchId:"378107"}}});
  const future=buildHandball360SeasonGame(games[2],"378122",teamId,schedule.matches[2]);
  const futureFolder=seasonMatchFolder(future);
  expect(firstFolder).toContain("_vs_");
  expect(firstFolder).toContain("378107");
  expect(futureFolder).toContain("378122");
  expect(paths).toContain("TSV_Kronshagen_mB/"+firstFolder+"/spiel.json");
  expect(paths).toContain("TSV_Kronshagen_mB/"+futureFolder+"/spiel.json");
  expect(paths).toContain("TSV_Kronshagen_mB/"+firstFolder+"/videos/");
  expect(paths).not.toContain("TSV_Kronshagen_mB/2026-27/"+firstFolder+"/spiel.json");
  const [seasonDownload]=await Promise.all([
    page.waitForEvent("download"),page.locator("#seasonExport").click()
  ]);
  const season=JSON.parse(await readFile(await seasonDownload.path(),"utf8"));
  expect(season.archiveTeam).toBe("TSV Kronshagen mB");
  const manual=season.games.find(g=>g.data.officialSource?.matchId==="378107");
  expect(manual.fileName).toBe("manuell.json");
  expect(manual.data.events[0].comment).toBe("Mein eigenes Scouting");
  expect(manual.data.video.youtubeUrl).toContain("mine");
});


test("opens a future season game in Setup and saves edits to the same archived record",async({page})=>{
  const future=buildHandball360SeasonGame(games[2],"378122",teamId,schedule.matches[2]);
  future.state.events=[];
  future.state.isVideoscoutingFile=true; // Handball360 initially marks imported fixtures as video-scouting files
  await page.locator("#seasonGameInput").setInputFiles(upload("future.json",future.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  const picker=page.locator("#setupSeasonGameSelect");
  await expect(picker.locator("option")).toHaveCount(2);
  await picker.selectOption({index:1});
  await expect(page.locator("#setupSeasonContinue")).toBeEnabled();
  await page.locator("#setupSeasonContinue").click();
  await expect(page.locator('[data-tab="setup"]')).toHaveClass(/active/);
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator('[data-tab="match"]')).toHaveClass(/active/);
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupCompetition").fill("Kader im Training vorbereitet");
  await page.locator("#setupCompetition").dispatchEvent("change");
  await page.locator("#setupGameName").fill("Vorbereitetes Spiel - überarbeitet");
  await page.locator("#setupGameName").dispatchEvent("change");
  await page.locator("#saveBtn").click();
  await expect(page.locator("#setupSeasonGameStatus")).toContainText("Aktiv mit Saison verknüpft");

  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const archived=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(archived.games).toHaveLength(1);
  expect(archived.games[0].data.competition).toBe("Kader im Training vorbereitet");
  expect(archived.games[0].data.gameName).toBe("Vorbereitetes Spiel - überarbeitet");
  expect(archived.games[0].data.officialSource.matchId).toBe("378122");
  expect(archived.games[0].data.isVideoscoutingFile).toBe(false);
  const stableId=archived.games[0].id;

  await page.reload();
  await expect(page.locator("#setupSeasonGameStatus")).toContainText("Aktiv mit Saison verknüpft");
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [next]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const restored=JSON.parse(await readFile(await next.path(),"utf8"));
  expect(restored.games).toHaveLength(1);
  expect(restored.games[0].id).toBe(stableId);
  expect(restored.games[0].data.gameName).toBe("Vorbereitetes Spiel - überarbeitet");

  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#newGame").click();
  await page.locator("#newGameManual").click();
  await page.locator("#setupGameName").fill("Unabhängiges Spiel");
  await page.locator("#setupGameName").dispatchEvent("change");
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [last]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const unchanged=JSON.parse(await readFile(await last.path(),"utf8"));
  expect(unchanged.games[0].data.gameName).toBe("Vorbereitetes Spiel - überarbeitet");
});

test("opens an imported already-scouted match for video editing or analysis and retains custom events",async({page})=>{
  const scouted=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  scouted.state.events[0].comment="Mein manuelles Scouting";
  scouted.state.video.youtubeUrl="https://www.youtube.com/watch?v=custom";
  await page.locator("#seasonGameInput").setInputFiles(upload("scouting.json",scouted.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await expect(page.locator("#setupSeasonContinue")).toBeEnabled();
  await expect(page.locator("#setupSeasonAnalysis")).toBeEnabled();
  await page.locator("#setupSeasonContinue").click();
  await expect(page.locator('[data-tab="setup"]')).toHaveClass(/active/);
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator('[data-tab="match"]')).toHaveClass(/active/);
  await expect(page.locator("#modeSelect")).toHaveValue("video");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonAnalysis").click();
  await expect(page.locator('[data-tab="analysis"]')).toHaveClass(/active/);
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupCompetition").fill("Nachanalyse ergänzt");
  await page.locator("#setupCompetition").dispatchEvent("change");
  await page.locator("#saveBtn").click();
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const archived=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(archived.games).toHaveLength(1);
  expect(archived.games[0].data.events[0].comment).toBe("Mein manuelles Scouting");
  expect(archived.games[0].data.video.youtubeUrl).toContain("custom");
  expect(archived.games[0].data.officialSource.matchId).toBe("378107");
  expect(archived.games[0].data.competition).toBe("Nachanalyse ergänzt");
});


test("temporarily viewing a live-scouted season game does not disable later continuation",async({page})=>{
  const manual=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  manual.state.isHistorical=false;
  manual.state.isVideoscoutingFile=false;
  manual.state.events[0].comment="Eigene Live-Notiz";
  await page.locator("#seasonGameInput").setInputFiles(upload("live-scouting.json",manual.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await expect(page.locator("#setupSeasonContinue")).toBeEnabled();
  await page.locator("#setupSeasonAnalysis").click();
  await expect(page.locator('[data-tab="analysis"]')).toHaveClass(/active/);
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupSeasonContinue")).toBeEnabled();
  await page.locator("#setupSeasonContinue").click();
  await expect(page.locator('[data-tab="setup"]')).toHaveClass(/active/);
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator('[data-tab="match"]')).toHaveClass(/active/);
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const season=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(season.games[0].data.isHistorical).toBe(false);
  expect(season.games[0].data.events[0].comment).toBe("Eigene Live-Notiz");
});


test("season list keeps Handball360 roster sync distinct from nuLiga protocol reconciliation",async({page})=>{
  const archived=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  archived.state.events=[{type:"goal",team:archived.ownTeam,pId:"scouted",comment:"Keep this event"}];
  const official=payload("378107","2026-09-05T16:00:00Z");
  official.events=[];
  official.lineups={data:{
    local:{players:[{player:{id:21,first_name:"Mia",last_name:"Test"},number:18,is_goalkeeper:false}]},
    visitor:{players:[{player:{id:32,first_name:"Gina",last_name:"Gast"},number:1,is_goalkeeper:true}]}
  }};
  await page.route("**/match/378107",route=>route.fulfill({
    status:200,headers:{"access-control-allow-origin":"*"},
    contentType:"application/json",body:JSON.stringify(official)
  }));
  await page.locator("#seasonGameInput").setInputFiles(upload("archived-roster.json",archived.state));
  await expect(page.locator("#seasonGameList .season-game-item")).toHaveCount(1);
  await page.locator("#seasonGamesDetails > summary").click();
  const item=page.locator("#seasonGameList .season-game-item").first();
  await expect(item.getByRole("button",{name:"Handball360-Kader"})).toBeVisible();
  await expect(item.getByRole("button",{name:"nuLiga-Protokoll"})).toBeVisible();
  await expect(item.getByRole("button",{name:"JSON ersetzen"})).toBeVisible();
  await item.getByRole("button",{name:"Handball360-Kader"}).click();
  await expect(page.locator("#setupModeSingle")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#setupOfficialRosterDialog")).toBeVisible();
  await expect(page.locator("#setupOfficialRosterDialog")).toContainText("Handball360 Match 378107");
  await expect(page.locator("#seasonProtocolDialog")).not.toBeVisible();
  await page.locator("#setupOfficialRosterCancel").click();
  await openSeasonAdmin(page);
  await page.locator("#seasonGameList .season-game-item").first()
    .getByRole("button",{name:"nuLiga-Protokoll"}).click();
  await expect(page.locator("#seasonProtocolDialog")).toBeVisible();
  await expect(page.locator("#setupOfficialRosterDialog")).not.toBeVisible();
  await page.locator("#seasonProtocolClose").click();
});

test("pregame Setup lineup refresh previews and replaces only the active match roster",async({page})=>{
  const future=buildHandball360SeasonGame(games[2],"378122",teamId,schedule.matches[2]);
  future.state.events=[];
  future.state.home.players=[
    {id:"local-21",handballNetId:"21",nr:7,vorname:"Mia",nachname:"Test",isTW:false},
    {id:"local-old",handballNetId:"24",nr:9,vorname:"Nicht",nachname:"Gemeldet",isTW:false}
  ];
  future.state.away.players=[];
  future.state.video.youtubeUrl="https://youtu.be/roster-test";
  const official=payload("378122","2026-11-15T16:00:00Z");
  official.events=[];
  official.lineups={data:{
    local:{players:[
      {player:{id:21,first_name:"Mia",last_name:"Test"},number:18,is_goalkeeper:false},
      {player:{id:23,first_name:"Neuer",last_name:"Spieler"},number:3,is_goalkeeper:false}
    ]},
    visitor:{players:[
      {player:{id:32,first_name:"Gina",last_name:"Gast"},number:1,is_goalkeeper:true}
    ]}
  }};
  await page.route("**/match/378122", route=>route.fulfill({
    status:200,
    headers:{"access-control-allow-origin":"*"},
    contentType:"application/json",body:JSON.stringify(official)
  }));
  await page.locator("#seasonGameInput").setInputFiles(upload("future.json",future.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await expect(page.locator("#setupSeasonRosterRefresh")).toBeEnabled();
  await page.locator("#setupSeasonContinue").click();
  await page.locator('[data-tab="setup"]').click();

  await page.locator("#setupSeasonRosterRefresh").click();
  const dialog=page.locator("#setupOfficialRosterDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2 von 2 Spielkadern verfügbar");
  await expect(dialog).toContainText("Nicht Gemeldet");
  await expect(dialog).toContainText("Nr. 7 → 18");
  await dialog.locator("#setupOfficialRosterCancel").click();
  await expect(page.locator("#setupSeasonRosterStatus")).toContainText("abgebrochen");

  await page.locator("#setupSeasonRosterRefresh").click();
  await expect(dialog).toBeVisible();
  await dialog.locator("#setupOfficialRosterConfirm").click();
  await expect(page.locator("#setupSeasonRosterStatus")).toContainText("Kader aktualisiert");
  await expect(page.locator("#setupSeasonGameStatus")).toContainText("Aktiv mit Saison verknüpft");
  await page.locator("#saveBtn").click();

  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const archive=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(archive.games).toHaveLength(1);
  const snapshot=archive.games[0].data;
  expect(snapshot.home.players).toHaveLength(2);
  expect(snapshot.home.players.map(p=>p.handballNetId).sort()).toEqual(["21","23"]);
  expect(snapshot.home.players.find(p=>p.handballNetId==="21")).toMatchObject({id:"local-21",nr:18});
  expect(snapshot.away.players).toHaveLength(1);
  expect(snapshot.events).toEqual([]);
  expect(snapshot.video.youtubeUrl).toContain("roster-test");
  expect(snapshot.lineupSync).toMatchObject({matchId:"378122",homeConfirmed:true,awayConfirmed:true});
  expect(snapshot.officialSource.matchId).toBe("378122");

  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonContinue").click();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupSeasonRosterRefresh").click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Keine Abweichungen");
  await dialog.locator("#setupOfficialRosterCancel").click();
});

test("pregame Setup roster refresh refuses missing Handball360 lineup without changing season",async({page})=>{
  const future=buildHandball360SeasonGame(games[2],"378122",teamId,schedule.matches[2]);
  future.state.events=[];
  future.state.home.players=[{id:"local-21",handballNetId:"21",nr:7,vorname:"Mia",nachname:"Test",isTW:false}];
  await page.locator("#seasonGameInput").setInputFiles(upload("future.json",future.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonRosterRefresh").click();
  await expect(page.locator("#setupSeasonRosterStatus")).toContainText("noch keine offizielle Aufstellung");
  await expect(page.locator("#setupOfficialRosterDialog")).not.toBeVisible();
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const archive=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(archive.games[0].data.home.players).toEqual(future.state.home.players);
});


test("historical Setup lineup reconciliation preserves scouted events, video and local player references",async({page})=>{
  const game=buildHandball360SeasonGame(games[2],"378122",teamId,schedule.matches[2]);
  // Legacy manual roster: local player IDs exist, but Handball360 IDs are absent.
  game.state.home.players=[
    {id:"local-21",nr:7,vorname:"Mia",nachname:"Test",isTW:false},
    {id:"local-old",nr:9,vorname:"Nicht",nachname:"Gemeldet",isTW:false}
  ];
  game.state.away.players=[];
  game.state.events=[
    {id:"local-goal",team:"home",type:"goal",pId:"local-21",scoreH:1,scoreA:0,comment:"Altes Live-Scouting",videoTime:222},
    {id:"local-defense",team:"away",type:"error",pId:"local-old",playerTags:[{pId:"local-21"}],comment:"Manuelle Abwehrzuordnung"}
  ];
  game.state.video.youtubeUrl="https://youtu.be/history-preserve";
  const official=payload("378122","2026-11-15T16:00:00Z");
  official.events=[];
  official.lineups={data:{
    local:{players:[
      {player:{id:21,first_name:"Mia",last_name:"Test"},number:18,is_goalkeeper:false},
      {player:{id:23,first_name:"Neuer",last_name:"Spieler"},number:3,is_goalkeeper:false}
    ]},
    visitor:{players:[
      {player:{id:32,first_name:"Gina",last_name:"Gast"},number:1,is_goalkeeper:true}
    ]}
  }};
  await page.route("**/match/378122",route=>route.fulfill({
    status:200,headers:{"access-control-allow-origin":"*"},
    contentType:"application/json",body:JSON.stringify(official)
  }));
  await page.locator("#seasonGameInput").setInputFiles(upload("historisch.json",game.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await expect(page.locator("#setupSeasonRosterRefresh")).toBeEnabled();
  await expect(page.locator("#setupSeasonAnalysis")).toBeEnabled();
  await page.locator("#setupSeasonAnalysis").click();
  // Export the season snapshot: "Kopie exportieren" may use a native
  // file picker instead of emitting a Playwright download.
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [beforeDownload]=await Promise.all([
    page.waitForEvent("download"),page.locator("#seasonExport").click()
  ]);
  const before=JSON.parse(await readFile(await beforeDownload.path(),"utf8")).games[0].data;
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonRosterRefresh").click();
  const dialog=page.locator("#setupOfficialRosterDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Scouting-Ereignisse");
  await expect(dialog).toContainText("Nicht offiziell gemeldet (bleibt im historischen Spiel)");
  await expect(dialog).toContainText("Nicht Gemeldet");
  await expect(dialog).toContainText("Nr. 7 → 18");
  await dialog.locator("#setupOfficialRosterConfirm").click();
  await expect(page.locator("#setupSeasonRosterStatus")).toContainText("Historischen Kader sicher abgeglichen");
  // Roster refresh saves directly to the season archive. A passive analysis
  // preview must not expose the independent Match save button.
  await expect(page.locator("#saveBtn")).toBeHidden();
  await page.locator('[data-tab="setup"]').click();
  await openSeasonAdmin(page);
  const [download]=await Promise.all([
    page.waitForEvent("download"),page.locator("#seasonExport").click()
  ]);
  const archive=JSON.parse(await readFile(await download.path(),"utf8"));
  const actual=archive.games[0].data;
  expect(actual.events).toEqual(before.events);
  expect(actual.video).toEqual(before.video);
  expect(actual.home.players.find(p=>p.id==="local-21")).toMatchObject({nr:18,handballNetId:"21"});
  expect(actual.home.players.find(p=>p.id==="local-old")).toBeDefined();
  expect(actual.home.players.some(p=>p.handballNetId==="23")).toBe(true);
  expect(actual.away.players.some(p=>p.handballNetId==="32")).toBe(true);
  expect(actual.officialSource.matchId).toBe("378122");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonRosterRefresh").click();
  await expect(dialog).toContainText("Keine Abweichungen");
  await dialog.locator("#setupOfficialRosterCancel").click();
});

test("season analysis preview offers explicit entry into video and data editing",async({page})=>{
  const game=buildHandball360SeasonGame(games[0],"378107",teamId,schedule.matches[0]);
  await page.locator("#seasonGameInput").setInputFiles(upload("season-analysis-edit.json",game.state));
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonAnalysis").click();
  await expect(page.locator("#analysisGamePicker")).toHaveValue(/.+/);
  await expect(page.locator('[data-tab="video"]')).toBeHidden();
  await expect(page.locator('[data-tab="data"]')).toBeHidden();
  await expect(page.locator("#analysisOpenSeasonGame")).toBeVisible();
  await page.locator("#analysisOpenSeasonGame").click();
  await expect(page.locator('[data-tab="video"]')).toBeVisible();
  await expect(page.locator('[data-tab="data"]')).toBeVisible();
  await page.locator('[data-tab="video"]').click();
  await expect(page.locator("#videoTab")).toHaveClass(/active/);
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator("#dataTab")).toHaveClass(/active/);
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisGamePicker")).toHaveValue(/.+/);
});
