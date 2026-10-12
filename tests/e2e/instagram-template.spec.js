import { test, expect } from "@playwright/test";

test("Instagram HTML template import validates required fields and previews", async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 await expect(page.locator("details.video-production-card")).toHaveAttribute("open", "");
 await page.locator("#instagramTemplateKind").selectOption("highlight");
 const file=page.locator("#instagramTemplateImportInput");
 await file.setInputFiles({name:"invalid.html",mimeType:"text/html",buffer:Buffer.from("<html><body><p>Invalid</p></body></html>")});
 await expect(page.locator("#instagramTemplateStatus")).toContainText("videoArea");
 const fields=["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea"];
 const html="<html><body>"+fields.map(field=>'<div data-field="'+field+'">'+field+"</div>").join("")+"</body></html>";
 await file.setInputFiles({name:"valid.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#instagramTemplateStatus")).toContainText(/Eigene (highlight|matchday)-Vorlage gespeichert/);
 await page.locator("#instagramTemplatePreview").click();
 await expect(page.locator("#instagramTemplateFrame")).toBeVisible();
 await expect(page.frameLocator("#instagramTemplateFrame").locator('[data-field="videoArea"]')).toBeVisible();
});

test("Setup Matchday accepts embedded CSS images but rejects remote URLs",async ({page})=>{
 await page.goto("/");
 const slots=["homeLogo","awayLogo","home","away"].map(name=>'<div data-field="'+name+'"></div>').join("");
 const upload=async css=>page.locator("#setupMatchdayTemplateFile").setInputFiles({name:"matchday.html",mimeType:"text/html",buffer:Buffer.from('<html><head><style>'+css+'</style></head><body>'+slots+'</body></html>')});
 await upload('body {background-image:url("data:image/png;base64,iVBORw0KGgo=")}');
 await expect(page.locator("#setupMatchdayTemplateStatus")).toContainText("Akzeptiert");
 await upload('body {background-image:url("https://example.org/remote.jpg")}');
 await expect(page.locator("#instagramTemplateStatus")).toContainText("https://example.org/remote.jpg");
});
test("stores Matchday, result, and highlight templates independently across reloads",async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 const kinds={matchday:["homeLogo","awayLogo","home","away"],endstand:["homeLogo","awayLogo","home","away","score"],highlight:["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea"]};
 for(const [kind,fields] of Object.entries(kinds)){
   await page.locator("#instagramTemplateKind").selectOption(kind);
   const html="<html><body>"+fields.map(field=>'<div data-field="'+field+'">'+kind+"-"+field+"</div>").join("")+"</body></html>";
   await page.locator("#instagramTemplateImportInput").setInputFiles({name:kind+".html",mimeType:"text/html",buffer:Buffer.from(html)});
   await expect(page.locator("#instagramTemplateStatus")).toContainText("Eigene "+kind+"-Vorlage gespeichert.");
 }
 await page.reload();
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 for(const kind of Object.keys(kinds)){
   await page.locator("#instagramTemplateKind").selectOption(kind);
   await expect(page.locator("#instagramTemplateStatus")).toContainText("Eigene "+kind+"-Vorlage gespeichert.");
   await page.locator("#instagramTemplatePreview").click();
   await expect(page.frameLocator("#instagramTemplateFrame").locator('[data-field="home"]')).toContainText(kind+"-home");
   await page.locator("#instagramTemplatePreview").click();
 }
});

test("three independent controls show accepted templates after reload and reset",async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 const cases=[["matchday","Matchday",["homeLogo","awayLogo","home","away"]],["endstand","Endstand",["homeLogo","awayLogo","home","away","score"]],["highlight","Highlight",["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea"]]];
 for(const [kind,suffix,fields] of cases){
   const html="<html><body>"+fields.map(name=>'<span data-field="'+name+'">'+name+"</span>").join("")+"</body></html>";
   if(kind==="matchday")await page.locator('[data-tab="setup"]').click();else await page.locator('[data-tab="video"]').click();
   await page.locator(kind==="matchday"?"#setupMatchdayTemplateFile":"#instagramFile"+suffix).setInputFiles({name:kind+".html",mimeType:"text/html",buffer:Buffer.from(html)});
   await expect(page.locator(kind==="matchday"?"#setupMatchdayTemplateStatus":"#instagramState"+suffix)).toContainText("✓ Akzeptiert und gespeichert");
 }
 await page.reload();
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 for(const [,suffix] of cases)await expect(page.locator(suffix==="Matchday"?"#setupMatchdayTemplateStatus":"#instagramState"+suffix)).toContainText("✓ Akzeptiert und gespeichert");
 await page.locator("#instagramTemplateKind").selectOption("endstand");
 await page.locator("#instagramTemplateReset").click();
 await expect(page.locator("#instagramStateEndstand")).toContainText("Nicht konfiguriert");
 await expect(page.locator("#setupMatchdayTemplateStatus")).toContainText("Akzeptiert");
});

test("Setup creates standalone Matchday PNG without a video",async ({page})=>{
 await page.goto("/");
 const html='<!doctype html><html><head><style>body{margin:0;background:#ad172e}</style></head><body><div data-field="homeLogo"></div><div data-field="awayLogo"></div><div data-field="home"></div><div data-field="away"></div></body></html>';
 await page.locator("#setupMatchdayTemplateFile").setInputFiles({name:"matchday.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#setupMatchdayTemplateStatus")).toContainText("Akzeptiert");
 await page.locator("#setupMatchdayPng").click();
 await expect(page.locator("#setupMatchdayDownload")).toBeEnabled({timeout:20000});
 await expect(page.locator("#setupMatchdayExportStatus")).toContainText("1080 × 1350");
});
