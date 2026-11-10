import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

test('"Alle Würfe" in Video includes goals, misses and saves, but not unrelated events',async({page})=>{
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.isHistorical=false;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"all-shots.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="video"]').click();
  for(const id of ["videoTeamFilter","videoPlayerFilter","videoZoneFilter","videoTargetFilter","videoPhaseFilter","videoTagFilter"])
    await page.locator("#"+id).selectOption("all");
  await page.locator("#videoTypeFilter").selectOption("shot");
  const selected=game.events.filter(e=>["shot","goal","miss","save","block"].includes(e.type));
  const goalCount=game.events.filter(e=>e.type==="goal").length;
  const entries=page.locator("#videoPlaylist .clip");
  await expect(entries).toHaveCount(selected.length);
  const displayed=await entries.locator(".clip-head").allTextContents();
  expect(displayed.filter(t=>/\bTor\b/.test(t))).toHaveLength(goalCount);
  await page.locator("#videoTypeFilter").selectOption("goal");
  await expect(entries).toHaveCount(goalCount);
  await page.locator("#videoTypeFilter").selectOption("shot");
  await expect(entries).toHaveCount(selected.length);
});
