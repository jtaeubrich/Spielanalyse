import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/handbuch/demo/fixtures/00-setup.json");

async function openDemo(page,{extraPlayers=[],assist=false}={}){
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  const source=JSON.parse(await readFile(fixture,"utf8"));
  source.away.players.push(...extraPlayers);
  source.shotCapture={...source.shotCapture,assist,defense:false};
  await page.locator("#continueGameInput").setInputFiles({
    name:"fast-picker-demo.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(source))
  });
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  return source;
}
async function startShot(page,team="away"){
  await page.locator("#"+team+"Poss").click();
  await page.locator('[data-flow="shot"]').click();
  await expect(page.locator("#playerStep")).toBeVisible();
}

test("phone uses the numeric keypad, filters jersey prefixes and never auto-selects an ambiguous 1",async({page,isMobile})=>{
  test.skip(!isMobile,"smartphone keypad");
  const source=await openDemo(page);
  await startShot(page);
  const host=page.locator("#playerList");
  await expect(host.locator(".fast-picker-phone")).toBeVisible();
  await expect(host.locator(".fast-picker-key")).toHaveCount(12);
  await expect(host.locator(".fast-player-tile")).toHaveCount(0);
  await host.getByRole("button",{name:"Ziffer 1",exact:true}).click();
  await expect(page.locator("#playerStep")).toBeVisible();
  await expect(page.locator("#eventCount")).toHaveText("0 Ereignisse");
  await expect(host.locator(".fast-player-tile")).toHaveCount(7);
  expect(await host.locator(".fast-player-tile").evaluateAll(els=>els.map(el=>el.dataset.jerseyNumber)))
    .toEqual(["1","10","11","15","17","18","19"]);
  await host.getByRole("button",{name:"Ziffer 7",exact:true}).click();
  await expect(host.locator(".fast-player-tile")).toHaveCount(1);
  await expect(host.locator('.fast-player-tile[data-jersey-number="17"]')).toBeVisible();
  await host.locator('.fast-player-tile[data-jersey-number="17"]').click();
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator('#locationList [data-zone="K"]').click();
  await page.locator('#shotResultList [data-result="goal"]').click();
  await expect(page.locator("#idleStep")).toBeVisible();
  const event=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events.at(-1));
  expect(event).toMatchObject({type:"goal",team:"away",pId:source.away.players.find(p=>p.nr===17).id,pNr:17,scoreA:1});
});

test("phone allows correction, unknown player and an unnumbered player",async({page,isMobile})=>{
  test.skip(!isMobile,"smartphone keypad");
  const player={id:987654321,nr:"",nachname:"Ohne Nummer",vorname:"Test",isTW:false};
  await openDemo(page,{extraPlayers:[player]});
  await startShot(page);
  const host=page.locator("#playerList");
  await host.getByRole("button",{name:"Ziffer 2",exact:true}).click();
  await host.getByRole("button",{name:"Ziffer 7",exact:true}).click();
  await expect(host.locator(".fast-picker-results .fast-player-tile")).toHaveCount(0);
  await host.getByRole("button",{name:"Letzte Ziffer löschen"}).click();
  await expect(host.locator(".fast-picker-digits")).toHaveText("#2");
  await host.getByRole("button",{name:"Eingabe löschen"}).click();
  await expect(host.locator(".fast-picker-digits")).toHaveText("–");
  await host.getByRole("button",{name:"Ohne Trikotnummer (1)"}).click();
  await expect(host.locator(".fast-player-tile")).toHaveCount(1);
  await host.locator('[data-player-id="987654321"]').click();
  await expect(page.locator("#locationStep")).toBeVisible();
  await page.locator("#flowBack").click();
  await expect(page.locator("#playerStep")).toBeVisible();
  // The existing fallback to an unidentified player remains available.
  await expect(host.locator(".unknown-option")).toHaveCount(1);
  await host.locator(".unknown-option").click();
  await expect(page.locator("#locationStep")).toBeVisible();
});

