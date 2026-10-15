test("separates game roster editing from persistent team collection in Setup",async({page})=>{
 await page.goto("/");
 await page.locator("#setupRosterPanel > summary").click();
 await expect(page.locator("#rosterTeam")).toBeVisible();
 await expect(page.locator("#addPlayer")).toHaveText(/Spieler hinzufügen/);
 await expect(page.locator("#rosterEditor")).toBeVisible();
 await page.locator("#setupTeamCollectionPanel > summary").click();
 await expect(page.locator("#knownRosterSelect")).toBeVisible();
 await expect(page.locator("#applyKnownRoster")).toHaveText("Für aktuelles Spiel verwenden");
 await expect(page.locator("#loadRosterCollection")).toHaveText("Spieler für aktuelle Mannschaft ergänzen");
 await expect(page.locator("#updateRosterCollection")).toHaveText("Spielkader in Sammlung speichern");
 await expect(page.locator("#deleteKnownRoster")).toHaveText("Aus Sammlung löschen");
});

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const hknFixture = path.resolve(here, "../fixtures/hkn_reference.json");
const h360Fixture = path.resolve(here, "../fixtures/handball360_378107.json");
async function loadVideoScoutingFixture(page){
 const fs=await import("node:fs/promises");
 const game=JSON.parse(await fs.readFile(hknFixture,"utf8"));
 game.isVideoscoutingFile=true;
 await page.locator("#continueGameInput").setInputFiles({
  name:"hkn_video_scouting.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))
 });
 await expect(page.locator("#modeSelect")).toHaveValue("video");
}


test("loads legacy game with symmetric home and away labels",async({page})=>{
 await page.goto("/");
 await page.locator("#continueGameInput").setInputFiles(hknFixture);
 await expect(page.locator("#homeName")).toContainText("Heim ·");
 await expect(page.locator("#setupHomeName")).toHaveValue("HSG Herzhorn/Kollmar/Neuendorf");
 await expect(page.locator("#setupOwnTeamSide")).toHaveCount(0);
});

test("imports the Handball360 reference payload without using the live proxy", async ({ page }) => {
  const fixture = JSON.parse(
    await (await import("node:fs/promises")).readFile(h360Fixture, "utf8")
  );

  await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:4173",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Authorization"
        }
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4173"
      },
      body: JSON.stringify(fixture)
    });
  });

  await page.goto("/");
  await page.locator("#newGame").click();
  await page.locator("#newGameHandball360").click();
  await page.locator("#handballNetUrl").fill("https://www.handball.net/match/378107");
  await page.locator("#handballNetCreateDirect").click();

  await expect(page.locator("#newGameHandball360Status")).toContainText("Spiel erfolgreich geladen");
  await expect(page.locator("#handballNetRawDetails")).not.toHaveAttribute("open", "");

  await page.locator("#handballNetCreateDirect").click();

  await expect(page.locator("#score")).toHaveText("26 : 35");
  await expect(page.locator("#homeName")).toContainText("Heim ·");
  await expect(page.locator("#awayName")).toContainText("Gast ·");
  await expect(page.locator("#homeName")).toContainText("Heim ·");

  await expect.poll(async () => page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open("handball-spielanalyse", 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("rosters", "readonly");
        const getAll = tx.objectStore("rosters").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const records = getAll.result || [];
          db.close();
          resolve(records);
        };
      };
    });
  })).toEqual(expect.arrayContaining([
    expect.objectContaining({
      players: expect.arrayContaining([
        expect.objectContaining({
          handballNetId: expect.any(String)
        })
      ])
    })
  ]));

  await page.getByRole("button", { name: "Setup" }).click();
  await page.locator("#setupTab details").filter({has:page.locator("summary", {hasText:"Spielkader bearbeiten"})}).locator("summary").click();
  await page.locator("#setupTeamCollectionPanel > summary").click();
  await expect(page.locator("#rosterCollectionStatus")).toContainText("H360-ID");

  await expect.poll(async () => page.locator("#knownRosterSelect option").count()).toBeGreaterThan(1);
  const firstKnownValue = await page.locator("#knownRosterSelect option").nth(1).getAttribute("value");
  const firstKnownLabel = await page.locator("#knownRosterSelect option").nth(1).textContent();
  await page.locator("#knownRosterSelect").selectOption(firstKnownValue);
  await page.locator("#applyKnownRoster").click();
  await expect(page.locator("#setupAwayName")).toHaveValue((firstKnownLabel || "").split(" · ")[0]);
});

