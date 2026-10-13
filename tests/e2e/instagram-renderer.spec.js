import {test,expect} from "@playwright/test";
test("imports Matchday HTML in Setup and exports standalone PNG",async ({page})=>{
 await page.goto("/");
 await page.locator("#setupMatchdayPanel > summary").click();
 const html='<!doctype html><html><head><style>body{margin:0}.poster{width:1080px;height:1350px;background:#d50b27;color:white;font:90px Arial}</style></head><body><main class="poster"><div data-field="homeLogo">LOGO</div><div data-field="awayLogo">LOGO</div><div data-field="home">HOME</div><div data-field="away">AWAY</div></main></body></html>';
 await page.locator("#setupMatchdayTemplateFile").setInputFiles({name:"matchday.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#setupMatchdayTemplateStatus")).toContainText("Akzeptiert");
 await page.locator("#instagramTemplateCheckDialog button").click();
 await page.locator("#setupMatchdayPng").click();
 await expect(page.locator("#setupMatchdayExportStatus")).toContainText("Matchday-PNG bereit",{timeout:20000});
 await expect(page.locator("#setupMatchdayDownload")).toBeEnabled();
});

test("HTML highlight exposes fixed 16:9 video rectangle and paints its backdrop",async ({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="video"]').click();
 await page.locator("details.video-production-card > summary").click();
 await page.locator("#instagramTemplateKind").selectOption("highlight");
 const names=["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea"];
 const html='<!doctype html><html><head><style>body{margin:0}.poster{position:relative;width:1080px;height:1350px;background:#152132;color:white}.video{position:absolute;top:700px;left:60px;width:960px;height:540px;background:black}</style></head><body><main class="poster">'+names.map(n=>'<div '+(n==="videoArea"?'class="video" ':'')+'data-field="'+n+'">'+n+'</div>').join("")+"</main></body></html>";
 await page.locator("#instagramTemplateImportInput").setInputFiles({name:"highlight.html",mimeType:"text/html",buffer:Buffer.from(html)});
 await expect(page.locator("#instagramTemplateStatus")).toContainText("gespeichert");
 const geometry=await page.evaluate(async()=>{
   const m=await import("./src/instagram-html-renderer.js");
   const source=localStorage.getItem("handballSpielanalyse.instagramTemplates.v1");
   const template=JSON.parse(source).highlight;
   const result=await m.rasterizeInstagramHtml(m.fillInstagramHtml(template,"highlight",{home:"TSV Kronshagen",score:"18 : 16"}),{withGeometry:true});
   return {type:result.blob.type,size:result.blob.size,rect:result.videoArea};
 });
 expect(geometry.type).toBe("image/png");
 expect(geometry.size).toBeGreaterThan(1000);
 expect(geometry.rect.w).toBe(960);
 expect(geometry.rect.h).toBe(540);
});

test("long away name wraps and embedded team logos are inserted",async({page})=>{
 await page.goto("/");
 const result=await page.evaluate(async()=>{
  const {fillInstagramHtml}=await import("./src/instagram-html-renderer.js");
  const logo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
  const html='<html><head><style>.team{width:180px;font-size:50px}</style></head><body>'+
  ['homeLogo','awayLogo','home','away'].map(x=>'<div class="team" data-field="'+x+'">PLACEHOLDER</div>').join('')+'</body></html>';
  const filled=fillInstagramHtml(html,"matchday",{home:"TSV Kronshagen",away:"SG FLENSBURG-HANDEWITT II",homeLogo:logo,awayLogo:logo});
  const doc=new DOMParser().parseFromString(filled,"text/html");
  return {logos:doc.querySelectorAll('[data-field="homeLogo"] img,[data-field="awayLogo"] img').length,
    away:doc.querySelector('[data-field="away"]').textContent,
    size:doc.querySelector('[data-field="away"]').style.fontSize,
    wrapping:filled.includes("overflow-wrap:anywhere")};
 });
 expect(result.logos).toBe(2);
 expect(result.away).toBe("SG FLENSBURG-HANDEWITT II");
 expect(result.size).toBe("25px");
 expect(result.wrapping).toBe(true);
});
