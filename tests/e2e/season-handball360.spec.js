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
