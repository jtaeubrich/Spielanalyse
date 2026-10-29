import {test,expect} from "@playwright/test";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";

const fixture=JSON.parse(await readFile(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
const upload=(name,data)=>({name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))});
function makeGame(name,date,home,away,goals=1){
  const data=structuredClone(fixture);
  data.gameName=name;data.gameDate=date;
  data.home.name=home;data.away.name=away;
  data.ownTeam="away";
  data.events=Array.from({length:goals},(_,i)=>({
    id:"goal-"+i,type:"goal",team:"home",time:60+i*30,scoreH:i+1,scoreA:0,
    pId:null,z:"RL",gz:"UL"
  }));
  data.isHistorical=false;data.isVideoscoutingFile=false;
  return data;
}
test("opening a season selects the most recent recorded fixture for analysis without replacing the standalone match",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  const standalone=makeGame("THW Einzelspiel","2026-10-01","THW Kiel","HC Empor Rostock",3);
  await page.locator("#continueGameInput").setInputFiles(upload("einzelspiel.json",standalone));
  await expect(page.locator("#homeName")).toContainText("THW Kiel");
  await expect(page.locator("#score")).toHaveText("3 : 0");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeAdvanced").click();
  await page.locator("#seasonGameInput").setInputFiles([
    upload("frueh.json",makeGame("Frühes Spiel","2026-09-05","TSV Kronshagen","Gegner A",1)),
    upload("spaet.json",makeGame("Spätes Spiel","2026-10-12","Gegner B","TSV Kronshagen",2))
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator("#seasonPreferredTeam").selectOption({label:"TSV Kronshagen"});
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisSeasonSubtab")).toBeVisible();
  await expect(page.locator("#analysisPerspectiveControl")).toBeHidden();
  await expect(page.locator("#analysisGamePicker option:checked")).toContainText("2026-10-12");
  await expect(page.locator("#analysisSeasonFocus")).toContainText("TSV Kronshagen");
  await expect(page.locator("#offenseMapTitle")).toContainText("TSV Kronshagen");
  await expect(page.locator("#score")).toHaveText("2 : 0");
  await expect(page.locator("#analysisToVideo")).toBeDisabled();

  const independent=await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem("handballSpielanalyse.independentSession"));
    return {name:saved?.state?.gameName,events:saved?.state?.events?.length};
  });
  expect(independent).toEqual({name:"THW Einzelspiel",events:3});

  await page.locator("#analysisSeasonSubtab").click();
  await expect(page.locator("#seasonStats")).toBeVisible();
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeAdvanced").click();
  await expect(page.locator("#setupHomeName")).toHaveValue("THW Kiel");
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisSeasonSubtab")).toBeHidden();
  await expect(page.locator("#analysisPerspectiveControl")).toBeVisible();
  await expect(page.locator("#score")).toHaveText("3 : 0");
});
test("season analysis remembers the last edited fixture, including after reload",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    upload("frueh.json",makeGame("Frühes Spiel","2026-09-05","TSV Kronshagen","Gegner A",1)),
    upload("spaet.json",makeGame("Spätes Spiel","2026-10-12","Gegner B","TSV Kronshagen",2))
  ]);
  await page.locator("#seasonPreferredTeam").selectOption({label:"TSV Kronshagen"});
  await page.locator("#setupSeasonGameSelect").selectOption({index:1});
  await page.locator("#setupSeasonContinue").click();
  await expect(page.locator("#setupContextTitle")).toContainText("Saisonspiel");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList .home-list-row").first()
    .getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisGamePicker option:checked")).toContainText("2026-09-05");
  // The explicitly continued match can still access its video scenes.
  // Passive season previews never launch a new scouting session.
  await page.reload();
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisGamePicker option:checked")).toContainText("2026-09-05");
  await expect(page.locator("#analysisPerspectiveControl")).toBeHidden();
});