test("setup stays usable on a mobile viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only smoke test");
  await page.goto("/");
  await expect(page.locator("#setupTab")).toBeVisible();
  await expect(page.locator("#newGame")).toBeVisible();
  await expect(page.locator("#setupHomeName")).toBeVisible();
});

test("Video Scouting places selectors before video and capture below without game clock buttons",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("body")).toHaveClass(/video-scouting-layout/);
 await expect(page.locator("#matchReviewTopHost #modeSelect")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOwnKeeper")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOpponentKeeper")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOwnDefense")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOpponentDefense")).toBeVisible();
 await expect(page.locator("#runBtn")).toBeHidden();
 await expect(page.locator("#gameClock")).toBeHidden();
 await expect(page.locator("#idleStep")).toBeVisible();
 const positions=await page.evaluate(()=>{
  const rect=id=>document.querySelector(id).getBoundingClientRect();
  return {selectors:rect("#matchReviewTopHost").bottom,video:rect("#matchVideoHost").top,capture:rect("#idleStep").top};
 });
 if((await page.evaluate(()=>window.innerWidth))<760){
   expect(positions.video).toBeLessThan(positions.selectors);
 }else{
   expect(positions.selectors).toBeLessThanOrEqual(positions.video+3);
 }
 expect(positions.video).toBeLessThan(positions.capture);
});

test("nearby events use a horizontal strip in Match video scouting",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchNearbyEvents")).toBeVisible();
 await expect(page.locator("#matchNearbyList")).toBeVisible();
 await expect(page.locator("#matchGrid > #matchNearbyEvents")).toHaveCount(1);
 await expect(page.locator("#matchNearbyList")).toContainText("Noch keine Ereignisse erfasst.");
 await expect(page.locator("#idleStep")).toBeVisible();
 await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
 await expect(page.locator("#matchNearbyEditorHost")).toHaveCount(1);
 await expect(page.locator("#matchNearbyList")).toHaveCount(1);
 await expect(page.locator("#matchNearbyList")).toHaveCSS("overflow-x",/auto|hidden/);
 await expect(page.locator("#matchMarkH1")).toBeVisible();
 await expect(page.locator("#matchMarkH2")).toBeVisible();
});

test("symmetric capture and season-only preferred team selector",async({page})=>{
 await page.goto("/");
 await expect(page.locator("#setupOwnTeamSide")).toHaveCount(0);
 await page.locator('[data-tab="match"]').click();
 await expect(page.locator("#homePoss")).toContainText("Ballbesitz");
 await expect(page.locator("#awayPoss")).toContainText("Ballbesitz");
 await expect(page.locator("#activeOwnKeeper").locator("..")).toContainText("Heim");
 await expect(page.locator("#activeOpponentKeeper").locator("..")).toContainText("Gast");
 await page.locator('[data-tab="season"]').click();
 await expect(page.locator("#seasonPreferredTeam")).toBeVisible();
});

test("season preferred team maps imported home and away matches",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="season"]').click();
 await page.locator("#seasonGameInput").setInputFiles(hknFixture);
 const team=page.locator("#seasonPreferredTeam");
 await expect(team.locator("option")).toContainText(["Keine Mannschaft ausgewählt","HSG Herzhorn/Kollmar/Neuendorf","Mein Team"]);
 await team.selectOption({label:"HSG Herzhorn/Kollmar/Neuendorf"});
 await expect(team).toHaveValue("HSG Herzhorn/Kollmar/Neuendorf");
 await expect(page.locator("#seasonGameList")).toContainText("HSG Herzhorn/Kollmar/Neuendorf");
});