test("tablet displays a stable numeric 4-by-4 grid with 16 players",async({page,isMobile})=>{
  test.skip(isMobile,"tablet viewport with non-phone user agent");
  await page.setViewportSize({width:820,height:1180});
  const extraPlayers=[
    {id:987654321,nr:2,nachname:"Extra",vorname:"Zwei",isTW:false},
    {id:987654322,nr:3,nachname:"Extra",vorname:"Drei",isTW:false}
  ];
  await openDemo(page,{extraPlayers});
  await startShot(page);
  const host=page.locator("#playerList");
  await expect(host.locator(".fast-picker-tablet")).toBeVisible();
  await expect(host.locator(".fast-picker-key")).toHaveCount(0);
  const tiles=host.locator(".fast-picker-tiles .fast-player-tile");
  await expect(tiles).toHaveCount(16);
  expect(await tiles.evaluateAll(els=>els.map(el=>Number(el.dataset.jerseyNumber))))
    .toEqual([1,2,3,7,10,11,15,17,18,19,22,23,25,84,95,99]);
  const dimensions=await host.locator(".fast-picker-tiles").evaluate(el=>({
    columns:getComputedStyle(el).gridTemplateColumns.split(" ").length,
    width:el.getBoundingClientRect().width,
    tiles:[...el.children].map(child=>({left:child.getBoundingClientRect().left,top:child.getBoundingClientRect().top}))
  }));
  expect(dimensions.columns).toBe(4);
  expect(new Set(dimensions.tiles.slice(0,4).map(t=>Math.round(t.top))).size).toBe(1);
  expect(new Set(dimensions.tiles.slice(0,4).map(t=>Math.round(t.left))).size).toBe(4);
  await host.locator('.fast-player-tile[data-jersey-number="17"]').click();
  await expect(page.locator("#locationStep")).toBeVisible();
});

test("tablet paginates after 16 while preserving the 4-column layout",async({page,isMobile})=>{
  test.skip(isMobile,"tablet viewport with non-phone user agent");
  await page.setViewportSize({width:820,height:1180});
  await openDemo(page,{extraPlayers:[
    {id:987654321,nr:2,nachname:"Extra",vorname:"Zwei",isTW:false},
    {id:987654322,nr:3,nachname:"Extra",vorname:"Drei",isTW:false},
    {id:987654323,nr:5,nachname:"Extra",vorname:"Fünf",isTW:false}
  ]});
  await startShot(page);
  const host=page.locator("#playerList");
  await expect(host.locator(".fast-player-tile")).toHaveCount(16);
  await host.locator(".fast-picker-pagination").getByRole("button",{name:"Weiter →"}).click();
  await expect(host.locator(".fast-player-tile")).toHaveCount(1);
  await expect(host.locator('.fast-player-tile[data-jersey-number="99"]')).toBeVisible();
});

test("penalties and assists reuse the responsive player picker",async({page,isMobile})=>{
  const source=await openDemo(page,{assist:true});
  await page.locator("#awayPoss").click();
  await page.locator('[data-flow="penalty"]').click();
  await expect(page.locator("#penaltyStep")).toBeVisible();
  const penalties=page.locator("#penaltyList");
  await expect(penalties.locator(isMobile?".fast-picker-phone":".fast-picker-tablet")).toBeVisible();
  if(isMobile)await penalties.getByRole("button",{name:"Ziffer 4",exact:true}).click();
  await penalties.locator('.fast-player-tile[data-jersey-number="4"]').click();
  await expect(page.locator("#penaltyTypeStep")).toBeVisible();
  await page.locator('[data-penalty-type="2min"]').click();
  await expect(page.locator("#idleStep")).toBeVisible();
  await page.locator("#awayPoss").click();
  await page.locator('[data-flow="shot"]').click();
  await expect(page.locator("#playerStep")).toBeVisible();
  const attackers=page.locator("#playerList");
  if(isMobile)await attackers.getByRole("button",{name:"Ziffer 7",exact:true}).click();
  await attackers.locator('.fast-player-tile[data-jersey-number="7"]').click();
  await page.locator('#locationList [data-zone="K"]').click();
  await page.locator('#shotResultList [data-result="goal"]').click();
  const assists=page.locator("#assistList");
  await expect(assists.locator(isMobile?".fast-picker-phone":".fast-picker-tablet")).toBeVisible();
  if(isMobile)await assists.getByRole("button",{name:"Ziffer 1",exact:true}).click();
  await expect(assists.locator('.fast-player-tile[data-jersey-number="7"]')).toHaveCount(0);
  await assists.locator('.fast-player-tile[data-jersey-number="1"]').click();
  await expect(page.locator("#idleStep")).toBeVisible();
  const event=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events.at(-1));
  expect(event).toMatchObject({type:"goal",pId:source.away.players.find(p=>p.nr===7).id,assistPId:source.away.players.find(p=>p.nr===1).id});
});
