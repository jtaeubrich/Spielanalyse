import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
const upload=(name,game)=>({name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))});

async function importSeasonGame(page,game){
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles(upload("video-season.json",game));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList").getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
}

test("video-only archived scouting can resume editing in Video Scouting without switching to Live",async({page})=>{
  const game=structuredClone(fixture);
  game.gameName="Treia Videoanalyse";
  game.isHistorical=true;
  game.isVideoscoutingFile=true;
  await importSeasonGame(page,game);
  await expect(page.locator("#homeSeasonGames")).toContainText("Fortsetzen");
  await page.locator("#homeSeasonGames").getByRole("button",{name:"Fortsetzen"}).click();
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator("#matchTab")).toBeVisible();
  await expect(page.locator("#modeSelect")).toHaveValue("video");
  await expect(page.locator("body")).toHaveClass(/video-scouting-layout/);
  await expect(page.locator("#matchVideoHost")).toBeVisible();
  const total=game.events.length;
  await expect(page.locator("#eventCount")).toContainText(String(total));
  await page.locator("#modeSelect").selectOption("live");
  await expect(page.locator("#modeSelect")).toHaveValue("video");
  await expect(page.locator("#eventCount")).toContainText(String(total));
  await page.reload();
  await page.locator("#homeRecentOptions").getByRole("button",{name:"Spiel fortsetzen"}).click();
  await expect(page.locator("#modeSelect")).toHaveValue("video");
  await expect(page.locator("body")).toHaveClass(/video-scouting-layout/);
});

test("finishing a live match permanently opens Video-Nachanalyse without deleting any events",async({page})=>{
  const game=structuredClone(fixture);
  game.gameName="Live abgeschlossen";
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  delete game.liveScoutingCompleted;
  await importSeasonGame(page,game);
  await page.locator("#homeSeasonGames").getByRole("button",{name:"Fortsetzen"}).click();
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  const count=game.events.length;
  await expect(page.locator("#eventCount")).toContainText(String(count));
  await expect(page.locator("#finishLiveScouting")).toBeVisible();
  await expect(page.locator("#matchReviewToggle")).toBeEnabled();
  page.once("dialog",dialog=>dialog.dismiss());
  await page.locator("#finishLiveScouting").click();
  await expect(page.locator("#modeSelect")).toBeEnabled();
  await expect(page.locator("body")).toHaveClass(/live-scouting-layout/);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#finishLiveScouting").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("#matchVideoHost")).toBeVisible();
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("#modeSelect")).toBeDisabled();
  await expect(page.locator("#runBtn")).toBeHidden();
  await expect(page.locator("#matchReviewToggle")).toBeDisabled();
  await expect(page.locator("#finishLiveScouting")).toBeHidden();
  await expect(page.locator("#eventCount")).toContainText(String(count));
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")));
  expect(persisted.state.liveScoutingCompleted).toBe(true);
  expect(persisted.state.events).toHaveLength(count);
  await page.reload();
  await page.locator("#homeRecentOptions").getByRole("button",{name:"Spiel fortsetzen"}).click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("#modeSelect")).toBeDisabled();
  await expect(page.locator("#runBtn")).toBeHidden();
  await expect(page.locator("#eventCount")).toContainText(String(count));
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList").getByRole("button",{name:"Öffnen",exact:true}).click();
  await page.locator("#homeSeasonGames").getByRole("button",{name:"Fortsetzen"}).click();
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("#modeSelect")).toBeDisabled();
  await expect(page.locator("#runBtn")).toBeHidden();
});

test("completed standalone live game restores video review label and video workspace",async({page})=>{
  const game=structuredClone(fixture);
  game.gameName="THW Kiel - HC Empor Rostock";
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  game.liveScoutingCompleted=true;
  game.timer={...game.timer,half:2,secondsElapsed:1802,active:false};
  const total=game.events.length;
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(upload("completed-live.json",game));
  await expect(page.locator("#matchTab")).toBeVisible();
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("#modeSelect")).toBeDisabled();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("body")).not.toHaveClass(/live-scouting-layout/);
  await expect(page.locator("#matchVideoHost")).toBeVisible();
  await expect(page.locator("#runBtn")).toBeHidden();
  await expect(page.locator("#halfBtn")).toBeHidden();
  await expect(page.locator("#eventCount")).toContainText(String(total));

  await page.locator('[data-tab="setup"]').click();
  await page.locator('[data-tab="match"]').click();
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);

  await page.reload();
  await page.locator("#homeRecentOptions").getByRole("button",{name:"Spiel fortsetzen"}).click();
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await expect(page.locator("#eventCount")).toContainText(String(total));
  const session=await page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")));
  expect(session.state.liveScoutingCompleted).toBe(true);
  expect(session.state.events).toHaveLength(total);
});

test("new manual game clears the review label after opening completed live game",async({page})=>{
  const game=structuredClone(fixture);
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  game.liveScoutingCompleted=true;
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(upload("completed-live.json",game));
  await expect(page.locator("#modeSelect")).toHaveValue("review");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#newGame").click();
  await page.locator("#newGameManual").click();
  await page.locator('[data-tab="match"]').click();
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  await expect(page.locator("#modeSelect")).toBeEnabled();
  await expect(page.locator("body")).toHaveClass(/live-scouting-layout/);
  await expect(page.locator("body")).not.toHaveClass(/match-review-mode/);
});

test("an empty upcoming fixture remains eligible for live scouting",async({page})=>{
  const fixtureGame=structuredClone(fixture);
  fixtureGame.gameName="Kommendes Saisonspiel";
  fixtureGame.events=[];
  fixtureGame.isHistorical=true;
  fixtureGame.isVideoscoutingFile=true;
  fixtureGame.officialSource={provider:"handball.net",matchId:"20261107"};
  await importSeasonGame(page,fixtureGame);
  await expect(page.locator("#homeSeasonGames")).toContainText("Fortsetzen");
  await page.locator("#homeSeasonGames").getByRole("button",{name:"Fortsetzen"}).click();
  await expect(page.locator("#setupPreflight")).toBeVisible();
  await page.locator("#preflightStart").click();
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  await expect(page.locator("body")).toHaveClass(/live-scouting-layout/);
  await expect(page.locator("#finishLiveScouting")).toBeHidden();
});

test("live events without finalization retain the reversible video review switch",async({page})=>{
  const game=structuredClone(fixture);
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(upload("live.json",game));
  await expect(page.locator("#modeSelect")).toHaveValue("live");
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/live-scouting-layout/);
  await expect(page.locator("#finishLiveScouting")).toBeVisible();
});
