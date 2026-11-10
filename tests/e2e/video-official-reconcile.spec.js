import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("handballSpielanalyse.proxyToken","playwright-fake-proxy-token"));
});
const dir=path.dirname(fileURLToPath(import.meta.url));
const fixture=path.resolve(dir,"../../docs/handbuch/demo/fixtures/00-setup.json");
const report=[
  '<!doctype html><html lang="de"><body><h1>Spielnummer 102005 · Spielbericht (genehmigt)</h1>',
  '<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>4</td><td>Schulze, Max</td><td>1</td></tr></table>',
  '<table><tr><th>Trikot</th><th>Name, Vorname</th><th>Tore</th></tr><tr><td>7</td><td>Meyer, Hans</td><td>2</td></tr></table>',
  '<table><tr><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th><th>Team</th><th>Zeit</th><th>Stand</th><th>Ereignis</th><th>Person</th></tr>',
  '<tr><td>Gast</td><td>01:31</td><td>0:1</td><td>Tor</td><td>7 Meyer, Hans</td><td>Heim</td><td>03:01</td><td>1:1</td><td>Tor</td><td>4 Schulze, Max</td></tr>',
  '<tr><td></td><td>11:48</td><td></td><td>Auszeit Heim</td><td></td><td>Gast</td><td>12:15</td><td>1:2</td><td>7m mit Tor</td><td>7 Meyer, Hans</td></tr>',
  '</table></body></html>'
].join("");
const hbPayload={
  match_id:"378107",
  match:{data:[{id:"378107",duration:{minutes_per_period:25},
    local:{name:"SG Achim/Baden"},visitor:{name:"HC Bremen"},date:"2026-10-25T17:00:00"}]},
  lineups:{data:{
    local:{players:[{number:4,player:{id:"hb-home-4",first_name:"Max",last_name:"Schulze"}}]},
    visitor:{players:[{number:7,player:{id:"hb-away-7",first_name:"Hans",last_name:"Meyer"}}]}
  }},
  events:{data:[
    {id:98701,minute:"01:31",block:" 1. Halbzeit",event_type:{name:"Tor",is_goal:true},
      is_home:false,team:{name:"HC Bremen"},player:{id:"hb-away-7",first_name:"Hans",last_name:"Meyer"},
      score:{local:0,visitor:1}},
    {id:98702,minute:"05:20",block:" 1. Halbzeit",
      event_type:{name:"Zwei Minuten",sanction_class:"suspension"},
      is_home:true,team:{name:"SG Achim/Baden"},player:{id:"hb-home-4",first_name:"Max",last_name:"Schulze"},
      score:{local:0,visitor:1}}
  ]}
};
async function openGame(page,mode){
  const game=JSON.parse(await readFile(fixture,"utf8"));
  game.home={name:"SG Achim/Baden",players:[
    {id:"local-4",nr:4,vorname:"Max",nachname:"Schulze",isTW:false}
  ]};
  game.away={name:"HC Bremen",players:[
    {id:"local-7",nr:7,vorname:"Hans",nachname:"Meyer",isTW:false}
  ]};
  game.gameName="SG Achim/Baden – HC Bremen";
  game.gameDate="2026-10-25";
  game.officialSource=undefined;
  game.isHistorical=false;
  game.isVideoscoutingFile=mode==="video";
  game.events=[
    {id:"own-1",type:"goal",team:"away",time:91,displayTime:"01:31",scoreH:0,scoreA:1,pId:null,
      pName:"Unbekannt",comment:"Wichtiger Videokommentar",z:"RL-6m",gz:"UL",realTime:15000},
    {id:"own-2",type:"goal",team:"home",time:181,displayTime:"03:01",scoreH:1,scoreA:1,pId:null,pName:"Unbekannt"},
    {id:"own-3",type:"goal",team:"away",time:735,displayTime:"12:15",scoreH:1,scoreA:2,pId:null,pName:"Unbekannt",is7:true,z:"7M"}
  ];
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"official-match.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="match"]').click();
  if(mode==="review")await page.locator("#matchReviewToggle").click();
  await expect(page.locator("#videoOfficialOpen")).toBeVisible();
  await page.locator("#videoOfficialOpen").click();
  await expect(page.locator("#videoOfficialDialog")).toBeVisible();
  return game;
}
async function storedGame(page){
  return page.evaluate(()=>JSON.parse(localStorage.getItem("handballSpielanalyse.session")).state);
}
for(const mode of ["video","review"]){
  test(mode+": nuLiga preview and selective import preserve manually scouted data",async({page})=>{
    await openGame(page,mode);
    const initial=await storedGame(page);
    await page.locator("#videoOfficialSource").selectOption("nuliga");
    await page.locator("#videoOfficialFile").setInputFiles({
      name:"offizieller-bericht.html",mimeType:"text/html",buffer:Buffer.from(report)
    });
    page.once("dialog",dlg=>dlg.accept());
    await page.locator("#videoOfficialLoad").click();
    await expect(page.locator("#videoOfficialStatus")).toContainText("Vorschau geladen");
    await expect(page.locator("#videoOfficialSummary")).toContainText("3 vorhanden");
    await expect(page.locator("#videoOfficialSummary")).toContainText("1 eindeutig fehlend");
    const before=await storedGame(page);
    expect(before.events).toEqual(initial.events);
    await expect(page.locator("#videoOfficialEventRows .video-official-add:not(:disabled)")).toHaveCount(1);
    await page.locator("#videoOfficialNone").click();
    await expect(page.locator("#videoOfficialEventRows .video-official-add:checked")).toHaveCount(0);
    await page.locator("#videoOfficialEventRows .video-official-add:not(:disabled)").check();
    await page.locator("#videoOfficialSafe").click();
    await page.locator("#videoOfficialRosters").check();
    page.once("dialog",dlg=>dlg.accept());
    await page.locator("#videoOfficialApply").click();
    await expect(page.locator("#videoOfficialStatus")).toContainText("Übernommen: 1 Ereignisse");
    const after=await storedGame(page);
    expect(after.events).toHaveLength(4);
    const existing=after.events.find(e=>e.id==="own-1");
    expect(existing).toMatchObject({time:91,scoreA:1,comment:"Wichtiger Videokommentar",z:"RL-6m",gz:"UL",realTime:15000});
    expect(existing.pName).toBe("Meyer, Hans");
    expect(after.events.filter(e=>e.type==="goal")).toHaveLength(3);
    expect(after.events.filter(e=>e.type==="timeout")).toHaveLength(1);
    expect(after.video).toEqual(before.video);
    await page.locator("#videoOfficialClose").click();
    await page.locator("#videoOfficialOpen").click();
    await page.locator("#videoOfficialSource").selectOption("nuliga");
    await page.locator("#videoOfficialFile").setInputFiles({
      name:"offizieller-bericht.html",mimeType:"text/html",buffer:Buffer.from(report)
    });
    page.once("dialog",dlg=>dlg.accept());
    await page.locator("#videoOfficialLoad").click();
    await expect(page.locator("#videoOfficialSummary")).toContainText("0 eindeutig fehlend");
  });
  test(mode+": Handball360 compares existing goal and imports only the confirmed sanction",async({page})=>{
    await openGame(page,mode);
    const initial=await storedGame(page);
    await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**",route=>{
      const headers={"access-control-allow-origin":"*",
        "access-control-allow-methods":"GET, OPTIONS",
        "access-control-allow-headers":"Authorization"};
      if(route.request().method()==="OPTIONS")
        return route.fulfill({status:204,headers});
      if(!route.request().url().endsWith("/match/378107"))return route.abort();
      return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify(hbPayload)});
    });
    await page.locator("#videoOfficialUrl").fill("https://www.handball.net/match/378107");
    await page.locator("#videoOfficialLoad").click();
    await expect(page.locator("#videoOfficialStatus")).toContainText("Vorschau geladen");
    await expect(page.locator("#videoOfficialSummary")).toContainText("1 vorhanden");
    await expect(page.locator("#videoOfficialSummary")).toContainText("1 eindeutig fehlend");
    expect((await storedGame(page)).events).toEqual(initial.events);
    await page.locator("#videoOfficialEventRows .video-official-add:not(:disabled)").check();
    page.once("dialog",dlg=>dlg.accept());
    await page.locator("#videoOfficialApply").click();
    await expect(page.locator("#videoOfficialStatus")).toContainText("Übernommen: 1 Ereignisse");
    const state=await storedGame(page);
    expect(state.events).toHaveLength(4);
    expect(state.events.filter(e=>e.type==="goal")).toHaveLength(3);
    const sanction=state.events.find(e=>e.type==="2min");
    expect(sanction).toMatchObject({time:320,team:"home",officialEventId:98702,realTime:null,pId:"local-4"});
    expect(state.events.find(e=>e.id==="own-1")).toEqual(initial.events[0]);
    expect(state.video).toEqual(initial.video);
    expect(state.officialSource.matchId).toBe("378107");
  });
}
