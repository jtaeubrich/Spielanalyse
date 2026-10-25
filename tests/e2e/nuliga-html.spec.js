import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

const fixture=String.raw`<!doctype html><html lang="de"><body><h1>HC Bremen - Oberliga Männer Nord</h1><table>
<tr><th>Tag</th><th>Datum</th><th>Zeit</th><th>Nr.</th><th>AK</th><th>Staffel</th><th>Heimmannschaft</th><th>Gastmannschaft</th><th>Ergebnis</th></tr>
<tr><td>Sa</td><td>05.09.2026</td><td>19:30</td><td>102005</td><td>M</td><td>Oberliga M Nord</td><td>SG Achim/Baden</td><td>HC Bremen</td><td><a href="groupMeetingReport?championship=HVNB+26%2F27&amp;group=489136&amp;meeting=8279246">29:28</a></td></tr>
<tr><td>So</td><td>25.10.2026</td><td>17:00</td><td>102049</td><td>M</td><td>Oberliga M Nord</td><td>HC Bremen</td><td>HSG Delmenhorst</td><td></td></tr>
<tr><td>So</td><td>25.10.2026</td><td>13:00</td><td>102051</td><td>M</td><td>Oberliga M Nord</td><td>TV Neerstedt</td><td>TV Schiffdorf</td><td></td></tr>
</table></body></html>`;
const report=String.raw`<!doctype html><html lang="de"><body><h1>Spielnummer 102005 · Spielbericht (genehmigt)</h1>
<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>4</td><td><a href="personPortrait?person=111">Schulze, Max</a></td><td>5</td></tr></table>
<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>7</td><td><a href="personPortrait?person=222">Meyer, Hans</a></td><td>6</td></tr></table>
<table><tr><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th></tr>
<tr><td>Gast</td><td>01:31</td><td>0:1</td><td>Tor</td><td>7 Meyer, Hans</td><td>Heim</td><td>03:01</td><td>1:1</td><td>Tor</td><td>4 Schulze, Max</td></tr>
<tr><td></td><td>11:48</td><td></td><td>Auszeit Heim</td><td></td><td>Gast</td><td>12:15</td><td>1:2</td><td>7m mit Tor</td><td>7 Meyer, Hans</td></tr>
</table></body></html>`;
const url="https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2220643&pageState=vorrunde&championship=HVNB+26%2F27&group=489136";
const htmlFile=(name,text)=>({name,mimeType:"text/html",buffer:Buffer.from(text)});

async function openDemo(page){
  await page.goto("/");
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonNuLigaOpen").click();
  await expect(page.locator("#seasonNuLigaDialog")).toBeVisible();
  await page.locator("#seasonNuLigaUrl").fill(url);
  await page.locator("#seasonNuLigaTeam").fill("HC Bremen");
  await page.locator("#seasonNuLigaHtml").setInputFiles(htmlFile("spielplan.html",fixture));
  await page.locator("#seasonNuLigaPreview").click();
  await expect(page.locator("#seasonNuLigaStatus")).toContainText("2 Begegnungen erkannt");
}
async function saveSeason(page){
  await page.locator("#seasonNuLigaClose").click();
  const [dl]=await Promise.all([page.waitForEvent("download"),page.locator("#seasonExport").click()]);
  return JSON.parse(await readFile(await dl.path(),"utf8"));
}
test("HTML fixture preview and season import create only selected HC Bremen games",async({page})=>{
  await openDemo(page);
  await expect(page.locator('#seasonNuLigaList input[data-nu-liga-key]')).toHaveCount(2);
  await page.locator("#seasonNuLigaImport").click();
  await expect(page.locator("#seasonNuLigaStatus")).toContainText("2 neue Saisonspiele");
  await expect(page.locator('#seasonNuLigaList input[data-nu-liga-key]:disabled')).toHaveCount(2);
  const archive=await saveSeason(page);
  expect(archive.games).toHaveLength(2);
  expect(archive.games.every(g=>g.selected===false)).toBe(true);
  const first=archive.games.find(g=>g.data.officialSource.gameNumber==="102005");
  expect(first.data.officialSource).toMatchObject({provider:"nuliga",meetingId:"8279246",group:"489136"});
  expect(first.data.home.name).toBe("SG Achim/Baden");
  expect(first.data.away.name).toBe("HC Bremen");
  expect(archive.games.find(g=>g.data.officialSource.gameNumber==="102049").data.events).toEqual([]);
});
test("nuLiga match report HTML attaches lineup and ordered official events",async({page})=>{
  await openDemo(page);
  await page.locator("#seasonNuLigaImport").click();
  await page.locator("#seasonNuLigaReportMatch").selectOption({index:1});
  await page.locator("#seasonNuLigaReportHtml").setInputFiles(htmlFile("spielbericht.html",report));
  await page.locator("#seasonNuLigaApplyReport").click();
  await expect(page.locator("#seasonNuLigaReportStatus")).toContainText("4 offizielle Ereignisse");
  const archive=await saveSeason(page);
  const game=archive.games.find(g=>g.data.officialSource.gameNumber==="102005");
  expect(game.data.home.players).toHaveLength(1);
  expect(game.data.away.players).toHaveLength(1);
  expect(game.data.events).toHaveLength(4);
  expect(game.data.events.map(e=>e.time)).toEqual([91,181,708,735]);
  expect(game.data.events[0]).toMatchObject({type:"goal",pNr:7,team:"away",scoreA:1});
  expect(game.data.events[3].is7).toBe(true);
  expect(game.data.officialSource.reportStatus).toBe("genehmigt");
});
test("HTML match report never overwrites own video-scouting and references",async({page})=>{
  await openDemo(page);
  await page.locator("#seasonNuLigaImport").click();
  let archive=await saveSeason(page);
  const historic=archive.games.find(g=>g.data.officialSource.gameNumber==="102005");
  historic.data.events=[{id:"own-shot",type:"goal",team:"away",pId:"own-local-7",scoreH:0,scoreA:1,comment:"Eigenes Video-Scouting"}];
  historic.data.away.players=[{id:"own-local-7",nr:7,vorname:"Hans",nachname:"Meyer"}];
  historic.data.video={youtubeUrl:"https://youtu.be/demo"};
  await page.locator("#seasonImportInput").setInputFiles({name:"historische_saison.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(archive))});
  await page.locator("#seasonNuLigaOpen").click();
  await page.locator("#seasonNuLigaReportMatch").selectOption({index:1});
  await page.locator("#seasonNuLigaReportHtml").setInputFiles(htmlFile("bericht.html",report));
  await page.locator("#seasonNuLigaApplyReport").click();
  await expect(page.locator("#seasonNuLigaReportStatus")).toContainText("4 offizielle Ereignisse");
  archive=await saveSeason(page);
  const after=archive.games.find(g=>g.data.officialSource.gameNumber==="102005");
  expect(after.data.events).toEqual(historic.data.events);
  expect(after.data.video).toEqual(historic.data.video);
  expect(after.data.away.players.find(p=>p.id==="own-local-7")).toBeDefined();
  expect(after.data.officialData.nuLigaEvents).toHaveLength(4);
});
