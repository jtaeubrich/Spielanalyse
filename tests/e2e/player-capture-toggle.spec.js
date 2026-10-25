import { test, expect } from "@playwright/test";

async function setPlayerCapture(page, enabled) {
  await page.goto("/");
  await page.locator("#setupTab details").filter({
    has: page.locator("summary", { hasText: "Torwurf-Erfassung" })
  }).locator("summary").click();
  const option = page.locator('[data-shot-setting="attacker"]');
  await expect(option).toBeVisible();
  if (enabled) await option.check();
  else await option.uncheck();
  await page.locator('[data-tab="match"]').click();
}

test("disabled player capture skips the attacker for technical errors", async ({ page }) => {
  await setPlayerCapture(page, false);
  await page.locator('[data-flow="error"]').click();
  await expect(page.locator("#errorStep")).toHaveClass(/active/);
  await expect(page.locator("#playerStep")).not.toHaveClass(/active/);
  await page.locator("#flowBack").click();
  await expect(page.locator("#idleStep")).toHaveClass(/active/);
  await page.locator('[data-flow="error"]').click();
  await page.locator("#errorList .option").first().click();
  await expect(page.locator("#eventCount")).toContainText("1 Ereignis");
  await expect(page.locator("#idleStep")).toHaveClass(/active/);
});

test("disabled player capture skips penalty player but keeps team selection", async ({ page }) => {
  await setPlayerCapture(page, false);
  await page.locator('[data-flow="penalty"]').click();
  await expect(page.locator("#penaltyTypeStep")).toHaveClass(/active/);
  await expect(page.locator("#penaltyStep")).not.toHaveClass(/active/);
  await expect(page.locator("#penaltyQuickTeam")).toBeVisible();
  const quick = page.locator("#penaltyQuickTeamSwitch");
  await page.locator("#penaltyQuickTeam .team-switch").click();
  await expect(quick).toBeChecked();
  await page.locator("#flowBack").click();
  await expect(page.locator("#idleStep")).toHaveClass(/active/);
  await page.locator('[data-flow="penalty"]').click();
  await page.locator('[data-penalty-type="2min"]').click();
  await expect(page.locator("#eventCount")).toContainText("1 Ereignis");
});

test("enabled player capture retains both existing player steps", async ({ page }) => {
  await setPlayerCapture(page, true);
  await page.locator('[data-flow="error"]').click();
  await expect(page.locator("#playerStep")).toHaveClass(/active/);
  await page.locator("#playerList .unknown-option").click();
  await expect(page.locator("#errorStep")).toHaveClass(/active/);
  await page.locator("#flowBack").click();
  await expect(page.locator("#playerStep")).toHaveClass(/active/);
  await page.locator("#flowBack").click();
  await expect(page.locator("#idleStep")).toHaveClass(/active/);
  await page.locator('[data-flow="penalty"]').click();
  await expect(page.locator("#penaltyStep")).toHaveClass(/active/);
  await page.locator("#penaltyList .unknown-option").first().click();
  await expect(page.locator("#penaltyTypeStep")).toHaveClass(/active/);
  await expect(page.locator("#penaltyQuickTeam")).toBeHidden();
  await page.locator("#flowBack").click();
  await expect(page.locator("#penaltyStep")).toHaveClass(/active/);
});
