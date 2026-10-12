import {test,expect} from "@playwright/test";
test("imports Matchday HTML and exports a real 1080x1350 PNG before the match",async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 await page.locator("#instagramTemplateKind").selectOption("matchday");
 const html='<!doctype html><html><head><style>body{margin:0}.poster{width:1080px;height:1350px;background:#d50b27;color:white;font:90px Arial}</style></head><body><main class="poster"><div data-field="homeLogo">LOGO</div><div data-field="awayLogo">LOGO</div><div data-field="home">HOME</div><div data-field="away">AWAY</div></main></body></html>';
 await page.locator("#instagramTemplateImportInput").setInputFiles({name:"matchday.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#instagramTemplateStatus")).toContainText("gespeichert");
 await page.locator("#instagramExportPhase").selectOption("before");
 await page.locator("#instagramZipExport").click();
 await expect(page.locator("#exportStatus")).toContainText(/Instagram-ZIP bereit|fehlgeschlagen|konnte nicht|Browser unterstützt|Keine Dateien|Fehler/i,{timeout:12000});
 await expect(page.locator("#instagramZipDownload"),"Exportstatus: "+await page.locator("#exportStatus").textContent()).toBeEnabled({timeout:12000});
 await expect(page.locator("#exportStatus")).toContainText("1 Grafiken");
});
