import { test, expect } from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));

test("season charts work on mobile as one plot and desktop as four configurable plots",async({page})=>{
  await page.goto("/");
  const first=structuredClone(fixture);
  first.gameName="Erstes Spiel";
  first.gameDate="2026-09-05";
  const second=structuredClone(fixture);
  second.gameName="Zweites Spiel";
  second.gameDate="2026-09-12";
  second.home.name="MTV Lübeck Jugend";
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    {name:"first.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(first))},
    {name:"second.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(second))}
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator('[data-tab="season"]').click();
  await expect(page.locator("#seasonTrendScope")).toBeVisible();
  await expect(page.locator("#seasonTrendMetric")).toHaveValue("goals");
  await expect(page.locator("#seasonTrend path[stroke]")).toHaveCount(2);
  await expect(page.locator("#seasonTrend circle[data-trend-index]")).not.toHaveCount(0);
  const opponents=page.locator("#seasonTrend text[data-trend-opponent]");
  await expect(opponents).toHaveCount(2);
  await expect(opponents.first().locator("title")).toHaveText("HSG Herzhorn/Kollmar/Neuendorf");
  await expect(opponents.nth(1).locator("title")).toHaveText("MTV Lübeck Jugend");
  const abbreviated=await opponents.first().evaluate(element=>element.firstChild.textContent);
  expect([...abbreviated].length).toBeLessThanOrEqual(14);
  expect(abbreviated).toContain("…");
  await page.locator("#seasonTrend circle[data-trend-index='0']").first().click();
  await expect(page.locator("#seasonTrendDetail")).toContainText("HSG Herzhorn/Kollmar/Neuendorf");
  const mobile=(page.viewportSize()?.width||0)<768;
  if(mobile){
    await expect(page.locator("#seasonTrend2")).toBeHidden();
    await expect(page.locator("#seasonTrend3")).toBeHidden();
    await expect(page.locator("#seasonTrend4")).toBeHidden();
  }else{
    await expect(page.locator("#seasonTrend2")).toBeVisible();
    await expect(page.locator("#seasonTrend3")).toBeVisible();
    await expect(page.locator("#seasonTrend4")).toBeVisible();
  }
  await page.locator("#seasonTrendMetric").selectOption("shotRate");
  await expect(page.locator("#seasonTrend")).toHaveAttribute("aria-label",/Wurfeffizienz/);
  await expect(page.locator("#seasonTrendDetail")).toContainText("%");
  await page.locator("#seasonTrendScope").selectOption("player");
  await expect(page.locator("#seasonTrendPlayerLabel")).toBeVisible();
  await expect(page.locator("#seasonTrendPlayer option").first()).toBeAttached();
  await expect(page.locator("#seasonTrendLegend")).not.toContainText("Gegner");
  await page.locator("#seasonTrendMetric").selectOption("penalties");
  await expect(page.locator("#seasonTrend")).toHaveAttribute("aria-label",/Zeitstrafen/);
  await expect(page.locator("#seasonTrend")).toBeVisible();
});

test("Phase 2 trend charts filter venue, aggregate season and compare multiple players",async({page})=>{
  await page.goto("/");
  const first=structuredClone(fixture);first.gameName="Heimspiel";first.gameDate="2026-09-05";
  const second=structuredClone(fixture);second.gameName="Auswärtsspiel";second.gameDate="2026-09-12";
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    {name:"phase2-first.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(first))},
    {name:"phase2-second.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(second))}
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonTrendView").selectOption("cumulative");
  await expect(page.locator("#seasonTrend")).toHaveAttribute("aria-label",/Tore/);
  await page.locator("#seasonTrendVenue").selectOption(fixture.ownTeam);
  await expect(page.locator("#seasonTrend circle[data-trend-index]")).not.toHaveCount(0);
  await page.locator("#seasonTrendVenue").selectOption(fixture.ownTeam==="home"?"away":"home");
  await expect(page.locator("#seasonTrend circle[data-trend-index]")).toHaveCount(0);
  await page.locator("#seasonTrendVenue").selectOption("all");
  await page.locator("#seasonTrendScope").selectOption("player");
  await expect(page.locator("#seasonTrendComparison")).toBeVisible();
  await page.locator("#seasonTrendComparison summary").click();
  const options=page.locator("#seasonTrendCompareOptions input[type=checkbox]");
  await expect(options.first()).toBeVisible();
  await options.first().check();
  await expect(page.locator("#seasonTrendCompareCount")).toContainText("2 von 4");
  await expect(page.locator("#seasonTrend path[stroke]")).toHaveCount(2);
  await page.locator("#seasonTrendMetric").selectOption("assists");
  await expect(page.locator("#seasonTrend")).toHaveAttribute("aria-label",/Assists/);
  await page.locator("#seasonTrendMetric").selectOption("shotRate");
  await expect(page.locator("#seasonTrend")).toHaveAttribute("aria-label",/Wurfeffizienz/);
});

test("low count statistics have unique integer y-axis labels on mobile and desktop",async({page})=>{
  await page.goto("/");
  const game=structuredClone(fixture);
  game.gameName="Einzelne Zeitstrafe";
  game.gameDate="2026-10-01";
  game.events=[{type:"2min",team:game.ownTeam,pId:game[game.ownTeam].players[0].id}];
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles({
    name:"axis-one-penalty.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonTrendMetric").selectOption("penalties");
  const yLabels=await page.locator('#seasonTrend .chart-axis[x="38"]').allTextContents();
  expect(yLabels).toEqual(["0","1"]);
  expect(new Set(yLabels).size).toBe(yLabels.length);
  await page.locator("#seasonTrendMetric").selectOption("shotRate");
  await expect(page.locator('#seasonTrend .chart-axis[x="38"]')).toHaveText(["0%","25%","50%","75%","100%"]);
});