test("key moment opens defender choices for neutral home and away possession",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator('[data-flow="key"]').click();
 await expect(page.locator("#keyTagList")).toBeVisible();
 await expect(page.locator("#keyTagList .unknown-option")).toHaveCount(1);
});

test("tablet landscape displays video and nearby events side by side",async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await page.locator("#videoSize").fill("64");
 const rects=await page.evaluate(()=>{
  const video=document.querySelector("#matchVideoHost").getBoundingClientRect();
  const events=document.querySelector("#matchNearbyEvents").getBoundingClientRect();
  return {videoLeft:video.left,videoRight:video.right,videoTop:video.top,eventsLeft:events.left,eventsTop:events.top};
 });
 expect(rects.eventsLeft).toBeGreaterThanOrEqual(rects.videoRight-3);
 expect(Math.abs(rects.eventsTop-rects.videoTop)).toBeLessThan(5);
});

test("tablet Match video events list aligns beside video without hosting details",async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const layout=await page.evaluate(()=>{
   const v=document.querySelector("#matchVideoHost").getBoundingClientRect();
   const e=document.querySelector("#matchNearbyEvents").getBoundingClientRect();
   return {difference:Math.abs(v.height-e.height),left:e.left,right:v.right,
     editorInVideo:document.querySelector("#matchVideoHost").contains(document.querySelector("#matchNearbyEditorHost"))};
 });
 expect(layout.difference).toBeLessThan(5);
 expect(layout.left).toBeGreaterThanOrEqual(layout.right-3);
 expect(layout.editorInVideo).toBe(true);
});

test("video tab exposes set current video or real time for selected event",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await expect(page.locator("#videoTabSetCurrentTime")).toBeVisible();
 await expect(page.locator("#videoTabSetCurrentTime")).toBeDisabled();
 await expect(page.locator("#videoTabSetCurrentTimeStatus")).toContainText("Ereignis auswählen");
});


test("video Match keeps list visible when editor is toggled",async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const list=page.locator("#matchNearbyList");
 const editor=page.locator("#matchNearbyEditorHost");
 await expect(list).toBeVisible();
 await expect(editor).toBeHidden();
 await expect(page.locator("#matchNearbyEvents")).toBeVisible();
});


test("new game action still opens dialog after video-sync module load",async({page})=>{
 const pageErrors=[];
 page.on("pageerror",error=>pageErrors.push(error.message));
 await page.goto("/");
 await page.locator("#newGame").click();
 await expect(page.locator("#newGameDialog")).toBeVisible();
 expect(pageErrors).toEqual([]);
});

test("landscape smartphone shows adjustable video width and compact control groups",async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#videoSize")).toBeVisible();
 await expect(page.locator("#videoSize")).toHaveAttribute("max","90");
 await page.locator("#videoSize").fill("72");
 await expect(page.locator("#videoSizeValue")).toHaveText("72 %");
 const layout=await page.evaluate(()=>{
   const host=document.querySelector("#matchVideoHost");
   const tempo=host.querySelector(".video-control-group:first-child").getBoundingClientRect();
   const seek=host.querySelector(".video-control-group:nth-child(2)").getBoundingClientRect();
   const list=document.querySelector("#matchNearbyEvents").getBoundingClientRect();
   const video=host.getBoundingClientRect();
   return {tempoY:tempo.top,seekY:seek.top,sideBySide:list.left>=video.right-3};
 });
 expect(Math.abs(layout.tempoY-layout.seekY)).toBeLessThan(5);
 expect(layout.sideBySide).toBe(true);
});

