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


test("missing season statistics use a hollow marker and dashed bridge, not a zero",async({page})=>{
  await page.goto("/");
  const first=structuredClone(fixture);
  first.gameName="Mit Wurfstatistik 1";first.gameDate="2026-09-01";
  const middle=structuredClone(fixture);
  middle.gameName="Ohne Wurfstatistik";middle.gameDate="2026-09-08";
  middle.events=[{type:"2min",team:middle.ownTeam,pId:middle[middle.ownTeam].players[0].id}];
  const last=structuredClone(fixture);
  last.gameName="Mit Wurfstatistik 2";last.gameDate="2026-09-15";
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    {name:"trend-gap-1.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(first))},
    {name:"trend-gap-2.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(middle))},
    {name:"trend-gap-3.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(last))}
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("3 Spiele");
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonTrendMetric").selectOption("shotRate");
  const chart=page.locator("#seasonTrend");
  await expect(chart.locator('circle[data-trend-index="0"]:not([data-trend-missing])').first()).toBeAttached();
  await expect(chart.locator('circle[data-trend-index="1"][data-trend-missing="true"]')).toHaveCount(2);
  await expect(chart.locator('circle[data-trend-index="2"]:not([data-trend-missing])').first()).toBeAttached();
  await expect(chart.locator('path[data-trend-gap]')).toHaveCount(2);
  await expect(chart.locator('path[data-trend-gap]').first()).toHaveAttribute("stroke-dasharray","2 6");
  await expect(page.locator("#seasonTrendLegend")).toContainText("kein Messwert");
  await chart.locator('circle[data-trend-index="1"][data-trend-missing="true"]').first().click();
  await expect(page.locator("#seasonTrendDetail")).toContainText("kein Messwert");
  await page.locator("#seasonTrendMetric").selectOption("goals");
  await expect(chart.locator('circle[data-trend-missing="true"]')).toHaveCount(0);
  await expect(chart.locator('path[data-trend-gap]')).toHaveCount(0);
});


test("season player trend treats an unverified roster-only appearance as a missing game",async({page})=>{
  await page.goto("/");
  const first=structuredClone(fixture);
  first.gameName="Gegen HSG";first.gameDate="2026-09-05";
  const middle=structuredClone(fixture);
  middle.gameName="Gegen MTV Lübeck II";middle.gameDate="2026-09-12";
  middle.home.name="MTV Lübeck II";
  const teammate=middle[middle.ownTeam].players.find(player=>Number(player.nr)===25);
  middle.events=[{type:"goal",team:middle.ownTeam,pId:teammate.id}];
  const third=structuredClone(fixture);
  third.gameName="Gegen HSG 2";third.gameDate="2026-09-19";
  const validZero=structuredClone(fixture);
  validZero.gameName="Gegen HSG 3";validZero.gameDate="2026-09-26";
  const jespe=validZero[validZero.ownTeam].players.find(player=>Number(player.nr)===17);
  validZero.events=[{type:"error",team:validZero.ownTeam,pId:jespe.id}];
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    {name:"presence-first.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(first))},
    {name:"presence-luebeck.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(middle))},
    {name:"presence-third.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(third))},
    {name:"presence-zero.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(validZero))}
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("4 Spiele");
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonTrendScope").selectOption("player");
  const option=page.locator("#seasonTrendPlayer option").filter({hasText:"Jespe Mats Täubrich"});
  await expect(option).toHaveCount(1);
  const playerKey=await option.getAttribute("value");
  await page.locator("#seasonTrendPlayer").selectOption(playerKey);
  await page.locator("#seasonTrendMetric").selectOption("goals");
  const plot=page.locator("#seasonTrend");
  await expect(plot.locator('circle[data-trend-index="1"][data-trend-missing="true"]')).toHaveCount(1);
  await expect(plot.locator('path[data-trend-gap]')).toHaveCount(1);
  await expect(plot.locator('circle[data-trend-index="3"]:not([data-trend-missing])')).toHaveCount(1);
  const marker=plot.locator('circle[data-trend-index="1"][data-trend-missing="true"]');
  await expect(marker).toHaveAttribute("aria-label",/Einsatz nicht bestätigt/);
  await marker.click();
  await expect(page.locator("#seasonTrendDetail")).toContainText("Einsatz nicht bestätigt");
  await plot.locator('circle[data-trend-index="3"]').click();
  await expect(page.locator("#seasonTrendDetail")).toContainText("Jespe Mats Täubrich: 0");
});
