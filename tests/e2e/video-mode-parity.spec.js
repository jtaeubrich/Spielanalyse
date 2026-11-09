import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function openWorkflow(page,mode){
  await page.addInitScript(()=>{
    window.__fakeVideoTime=0;
    window.__videoSeekCalls=[];
    class FakePlayer {
      constructor(_target,config){
        this.config=config;
        this.rate=1;
        queueMicrotask(()=>config.events.onReady?.());
      }
      getCurrentTime(){return window.__fakeVideoTime;}
      getDuration(){return 1800;}
      getPlayerState(){return 2;}
      getPlaybackRate(){return this.rate;}
      getAvailablePlaybackRates(){return [0.5,1,1.25,1.5];}
      setPlaybackRate(rate){this.rate=rate;}
      seekTo(seconds){window.__fakeVideoTime=seconds;window.__videoSeekCalls.push(seconds);}
      pauseVideo(){}
      playVideo(){}
      destroy(){}
    }
    window.YT={Player:FakePlayer};
  });
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.isHistorical=false;
  game.isVideoscoutingFile=mode==="video";
  game.liveScoutingCompleted=false;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"workflow-parity.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="match"]').click();
  if(mode==="review")await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/video-workflow-layout/);
  await page.locator("#youtubeUrl").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.locator("#youtubeForm button").first().click();
  await expect(page.locator("#videoMessage")).toContainText("Bereit.");
  return game;
}

for(const mode of ["video","review"]){
  test(mode+" has same compact events, editor placement, short tap and long press",async({page,isMobile})=>{
    const game=await openWorkflow(page,mode);
    const rows=page.locator("#matchNearbyList .match-nearby-item");
    await expect(rows).toHaveCount(game.events.length);
    await expect(page.locator("#matchGrid>.events")).toBeHidden();
    await expect(page.locator("#matchNearbyEvents")).toBeVisible();
    await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
    const first=rows.first();
    await first.click();
    await expect(page.locator("#matchNearbyEditorHost")).toBeVisible();
    await expect(page.locator("#videoEventEditor")).toBeVisible();
    await expect(page.locator("#veePlayScene")).toBeVisible();
    await expect(page.locator("#veeJumpToEvent")).toBeVisible();
    await expect(page.locator("#matchNearbyList .match-nearby-item.selected")).toHaveCount(1);
    const geometry=await page.evaluate(()=>{
      const box=id=>document.getElementById(id).getBoundingClientRect();
      const video=box("matchVideoHost"),events=box("matchNearbyEvents"),
        editor=box("matchNearbyEditorHost"),grid=box("matchGrid");
      return {
        editorBelow:editor.top>=video.top+100,
        eventsBeside:Math.abs(events.top-video.top)<5&&events.left>=video.right-4,
        eventsUnder:events.top>=video.bottom-4,
        noOverflow:document.getElementById("matchGrid").scrollWidth<=grid.width+4
      };
    });
    expect(geometry.editorBelow).toBe(true);
    expect(geometry.noOverflow).toBe(true);
    if(isMobile){expect(geometry.eventsUnder).toBe(true)}
    else {expect(geometry.eventsBeside).toBe(true)}

    await first.click();
    await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();

    const target=rows.nth(2);
    await target.scrollIntoViewIfNeeded();
    const rect=await target.boundingBox();
    expect(rect).toBeTruthy();
    const seekCount=await page.evaluate(()=>window.__videoSeekCalls.length);
    await page.mouse.move(rect.x+Math.min(rect.width/2,38),rect.y+Math.min(rect.height/2,18));
    await page.mouse.down();
    await expect(page.locator("#matchEventHoldMenu")).toBeVisible({timeout:2200});
    await page.mouse.up();
    await page.locator("#matchEventHoldDetails").click();
    await expect(page.locator("#matchNearbyEditorHost")).toBeVisible();
    await expect(rows.nth(2)).toHaveClass(/selected/);
    expect(await page.evaluate(()=>window.__videoSeekCalls.length)).toBe(seekCount);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state);
    expect(saved.events).toHaveLength(game.events.length);
    expect(saved.events.map(e=>e.type)).toEqual(game.events.map(e=>e.type));
  });
}
