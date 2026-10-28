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

test("season analysis follows preferred team on home and away fixtures and hides perspective chooser",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  const basic=JSON.parse(await readFile(file,"utf8"));
  const home=structuredClone(basic);
  home.gameName="Kronshagen Heimspiel";home.gameDate="2026-11-07";
  home.home.name="TSV Kronshagen";home.away.name="SG Flensburg-Handewitt II";
  home.ownTeam="away"; // A deliberately conflicting original scouting assignment.
  const away=structuredClone(basic);
  away.gameName="Kronshagen Auswärtsspiel";away.gameDate="2027-02-21";
  away.home.name="SG Flensburg-Handewitt II";away.away.name="TSV Kronshagen";
  away.ownTeam="home";
  const upload=(name,data)=>({name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))});
  await page.locator("#seasonGameInput").setInputFiles([upload("home.json",home),upload("away.json",away)]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator("#seasonPreferredTeam").selectOption({label:"TSV Kronshagen"});
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisSubtabs")).toBeVisible();
  await expect(page.locator("#analysisSeasonSubtab")).toBeVisible();
  await expect(page.locator("#analysisPerspectiveControl")).toBeHidden();

  const pick=async(part)=>{
    const option=page.locator("#analysisGamePicker option").filter({hasText:part});
    await expect(option).toHaveCount(1);
    await page.locator("#analysisGamePicker").selectOption(await option.getAttribute("value"));
  };
  await pick("2026-11-07");
  await expect(page.locator("#analysisSeasonFocus")).toContainText("TSV Kronshagen");
  await expect(page.locator("#analysisTeamFilter")).toHaveValue("own");
  await expect(page.locator("#offenseMapTitle")).toContainText("TSV Kronshagen");
  await expect(page.locator("#defenseMapTitle")).toContainText("SG Flensburg-Handewitt II");
  await pick("2027-02-21");
  await expect(page.locator("#offenseMapTitle")).toContainText("TSV Kronshagen");
  await expect(page.locator("#defenseMapTitle")).toContainText("SG Flensburg-Handewitt II");
  await expect(page.locator("#analysisPerspectiveSelect")).toHaveValue("away");

  await page.locator("#analysisSeasonSubtab").click();
  await expect(page.locator("#seasonStats")).toBeVisible();
  await expect(page.locator('[data-tab="analysis"]')).toHaveClass(/active/);
  await page.locator("#analysisSingleSubtab").click();
  await expect(page.locator("#analysisPerspectiveControl")).toBeHidden();

  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#continueGameInput").setInputFiles(file);
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisSeasonSubtab")).toBeHidden();
  await expect(page.locator("#analysisPerspectiveControl")).toBeVisible();
  await expect(page.locator("#analysisPerspectiveSelect")).toHaveValue("neutral");
});
