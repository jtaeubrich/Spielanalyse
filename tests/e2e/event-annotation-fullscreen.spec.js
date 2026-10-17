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

  test("single annotation visibility checkbox persists across Video and Match", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-tab="video"]').click();
    if (await page.locator("#annotationToolsToggle").isVisible()) await page.locator("#annotationToolsToggle").click();
    await expect(page.locator("#showMatchAnnotations")).toHaveCount(0);
    await page.locator("#showVideoAnnotations").uncheck();
    await page.locator('[data-tab="match"]').click();
    await page.locator("#modeSelect").selectOption("video");
    await page.locator('[data-tab="video"]').click();
    await expect(page.locator("#showVideoAnnotations")).not.toBeChecked();
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

  test("annotation canvas resizes with device orientation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator('[data-tab="video"]').click();
    const portrait = await page.locator("#annotationCanvas").evaluate(canvas => ({width:canvas.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height}));
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => page.locator("#annotationCanvas").evaluate(canvas => canvas.getBoundingClientRect().width)).not.toBe(portrait.width);
    const dimensions = await page.locator("#annotationCanvas").evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  test("fullscreen event label and tools exist in the video stage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#videoStage #fullscreenEventLabel")).toHaveCount(1);
    await expect(page.locator("#videoStage #fullscreenDrawToolbar")).toHaveCount(1);
    await expect(page.locator("#fullscreenDrawTool option")).toHaveCount(3);
  });
});
