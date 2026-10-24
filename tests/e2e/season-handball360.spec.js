import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHandball360SeasonGame } from "../../src/season-handball360.js";

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
test.beforeEach(async({page})=>{
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
  await page.locator('[data-tab="season"]').click();
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
  expect(paths).toContain("TSV_Kronshagen_mB/378107/spiel.json");
  expect(paths).toContain("TSV_Kronshagen_mB/378122/spiel.json");
  expect(paths).toContain("TSV_Kronshagen_mB/378107/videos/");
  expect(paths).not.toContain("TSV_Kronshagen_mB/2026-27/378107/spiel.json");
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
