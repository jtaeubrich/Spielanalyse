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
  await expect(page.locator("#seasonTrend path.chart-home")).toHaveCount(1);
  await expect(page.locator("#seasonTrend circle[data-trend-index]")).not.toHaveCount(0);
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