test("landscape Match video has 16:9 geometry and event position shortcut",async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchJumpToCurrentEvent")).toBeVisible();
 const geometry=await page.evaluate(()=>{
  const frame=document.querySelector("#matchVideoHost .video-frame").getBoundingClientRect();
  const stage=document.querySelector("#videoStage").getBoundingClientRect();
  return {frameRatio:frame.width/frame.height,stageRatio:stage.width/stage.height};
 });
 expect(geometry.frameRatio).toBeCloseTo(16/9,1);
 expect(geometry.stageRatio).toBeCloseTo(16/9,1);
});

test("Match video editor provides a close button",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchEditorClose")).toHaveCount(1);
 await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
 await page.evaluate(()=>document.querySelector("#matchNearbyEditorHost").classList.remove("hidden"));
 await expect(page.locator("#matchEditorClose")).toBeVisible();
 await page.locator("#matchEditorClose").click();
 await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
 await expect(page.locator("#matchNearbyList")).toBeVisible();
});

test("landscape phone attack capture actions fit in one compact row",async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const layout=await page.locator("#idleStep .actions").evaluate(el=>{
   const buttons=[...el.querySelectorAll(".choice")].filter(btn=>getComputedStyle(btn).display!=="none");
   const rects=buttons.map(btn=>btn.getBoundingClientRect());
   return {rows:new Set(rects.map(rect=>Math.round(rect.top))).size,largestHeight:Math.max(...rects.map(rect=>rect.height))};
 });
 expect(layout.rows).toBe(1);
 expect(layout.largestHeight).toBeLessThan(70);
});

test("video review clock controls are available with compact half markers",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#reviewClock")).toBeVisible();
 await expect(page.locator("#reviewVideoTime")).toBeVisible();
 await expect(page.locator("#reviewGameTime")).toHaveText("--:--");
 await expect(page.locator("#reviewClockStart")).toBeDisabled();
 await expect(page.locator("#reviewClockPause")).toBeDisabled();
 await expect(page.locator("#matchMarkH1")).toHaveText("H1");
 await expect(page.locator("#matchMarkH2")).toHaveText("H2");
});

test("automatic event scrolling dismisses details once selected event leaves view",async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
 await expect(page.locator("#matchEditorClose")).toHaveCount(1);
});

test("long press event menu can open details without video seek",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchEventHoldMenu")).toBeHidden();
 await expect(page.locator("#matchEventHoldDetails")).toHaveText("Details ohne Videosprung");
});

test("tablet video scouting shows four capture outcomes in one row and hides recent events",async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const result=await page.evaluate(()=>{
   const nodes=["shot","error","penalty","key"].map(key=>document.querySelector('#idleStep [data-flow="'+key+'"]'));
   return {tops:nodes.map(node=>Math.round(node.getBoundingClientRect().top)),recentVisible:getComputedStyle(document.querySelector("#matchGrid>.side>.events")).display!=="none"};
 });
 expect(new Set(result.tops).size).toBe(1);
 expect(result.recentVisible).toBe(false);
});

test("review match clock includes editable synchronization dialog",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#reviewGameTime")).toBeVisible();
 await expect(page.locator("#reviewClockDialog")).toBeHidden();
 await expect(page.locator("#reviewClockInput")).toHaveAttribute("placeholder","12:34");
});


