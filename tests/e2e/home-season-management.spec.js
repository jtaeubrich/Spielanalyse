import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json"),"utf8"));
async function newSeason(page,name){
  await page.locator("#homeChooseSeason").click();
  page.once("dialog",dialog=>dialog.accept(name));
  await page.locator("#homeNew").click();
  // The season overview deliberately separates the team from the season label.
  const identity=/^(.+?)\s*[·|]\s*(Saison\s+20\d{2}\/\d{2})$/i.exec(name);
  if(identity){
    await expect(page.locator("#homeSeasonTeam")).toHaveText(identity[1].trim());
    await expect(page.locator("#homeSeasonName")).toHaveText(identity[2]);
  }else{
    await expect(page.locator("#homeSeasonName")).toHaveText(name);
  }
  await page.locator("#homeSeasonManage").click();
}
function sample(name,opponent){
  const data=structuredClone(fixture);
  data.gameName=name;
  data.home.name="HC Bremen";
  data.away.name=opponent;
  data.gameDate="2026-10-20";
  return {name:name+".json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))};
}
test("identically named seasons can be renamed and one removed without affecting the other",async({page})=>{
  await page.goto("/");
  await newSeason(page,"HC Bremen | Saison 2026/27");
  await page.locator("#seasonGameInput").setInputFiles(sample("First","Gast A"));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await newSeason(page,"HC Bremen | Saison 2026/27");
  await page.locator("#seasonGameInput").setInputFiles(sample("Second","Gast B"));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  const rows=page.locator("#homeLibraryList .home-list-row");
  await expect(rows).toHaveCount(3); // includes the preserved default season
  const duplicates=rows.filter({hasText:"HC Bremen | Saison 2026/27"});
  await expect(duplicates).toHaveCount(2);
  await expect(duplicates.first()).toContainText("Kennung:");
  page.once("dialog",dialog=>dialog.dismiss());
  await duplicates.first().getByRole("button",{name:"Löschen"}).click();
  await expect(duplicates).toHaveCount(2);
  page.once("dialog",dialog=>dialog.accept());
  await duplicates.first().getByRole("button",{name:"Löschen"}).click();
  await expect(duplicates).toHaveCount(1);
  await expect(rows).toHaveCount(2);
  page.once("dialog",dialog=>dialog.accept("HC Bremen | 2026/27 korrigiert"));
  await duplicates.first().getByRole("button",{name:"Umbenennen"}).click();
  await expect(page.locator("#homeLibraryList")).toContainText("HC Bremen | 2026/27 korrigiert");
  await page.reload();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList")).toContainText("HC Bremen | 2026/27 korrigiert");
  await expect(page.locator("#homeLibraryList .home-list-row")).toHaveCount(2);
});

test("generic imported season title displays an inferred team name without renaming a custom season",async({page})=>{
  await page.goto("/");
  const prepared=[0,1,2].map(index=>{
    const data=structuredClone(fixture);
    data.gameName="Spiel "+index;
    data.home.name=index%2?"Gast "+index:"TSV KRONSHAGEN";
    data.away.name=index%2?"TSV KRONSHAGEN":"Gast "+index;
    data.gameDate="2026-11-"+String(index+1).padStart(2,"0");
    return {name:"game_"+index+".json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))};
  });
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles(prepared);
  await expect(page.locator("#seasonGameCount")).toContainText("3 Spiele");
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList")).toContainText("TSV KRONSHAGEN · Saison 2026/27");
});
