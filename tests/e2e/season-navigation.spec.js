import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
const upload=(name,game)=>({name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))});
const game=(name,{events=[],home="HC Bremen",away="Gegner"}={})=>{
  const copy=structuredClone(fixture);
  copy.gameName=name;
  copy.gameDate=name==="Bremen Saisonspiel"?"2026-11-02T16:00:00":"2026-10-26T16:00:00";
  copy.home.name=home;copy.away.name=away;copy.events=events;
  copy.isHistorical=false;copy.isVideoscoutingFile=false;
  copy.ownTeam="home";
  return copy;
};
async function openSeasonSetup(page){
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await expect(page.locator("#seasonName")).toBeVisible();
}
async function newSeason(page,name){
  page.once("dialog",dialog=>dialog.accept(name));
  await page.locator("#seasonNew").click();
  await expect(page.locator("#seasonName")).toHaveValue(name);
}

test("Setup separates individual games and season administration from Saisonanalyse",async({page})=>{
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupSinglePanel")).toBeVisible();
  await expect(page.locator("#setupSeasonPanel")).toBeHidden();
  await openSeasonSetup(page);
  await expect(page.locator("#seasonHandball360Open")).toBeVisible();
  await expect(page.locator("#newGame")).toBeHidden();
  await page.locator('[data-tab="season"]').click();
  await expect(page.locator("#seasonStats")).toBeVisible();
  await expect(page.locator("#seasonHandball360Open")).toBeHidden();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await expect(page.locator("#newGame")).toBeVisible();
});

test("two separate seasons survive reload and never merge their match collections",async({page})=>{
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  await openSeasonSetup(page);
  const first=game("Kronshagen Saisonspiel",{home:"TSV Kronshagen",away:"VfL"});
  await page.locator("#seasonGameInput").setInputFiles(upload("kronshagen.json",first));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator("#seasonName").fill("Kronshagen – 2026/27");
  await page.locator("#seasonName").dispatchEvent("change");
  const kronshagenId=await page.locator("#seasonLibrarySelect").inputValue();
  await newSeason(page,"HC Bremen – 2026/27");
  const bremenId=await page.locator("#seasonLibrarySelect").inputValue();
  expect(bremenId).not.toBe(kronshagenId);
  await expect(page.locator("#seasonGameCount")).toContainText("0 Spiele");
  await page.locator("#seasonGameInput").setInputFiles(upload("bremen.json",game("Bremen Saisonspiel")));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await expect(page.locator("#seasonLibrarySelect option")).toHaveCount(2);
  await page.locator("#seasonLibrarySelect").selectOption(kronshagenId);
  await expect(page.locator("#seasonName")).toHaveValue("Kronshagen – 2026/27");
  await expect(page.locator("#seasonGameList")).toContainText("Kronshagen Saisonspiel");
  await expect(page.locator("#seasonGameList")).not.toContainText("Bremen Saisonspiel");
  await page.reload();
  await openSeasonSetup(page);
  await expect(page.locator("#seasonLibrarySelect option")).toHaveCount(2);
  await expect(page.locator("#seasonLibrarySelect")).toHaveValue(kronshagenId);
  await page.locator("#seasonLibrarySelect").selectOption(bremenId);
  await expect(page.locator("#seasonGameList")).toContainText("Bremen Saisonspiel");
  await expect(page.locator("#seasonGameList")).not.toContainText("Kronshagen Saisonspiel");
  await page.locator("#seasonLibrarySelect").selectOption(kronshagenId);
  await expect(page.locator("#seasonGameList")).toContainText("Kronshagen Saisonspiel");
});

test("analysis dropdown previews a season fixture without changing active scouting game",async({page})=>{
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  const active=game("Aktives Scouting",{events:[],home:"Mein Live-Team",away:"Gegner"});
  await page.locator("#continueGameInput").setInputFiles(upload("aktives-match.json",active));
  await expect(page.locator("#setupHomeName")).toHaveValue("Mein Live-Team");
  await openSeasonSetup(page);
  const archived=game("Bremen Saisonspiel",{events:[
    {id:"goal-1",type:"goal",team:"home",time:120,scoreH:1,scoreA:0,pId:null,z:"RL",gz:"UL"}
  ]});
  await page.locator("#seasonGameInput").setInputFiles(upload("archive.json",archived));
  await page.locator('[data-tab="analysis"]').click();
  const select=page.locator("#analysisGamePicker");
  await expect(select).toBeVisible();
  await expect(select.locator("option")).toHaveCount(2);
  await select.selectOption({index:1});
  await expect(page.locator("#analysisGamePickerStatus")).toContainText("Bremen Saisonspiel");
  await expect(page.locator("#analysisStats")).toContainText("1");
  await expect(page.locator("#analysisToVideo")).toBeDisabled();
  await expect(page.locator("#score")).toHaveText("0 : 0");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await expect(page.locator("#setupHomeName")).toHaveValue("Mein Live-Team");
  await page.locator('[data-tab="match"]').click();
  await expect(page.locator("#eventCount")).toContainText("0 Ereignisse");
  await page.locator('[data-tab="analysis"]').click();
  await select.selectOption("");
  await expect(page.locator("#analysisToVideo")).toBeEnabled();
  await expect(page.locator("#analysisStats")).toContainText("0");
});

test("an imported season fixture displays its official match URL and pre-fills the setup link",async({page})=>{
  await page.goto("/");
  await openSeasonSetup(page);
  const fixture=game("Kronshagen vs Flensburg",{home:"TSV Kronshagen",away:"SG Flensburg-Handewitt II"});
  fixture.officialSource={provider:"handball.net",matchId:"378112",matchDate:"2026-11-07"};
  await page.locator("#seasonGameInput").setInputFiles(upload("spiel_378112.json",fixture));
  await expect(page.locator("#seasonGameList")).toContainText("Handball.net");
  await expect(page.locator('#seasonGameList a[href="https://www.handball.net/match/378112"]')).toHaveCount(1);
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({label:/TSV Kronshagen/});
  await expect(page.locator("#setupSeasonRosterRefresh")).toBeEnabled();
  await expect(page.locator("#setupSeasonMatchLink")).toHaveAttribute("href","https://www.handball.net/match/378112");
  await page.locator("#setupSeasonContinue").click();
  await expect(page.locator("#existingH360Url")).toHaveValue("https://www.handball.net/match/378112");
  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#setupSeasonGameSelect").selectOption({label:/TSV Kronshagen/});
  await expect(page.locator("#setupSeasonMatchLink")).toHaveAttribute("href","https://www.handball.net/match/378112");
});
