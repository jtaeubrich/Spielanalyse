import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixture=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/handbuch/demo/fixtures/00-setup.json");
const official=[
 '<!doctype html><html lang="de"><body><h1>Spielnummer 102005 · Spielbericht (genehmigt)</h1>',
 '<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>4</td><td><a href="personPortrait?person=111">Schulze, Max</a></td><td>5</td></tr></table>',
 '<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>7</td><td><a href="personPortrait?person=222">Meyer, Hans</a></td><td>6</td></tr></table>',
 '<table><tr><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th></tr>',
 '<tr><td>Gast</td><td>01:31</td><td>0:1</td><td>Tor</td><td>7 Meyer, Hans</td><td>Heim</td><td>03:01</td><td>1:1</td><td>Tor</td><td>4 Schulze, Max</td></tr>',
 '<tr><td></td><td>11:48</td><td></td><td>Auszeit Heim</td><td></td><td>Gast</td><td>12:15</td><td>1:2</td><td>7m mit Tor</td><td>7 Meyer, Hans</td></tr></table></body></html>'
].join("");
const file=(name,contents,type="application/json")=>({name,mimeType:type,buffer:Buffer.from(contents)});
async function openScoutingGame(page,{provider}={}){
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.home={name:"SG Achim/Baden",players:[]};
  game.away={name:"HC Bremen",players:[]};
  game.gameName="SG Achim/Baden – HC Bremen";
  game.gameDate="2026-10-25T17:00:00";
  game.ownTeam="away";
  game.officialSource=provider?{provider,matchId:"378112"}:undefined;
  game.events=[
    {id:"own-1",type:"goal",team:"away",time:91,displayTime:"01:31",scoreH:0,scoreA:1,pId:null,
      pName:"Unbekannt",comment:"Links durchgebrochen",z:"RL-6m",gz:"UL",realTime:15000},
    {id:"own-2",type:"goal",team:"home",time:181,displayTime:"03:01",scoreH:1,scoreA:1,pId:null,pName:"Unbekannt"},
    {id:"own-3",type:"goal",team:"away",time:735,displayTime:"12:15",scoreH:1,scoreA:2,pId:null,pName:"Unbekannt",is7:true,z:"7M"}
  ];
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles(file("hc-bremen-scouting.json",JSON.stringify(game)));
  await expect(page.locator("#seasonGameCount")).toContainText("1 Spiel");
  await page.locator("#seasonGamesDetails > summary").click();
  await page.locator("#seasonGameList").getByRole("button",{name:"Protokollabgleich"}).click();
  await expect(page.locator("#seasonProtocolDialog")).toBeVisible();
  return game;
}
async function loadProtocol(page){
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonProtocolFile").setInputFiles(file("bericht.html",official,"text/html"));
  await page.locator("#seasonProtocolLoad").click();
  await expect(page.locator("#seasonProtocolStatus")).toContainText("Vorschau geladen");
}
async function seasonExport(page){
  await page.locator("#seasonProtocolClose").click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  const archive=JSON.parse(await readFile(await download.path(),"utf8"));
  return archive.games[0].data;
}
test("manual live game: preview official scorers, confirm selected only, no duplicate goals",async({page})=>{
  await openScoutingGame(page);
  await loadProtocol(page);
  const rows=page.locator("#seasonProtocolRows .protocol-row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("#seasonProtocolSummary")).toContainText("3 eindeutige Vorschläge");
  await expect(rows.locator("input:checked")).toHaveCount(3);
  await expect(rows.nth(0).locator("select")).toContainText("Meyer");
  await rows.nth(1).locator("input").uncheck();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonProtocolApply").click();
  await expect(page.locator("#seasonProtocolStatus")).toContainText("2 Spielerzuordnung(en) übernommen");
  const game=await seasonExport(page);
  expect(game.events).toHaveLength(3);
  expect(game.events[0]).toMatchObject({id:"own-1",pNr:7,pName:"Meyer, Hans",
    type:"goal",time:91,scoreA:1,z:"RL-6m",gz:"UL",comment:"Links durchgebrochen",realTime:15000});
  expect(game.events[1].pId).toBeNull();
  expect(game.events[2]).toMatchObject({pNr:7,z:"7M",scoreA:2});
  expect(game.officialData.nuLigaEvents).toHaveLength(4);
  expect(game.officialData.nuLigaReport.gameNumber).toBe("102005");
  expect(game.home.players.some(player=>player.nr===4)).toBe(true);
  expect(game.away.players.some(player=>player.nr===7)).toBe(true);
});
test("import supports a Handball360-linked scouting game without changing provider or events",async({page})=>{
  await openScoutingGame(page,{provider:"handball.net"});
  await loadProtocol(page);
  await page.locator("#seasonProtocolNone").click();
  await expect(page.locator("#seasonProtocolRows .protocol-check:checked")).toHaveCount(0);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonProtocolApply").click();
  await expect(page.locator("#seasonProtocolStatus")).toContainText("0 Spielerzuordnung(en)");
  const state=await seasonExport(page);
  expect(state.officialSource).toMatchObject({provider:"handball.net",matchId:"378112"});
  expect(state.events).toHaveLength(3);
  expect(state.events.every(event=>event.pId==null)).toBe(true);
  expect(state.officialData.nuLigaEvents).toHaveLength(4);
});
test("repeated protocol import leaves attributed events intact and allows the remaining ones",async({page})=>{
  await openScoutingGame(page);
  await loadProtocol(page);
  const rows=page.locator("#seasonProtocolRows .protocol-row");
  await rows.nth(1).locator("input").uncheck();
  await rows.nth(2).locator("input").uncheck();
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonProtocolApply").click();
  await expect(page.locator("#seasonProtocolStatus")).toContainText("1 Spielerzuordnung(en)");
  await page.locator("#seasonProtocolClose").click();
  await page.locator("#seasonGameList").getByRole("button",{name:"Protokollabgleich"}).click();
  await loadProtocol(page);
  await expect(page.locator("#seasonProtocolRows .protocol-row")).toHaveCount(2);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#seasonProtocolApply").click();
  await expect(page.locator("#seasonProtocolStatus")).toContainText("2 Spielerzuordnung(en)");
  const game=await seasonExport(page);
  expect(game.events).toHaveLength(3);
  expect(game.events.every(e=>e.pId!=null)).toBe(true);
});
