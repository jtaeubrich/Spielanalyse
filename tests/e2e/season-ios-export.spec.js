import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");
async function openSeasonWithGame(page){
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.gameName="Exportprüfung iPad";
  game.gameDate="2026-11-07T15:00:00";
  game.home.name="TSV Kronshagen";
  game.away.name="Testgegner";
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  game.ownTeam="home";
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  if(await page.locator("#setupModeSeason").isVisible()){
    await page.locator("#setupModeSeason").click();
  } else {
    await page.locator('[data-tab="home"]').click();
    await page.locator("#homeChooseSeason").click();
    await page.locator("#homeOpen").click();
    await page.locator("#homeAdvanced").click();
  }
  await page.locator("#seasonGameInput").setInputFiles({
    name:"spiel_export.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await expect(page.locator("#seasonExport")).toBeEnabled();
  await expect(page.locator("#seasonExportDownload")).toBeVisible();
}
async function setFakeIPad(page,mode){
  await page.addInitScript(mode=>{
    Object.defineProperty(navigator,"platform",{configurable:true,value:"MacIntel"});
    Object.defineProperty(navigator,"maxTouchPoints",{configurable:true,value:5});
    window.__shareResult=null;
    Object.defineProperty(navigator,"canShare",{configurable:true,value:({files})=>
      (mode==="supported"||mode==="cancel")?Boolean(files?.length):
      mode==="txt"?(files?.[0]?.name?.endsWith(".txt")||false):
      false
    });
    Object.defineProperty(navigator,"share",{configurable:true,value:async({files})=>{
      if(mode==="cancel")throw new DOMException("Abgebrochen","AbortError");
      const file=files[0];
      window.__shareResult={name:file.name,type:file.type,text:await file.text()};
    }});
  },mode);
}

test("iPad season export shares complete JSON using native file share instead of triggering a download",async({page})=>{
  await setFakeIPad(page,"supported");
  await openSeasonWithGame(page);
  await expect(page.locator("#seasonExport")).toHaveText("Saison-JSON in Dateien sichern");
  await page.locator("#seasonExport").click();
  await expect(page.locator("#seasonExportStatus")).toContainText("Datei an „Teilen“ übergeben");
  const result=await page.evaluate(()=>window.__shareResult);
  expect(result).toBeTruthy();
  expect(result.name).toMatch(/\.json$/);
  expect(result.type).toBe("application/json");
  const json=JSON.parse(result.text);
  expect(json.games).toHaveLength(1);
  expect(result.text).toContain("TSV Kronshagen");
});

test("iPad unsupported share offers explicit download fallback with intact season data",async({page})=>{
  await setFakeIPad(page,"unsupported");
  await openSeasonWithGame(page);
  await page.locator("#seasonExport").click();
  await expect(page.locator("#seasonExportStatus")).toContainText("Teilen dieser Datei nicht");
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.locator("#seasonExportDownload").click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const data=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(data.games).toHaveLength(1);
  await expect(page.locator("#seasonExportStatus")).toContainText("Download von");
  await expect(page.locator("#seasonExportStatus")).toContainText("Browser-Downloadliste");
});

test("iPad can share JSON content as renamed text when JSON file sharing is unavailable",async({page})=>{
  await setFakeIPad(page,"txt");
  await openSeasonWithGame(page);
  await page.locator("#seasonExport").click();
  await expect(page.locator("#seasonExportStatus")).toContainText(".json.txt");
  const result=await page.evaluate(()=>window.__shareResult);
  expect(result.name).toMatch(/\.json\.txt$/);
  expect(result.type).toBe("text/plain");
  expect(JSON.parse(result.text).games).toHaveLength(1);
});

test("iPad cancelled share is clearly reported without silently downloading",async({page})=>{
  await setFakeIPad(page,"cancel");
  await openSeasonWithGame(page);
  await page.locator("#seasonExport").click();
  // No download fallback is triggered by a cancellation.
  await expect(page.locator("#seasonExportStatus")).toContainText("Teilen nicht abgeschlossen");
});
