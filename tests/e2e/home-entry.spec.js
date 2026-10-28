import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

test("Home is the default entry and reveals the two-stage Saison/Einzelspiel actions",async({page})=>{
  await page.goto("/");
  await expect(page.locator("#homeTab")).toBeVisible();
  await expect(page.locator("#setupTab")).toBeHidden();
  await expect(page.locator("#homeChooseSeason")).toBeVisible();
  await expect(page.locator("#homeChooseGame")).toBeVisible();
  await expect(page.locator("#homeActions")).toBeHidden();
  await page.locator("#homeChooseGame").click();
  await expect(page.locator("#homeOpenLabel")).toHaveText("Spiel laden");
  await expect(page.locator("#homeImportHint")).toContainText("Spiel-JSON");
  await expect(page.locator("#homeNewHint")).toContainText("Handball360");
  await expect(page.locator("#homeActions")).toBeVisible();
  await expect(page.locator("#homeOpen")).toBeVisible();
  await expect(page.locator("#homeImport")).toBeVisible();
  await expect(page.locator("#homeNew")).toBeVisible();
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeChooseSeason")).toBeVisible();
  await page.locator("#homeChooseSeason").click();
  await expect(page.locator("#homeOpenLabel")).toHaveText("Saison laden");
  await expect(page.locator("#homeImportHint")).toContainText("Saison-JSON");
  await expect(page.locator("#homeNewHint")).toContainText("Unabhängige Saison");
  await expect(page.locator("#homeBreadcrumb")).toContainText("Saison");
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibrary")).toBeVisible();
  await expect(page.locator("#homeLibraryTitle")).toHaveText("Gespeicherte Saisons");
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeActions")).toBeVisible();
  // The expert Setup remains directly accessible at any time.
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupTab")).toBeVisible();
  await page.locator('[data-tab="home"]').click();
  await expect(page.locator("#homeChooseSeason")).toBeVisible();
});

test("Home > Einzelspiel > Neu anlegen offers the existing manual/H360 dialog without destroying active match",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeNew").click();
  await expect(page.locator("#newGameDialog")).toBeVisible();
  await expect(page.locator("#newGameManual")).toBeVisible();
  await expect(page.locator("#newGameHandball360")).toBeVisible();
  await page.locator("#newGameCancel").click();
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeNew").click();
  await page.locator("#newGameManual").click();
  await expect(page.locator("#setupTab")).toBeVisible();
  await expect(page.locator("#setupSinglePanel")).toBeVisible();
  await page.locator('[data-tab="home"]').click();
  await expect(page.locator("#homeRecent")).toBeVisible();
  await page.locator("#homeRecentOptions").getByRole("button",{name:"Spiel fortsetzen"}).click();
  await expect(page.locator("#matchTab")).toBeVisible();
});

test("Home > Einzelspiel > Importieren loads JSON and can resume the saved game after reload",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(fixture);
  await expect(page.locator("#matchTab")).toBeVisible();
  const before=await page.locator("#homeName").textContent();
  await page.reload();
  await expect(page.locator("#homeTab")).toBeVisible();
  await expect(page.locator("#homeRecentOptions")).toContainText(/Ereignisse/);
  await page.locator("#homeRecentOptions").getByRole("button",{name:"Spiel fortsetzen"}).click();
  await expect(page.locator("#matchTab")).toBeVisible();
  await expect(page.locator("#homeName")).toHaveText(before);
});

test("Home > Saison > Neu > dashboard retains existing current Match and enables season management",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("Neue Saison Demo 2026"));
  await page.locator("#homeNew").click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await expect(page.locator("#homeSeasonName")).toHaveText("Neue Saison Demo 2026");
  await expect(page.locator("#homeSeasonGames")).toContainText("noch keine Spiele");
  await page.locator("#homeSeasonManage").click();
  await expect(page.locator("#setupTab")).toBeVisible();
  await expect(page.locator("#setupSeasonPanel")).toBeVisible();
  await page.locator("#seasonGameInput").setInputFiles(fixture);
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  // All seasons now use "Öffnen". Choose the intended row before clicking.
  const selectedSeason=page.locator("#homeLibraryList .home-list-row")
    .filter({hasText:"Neue Saison Demo 2026"});
  await expect(selectedSeason).toHaveCount(1);
  await selectedSeason.getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await expect(page.locator("#homeSeasonGames .home-list-row")).toHaveCount(1);
  await expect(page.locator("#homeSeasonGames")).toContainText("Analysieren");
  await page.locator("#homeSeasonGames").getByRole("button",{name:"Analysieren"}).click();
  await expect(page.locator("#analysisTab")).toBeVisible();
  await expect(page.locator("#score")).toBeVisible();
});

test("Home can switch between locally saved seasons without replacing the open scouting game",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(fixture);
  await expect(page.locator("#matchTab")).toBeVisible();
  const game=await page.locator("#homeName").textContent();
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("Saison A"));
  await page.locator("#homeNew").click();
  await expect(page.locator("#homeSeasonName")).toHaveText("Saison A");
  await page.locator("#homeSeasonManage").click();
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("Saison B"));
  await page.locator("#homeNew").click();
  await expect(page.locator("#homeSeasonName")).toHaveText("Saison B");
  await page.reload();
  await expect(page.locator("#homeTab")).toBeVisible();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList")).toContainText("Saison A");
  await expect(page.locator("#homeLibraryList")).toContainText("Saison B");
  const row=page.locator("#homeLibraryList .home-list-row").filter({hasText:"Saison A"});
  await row.getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonName")).toHaveText("Saison A");
  await page.locator('[data-tab="match"]').click();
  await expect(page.locator("#homeName")).toHaveText(game);
});

