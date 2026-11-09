import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");
const playerTag=(player,team)=>({
  pId:player.id,
  pName:player.nachname+", "+player.vorname,
  pNr:player.nr,
  team
});
async function loadKeyMoment(page,{stale=false}={}){
  const game=JSON.parse(await readFile(fixture,"utf8"));
  const [first,third]=[game.home.players[1],game.home.players[2]];
  const second=game.away.players[1];
  const stalePlayer={pId:99887766,pName:"Alter Kader, Spieler",pNr:99,team:"away"};
  game.isHistorical=false;
  game.isVideoscoutingFile=false;
  game.events=[{
    id:12345,time:75,displayTime:"01:15",half:1,realTime:150000,
    type:"keyMoment",team:"home",note:"Sperre und Absetzen",
    scoreH:0,scoreA:0,scoreChanged:false,defenderUnknown:false,
    playerTags:[playerTag(first,"home"),playerTag(second,"away"),...(stale?[stalePlayer]:[])]
  }];
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"key-moment-players.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  return {game,first,second,third,stalePlayer};
}
const currentEvent=page=>page.evaluate(()=>{
  const raw=localStorage.getItem("handballSpielanalyse.session");
  const session=JSON.parse(raw);
  return session.state.events.find(e=>e.type==="keyMoment");
});

test("multi-player key moments are visible and editable in Daten editieren and in video review",async({page})=>{
  const {first,second,third}=await loadKeyMoment(page);
  await page.locator('[data-tab="data"]').click();
  const dataPicker=page.locator("#deeKeyMomentPlayers");
  await expect(dataPicker.locator("summary")).toContainText("Beteiligte Spieler (2)");
  await expect(dataPicker.locator("summary")).toContainText(first.nachname);
  await expect(dataPicker.locator("summary")).toContainText(second.nachname);
  await expect(page.locator("#dataEditorRows")).toContainText(first.nachname);
  await expect(page.locator("#dataEditorRows")).toContainText(second.nachname);
  await dataPicker.locator("summary").click();
  await expect(dataPicker.locator('[data-player-id="'+first.id+'"]')).toHaveAttribute("aria-pressed","true");

  // Correct an incorrectly entered player while preserving the second.
  await dataPicker.locator('[data-player-id="'+first.id+'"]').click();
  await expect(dataPicker.locator("summary")).toContainText("Beteiligte Spieler (1)");
  await dataPicker.locator('[data-player-id="'+third.id+'"]').click();
  await expect(dataPicker.locator("summary")).toContainText("Beteiligte Spieler (2)");
  await expect(dataPicker.locator('[data-player-id="'+third.id+'"]')).toHaveAttribute("aria-pressed","true");
  await expect.poll(async()=>(await currentEvent(page)).playerTags.map(t=>String(t.pId)).sort())
    .toEqual([String(second.id),String(third.id)].sort());

  // Video review uses the same saved playerTags[] and lets us fix them.
  await page.locator('[data-tab="match"]').click();
  await page.locator("#matchReviewToggle").click();
  const event=page.locator("#matchNearbyList .match-nearby-item").first();
  await expect(event).toBeVisible();
  await event.click();
  const videoPicker=page.locator("#veeKeyMomentPlayers");
  await expect(videoPicker).toBeVisible();
  await expect(videoPicker.locator("summary")).toContainText(third.nachname);
  await expect(videoPicker.locator("summary")).toContainText(second.nachname);
  await videoPicker.locator("summary").click();
  await videoPicker.locator('[data-player-id="'+second.id+'"]').click();
  await expect(videoPicker.locator("summary")).toContainText("Beteiligte Spieler (1)");
  await expect.poll(async()=>(await currentEvent(page)).playerTags.map(t=>String(t.pId)))
    .toEqual([String(third.id)]);

  await page.locator('[data-tab="data"]').click();
  await expect(page.locator("#deeKeyMomentPlayers summary")).toContainText(third.nachname);
  await expect(page.locator("#deeKeyMomentPlayers summary")).not.toContainText(second.nachname);
  await expect(page.locator("#dataEditorRows")).toContainText(third.nachname);

  await page.reload();
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator("#deeKeyMomentPlayers summary")).toContainText(third.nachname);
  await expect(page.locator("#deeKeyMomentPlayers summary")).not.toContainText(first.nachname);
  await expect(page.locator("#deeKeyMomentPlayers summary")).not.toContainText(second.nachname);
});

test("legacy key moments retain missing-roster players until intentionally removed",async({page})=>{
  const {stalePlayer}=await loadKeyMoment(page,{stale:true});
  await page.locator('[data-tab="data"]').click();
  const picker=page.locator("#deeKeyMomentPlayers");
  await expect(picker.locator("summary")).toContainText(stalePlayer.pName);
  await picker.locator("summary").click();
  const missing=picker.locator(".key-moment-player-missing");
  await expect(missing).toContainText("nicht im Kader");
  await missing.locator('[data-player-id="'+stalePlayer.pId+'"]').click();
  await expect(picker.locator("summary")).not.toContainText(stalePlayer.pName);
  await expect.poll(async()=>JSON.stringify((await currentEvent(page)).playerTags))
    .not.toContain(String(stalePlayer.pId));
  await picker.getByRole("button",{name:"Unbekannt",exact:true}).click();
  await expect(picker.locator("summary")).toContainText("Beteiligte Spieler (0): Unbekannt");
  await expect.poll(async()=>(await currentEvent(page)).defenderUnknown).toBe(true);
  await picker.getByRole("button",{name:"Keine Zuordnung"}).click();
  await expect(picker.locator("summary")).toContainText("Beteiligte Spieler (0): Keine Zuordnung");
  await expect.poll(async()=>(await currentEvent(page)).defenderUnknown).toBe(false);
});
