import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function openWorkflow(page,mode,customizeGame=null){
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
  if(customizeGame)customizeGame(game);
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

test("Match sorts mixed imported and own events by game clock and still follows the video timeline",async({page,isMobile})=>{
  const game=await openWorkflow(page,"video",input=>{
    input.video={...input.video,syncUnit:"seconds",h1SyncRealTime:-5};
    const entry=(id,type,time,video,official=false)=>({
      id,type,team:"home",time,half:1,
      displayTime:String(Math.floor(time/60)).padStart(2,"0")+":"+
        String(time%60).padStart(2,"0"),
      realTime:Math.round(video*1000),
      ...(official?{officialSource:"handball.net"}:{})
    });
    input.events=[
      ...Array.from({length:18},(_,i)=>entry("lead-"+i,"goal",20+i*22,35+i*24,i%2===0)),
      entry("official-miss","miss",420,653.8,true),
      entry("official-goal","goal",659,681,true),
      entry("own-yellow","yellow",571,804.8,false),
      entry("own-goal","goal",742,880,false),
      entry("own-miss","miss",692,926.8,false),
      ...Array.from({length:16},(_,i)=>entry("tail-"+i,"goal",800+i*30,120+i*16,i%2===0))
    ];
  });
  const list=page.locator("#matchNearbyList");
  const rows=list.locator(".match-nearby-item");
  await expect(rows).toHaveCount(game.events.length);
  const order=await rows.evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.eventIndex)));
  expect(order.filter(index=>index>=18&&index<=22)).toEqual([18,20,19,22,21]);
  const labels=await rows.locator(".compact-event-head").allTextContents();
  const times=labels.map(label=>{
    const match=label.match(/^(\\d{1,3}):(\\d\\d)/);
    return match?Number(match[1])*60+Number(match[2]):NaN;
  });
  expect(times.every((time,i)=>i===0||time>=times[i-1])).toBe(true);
  await list.evaluate(host=>{
    host.scrollLeft=0;host.scrollTop=0;
    host.dispatchEvent(new WheelEvent("wheel",{bubbles:true}));
  });
  await page.evaluate(()=>{window.__fakeVideoTime=700});
  await page.locator("#matchJumpToCurrentEvent").click();
  // Video 13:24.8 (game time 09:31) is the first event after 11:35
  // on the video timeline; a game-time-ordered scan would choose 12:22.
  const target=list.locator('[data-event-index="20"]');
  await expect.poll(()=>target.evaluate(row=>{
    const host=row.parentElement.getBoundingClientRect(),box=row.getBoundingClientRect();
    return Math.abs(window.innerWidth<=600?box.left-host.left:box.top-host.top);
  })).toBeLessThan(isMobile?220:75);
  const saved=await page.evaluate(()=>JSON.parse(
    localStorage.getItem("handballSpielanalyse.session")).state.events);
  expect(saved.map(event=>event.id)).toEqual(game.events.map(event=>event.id));
  expect(saved.map(event=>event.time)).toEqual(game.events.map(event=>event.time));
  expect(saved.map(event=>event.realTime)).toEqual(game.events.map(event=>event.realTime));
});

