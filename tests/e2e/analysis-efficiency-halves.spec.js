import {test,expect} from "@playwright/test";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function openFixture(page,source=fixture){
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(source);
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisDonuts .donut-wrap")).toHaveCount(3);
}
const rate=(goals,total)=>total?Math.round(100*goals/total)+"%":"–";

test("efficiency circles switch between total, first and second half without changing other analysis cards",async({page})=>{
  await openFixture(page);
  const ring=n=>page.locator("#analysisDonuts .donut-wrap").nth(n);
  const button=period=>page.locator('[data-efficiency-half="'+period+'"]');
  const summary=await page.locator("#analysisStats").innerText();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events);

  await expect(ring(0)).toContainText("Wurfeffizienz");
  await expect(ring(0).locator("strong")).toHaveText("63%");
  await expect(ring(1).locator("strong")).toHaveText("50%");
  await expect(ring(2).locator("strong")).toHaveText("24%");
  await expect(button("all")).toHaveAttribute("aria-pressed","true");

  await button("1").click();
  await expect(ring(0).locator("strong")).toHaveText("60%");
  await expect(ring(1).locator("strong")).toHaveText("48%");
  await expect(ring(2).locator("strong")).toHaveText("26%");
  await expect(ring(0)).toContainText("31 Tore / 52 Würfe");
  await expect(ring(1)).toContainText("31 Tore / 64 Angriffe");
  await expect(button("1")).toHaveAttribute("aria-pressed","true");
  await expect(button("all")).toHaveAttribute("aria-pressed","false");

  await button("2").click();
  await expect(ring(0).locator("strong")).toHaveText("67%");
  await expect(ring(1).locator("strong")).toHaveText("52%");
  await expect(ring(2).locator("strong")).toHaveText("21%");
  await expect(ring(0)).toContainText("30 Tore / 45 Würfe");
  await expect(ring(1)).toContainText("30 Tore / 58 Angriffe");
  await expect(page.locator("#analysisEfficiencyNote")).toContainText("2. Halbzeit");

  expect(await page.locator("#analysisStats").innerText()).toBe(summary);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state.events)).toEqual(saved);

  await button("all").click();
  await expect(ring(0).locator("strong")).toHaveText("63%");
  await expect(ring(1).locator("strong")).toHaveText("50%");
  await expect(ring(2).locator("strong")).toHaveText("24%");
  await expect(page.locator("#analysisEfficiencyNote")).toHaveText("Gesamtes Spiel");
});

test("half-specific efficiency follows the existing team perspective",async({page})=>{
  await openFixture(page);
  await page.locator("#analysisPerspectiveSelect").selectOption("home");
  await page.locator('[data-efficiency-half="1"]').click();
  const data=JSON.parse(await readFile(fixture,"utf8"));
  const first=data.events.filter(event=>event.half===1);
  const side=event=>["save","block"].includes(event.type)
    ? event.endedPossessionOf||(event.team==="home"?"away":"home")
    : event.team;
  const shots=first.filter(event=>["shot","goal","miss","save","block"].includes(event.type)
    &&event.type!=="shot"&&side(event)==="home");
  const goals=shots.filter(event=>event.type==="goal").length;
  const errors=first.filter(event=>event.type==="error"&&side(event)==="home").length;
  const rings=page.locator("#analysisDonuts .donut-wrap");
  await expect(rings.nth(0).locator("strong")).toHaveText(rate(goals,shots.length));
  await expect(rings.nth(1).locator("strong")).toHaveText(rate(goals,shots.length+errors));
  await page.locator("#analysisPerspectiveSelect").selectOption("neutral");
  await expect(rings.nth(0).locator("strong")).toHaveText("60%");
  await expect(rings.nth(1).locator("strong")).toHaveText("48%");
});

test("empty second half shows missing values rather than fabricated zero efficiency",async({page})=>{
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.events=game.events.filter(event=>event.half===1);
  const source={name:"nur-erste-halbzeit.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))};
  await openFixture(page,source);
  await page.locator('[data-efficiency-half="2"]').click();
  const rings=page.locator("#analysisDonuts .donut-wrap");
  await expect(rings.nth(0).locator("strong")).toHaveText("–");
  await expect(rings.nth(1).locator("strong")).toHaveText("–");
  await expect(rings.nth(2).locator("strong")).toHaveText("–");
  await expect(rings.nth(1)).toContainText("0 Tore / 0 Angriffe");
});
