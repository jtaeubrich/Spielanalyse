import {test,expect} from "@playwright/test";

test("per-device proxy token is stored separately, used for calls, and removable",async({page})=>{
  const dummy="playwright-local-proxy-token-123456";
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  const panel=page.locator("#proxyAccessPanel");
  await panel.locator("summary").click();
  await expect(page.locator("#proxyTokenStatus")).toContainText("Kein Proxy-Token hinterlegt");
  await expect(page.locator("#proxyTokenRemove")).toBeDisabled();
  await page.locator("#proxyTokenInput").fill(dummy);
  await page.locator("#proxyTokenSave").click();
  await expect(page.locator("#proxyTokenStatus")).toContainText("lokal hinterlegt");
  await expect(page.locator("#proxyTokenInput")).toHaveValue("");
  await expect(page.locator("#proxyTokenRemove")).toBeEnabled();

  // A stored credential must never become part of a game session.
  let values=await page.evaluate(()=>({
    credential:localStorage.getItem("handballSpielanalyse.proxyToken"),
    session:localStorage.getItem("handballSpielanalyse.session")||""
  }));
  expect(values.credential).toBe(dummy);
  expect(values.session).not.toContain(dummy);

  let authorization=null;
  await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/match/378107",async route=>{
    const request=route.request();
    const headers={
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET, OPTIONS",
      "access-control-allow-headers":"Authorization"
    };
    if(request.method()==="OPTIONS"){
      await route.fulfill({status:204,headers});
      return;
    }
    authorization=request.headers()["authorization"]||null;
    await route.fulfill({status:401,contentType:"application/json",headers,
      body:JSON.stringify({error:{message:"Mocked response"}})});
  });
  await page.locator("#newGame").click();
  await page.locator("#newGameHandball360").click();
  await page.locator("#handballNetUrl").fill("https://www.handball.net/match/378107");
  await page.locator("#handballNetCreateDirect").click();
  await expect.poll(()=>authorization).toBe("Bearer "+dummy);
  await page.reload();

  await page.locator('[data-tab="setup"]').click();
  await panel.locator("summary").click();
  await expect(page.locator("#proxyTokenStatus")).toContainText("lokal hinterlegt");
  await expect(page.locator("#proxyTokenInput")).toHaveValue("");
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#proxyTokenRemove").click();
  await expect(page.locator("#proxyTokenStatus")).toContainText("Kein Proxy-Token hinterlegt");
  values=await page.evaluate(()=>({credential:localStorage.getItem("handballSpielanalyse.proxyToken"),
    session:localStorage.getItem("handballSpielanalyse.session")||""}));
  expect(values.credential).toBeNull();
  expect(values.session).not.toContain(dummy);
});

test("the app prompts for proxy configuration rather than embedding any credential",async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#newGame").click();
  await page.locator("#newGameHandball360").click();
  await page.locator("#handballNetUrl").fill("https://www.handball.net/match/378107");
  await page.locator("#handballNetCreateDirect").click();
  await expect(page.locator("#newGameHandball360Status")).toContainText("Proxy-Zugang fehlt");
  await expect(page.locator("#proxyTokenStatus")).toContainText("Kein Proxy-Token hinterlegt");
});