test("trainer can mark an event comment, tag and individual drawing private",async({page})=>{
  const game=await openWorkflow(page,"video",input=>{
    input.events[0].tags=["Deckung:3:2:1","Trainerhinweis"];
    input.events[0].videoAnnotation={
      comment:"Gemeinsamer Kommentar",
      shapes:[{tool:"arrow",points:[{x:0.1,y:0.2},{x:0.4,y:0.5}]}]
    };
  });
  const first=page.locator("#matchNearbyList .match-nearby-item").first();
  await first.click();
  await expect(page.locator("#videoEventEditor")).toBeVisible();
  await expect(page.locator("#veePrivateComment")).not.toBeChecked();
  await expect(page.locator('[data-private-shape-index="0"]')).not.toBeChecked();
  await page.locator("#veePrivateComment").check();
  await page.locator('[data-private-shape-index="0"]').check();
  await page.locator('[data-private-tag="Trainerhinweis"]').check();
  await expect.poll(()=>page.evaluate(()=>{
    const game=JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state;
    const event=game.events[0];
    return {
      comment:event.teamSpacePrivate?.comment,
      shape:event.videoAnnotation.shapes[0].teamSpacePrivate,
      tags:event.teamSpacePrivate?.tags
    };
  })).toEqual({comment:true,shape:true,tags:["Trainerhinweis"]});
  await page.reload();
  await page.locator('[data-tab="match"]').click();
  await page.locator("#matchNearbyList .match-nearby-item").first().click();
  await expect(page.locator("#veePrivateComment")).toBeChecked();
  await expect(page.locator('[data-private-shape-index="0"]')).toBeChecked();
  await expect(page.locator('[data-private-tag="Trainerhinweis"]')).toBeChecked();
  expect(game.events.length).toBeGreaterThan(0);
});

test("official first goal recalibrates a late-start video without changing confirmed event times",async({page})=>{
  await openWorkflow(page,"video",game=>{
    game.video={...game.video,syncUnit:"seconds",
      h1SyncRealTime:0,h2SyncRealTime:1800};
    game.events=[
      {id:"early",type:"yellow",team:"away",time:6,half:1,
        officialSource:"handball.net",realTime:null},
      {id:"first-goal",type:"goal",team:"home",time:40,half:1,
        scoreH:1,scoreA:0,officialSource:"handball.net",realTime:null},
      {id:"confirmed",type:"goal",team:"away",time:60,half:1,
        scoreH:1,scoreA:1,officialSource:"handball.net",realTime:55000},
      {id:"later",type:"goal",team:"home",time:80,half:1,
        scoreH:2,scoreA:1,officialSource:"handball.net",realTime:null},
      {id:"second-half",type:"goal",team:"away",time:1515,half:2,
        scoreH:2,scoreA:2,officialSource:"handball.net",realTime:null}
    ];
  });
  const rows=page.locator("#matchNearbyList .match-nearby-item");
  await expect(rows).toHaveCount(5);
  await rows.nth(1).click();
  await expect(page.locator("#veeSyncHalfFromGoal")).toBeVisible();
  const dialogs=[];
  page.on("dialog",dialog=>{
    dialogs.push(dialog.message());
    return dialog.accept();
  });
  await page.evaluate(()=>{window.__fakeVideoTime=35});
  await page.locator("#veeSyncHalfFromGoal").click();
  await expect.poll(()=>page.evaluate(()=>
    JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.video.h1SyncRealTime
  )).toBe(-5);
  expect(dialogs.some(message=>message.includes("Neuer Halbzeit-Anpfiff")&&
    message.includes("-5.0 s"))).toBe(true);
  const after=await page.evaluate(async()=>{
    const mod=await import("/src/video-sync.js?v=152");
    const saved=JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state;
    const positions=Object.fromEntries(saved.events.map(event=>[
      event.id,mod.eventVideoPosition(event,{
        events:saved.events,video:saved.video,
        durationMinutes:saved.timer.duration,isVideoscoutingFile:true
      })
    ]));
    return {video:saved.video,events:saved.events,positions};
  });
  expect(after.video.h1SyncRealTime).toBe(-5);
  expect(after.video.h2SyncRealTime).toBe(1800);
  expect(after.events.map(event=>event.time)).toEqual([6,40,60,80,1515]);
  expect(after.events.find(event=>event.id==="first-goal").realTime).toBe(35000);
  expect(after.events.find(event=>event.id==="confirmed").realTime).toBe(55000);
  expect(after.positions.early).toEqual({seconds:1,status:"estimated"});
  expect(after.positions["first-goal"]).toEqual({seconds:35,status:"confirmed"});
  expect(after.positions.confirmed).toEqual({seconds:55,status:"confirmed"});
  expect(after.positions.later).toEqual({seconds:75,status:"estimated"});
  expect(after.positions["second-half"]).toEqual({seconds:1815,status:"estimated"});
});
