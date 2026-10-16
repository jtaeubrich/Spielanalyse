import { test, expect } from "@playwright/test";

test.describe("Event-bound video annotations", () => {
  test("drawing actions require a selected event", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-tab="video"]').click();
    if (await page.locator("#annotationToolsToggle").isVisible()) await page.locator("#annotationToolsToggle").click();
    await expect(page.locator("#drawToggle")).toBeDisabled();
    await expect(page.locator("#fullscreenDrawOpen")).toBeDisabled();
    await expect(page.locator("#fullscreenEventLabel")).toBeHidden();
  });

  test("annotation visibility is shared between Video and Match", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-tab="video"]').click();
    if (await page.locator("#annotationToolsToggle").isVisible()) await page.locator("#annotationToolsToggle").click();
    await page.locator("#showVideoAnnotations").uncheck();
    await expect(page.locator("#showMatchAnnotations")).not.toBeChecked();
    await page.locator('[data-tab="match"]').click();
    await page.locator("#modeSelect").selectOption("video");
    await expect(page.locator("#showMatchAnnotations")).toBeVisible();
    await expect(page.locator("#showMatchAnnotations")).not.toBeChecked();
    await page.locator("#showMatchAnnotations").check();
    await page.locator('[data-tab="video"]').click();
    await expect(page.locator("#showVideoAnnotations")).toBeChecked();
  });

  test("fullscreen editing controls are available", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#fullscreenMode")).toHaveCount(1);
    await expect(page.locator("#fullscreenEditMode")).toHaveCount(1);
    await expect(page.locator("#selectedShapeDelete")).toBeHidden();
    await expect(page.locator("#fullscreenClose")).toHaveText("✕");
  });

  test("fullscreen exposes event and selected drawing timing controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#fullscreenAnnotationTime")).toHaveCount(1);
    await expect(page.locator("#fullscreenShapeStart")).toHaveCount(1);
    await expect(page.locator("#fullscreenShapeEnd")).toHaveCount(1);
    await expect(page.locator("#fullscreenTimingEdit")).toBeHidden();
  });

  test("fullscreen event label and tools exist in the video stage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#videoStage #fullscreenEventLabel")).toHaveCount(1);
    await expect(page.locator("#videoStage #fullscreenDrawToolbar")).toHaveCount(1);
    await expect(page.locator("#fullscreenDrawTool option")).toHaveCount(3);
  });
});