test("iPad video scouting displays editable event details below video and before capture, closable with X",async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto("/");
 await loadVideoScoutingFixture(page);
 await page.locator('[data-tab="match"]').click();
 await expect(page.locator("#matchNearbyList .match-nearby-item").first()).toBeVisible();
 await page.locator("#matchNearbyList .match-nearby-item").first().click();
 const details=page.locator("#matchNearbyEditorHost");
 await expect(details).toBeVisible();
 await expect(page.locator("#matchEditorClose")).toBeVisible();
 await expect(page.locator("#videoEventEditor")).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>{
  const details=document.querySelector("#matchNearbyEditorHost");
  const video=document.querySelector("#matchVideoHost");
  const capture=document.querySelector("#matchReviewCaptureHost");
  const list=document.querySelector("#matchNearbyList");
  const detailRect=details.getBoundingClientRect();
  const captureRect=capture.getBoundingClientRect();
  return {
   insideVideo:video.contains(details),
   beforeCapture:details.nextElementSibling?.id==="matchReviewCaptureHost",
   afterVideo:detailRect.top>=video.querySelector(".video-frame").getBoundingClientRect().bottom,
   beforeCaptureInDom:Boolean(details.compareDocumentPosition(capture)&Node.DOCUMENT_POSITION_FOLLOWING),
   listParent:list.closest("#matchNearbyEvents")?.id
  };
 })).toEqual({
  insideVideo:true,
  beforeCapture:true,
  afterVideo:true,
  beforeCaptureInDom:true,
  listParent:"matchNearbyEvents"
 });
 await page.locator("#matchEditorClose").click();
 await expect(details).toBeHidden();
 await expect(page.locator("#matchNearbyList .match-nearby-item").first()).toBeVisible();
});


test("neutral event editor uses defense label and defending team for defender choices",async({page})=>{
 await page.goto("/");
 await loadVideoScoutingFixture(page);
 await page.locator('[data-tab="match"]').click();
 const shots=page.locator("#matchNearbyList .match-nearby-item");
 await expect(shots.first()).toBeVisible();
 let found=false;
 for(let i=0;i<Math.min(await shots.count(),60);i++){
   await shots.nth(i).click();
   const formation=page.locator("#veeDefenseFormation");
   if(await formation.count()){
     await expect(formation.locator("xpath=..")).toContainText("Deckungsformation");
     await expect(formation.locator("xpath=..")).not.toContainText(/Mein Team|Gegner/);
     await expect(page.locator("#veeTeam")).toBeVisible();
     found=true;
     break;
   }
 }
 expect(found).toBe(true);
});

test("video scouting aligns Sync H1 H2 with playback controls and hides jump status",async({page})=>{
 await page.setViewportSize({width:1180,height:820});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const controls=page.locator("#matchTab .video-control-groups");
 const sync=controls.locator(".match-review-sync");
 await expect(sync).toBeVisible();
 await expect(sync.getByText("Sync")).toBeVisible();
 await expect(sync.locator("#matchMarkH1")).toBeVisible();
 await expect(sync.locator("#matchMarkH2")).toBeVisible();
 await expect(page.locator("#videoMessage")).toBeHidden();
 const positions=await page.evaluate(()=>{
  const rect=s=>document.querySelector(s).getBoundingClientRect();
  return {tempo:rect("#matchTab .video-control-groups > .video-control-group").top,
   sync:rect("#matchTab .video-control-groups > .match-review-sync").top,
   tempoLeft:rect("#matchTab .video-control-groups > .video-control-group").left,
   syncLeft:rect("#matchTab .video-control-groups > .match-review-sync").left};
 });
 expect(Math.abs(positions.tempo-positions.sync)).toBeLessThan(6);
 expect(positions.syncLeft).toBeGreaterThan(positions.tempoLeft);
});

test("key moment defender roster refreshes on possession switch and keeps defender team",async({page})=>{
 await page.goto("/");
 await page.locator("#continueGameInput").setInputFiles(hknFixture);
 await page.locator('[data-tab="match"]').click();
 await page.locator("#homePoss").click();
 await page.locator('[data-flow="key"]').click();
 const roster=()=>page.locator("#keyTagList [data-player-id]").evaluateAll(nodes=>nodes.map(n=>n.dataset.playerId));
 const awayDefenders=await roster();
 expect(awayDefenders.length).toBeGreaterThan(0);
 await page.locator("#awayPoss").click();
 const homeDefenders=await roster();
 expect(homeDefenders.length).toBeGreaterThan(0);
 expect(homeDefenders).not.toEqual(awayDefenders);
 await page.locator("#keyTagList [data-player-id]").first().click();
 await page.locator("#commitKey").click();
 await expect.poll(()=>page.evaluate(()=>{
   const raw=localStorage.getItem("handballSpielanalyse.session");
   return raw?JSON.parse(raw).state.events.at(-1)?.playerTags?.[0]?.team:null;
 })).toBe("home");
});

