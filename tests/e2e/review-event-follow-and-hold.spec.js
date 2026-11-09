import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function openReview(page,{video=false}={}){
  if(video){
    await page.addInitScript(()=>{
      window.__fakeVideoPosition=0;
      window.__fakeVideoSeeks=[];
      class FakePlayer {
        constructor(_host,options){
          this.events=options.events;
          this.rate=1;
          queueMicrotask(()=>this.events.onReady?.());
        }
        getCurrentTime(){return window.__fakeVideoPosition;}
        getDuration(){return 2400;}
        getPlayerState(){return 2;}
        getPlaybackRate(){return this.rate;}
        getAvailablePlaybackRates(){return [0.5,1,1.25,1.5];}
        setPlaybackRate(value){this.rate=value;}
        seekTo(value){window.__fakeVideoPosition=value;window.__fakeVideoSeeks.push(value);}
        playVideo(){}
        pauseVideo(){}
        destroy(){}
      }
      window.YT={Player:FakePlayer};
    });
  }
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  delete game.liveScoutingCompleted;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"review-scroll-and-hold.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await page.locator('[data-tab="match"]').click();
  if(video){
    await page.locator("#youtubeUrl").fill("https://youtu.be/dQw4w9WgXcQ");
    await page.locator("#youtubeForm button").first().click();
    await expect(page.locator("#videoMessage")).toContainText("Bereit.");
  }
  return game;
}

test.describe("video-review tablet sidebar",()=>{
  test.use({viewport:{width:1180,height:850},screen:{width:1180,height:850}});

  test("event column has at least the visible video height while details remain below",async({page,isMobile})=>{
    test.skip(isMobile,"Tablet layout is validated with a tablet-sized desktop viewport");
    await openReview(page);
    const column=page.locator("#matchGrid>.events");
    const list=page.locator("#eventList");
    for(const share of [60,75,85]){
      await page.locator("#videoSize").fill(String(share));
      await expect.poll(async()=>page.evaluate(()=>{
        const video=document.querySelector("#matchVideoHost").getBoundingClientRect();
        const editor=document.getElementById("matchReviewEventEditorHost").getBoundingClientRect();
        const events=document.querySelector("#matchGrid>.events").getBoundingClientRect();
        const list=document.getElementById("eventList");
        return {
          heightDifference:Math.round(events.height-(editor.top-video.top-12)),
          sameRow:Math.abs(events.top-video.top)<5,
          sidebarScroll:list.scrollHeight>list.clientHeight,
          vertical:list.scrollHeight>list.clientHeight&&getComputedStyle(list).overflowY==="auto",
          editorBelowVideo:editor.top>video.top+100
        };
      })).toMatchObject({
        sameRow:true,sidebarScroll:true,vertical:true,editorBelowVideo:true
      });
      const sizes=await page.evaluate(()=>{
        const video=document.querySelector("#matchVideoHost").getBoundingClientRect();
        const editor=document.getElementById("matchReviewEventEditorHost").getBoundingClientRect();
        const events=document.querySelector("#matchGrid>.events").getBoundingClientRect();
        return {needed:editor.top-video.top-12,actual:events.height};
      });
      expect(sizes.actual).toBeGreaterThanOrEqual(sizes.needed-8);
      await expect(column).toBeVisible();
      await expect(list).toBeVisible();
      await expect(page.locator("#videoEventEditor")).toBeVisible();
    }
  });

  test("video-time auto-follow respects manual scrolling and has a return button",async({page,isMobile})=>{
    test.skip(isMobile,"Tablet-specific vertical follow is not the phone's horizontal strip");
    await openReview(page,{video:true});
    await expect(page.locator("#matchReviewJumpToCurrentEvent")).toBeVisible();
    await expect(page.locator("#eventList .event")).toHaveCount(136);
    await page.evaluate(()=>window.__fakeVideoPosition=1120);
    await expect.poll(()=>page.locator("#eventList").evaluate(el=>el.scrollTop),{timeout:5000}).toBeGreaterThan(1000);
    await page.locator("#eventList").evaluate(el=>{
      el.scrollTop=0;
      el.dispatchEvent(new WheelEvent("wheel",{bubbles:true}));
    });
    await page.waitForTimeout(400);
    expect(await page.locator("#eventList").evaluate(el=>el.scrollTop)).toBeLessThan(100);
    await page.locator("#matchReviewJumpToCurrentEvent").click();
    await expect.poll(()=>page.locator("#eventList").evaluate(el=>el.scrollTop)).toBeGreaterThan(1000);
    expect(await page.evaluate(()=>window.__fakeVideoSeeks.length)).toBe(0);
  });

  test("550ms long press opens selected event details without a video seek",async({page,isMobile})=>{
    test.skip(isMobile,"Review long-press is validated on a tablet-like pointer viewport");
    await openReview(page,{video:true});
    const target=page.locator('#eventList .event[data-event-index="5"]');
    await target.scrollIntoViewIfNeeded();
    const rect=await target.boundingBox();
    expect(rect).toBeTruthy();
    await page.mouse.move(rect.x+Math.min(40,rect.width/2),rect.y+Math.min(20,rect.height/2));
    await page.mouse.down();
    await expect(page.locator("#matchEventHoldMenu")).toBeVisible({timeout:2000});
    await page.mouse.up();
    await page.locator("#matchEventHoldDetails").click();
    await expect(page.locator("#matchEventHoldMenu")).toBeHidden();
    await expect(page.locator('#eventList .event[data-event-index="5"]')).toHaveClass(/current/);
    await expect(page.locator("#videoEventEditor")).toContainText("Fixierung lösen");
    expect(await page.evaluate(()=>window.__fakeVideoSeeks.length)).toBe(0);
    expect(await page.evaluate(()=>window.__fakeVideoPosition)).toBe(0);
  });
});

test("phone review still uses horizontal events rather than tablet-height column",async({page,isMobile})=>{
  test.skip(!isMobile,"Phone layout is validated with a mobile browser");
  await openReview(page);
  await expect(page.locator("body")).toHaveClass(/phone-match-layout/);
  const layout=await page.locator("#eventList").evaluate(el=>{
    const first=el.querySelector(".event")?.getBoundingClientRect();
    const next=el.querySelectorAll(".event")[1]?.getBoundingClientRect();
    return {overflowX:getComputedStyle(el).overflowX,sameRow:Boolean(first&&next)&&Math.abs(first.top-next.top)<5};
  });
  expect(layout.overflowX).toBe("auto");
  expect(layout.sameRow).toBe(true);
});