test("Home uses distinct self-contained SVG icons for seasons and games",async({page})=>{
  await page.goto("/");
  await expect(page.locator("#homeChoose .home-choice-icon svg")).toHaveCount(2);
  await expect(page.locator('[data-entry-icon="season"] svg')).toHaveCount(1);
  await expect(page.locator('[data-entry-icon="game"] svg')).toHaveCount(1);
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("Grafik Test"));
  await page.locator("#homeNew").click();
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeLibrary")).toBeVisible();
  await expect(page.locator("#homeLibraryList .home-list-icon svg")).toHaveCount(2);
});

test("season overview replaces the generic hero with team, season and stored club logo",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("TSV Kronshagen · Saison 2026/27"));
  await page.locator("#homeNew").click();
  await expect(page.locator("#homeSeasonTeam")).toHaveText("TSV Kronshagen");
  await expect(page.locator("#homeSeasonName")).toHaveText("Saison 2026/27");
  await expect(page.locator("#homeSeasonInfo")).toContainText("0 Saisonspiele");
  await expect(page.locator("#homeSeasonDashboard #homeSeasonOther")).toHaveCount(0);
  await expect(page.locator("#homeTitle")).toBeHidden();
  await expect(page.locator("#homeSeasonLogoFallback svg")).toBeVisible();
  await expect(page.locator("#homeSeasonDashboard #homeSeasonName")).toHaveCount(0);
  const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a2iwAAAAASUVORK5CYII=";
  await page.evaluate(data=>new Promise((resolve,reject)=>{
    const open=indexedDB.open("handball-spielanalyse",3);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const db=open.result,transaction=db.transaction("rosters","readwrite");
      transaction.objectStore("rosters").put({
        id:"kronshagen-logo-test",teamName:"TSV Kronshagen",players:[],
        logoDataUrl:data
      });
      transaction.oncomplete=()=>{db.close();resolve()};
      transaction.onerror=()=>reject(transaction.error);
    };
  }),png);
  await page.locator("#homeBack").click();
  await expect(page.locator("#homeLibrary")).toBeVisible();
  await page.locator("#homeLibraryList .home-list-row")
    .filter({hasText:"TSV Kronshagen"}).getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonLogoImage")).toBeVisible();
  await expect(page.locator("#homeSeasonLogoImage")).toHaveAttribute("src",png);
  await page.reload();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList .home-list-row")
    .filter({hasText:"TSV Kronshagen"}).getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonLogoImage")).toBeVisible();
  await expect(page.locator("#homeSeasonName")).toHaveText("Saison 2026/27");
});

test("Home > Einzelspiel import opens only game settings and returns via Start to season management",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(fixture);
  await expect(page.locator("#matchTab")).toBeVisible();
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupSinglePanel")).toBeVisible();
  await expect(page.locator("#setupContextBar")).toBeVisible();
  await expect(page.locator("#setupContextTitle")).toContainText("Einzelspiel");
  await expect(page.locator("#setupModeSeason")).toBeHidden();
  await expect(page.locator(".setup-season-loader")).toBeHidden();
  await expect(page.locator(".setup-game-file-actions")).toBeHidden();
  await page.locator("#preflightOpenRoster").click();
  await expect(page.locator("#setupModeSeason")).toBeHidden();
  await expect(page.locator("#setupRosterPanel")).toBeVisible();
  await page.locator("#setupContextReturn").click();
  await expect(page.locator("#homeChooseSeason")).toBeVisible();
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept("Kontext-Saison 2026/27"));
  await page.locator("#homeNew").click();
  await page.locator("#homeSeasonManage").click();
  await expect(page.locator("#setupSeasonPanel")).toBeVisible();
  await expect(page.locator("#setupSinglePanel")).toBeHidden();
  await expect(page.locator("#setupContextTitle")).toContainText("Saison");
  await expect(page.locator("#setupModeSingle")).toBeHidden();
  await page.locator("#setupContextReturn").click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
});

test("Home > Einzelspiel > Neu keeps focused game preparation without season controls",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeNew").click();
  await page.locator("#newGameManual").click();
  await expect(page.locator("#setupContextBar")).toBeVisible();
  await expect(page.locator("#setupModeSeason")).toBeHidden();
  await expect(page.locator(".setup-season-loader")).toBeHidden();
  await expect(page.locator("#setupGameName")).toBeVisible();
  await expect(page.locator("#setupCapturePanel")).toBeVisible();
});

test("independent JSON hides all season controls even when a season is stored",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles(fixture);
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator("#setupModeSingle").click();
  await page.locator("#continueGameInput").setInputFiles(fixture);
  await expect(page.locator("#matchTab")).toBeVisible();
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupContextBar")).toBeVisible();
  await expect(page.locator("#setupContextTitle")).toContainText("Einzelspiel");
  await expect(page.locator(".setup-season-loader")).toBeHidden();
  await expect(page.locator("#setupModeSeason")).toBeHidden();
  await expect(page.locator("#setupSeasonPanel")).toBeHidden();
  await page.reload();
  await page.locator('[data-tab="setup"]').click();
  await expect(page.locator("#setupContextTitle")).toContainText("Einzelspiel");
  await expect(page.locator(".setup-season-loader")).toBeHidden();
  await page.locator("#setupContextReturn").click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeAdvanced").click();
  await expect(page.locator("#setupSeasonPanel")).toBeVisible();
  await expect(page.locator("#setupSinglePanel")).toBeHidden();
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
});
