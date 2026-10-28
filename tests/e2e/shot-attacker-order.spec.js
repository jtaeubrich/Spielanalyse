import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/handbuch/demo/fixtures/00-setup.json");

async function openDemo(page,{assist=false,defense=false,own="away",target=false,phase=false}={}){
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  const source=JSON.parse(await readFile(fixture,"utf8"));
  source.shotCapture={...source.shotCapture,assist,defense,target,phase};
  source.ownTeam=own;
  await page.locator("#continueGameInput").setInputFiles({
    name:"demo_schuss.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(source))
  });
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  return source;
}
async function configureOrder(page,order){
  await page.locator('[data-tab="setup"]').click();
  const capturePanel=page.locator("#shotAttackerOrder").locator("xpath=ancestor::details[1]");
  if(!await capturePanel.evaluate(el=>el.open))await capturePanel.locator("summary").click();
  await page.locator("#shotAttackerOrder").selectOption(order);
  await expect(page.locator("#shotAttackerOrder")).toHaveValue(order);
  await page.locator('[data-tab="match"]').click();
}
async function startShot(page,team="away"){
  await page.locator("#"+team+"Poss").click();
  await page.locator('[data-flow="shot"]').click();
}
async function selectGoalDetails(page){
  await page.locator('#locationList button[data-zone="7M"]').click();
  await page.locator('#shotResultList [data-result="goal"]').click();
  // If enabled for this test, the optional assist step must be completed.
  if(await page.locator("#assistList").isVisible())
    await page.locator("#assistList").getByRole("button",{name:"Kein Assist"}).click();
}
async function pickJersey(page,host,number){
  const picker=page.locator(host);
  if(await picker.locator(".fast-picker-phone").isVisible()){
    for(const digit of String(number))
      await picker.locator(".fast-picker-key").filter({hasText:new RegExp("^"+digit+"$")}).click();
  }
  await picker.locator('.fast-player-tile[data-jersey-number="'+number+'"]').click();
}
async function latestEvent(page){
  return page.evaluate(()=>{
    const raw=localStorage.getItem("handballSpielanalyse.session");
    return JSON.parse(raw).state.events.at(-1);
  });
}

test("shot: scorer-last waits for hall speaker while preserving original event stamp and scoring",async({page})=>{
  const original=await openDemo(page);
  await configureOrder(page,"last");
  await startShot(page,"away");
  await expect(page.locator("#locationStep")).toBeVisible();
  await expect(page.locator("#playerStep")).toBeHidden();
  await selectGoalDetails(page);
  await expect(page.locator("#playerStep")).toBeVisible();
  await expect(page.locator("#playerTeamText")).toContainText("Schütze nach Durchsage");
  await expect(page.locator("#eventCount")).toHaveText("0 Ereignisse");
  await expect(page.locator("#flowBack")).toBeEnabled();
  await page.locator("#flowBack").click();
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator("#flowNext").click();
  await expect(page.locator("#playerStep")).toBeVisible();
  const shooter=original.away.players.find(p=>p.nr===7);
  await pickJersey(page,"#playerList",7);
  await expect(page.locator("#idleStep")).toBeVisible();
  await expect(page.locator("#eventCount")).toHaveText("1 Ereignisse");
  const e=await latestEvent(page);
  expect(e).toMatchObject({type:"goal",team:"away",pId:shooter.id,pNr:7,z:"7M",scoreA:1,scoreChanged:true});
  expect(e.realTime).toBeDefined();
  expect(e.time).toBeDefined();
  expect(e.endedPossessionOf).toBe("away");
  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  const panel=page.locator("#shotAttackerOrder").locator("xpath=ancestor::details[1]");
  if(!await panel.evaluate(el=>el.open))await panel.locator("summary").click();
  await expect(page.locator("#shotAttackerOrder")).toHaveValue("last");
});

test("shot: default shooter-first sequence remains unchanged",async({page})=>{
  const original=await openDemo(page);
  await startShot(page,"away");
  await expect(page.locator("#playerStep")).toBeVisible();
  await expect(page.locator("#locationStep")).toBeHidden();
  await pickJersey(page,"#playerList",7);
  await expect(page.locator("#locationStep")).toBeVisible();
  await selectGoalDetails(page);
  await expect(page.locator("#idleStep")).toBeVisible();
  const e=await latestEvent(page);
  expect(e).toMatchObject({type:"goal",team:"away",pId:original.away.players.find(p=>p.nr===7).id,scoreA:1,z:"7M"});
});

test("shot: scorer-last accepts unknown shooter and still commits exactly once",async({page})=>{
  await openDemo(page);
  await configureOrder(page,"last");
  await startShot(page,"away");
  await selectGoalDetails(page);
  await expect(page.locator("#playerStep")).toBeVisible();
  await page.locator("#playerList .unknown-option").click();
  await expect(page.locator("#idleStep")).toBeVisible();
  const events=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({type:"goal",pId:null,pName:"Unbekannt",team:"away",scoreA:1});
});

test("shot: scorer-last preserves the opponent defensive assignment before selecting shooter",async({page})=>{
  const original=await openDemo(page,{defense:true});
  await configureOrder(page,"last");
  await startShot(page,"home");
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator('#locationList button[data-zone="7M"]').click();
  await page.locator('#shotResultList [data-result="goal"]').click();
  await expect(page.locator("#tagsStep")).toBeVisible();
  const ownDefender=original.away.players.find(p=>p.nr===7);
  await page.locator("#tagList .option").filter({hasText:"Spieler 17"}).click();
  await expect(page.locator("#playerStep")).toBeVisible();
  const shooter=original.home.players.find(p=>p.nr===4);
  await pickJersey(page,"#playerList",4);
  const e=await latestEvent(page);
  expect(e).toMatchObject({type:"goal",team:"home",pId:shooter.id,scoreH:1});
  expect(e.playerTags).toEqual(expect.arrayContaining([expect.objectContaining({pId:ownDefender.id})]));
});


