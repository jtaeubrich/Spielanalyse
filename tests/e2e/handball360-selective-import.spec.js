import {test,expect} from "@playwright/test";

const response={
 match_id:"378110",
 match:{data:[{id:378110,local:{id:12,name:"Gegner",club:{id:20}},visitor:{id:13,name:"Mein Team",club:{id:21}},phase:{competition:{name:"Regionalliga Test"}}}]},
 events:{data:[]},
 lineups:{data:{local:{players:[{number:7,player:{id:"hb-7",first_name:"Max",last_name:"Muster"}}]},visitor:{players:[{number:9,player:{id:"hb-9",first_name:"Anna",last_name:"Beispiel"}}]}}}
};
async function rosterRecords(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open("handball-spielanalyse",3);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction("rosters","readonly"),q=tx.objectStore("rosters").getAll();
   q.onerror=()=>reject(q.error);q.onsuccess=()=>{const records=q.result;db.close();resolve(records)};
  };
 }));
}
async function openImport(page){
 await page.locator("#setupTab details").filter({has:page.locator("summary",{hasText:"Spieldaten übernehmen"})}).locator("summary").click();
 await page.locator("#existingH360Url").fill("https://www.handball.net/match/378110");
 await page.locator("#existingH360Enrich").click();
 const dialog=page.locator("dialog").filter({has:page.getByRole("heading",{name:"Spieldaten übernehmen – Auswahl"})});
 await expect(dialog).toBeVisible();
 return dialog;
}
test.beforeEach(async ({page})=>{
 await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(response)}));
 await page.goto("/");
});
test("import options have independent defaults and cancel preserves the current game",async({page})=>{
 const before=await page.locator("#setupCompetition").inputValue();
 const dialog=await openImport(page);
 await expect(dialog.getByLabel("Vereinslogos und Team-/Club-IDs")).toBeChecked();
 await expect(dialog.getByLabel("Wettbewerb im aktuellen Spiel")).toBeChecked();
 await expect(dialog.getByLabel("Spieler und Handball360-IDs in der Mannschaftssammlung ergänzen")).toBeChecked();
 await expect(dialog.getByLabel("Kader auch in das aktuelle Spiel ergänzen")).not.toBeChecked();
 await expect(dialog).toContainText("2");
 await dialog.getByRole("button",{name:"Abbrechen"}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator("#setupCompetition")).toHaveValue(before);
 expect(await rosterRecords(page)).toHaveLength(0);
});
test("selected IDs populate collection without adding players to the game",async({page})=>{
 const dialog=await openImport(page);
 await dialog.getByLabel("Vereinslogos und Team-/Club-IDs").uncheck();
 await dialog.getByLabel("Wettbewerb im aktuellen Spiel").uncheck();
 await dialog.getByRole("button",{name:"Auswahl übernehmen"}).click();
 await expect(page.locator("#existingH360Status")).toContainText("2 Spieler ergänzt");
 const records=await rosterRecords(page);
 expect(records.flatMap(x=>x.players||[]).map(x=>x.handballNetId).sort()).toEqual(["hb-7","hb-9"]);
 await expect(page.locator("#setupCompetition")).toHaveValue("Freundschaftsspiel");
});
test("selective import updates competition and active roster while leaving event list intact",async({page})=>{
 const dialog=await openImport(page);
 await dialog.getByLabel("Vereinslogos und Team-/Club-IDs").uncheck();
 await dialog.getByLabel("Kader auch in das aktuelle Spiel ergänzen").check();
 await dialog.getByRole("button",{name:"Auswahl übernehmen"}).click();
 await expect(page.locator("#setupCompetition")).toHaveValue("Regionalliga Test");
 await expect(page.locator("#existingH360Status")).toContainText("2 Spieler ins Spiel ergänzt");
 await expect(page.locator("#score")).toHaveText("0 : 0");
});
