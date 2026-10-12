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
 await expect(page.locator("#instagramTemplateStatus")).toContainText("Eigene Vorlage geladen");
 await page.locator("#instagramTemplatePreview").click();
 await expect(page.locator("#instagramTemplateFrame")).toBeVisible();
 await expect(page.frameLocator("#instagramTemplateFrame").locator('[data-field="videoArea"]')).toBeVisible();
});

test("Matchday accepts embedded CSS data images but blocks remote CSS URLs", async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 await page.locator("#instagramTemplateKind").selectOption("matchday");
 const fields=["homeLogo","awayLogo","home","away"];
 const body=fields.map(name=>'<div data-field="'+name+'">'+name+"</div>").join("");
 const upload=async css=>page.locator("#instagramTemplateImportInput").setInputFiles({name:"matchday.html",mimeType:"text/html",buffer:Buffer.from('<!doctype html><html><head><style>'+css+'</style></head><body>'+body+'</body></html>')});
 await upload('body {background-image: url("data:image/png;base64,iVBORw0KGgo=")}');
 await expect(page.locator("#instagramTemplateStatus")).toContainText("Eigene Vorlage geladen");
 await upload('body {background-image: url("https://example.com/background.png")}');
 await expect(page.locator("#instagramTemplateStatus")).toContainText("Externe CSS-Ressourcen");
});

test("reports the exact rejected CSS URL for Matchday templates", async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 await page.locator("#instagramTemplateKind").selectOption("matchday");
 const html='<html><head><style>body {background: url("https://example.org/remote.jpg")}</style></head><body>'+
 ['homeLogo','awayLogo','home','away'].map(k=>'<div data-field="'+k+'"></div>').join('')+'</body></html>';
 await page.locator("#instagramTemplateImportInput").setInputFiles({name:"diagnose.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#instagramTemplateStatus")).toContainText("diagnose.html");
 await expect(page.locator("#instagramTemplateStatus")).toContainText("CSS-Zeile 1");
 await expect(page.locator("#instagramTemplateStatus")).toContainText("https://example.org/remote.jpg");
});