test("own shot never asks for a defender (Kronshagen away, scorer last)",async({page})=>{
  const original=await openDemo(page,{defense:true});
  await configureOrder(page,"last");
  await startShot(page,"away");
  await selectGoalDetails(page);
  await expect(page.locator("#tagsStep")).toBeHidden();
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",7);
  await expect(page.locator("#idleStep")).toBeVisible();
  const event=await latestEvent(page);
  expect(event).toMatchObject({type:"goal",team:"away",scoreA:1,
    pId:original.away.players.find(p=>p.nr===7).id});
  expect(event.playerTags).toEqual([]);
});

test("own shot skips defender assignment with Kronshagen at home",async({page})=>{
  const original=await openDemo(page,{defense:true,own:"home"});
  await configureOrder(page,"last");
  await startShot(page,"home");
  await selectGoalDetails(page);
  await expect(page.locator("#tagsStep")).toBeHidden();
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",4);
  const event=await latestEvent(page);
  expect(event).toMatchObject({type:"goal",team:"home",scoreH:1,
    pId:original.home.players.find(p=>p.nr===4).id});
  expect(event.playerTags).toEqual([]);
});

test("opponent shot still requests our defender when Kronshagen plays at home",async({page})=>{
  const original=await openDemo(page,{defense:true,own:"home"});
  await configureOrder(page,"last");
  await startShot(page,"away");
  await selectGoalDetails(page);
  await expect(page.locator("#tagsStep")).toBeVisible();
  await page.locator("#tagList .option").filter({hasText:"Spieler 02"}).click();
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",7);
  const event=await latestEvent(page);
  expect(event).toMatchObject({type:"goal",team:"away",scoreA:1});
  expect(event.playerTags).toEqual(expect.arrayContaining([
    expect.objectContaining({pId:original.home.players.find(p=>p.nr===4).id})
  ]));
});

test("shot: shooter-last clears assist when the announced shooter is also assist provider",async({page})=>{
  const original=await openDemo(page,{assist:true});
  await configureOrder(page,"last");
  await startShot(page,"away");
  await page.locator('#locationList button[data-zone="7M"]').click();
  await page.locator('#shotResultList [data-result="goal"]').click();
  await pickJersey(page,"#assistList",7);
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",7);
  const e=await latestEvent(page);
  expect(e.pId).toBe(original.away.players.find(p=>p.nr===7).id);
  expect(e).not.toHaveProperty("assistPId");
});

test("shot: technical errors still select offender first when scorer-last is enabled",async({page})=>{
  await openDemo(page);
  await configureOrder(page,"last");
  await page.locator("#awayPoss").click();
  await page.locator('[data-flow="error"]').click();
  await expect(page.locator("#playerStep")).toBeVisible();
  await page.locator("#playerList .unknown-option").click();
  await expect(page.locator("#errorStep")).toBeVisible();
});


test("miss outside the goal skips result confirmation and immediately opens shooter selection",async({page})=>{
  const original=await openDemo(page,{target:true,phase:true});
  await configureOrder(page,"last");
  for(const [code,selector] of [["ML",".goal-left"],["MR",".goal-right"],["OTM",".goal-over"]]){
    await startShot(page,"away");
    await expect(page.locator("#locationStep")).toBeVisible();
    await page.locator('#locationList button[data-zone="7M"]').click();
    await page.locator("#targetList "+selector).click();
    await expect(page.locator("#playerStep")).toBeVisible();
    await expect(page.locator("#phaseStep")).toBeHidden();
    await expect(page.locator("#missResultHint")).toBeHidden();
    await pickJersey(page,"#playerList",7);
    await expect(page.locator("#idleStep")).toBeVisible();
    const event=await latestEvent(page);
    expect(event).toMatchObject({
      type:"miss",team:"away",pId:original.away.players.find(p=>p.nr===7).id,
      z:"7M",gz:code,scoreChanged:false
    });
  }
  await expect(page.locator("#eventCount")).toHaveText("3 Ereignisse");
});

test("miss target can be revised after backing out of the shooter picker",async({page})=>{
  await openDemo(page,{target:true,phase:true});
  await configureOrder(page,"last");
  await startShot(page,"away");
  await page.locator('#locationList button[data-zone="7M"]').click();
  await page.locator("#targetList .goal-left").click();
  await expect(page.locator("#playerStep")).toBeVisible();
  await page.locator("#flowBack").click();
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator('#targetList button[data-target="OL"]').click();
  await expect(page.locator("#phaseStep")).toBeVisible();
  await page.locator('#shotResultList [data-result="goal"]').click();
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",7);
  expect(await latestEvent(page)).toMatchObject({type:"goal",gz:"OL",scoreChanged:true});
});

test("miss target with shooter-first saves immediately without a second result dialog",async({page})=>{
  const original=await openDemo(page,{target:true,phase:true});
  await configureOrder(page,"first");
  await startShot(page,"away");
  await expect(page.locator("#playerStep")).toBeVisible();
  await pickJersey(page,"#playerList",7);
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator('#locationList button[data-zone="7M"]').click();
  await page.locator("#targetList .goal-right").click();
  await expect(page.locator("#phaseStep")).toBeHidden();
  await expect(page.locator("#idleStep")).toBeVisible();
  expect(await latestEvent(page)).toMatchObject({
    type:"miss",team:"away",pId:original.away.players.find(p=>p.nr===7).id,gz:"MR"
  });
});
