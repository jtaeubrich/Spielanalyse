import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixturePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

async function openSeason(page) {
  await page.locator('[data-tab="setup"]').click();
  if(await page.locator("#setupModeSeason").isVisible())
    await page.locator("#setupModeSeason").click();
  else {
    await page.locator('[data-tab="home"]').click();
    await page.locator("#homeChooseSeason").click();
    await page.locator("#homeOpen").click();
    await page.locator("#homeAdvanced").click();
  }
  const game=JSON.parse(await readFile(fixturePath,"utf8"));
  game.gameName="iPad export fixture";
  game.home.name="TSV Kronshagen";
  await page.locator("#seasonGameInput").setInputFiles({
    name:"spiel.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await expect(page.locator("#seasonExport")).toBeEnabled();
}

test("on iPad: Saison exportieren hands a valid JSON file to the native share sheet",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{configurable:true,value:"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"});
    Object.defineProperty(navigator,"canShare",{configurable:true,value:({files})=>
      Array.isArray(files)&&files.length===1&&files[0].type==="application/json"
    });
    Object.defineProperty(navigator,"share",{configurable:true,value:async ({files})=>{
      window.__sharedFile={
        name:files[0].name,
        type:files[0].type,
        text:await files[0].text()
      };
    }});
  });
  await page.goto("/");
  await openSeason(page);
  await expect(page.locator("#seasonExport")).toHaveText("Saison-JSON in Dateien sichern");
  await expect(page.locator("#seasonExportDownload")).toBeVisible();
  await page.locator("#seasonExport").click();
  await expect.poll(()=>page.evaluate(()=>window.__sharedFile?.name)).toMatch(/\.json$/);
  const saved=await page.evaluate(()=>window.__sharedFile);
  const data=JSON.parse(saved.text);
  expect(data.games).toHaveLength(1);
  expect(saved.name).toMatch(/\.json$/);
  expect(saved.type).toBe("application/json");
  await expect(page.locator("#seasonExportStatus")).toContainText("Datei an „Teilen“ übergeben");
});

test("on iPad: unsupported Web Share offers explicit download without claiming success",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{configurable:true,value:"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"});
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false});
    Object.defineProperty(navigator,"share",{configurable:true,value:async()=>{throw Error("should not be invoked")}});
  });
  await page.goto("/");
  await openSeason(page);
  await page.locator("#seasonExport").click();
  await expect(page.locator("#seasonExportStatus")).toContainText("unterstützt das Teilen dieser Datei nicht");
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExportDownload").click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const data=JSON.parse(await readFile(await download.path(),"utf8"));
  expect(data.games).toHaveLength(1);
  await expect(page.locator("#seasonExportStatus")).toContainText("Download von");
});

test("on iPad: cancelling the native share dialog does not silently trigger a download",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{configurable:true,value:"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"});
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});
    Object.defineProperty(navigator,"share",{configurable:true,value:async()=>{throw new DOMException("Abbruch","AbortError")}});
  });
  await page.goto("/");
  await openSeason(page);
  const downloads=[];
  page.on("download",download=>downloads.push(download));
  await page.locator("#seasonExport").click();
  await expect(page.locator("#seasonExportStatus")).toContainText("Teilen nicht abgeschlossen");
  expect(downloads).toHaveLength(0);
});
