import {test,expect} from "@playwright/test";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";

const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

test("neutral match can be evaluated from home and away without changing events",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(file);
  await page.locator('[data-tab="analysis"]').click();
  const data=JSON.parse(await readFile(file,"utf8"));
  const homeGoals=data.events.filter(e=>e.type==="goal"&&e.team==="home").length;
  const awayGoals=data.events.filter(e=>e.type==="goal"&&e.team==="away").length;
  const goalCount=()=>page.locator("#analysisStats .metric").first().locator("strong");
  const initial=await page.evaluate(()=>{
    const raw=JSON.parse(localStorage.getItem("handballSpielanalyse.session"));
    return {team:raw.state.ownTeam,events:JSON.stringify(raw.state.events)};
  });
  await expect(page.locator("#analysisPerspectiveSelect")).toHaveValue("neutral");
  await expect(page.locator("#offenseMapTitle")).toContainText("Angriffe · Heim");
  await expect(page.locator("#defenseMapTitle")).toContainText("Angriffe · Gast");
  await expect(goalCount()).toHaveText(String(homeGoals+awayGoals));
  await expect(page.locator("#analysisSpecialTeams > section")).toHaveCount(2);

  await page.locator("#analysisPerspectiveSelect").selectOption("home");
  await expect(page.locator("#analysisTeamFilter")).toHaveValue("own");
  await expect(page.locator("#offenseMapTitle")).toContainText(data.home.name);
  await expect(page.locator("#defenseMapTitle")).toContainText("Defensive");
  await expect(page.locator("#defenseMapTitle")).toContainText(data.away.name);
  await expect(goalCount()).toHaveText(String(homeGoals));
  await expect(page.locator("#analysisSpecialTeams > section")).toHaveCount(0);
  await expect(page.locator("#analysisPerspectiveStatus")).toContainText("Sicht Heim");

  await page.locator("#analysisPerspectiveSelect").selectOption("away");
  await expect(page.locator("#offenseMapTitle")).toContainText(data.away.name);
  await expect(page.locator("#defenseMapTitle")).toContainText(data.home.name);
  await expect(goalCount()).toHaveText(String(awayGoals));
  await expect(page.locator("#analysisPerspectiveStatus")).toContainText("Sicht Gast");
  const after=await page.evaluate(()=>{
    const raw=JSON.parse(localStorage.getItem("handballSpielanalyse.session"));
    return {team:raw.state.ownTeam,events:JSON.stringify(raw.state.events)};
  });
  expect(after).toEqual(initial);
  await page.locator("#analysisPerspectiveSelect").selectOption("neutral");
  await expect(goalCount()).toHaveText(String(homeGoals+awayGoals));
});

test("analysis side-specific map opens correct team in the video scene filter",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(file);
  await page.locator('[data-tab="analysis"]').click();
  await page.locator("#analysisPerspectiveSelect").selectOption("home");
  await page.locator("#offenseGoalMap [data-target]").first().click();
  await expect(page.locator("#videoTeamFilter")).toHaveValue("opponent");
  await page.locator('[data-tab="analysis"]').click();
  await page.locator("#analysisPerspectiveSelect").selectOption("away");
  await page.locator("#offenseGoalMap [data-target]").first().click();
  await expect(page.locator("#videoTeamFilter")).toHaveValue("own");
});
