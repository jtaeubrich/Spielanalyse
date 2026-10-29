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
  await expect(page.locator("body")).not.toHaveClass(/phone-match-layout/);
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

// Keep screen size independent of the layout viewport. setViewportSize() would
// reset both and turn the wide-viewport phone into an emulated tablet.
for(const scenario of [
  {name:"portrait phone review",viewport:{width:390,height:900},screen:{width:390,height:900}},
  {name:"portrait phone review with wide layout viewport",viewport:{width:820,height:900},screen:{width:390,height:900}},
  {name:"landscape phone review with wide layout viewport",viewport:{width:844,height:390},screen:{width:844,height:390}}
]){
  test.describe(scenario.name,()=>{
    test.use({viewport:scenario.viewport,screen:scenario.screen});

    test("shows all unsynced events as a horizontal strip under video",async({page,isMobile})=>{
      test.skip(!isMobile,"Phone emulation is covered by the chromium-mobile project.");
      const fixturePath=new URL("../fixtures/hkn_reference.json",import.meta.url);
      const game=JSON.parse(await readFile(fixturePath,"utf8"));
      game.isHistorical=false;game.isVideoscoutingFile=false;
      delete game.liveScoutingCompleted;
      // Intentionally leave events without video sync, matching older live scouting games.
      for(const event of game.events){event.realTime=null;}
      await page.goto("/");
      await page.locator("#homeChooseGame").click();
      await page.locator("#homeImport").click();
      await page.locator("#continueGameInput").setInputFiles({
        name:"unsynced-review.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))
      });
      await page.locator("#matchReviewToggle").click();
      await expect(page.locator("body")).toHaveClass(/match-review-mode/);
      await expect(page.locator("body")).toHaveClass(/phone-match-layout/);
      expect(await page.evaluate(()=>({width:screen.width,height:screen.height}))).toEqual(scenario.screen);
      await expect(page.locator("#matchGrid>.events .event")).toHaveCount(game.events.length);
      const result=await page.evaluate(expectedEventCount=>{
        const rect=id=>document.getElementById(id).getBoundingClientRect();
        const eventList=document.getElementById("eventList"),
          cards=[...eventList.querySelectorAll(".event")];
        const first=cards[0]?.getBoundingClientRect(),second=cards[1]?.getBoundingClientRect();
        const grid=rect("matchGrid"),side=document.querySelector("#matchGrid>.side").getBoundingClientRect();
        return {
          eventBelowVideo:rect("eventList").top>=rect("matchVideoHost").bottom-4,
          possessionBelowEvents:rect("matchPossessionHost").top>=rect("eventList").bottom-4,
          captureBelowPossession:side.top>=rect("matchPossessionHost").bottom-4,
          settingsBelowActions:rect("matchSceneSettingsHost").top>=side.bottom-4,
          fullWidth:side.width>=grid.width-4,
          horizontalEvents:Boolean(first&&second)&&Math.abs(first.top-second.top)<5,
          unsyncedAvailable:cards.length===expectedEventCount
        };
      },game.events.length);
      expect(result).toEqual({
        eventBelowVideo:true,possessionBelowEvents:true,captureBelowPossession:true,
        settingsBelowActions:true,fullWidth:true,horizontalEvents:true,unsyncedAvailable:true
      });
      await page.locator("#matchGrid>.events .event").first().click();
      await expect(page.locator("#matchNearbyEditorHost")).toBeVisible();
      await expect(page.locator("#videoEventEditor")).toBeVisible();
      const layout=await page.evaluate(()=>{
        const events=document.querySelector("#matchGrid>.events").getBoundingClientRect();
        const editor=document.getElementById("matchNearbyEditorHost").getBoundingClientRect();
        const possession=document.getElementById("matchPossessionHost").getBoundingClientRect();
        const grid=document.getElementById("matchGrid");
        return {
          editorBelowEvents:editor.top>=events.bottom-4,
          possessionBelowEditor:possession.top>=editor.bottom-4,
          noGridOverflow:grid.scrollWidth<=grid.clientWidth+3
        };
      });
      expect(layout).toEqual({editorBelowEvents:true,possessionBelowEditor:true,noGridOverflow:true});
      await page.locator("#matchEditorCollapse").click();
      await expect(page.locator("#matchEditorCollapse")).toHaveAttribute("aria-expanded","false");
      await expect(page.locator("#videoEventEditor")).toBeHidden();
      await page.locator("#matchEditorCollapse").click();
      await expect(page.locator("#videoEventEditor")).toBeVisible();
      await page.locator("#matchEditorClose").click();
      await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
    });
  });
}


test.describe("phone video scouting editor",()=>{
  test.use({viewport:{width:844,height:390},screen:{width:844,height:390}});

  test("uses the same landscape event strip and collapsible editor as review",async({page,isMobile})=>{
    test.skip(!isMobile,"Phone emulation is covered by the chromium-mobile project.");
    const game=JSON.parse(await readFile(fixture,"utf8"));
    game.isHistorical=false;
    game.isVideoscoutingFile=true;
    for(const event of game.events)event.realTime=null;
    await page.goto("/");
    await page.locator("#homeChooseGame").click();
    await page.locator("#homeImport").click();
    await page.locator("#continueGameInput").setInputFiles({
      name:"landscape-video-scouting.json",
      mimeType:"application/json",
      buffer:Buffer.from(JSON.stringify(game))
    });
    await expect(page.locator("#modeSelect")).toHaveValue("video");
    await expect(page.locator("body")).toHaveClass(/phone-match-layout/);
    await expect(page.locator("#matchNearbyList .match-nearby-item").first()).toBeVisible();
    const horizontal=await page.evaluate(()=>{
      const list=document.getElementById("matchNearbyList");
      const cards=[...list.querySelectorAll(".match-nearby-item")];
      const video=document.getElementById("matchVideoHost").getBoundingClientRect();
      const events=document.getElementById("matchNearbyEvents").getBoundingClientRect();
      const first=cards[0]?.getBoundingClientRect();
      const second=cards[1]?.getBoundingClientRect();
      const grid=document.getElementById("matchGrid");
      return {
        eventsBelowVideo:events.top>=video.bottom-4,
        horizontalEvents:Boolean(first&&second)&&Math.abs(first.top-second.top)<5,
        noGridOverflow:grid.scrollWidth<=grid.clientWidth+3
      };
    });
    expect(horizontal).toEqual({eventsBelowVideo:true,horizontalEvents:true,noGridOverflow:true});
    await page.locator("#matchNearbyList .match-nearby-item").first().click();
    await expect(page.locator("#matchNearbyEditorHost")).toBeVisible();
    await expect(page.locator("#videoEventEditor")).toBeVisible();
    await page.locator("#matchEditorCollapse").click();
    await expect(page.locator("#videoEventEditor")).toBeHidden();
    await page.locator("#matchEditorCollapse").click();
    await expect(page.locator("#videoEventEditor")).toBeVisible();
    await page.locator("#matchEditorClose").click();
    await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
  });
});
