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
 await page.locator('[data-tab="setup"]').click();
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
 await page.locator('[data-tab="setup"]').click();
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


test("video scouting puts capture under event strip and scene controls last on phone, tablet and desktop",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator('[data-tab="match"]').click();
  await page.locator("#modeSelect").selectOption("video");
  for(const width of [390,820,1280]){
    await page.setViewportSize({width,height:900});
    const order=await page.evaluate(()=>{
      const box=id=>document.getElementById(id).getBoundingClientRect();
      const video=box("matchVideoHost"),events=box("matchNearbyEvents"),
        possession=box("matchPossessionHost"),capture=box("idleStep"),
        settings=box("matchSceneSettingsHost");
      return {
        eventRowBeforePossession:possession.top>=Math.max(video.bottom,events.bottom)-3,
        captureBelowPossession:capture.top>=possession.bottom-3,
        settingsBelowCapture:settings.top>=capture.bottom-3,
        captureFullWidth:Math.abs(box("matchGrid").width-box("matchGrid").width)<1 &&
          document.querySelector("#matchGrid>.side").getBoundingClientRect().width>=box("matchGrid").width-4,
        sceneHostContainsSettings:document.getElementById("matchSceneSettingsHost").contains(document.getElementById("matchReviewWindow"))
      };
    });
    expect(order).toEqual({
      eventRowBeforePossession:true,captureBelowPossession:true,
      settingsBelowCapture:true,captureFullWidth:true,sceneHostContainsSettings:true
    });
    await expect(page.locator("#matchReviewWindow")).toBeVisible();
    await expect(page.locator("#matchReviewWindow")).not.toHaveAttribute("open","");
    await expect(page.locator("#matchPreRoll")).toBeHidden();
    await page.locator("#matchReviewWindow summary").click();
    await expect(page.locator("#matchPreRoll")).toBeVisible();
    await page.locator("#matchReviewWindow summary").click();
  }
  await page.locator("#modeSelect").selectOption("live");
  await expect(page.locator("#matchSceneSettingsHost")).toBeHidden();
  await expect(page.locator("#matchGrid>.side #idleStep")).toBeVisible();
});

test("video review also keeps possession and event capture below the video/event columns",async({page})=>{
  const file=JSON.parse(await readFile(fixture,"utf8"));
  file.isHistorical=false;file.isVideoscoutingFile=false;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"review-layout.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(file))
  });
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await page.setViewportSize({width:820,height:900});
  const result=await page.evaluate(()=>{
    const b=id=>document.getElementById(id).getBoundingClientRect();
    const events=document.querySelector("#matchGrid>.events").getBoundingClientRect();
    const capture=document.getElementById("idleStep").getBoundingClientRect();
    const side=document.querySelector("#matchGrid>.side").getBoundingClientRect();
    return {
      eventsBesideVideo:events.left>=b("matchVideoHost").right-3,
      possessionBelowEvents:b("matchPossessionHost").top>=Math.max(events.bottom,b("matchVideoHost").bottom)-3,
      captureBelowPossession:capture.top>=b("matchPossessionHost").bottom-3,
      captureFullWidth:side.width>=b("matchGrid").width-4,
      settingsAtBottom:b("matchSceneSettingsHost").top>=side.bottom-3
    };
  });
  expect(result).toEqual({eventsBesideVideo:true,possessionBelowEvents:true,captureBelowPossession:true,captureFullWidth:true,settingsAtBottom:true});
});
