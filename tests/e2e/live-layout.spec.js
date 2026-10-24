import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function expectLiveFullWidth(page){
  await expect(page.locator("body")).toHaveClass(/live-scouting-layout/);
  await expect(page.locator("#matchReviewTopHost #modeSelect")).toHaveValue("live");
  await expect(page.locator("#matchVideoHost")).toBeHidden();
  await expect(page.locator("#matchNearbyEvents")).toBeHidden();
  await expect(page.locator("#matchGrid > .events")).toBeHidden();
  await expect(page.locator("#matchGrid > .side > .events")).toBeHidden();
  await expect(page.locator("#gameClock")).toBeVisible();
  await expect(page.locator("#videoClock")).toBeVisible();
  await expect(page.locator("#matchPossessionHost .possession")).toBeVisible();
  await expect(page.locator("#idleStep")).toBeVisible();
  await expect(page.locator("#liveUndoBtn")).toBeVisible();
  const widths=await page.evaluate(()=>{
    const grid=document.querySelector("#matchGrid").getBoundingClientRect();
    const side=document.querySelector("#matchGrid>.side").getBoundingClientRect();
    return {grid:grid.width,side:side.width,offset:side.left-grid.left};
  });
  expect(widths.side).toBeGreaterThan(widths.grid-4);
  expect(Math.abs(widths.offset)).toBeLessThan(4);
}

test("Live Scouting fills available width, hides video and all event lists",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="match"]').click();
  await expectLiveFullWidth(page);
  await expect(page.locator("#liveUndoBtn")).toBeDisabled();
  // Switching between empty modes must restore video layout only for video.
  await page.locator("#modeSelect").selectOption("video");
  await expect(page.locator("body")).toHaveClass(/video-scouting-layout/);
  await expect(page.locator("#matchVideoHost")).toBeVisible();
  await expect(page.locator("#matchNearbyEvents")).toBeVisible();
  await page.locator("#modeSelect").selectOption("live");
  await expectLiveFullWidth(page);
});

test("live event capture stays full width while review temporarily shows video and events",async({page})=>{
  await page.goto("/");
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  await page.locator("#continueGameInput").setInputFiles({
    name:"live-fullwidth-test.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="match"]').click();
  await expectLiveFullWidth(page);
  await expect(page.locator("#liveUndoBtn")).toBeEnabled();
  await expect(page.locator("#matchReviewControls")).toBeVisible();
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("body")).not.toHaveClass(/live-scouting-layout/);
  await expect(page.locator("#matchVideoHost")).toBeVisible();
  await expect(page.locator("#matchGrid > .events")).toBeVisible();
  await page.locator("#matchReviewToggle").click();
  await expectLiveFullWidth(page);
  // The separate video tab must remain usable even while Live is selected.
  await page.locator('[data-tab="video"]').click();
  await expect(page.locator("#videoPlayerHost #videoModule")).toBeVisible();
  await page.locator('[data-tab="match"]').click();
  await expectLiveFullWidth(page);
});
