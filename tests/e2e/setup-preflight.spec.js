import {test,expect} from "@playwright/test";
test.beforeEach(async({page})=>{
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSingle").click();
  await page.locator("#newGame").click();
  await page.locator("#newGameManual").click();
});
test("starts in Setup and permits scouting with open tasks",async({page})=>{
  await expect(page.locator("#preflightCount")).toHaveText("0 von 3 Pflichtschritten");
  await page.locator("#preflightStart").click();
  await expect(page.locator('[data-tab="match"]')).toHaveClass(/active/);
});
test("checks information, goalkeeper and capture settings separately",async({page})=>{
  await page.locator("#setupHomeName").fill("Heimclub");
  await page.locator("#setupHomeName").dispatchEvent("change");
  await page.locator("#setupAwayName").fill("Gastclub");
  await page.locator("#setupAwayName").dispatchEvent("change");
  for(const [id,value] of [["setupGameDate","2026-11-07"],["setupGameTime","16:00"],["setupGameVenue","Sporthalle Kronshagen"]]){
    await page.locator("#"+id).fill(value);
    await page.locator("#"+id).dispatchEvent("change");
  }
  await expect(page.locator("#preflightInfoStep")).toHaveAttribute("data-status","done");
  await page.locator("#preflightOpenRoster").click();
  await expect(page.locator("#setupRosterPanel")).toHaveAttribute("open","");
  await page.locator("#addPlayer").click();
  await page.locator("#rosterEditor tbody tr input[type=checkbox]").check();
  await page.locator("#rosterEditor tbody tr input[type=radio]").check();
  await expect(page.locator("#preflightConfirmRoster")).toBeEnabled();
  await page.locator("#preflightConfirmRoster").click();
  await expect(page.locator("#preflightRosterStep")).toHaveAttribute("data-status","done");
  await page.locator("#preflightOpenCapture").click();
  await expect(page.locator("#setupCapturePanel")).toHaveAttribute("open","");
  await page.locator("#preflightConfirmCapture").click();
  await expect(page.locator("#preflightCount")).toHaveText("3 von 3 Pflichtschritten");
  await page.locator('[data-shot-setting="location"]').uncheck();
  await expect(page.locator("#preflightCaptureStep")).toHaveAttribute("data-status","open");
});
