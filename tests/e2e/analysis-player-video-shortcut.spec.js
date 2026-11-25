import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/hkn_reference.json"),"utf8"));
const upload=(name,game)=>({name,mimeType:"application/json",buffer:Buffer.from(JSON.stringify(game))});
const game=(name,events=fixture.events)=>{
  const copy=structuredClone(fixture);
  copy.gameName=name;
  copy.events=structuredClone(events);
  copy.gameDate="2026-11-08";
  copy.isHistorical=false;
  copy.isVideoscoutingFile=true;
  return copy;
};
async function stored(page){
  return page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session"))?.state);
}

test("Analysis player video icon opens Video filtered for that player, regardless of prior video filters",async({page})=>{
  const source=game("Einzelspiel");
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("einzelspiel.json",source));
  await page.locator('[data-tab="video"]').click();
  await page.locator("#videoTypeFilter").selectOption("goal");
  await page.locator("#videoZoneFilter").selectOption("RL-9m");
  await page.locator("#videoTagFilter").selectOption("all");
  await page.locator('[data-tab="analysis"]').click();
  const player=source.away.players.find(p=>source.events.some(e=>String(e.pId)===String(p.id)));
  expect(player).toBeDefined();
  const before=await stored(page);
  // Neutral analysis perspective shows Heim as the first player card,
  // independent of the original scouting ownTeam ("away").
  await page.locator("#opponentPlayerRows tr").filter({hasText:player.nachname}).locator(".analysis-player-videos").click();
  await expect(page.locator('[data-tab="video"]')).toHaveClass(/active/);
  await expect(page.locator("#videoTeamFilter")).toHaveValue("all");
  await expect(page.locator("#videoPlayerFilter")).toHaveValue(String(player.id));
  for(const id of ["videoTypeFilter","videoZoneFilter","videoTargetFilter","videoPhaseFilter","videoTagFilter"])
    await expect(page.locator("#"+id)).toHaveValue("all");
  const expected=source.events.filter(e=>[e.pId,e.throwerId,e.attackerId,e.assistPId,e.againstTwId,
      ...(e.playerTags||[]).map(tag=>tag.pId)].filter(v=>v!=null).some(id=>String(id)===String(player.id))).length;
  await expect(page.locator("#videoPlaylist .clip")).toHaveCount(expected);
  expect((await stored(page)).events).toEqual(before.events);
});

test("Analysis opponent player video icon selects the opponent rather than the scouting own team",async({page})=>{
  const source=game("Einzelspiel");
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("einzelspiel.json",source));
  await page.locator('[data-tab="analysis"]').click();
  await page.locator("#ownPlayerRows .analysis-player-videos").first().click();
  await expect(page.locator('[data-tab="video"]')).toHaveClass(/active/);
  await expect(page.locator("#videoTeamFilter")).toHaveValue("all");
  await expect(page.locator("#videoPlayerFilter")).toHaveValue(String(source.home.players[0].id));
});

test("Season preview player video icon opens only the selected fixture and retains other season games",async({page})=>{
  const first=game("Erstes Saisonspiel",[]);
  first.gameDate="2026-11-01";
  const second=game("Zweites Saisonspiel");
  second.gameDate="2026-11-08";
  const independent=game("Unabhängiges Einzelspiel",[]);
  independent.events=[{id:"unrelated",type:"goal",team:"home",time:44,scoreH:1,scoreA:0}];
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("unabhaengig.json",independent));
  // After an individual game has been opened, the setup mode switch is
  // intentionally hidden; enter the season library through Start instead.
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseSeason").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeAdvanced").click();
  await page.locator("#seasonGameInput").setInputFiles([
    upload("eins.json",first),upload("zwei.json",second)
  ]);
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
  await page.locator("#seasonPreferredTeam").selectOption({label:second.away.name});
  await page.locator('[data-tab="analysis"]').click();
  await expect(page.locator("#analysisGamePicker option:checked")).toContainText("2026-11-08");
  const target=second.away.players.find(p=>second.events.some(e=>String(e.pId)===String(p.id)));
  await page.locator("#ownPlayerRows tr").filter({hasText:target.nachname}).locator(".analysis-player-videos").click();
  await expect(page.locator('[data-tab="video"]')).toHaveClass(/active/);
  await expect(page.locator("#videoPlayerFilter")).toHaveValue(String(target.id));
  const active=await stored(page);
  expect(active.gameName).toBe("Zweites Saisonspiel");
  expect(active.events).toHaveLength(second.events.length);
  const independentSaved=await page.evaluate(()=>
    JSON.parse(localStorage.getItem("handballSpielanalyse.independentSession"))?.state);
  expect(independentSaved.events).toHaveLength(1);
  expect(independentSaved.gameName).toBe("Unabhängiges Einzelspiel");
  await expect(page.locator("#seasonGameCount")).toContainText("2 Spiele");
});

test("Analysis combines a legacy and H360 roster entry and opens both video events", async ({ page }) => {
  const source = game("Einzelspiel mit Altbestand", []);
  const official = {
    ...source.home.players[0], vorname: "Mia", nachname: "Beispiel", nr: 12,
    isTW: false, handballNetId: "mia-h360"
  };
  const legacy = { id: "legacy-mia", vorname: "", nachname: "Mia Beispiel", nr: "" };
  const unused = { id: "unused", vorname: "Kim", nachname: "Ohneinsatz", nr: 14 };
  source.home.players = [legacy, official, unused];
  source.events = [legacy, official].map((p, index) => ({
    id: "goal-" + index, type: "goal", team: "home", pId: p.id,
    half: 1, time: 10 + index, realTime: 10000 + index * 1000
  }));

  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(upload("altbestand.json", source));
  await page.locator('[data-tab="analysis"]').click();
  const row = page.locator("#ownPlayerRows tr").filter({ hasText: "Mia Beispiel" });
  await expect(page.locator("#ownPlayerRows tr")).toHaveCount(1);
  await expect(row).toHaveCount(1);
  await expect(page.locator("#analysisPlayerFilter option[value=unused]")).toHaveCount(0);
  await expect(row.locator("td").first()).toContainText("#12 Mia Beispiel");
  await expect(row.locator("td").nth(2)).toHaveText("2");
  await expect(page.locator("#analysisPlayerFilter option").filter({ hasText: "Mia Beispiel" })).toHaveCount(1);
  await page.locator("#analysisPlayerFilter").selectOption(String(official.id));
  await expect(row.locator("td").nth(2)).toHaveText("2");

  await row.locator("button").click();
  await expect(page.locator("#videoPlayerFilter")).toHaveValue(String(official.id));
  await expect(page.locator("#videoPlaylist .clip")).toHaveCount(2);
  const after = await stored(page);
  expect(after.home.players.map(p => p.id)).toEqual([legacy.id, official.id, unused.id]);
  expect(after.events.map(event => event.pId)).toEqual([legacy.id, official.id]);
});
