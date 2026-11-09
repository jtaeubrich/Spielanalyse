import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

test("technical-error player can be corrected in video review and persists in Daten editieren",async({page})=>{
  const source=JSON.parse(await readFile(fixture,"utf8"));
  const before=source.home.players[1];
  const after=source.home.players[2];
  source.isHistorical=false;
  source.isVideoscoutingFile=false;
  source.events=[{
    id:99112026,
    type:"error",
    team:"home",
    pId:before.id,
    pName:before.nachname+", "+before.vorname,
    pNr:before.nr,
    errorType:null,
    time:75,
    displayTime:"01:15",
    realTime:75000,
    half:1,
    scoreH:0,
    scoreA:0,
    scoreChanged:false,
    playerTags:[]
  }];
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"technical-error-player-edit.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(source))
  });
  await page.locator('[data-tab="match"]').click();
  await page.locator("#matchReviewToggle").click();
  await expect(page.locator("body")).toHaveClass(/match-review-mode/);
  await page.locator("#matchNearbyList .match-nearby-item").first().click();

  const chooser=page.locator("#veePlayer");
  await expect(chooser).toBeVisible();
  await expect(chooser).toHaveValue(String(before.id));
  await expect(page.locator("#veeError")).toBeVisible();
  await chooser.selectOption(String(after.id));

  const stored=()=>page.evaluate(()=>{
    const session=JSON.parse(localStorage.getItem("handballSpielanalyse.session"));
    return session.state.events.find(e=>e.id===99112026);
  });
  await expect.poll(async()=>({
    pId:String((await stored()).pId),
    pNr:(await stored()).pNr,
    pName:(await stored()).pName
  })).toEqual({
    pId:String(after.id),
    pNr:after.nr,
    pName:after.nachname+", "+after.vorname
  });
  await expect(page.locator("#matchNearbyList .match-nearby-item").first()).toContainText(after.nachname);
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator("#dataEditorDetails select.player-edit").first()).toHaveValue(String(after.id));

  await page.reload();
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator("#dataEditorDetails select.player-edit").first()).toHaveValue(String(after.id));
  expect((await stored()).type).toBe("error");
});
