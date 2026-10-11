import { test, expect } from "@playwright/test";

test("Instagram HTML template import validates required fields and previews", async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
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
