import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixturePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/hkn_reference.json");
const fixture=JSON.parse(await readFile(fixturePath,"utf8"));
function gameFile(opponent,name){
  const game=structuredClone(fixture);
  game.home.name="HC Bremen";
  game.away.name=opponent;
  game.gameName=name;
  game.gameDate="2026-10-20";
  return {name:name+".json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))};
}
async function newSeason(page,name){
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept(name));
  await page.locator("#homeNew").click();
  await expect(page.locator("#homeSeasonDashboard")).toBeVisible();
  await page.locator("#homeSeasonManage").click();
}
test("Start searches saved season games; deleting one locally requires confirmation and persists",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    gameFile("Gast A","Erstes Spiel"),gameFile("Gast B","Zweites Spiel")
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator('[data-tab="home"]').click();
  const search=page.locator("#homeStartGameSearch"),results=page.locator("#homeStartSearchResults");
  await expect(search).toBeVisible();
  await search.fill("Gast A");
  await expect(results.locator(".home-list-row")).toHaveCount(1);
  await expect(results).toContainText("Gast A");
  const remove=results.getByRole("button",{name:/Spiel löschen/});
  await expect(remove).toHaveAttribute("title",/Spiel löschen/);
  page.once("dialog",dialog=>dialog.dismiss());
  await remove.click();
  await expect(results.locator(".home-list-row")).toHaveCount(1);
  page.once("dialog",dialog=>{
    expect(dialog.message()).toContain("Gast A");
    expect(dialog.message()).toContain("nur Daten auf diesem Gerät");
    return dialog.accept();
  });
  await remove.click();
  await expect(results.locator(".home-list-row")).toHaveCount(0);
  await expect(results).toContainText("Keine passenden");
  await search.fill("Gast B");
  await expect(results.locator(".home-list-row")).toHaveCount(1);
  await page.reload();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList .home-list-row").first()
    .getByRole("button",{name:"Öffnen",exact:true}).click();
  await expect(page.locator("#homeSeasonGames .home-list-row")).toHaveCount(1);
  await expect(page.locator("#homeSeasonGames")).toContainText("Gast B");
  await expect(page.locator("#homeSeasonGames")).not.toContainText("Gast A");
});

test("Spiel laden searches all seasons; removal changes only the matching season record",async({page})=>{
  await page.goto("/");
  await newSeason(page,"Saison A");
  await page.locator("#seasonGameInput").setInputFiles(gameFile("Gast A","Saison A Spiel"));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await newSeason(page,"Saison B");
  await page.locator("#seasonGameInput").setInputFiles(gameFile("Gast B","Saison B Spiel"));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  const search=page.locator("#homeLibraryGameSearch"),list=page.locator("#homeLibraryList");
  await expect(search).toBeVisible();
  await search.fill("Gast A");
  const row=list.locator(".home-list-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Saison A");
  page.once("dialog",dialog=>dialog.accept());
  await row.getByRole("button",{name:/Spiel löschen/}).click();
  await expect(row).toHaveCount(0);
  await search.fill("Gast B");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Saison B");
  await page.reload();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList .home-list-row")).toHaveCount(2);
  const openSeason=async name=>{
    await page.locator("#homeLibraryList .home-list-row").filter({hasText:name})
      .getByRole("button",{name:"Öffnen",exact:true}).click();
  };
  await openSeason("Saison A");
  await expect(page.locator("#homeSeasonGames .home-list-row")).toHaveCount(0);
  await page.locator("#homeBack").click();
  await openSeason("Saison B");
  await expect(page.locator("#homeSeasonGames .home-list-row")).toHaveCount(1);
  await expect(page.locator("#homeSeasonGames")).toContainText("Gast B");
});

test("Spiel laden removes current standalone session but never the source JSON file",async({page})=>{
  await page.goto("/");
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(fixturePath);
  await expect(page.locator("#matchTab")).toBeVisible();
  await page.locator('[data-tab="home"]').click();
  await expect(page.locator("#homeRecent")).toBeVisible();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  const search=page.locator("#homeLibraryGameSearch"),list=page.locator("#homeLibraryList");
  await search.fill("Herzhorn");
  const row=list.locator(".home-list-row");
  await expect(row).toHaveCount(1);
  page.once("dialog",dialog=>dialog.accept());
  await row.getByRole("button",{name:/Spiel löschen/}).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  // A season shortcut may remain visible; only the deleted game must be gone.
  await expect(page.locator("#homeRecentOptions .home-list-row").filter({hasText:"Herzhorn"})).toHaveCount(0);
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryGameSearch").fill("Herzhorn");
  await expect(page.locator("#homeLibraryList .home-list-row")).toHaveCount(0);
  // The user-supplied JSON still imports normally after local deletion.
  await page.locator("#homeBack").click();
  await page.locator("#homeImport").click();
  await page.locator("#continueGameInput").setInputFiles(fixturePath);
  await expect(page.locator("#matchTab")).toBeVisible();
});

test("Spiel laden deletes only a locally stored Team Space single game, not another",async({page})=>{
  await page.goto("/");
  await page.evaluate(async samples=>{
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open("handball-spielanalyse",3);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("games","readwrite");
      for(const sample of samples){
        tx.objectStore("games").put({
          id:"teamspace-localgame-"+sample.id,gameName:"Team Space "+sample.id,
          fileName:sample.id+".json",text:JSON.stringify(sample.data),
          savedAt:"2026-11-14T12:00:00Z"
        });
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  },[
    {id:"eins",data:{...fixture,home:{...fixture.home,name:"Heim Eins"}}},
    {id:"zwei",data:{...fixture,home:{...fixture.home,name:"Heim Zwei"}}}
  ]);
  await page.reload();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  const list=page.locator("#homeLibraryList"),search=page.locator("#homeLibraryGameSearch");
  await search.fill("Heim Eins");
  await expect(list.locator(".home-list-row")).toHaveCount(1);
  page.once("dialog",dialog=>dialog.accept());
  await list.getByRole("button",{name:/Spiel löschen/}).click();
  await expect(list.locator(".home-list-row")).toHaveCount(0);
  await search.fill("Heim Zwei");
  await expect(list.locator(".home-list-row")).toHaveCount(1);
  await page.reload();
  await page.locator("#homeChooseGame").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryGameSearch").fill("Heim Zwei");
  await expect(page.locator("#homeLibraryList .home-list-row")).toHaveCount(1);
});