test("sync dialog switches between half-relative and continuous match time",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const dialog=page.locator("#reviewClockDialog");
 await page.evaluate(()=>{
  const d=document.querySelector("#reviewClockDialog");
  d.dataset.half="2";d.dataset.videoAt="1600";d.showModal();
  document.querySelector("#reviewClockTimeMode").value="half";
  document.querySelector("#reviewClockInput").value="02:10";
 });
 const mode=page.locator("#reviewClockTimeMode");
 await expect(mode).toHaveValue("half");
 await mode.selectOption("total");
 await expect(page.locator("#reviewClockInput")).toHaveValue("27:10");
 await mode.selectOption("half");
 await expect(page.locator("#reviewClockInput")).toHaveValue("02:10");
 await page.locator("#reviewClockCancel").click();
 await expect(dialog).toBeHidden();
});

test("video clock row orders video game controls and right aligned score",async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#reviewClock")).toBeVisible();
 const layout=await page.evaluate(()=>{
  const row=document.querySelector("#reviewClock");
  const parts=["reviewVideoTime","reviewGameTime","reviewClockPause","reviewClockStart","reviewScore"].map(id=>document.getElementById(id).getBoundingClientRect());
  return {order:parts.every((r,i)=>i===0||r.left>=parts[i-1].left),rightGap:row.getBoundingClientRect().right-document.querySelector(".review-clock-score").getBoundingClientRect().right,
    scoreContainerMargin:getComputedStyle(document.querySelector(".review-clock-score")).marginLeft};
 });
 expect(layout.order).toBe(true);
 expect(layout.rightGap).toBeLessThan(25);
});

test("mobile video scouting keeps clocks and playback controls in one row and possession below video",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#reviewClock")).toBeVisible();
 const layout=await page.evaluate(()=>{
  const rect=selector=>document.querySelector(selector).getBoundingClientRect();
  const video=document.querySelector("#matchVideoHost");
  const possession=document.querySelector(".possession");
  const group=video.querySelector(".video-control-groups");
  const children=[...group.children].filter(el=>getComputedStyle(el).display!=="none");
  const clocks=[...document.querySelector("#reviewClock").children].filter(el=>getComputedStyle(el).display!=="none");
  return {
   possessionInVideo:video.contains(possession),
   possessionAfterControls:!!(group.compareDocumentPosition(possession)&Node.DOCUMENT_POSITION_FOLLOWING),
   playbackOneRow:children.every(el=>Math.abs(el.getBoundingClientRect().top-children[0].getBoundingClientRect().top)<10),
   clockOneRow:clocks.every(el=>Math.abs(el.getBoundingClientRect().top-clocks[0].getBoundingClientRect().top)<10),
   possessionBelowVideo:rect(".possession").top>=rect(".video-frame").bottom
  };
 });
 expect(layout).toEqual({possessionInVideo:true,possessionAfterControls:true,playbackOneRow:true,clockOneRow:true,possessionBelowVideo:true});
});

test("video timestamp editor accepts colon and dot on mobile keyboards",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 const input=page.locator("#reviewClockInput");
 await expect(input).toHaveAttribute("inputmode","text");
 await loadVideoScoutingFixture(page);
 await page.locator('[data-tab="match"]').click();
 await page.locator("#matchNearbyList .match-nearby-item").first().click();
 const videoTime=page.locator("#veeRealTime");
 await expect(videoTime).toHaveAttribute("inputmode","text");
 await videoTime.fill("47:39.6");
 await expect(videoTime).toHaveValue("47:39.6");
});
