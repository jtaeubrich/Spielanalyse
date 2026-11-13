import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const source=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/hkn_reference.json"),"utf8"));
function game(matchDate,manualTime=null,provider="handball.net"){
  const data=structuredClone(source);
  data.events=[];
  data.gameName="TSV Kronshagen - Testmannschaft";
  data.gameDate=matchDate;
  if(manualTime===null)delete data.gameTimeOfDay;
  else data.gameTimeOfDay=manualTime;
  data.officialSource={provider,matchId:"378107",matchDate};
  return data;
}
function upload(name,data){
  return {name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))};
}

test("November Handball360 kickoff in Setup remains 11:30, not 12:30",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("november.json",
    game("2026-11-15T11:30:00+00:00")));
  await expect(page.locator("#setupGameDate")).toHaveValue("2026-11-15");
  await expect(page.locator("#setupGameTime")).toHaveValue("11:30");
});
test("September Handball360 kickoff stays 14:00 rather than 16:00",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("september.json",
    game("2026-09-05T14:00:00+00:00")));
  await expect(page.locator("#setupGameTime")).toHaveValue("14:00");
});
test("explicit manual correction always has precedence",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("manual.json",
    game("2026-11-15T11:30:00+00:00","11:00")));
  await expect(page.locator("#setupGameTime")).toHaveValue("11:00");
});
test("non-Handball360 UTC timestamp retains real Europe/Berlin conversion",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("other.json",
    game("2026-11-15T11:30:00+00:00",null,"manual")));
  await expect(page.locator("#setupGameTime")).toHaveValue("12:30");
});
