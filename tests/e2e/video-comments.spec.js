import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/hkn_reference.json");

test("video event comment belongs to selected event and survives reload", async ({ page }) => {
  await page.goto("/");
 await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles(fixture);
  await page.locator('[data-tab="video"]').click();
  const entries = page.locator("#videoPlaylist [data-event-index]");
  await expect(entries.first()).toBeVisible();
  expect(await entries.count()).toBeGreaterThan(1);
  const firstIndex = await entries.nth(0).getAttribute("data-event-index");
  const secondIndex = await entries.nth(1).getAttribute("data-event-index");
  await entries.nth(0).click();
  const comment = page.locator("#videoTabEventComment");
  await expect(comment).toBeEnabled();
  await comment.fill("Gute Entscheidung im Rückraum");
  await expect(page.locator("#videoCommentOverlay")).toBeEmpty();
  await page.locator('#videoPlaylist [data-event-index="' + secondIndex + '"]').click();
  await expect(comment).toHaveValue("");
  await page.locator('#videoPlaylist [data-event-index="' + firstIndex + '"]').click();
  await expect(comment).toHaveValue("Gute Entscheidung im Rückraum");
  await expect.poll(() => page.evaluate((index) => {
    const raw = localStorage.getItem("handballSpielanalyse.session");
    return raw ? JSON.parse(raw).state.events[Number(index)]?.videoAnnotation?.comment : null;
  }, firstIndex)).toBe("Gute Entscheidung im Rückraum");
  await page.reload();
  await page.locator('[data-tab="video"]').click();
  await page.locator('#videoPlaylist [data-event-index="' + firstIndex + '"]').click();
  await expect(page.locator("#videoTabEventComment")).toHaveValue("Gute Entscheidung im Rückraum");
});
