test("separates game roster editing from persistent team collection in Setup",async({page})=>{
 await page.goto("/");
 await page.locator("#setupRosterPanel > summary").click();
 await expect(page.locator("#rosterTeam")).toBeVisible();
 await expect(page.locator("#addPlayer")).toHaveText(/Spieler hinzufügen/);
 await expect(page.locator("#rosterEditor")).toBeVisible();
 await page.locator("#setupTeamCollectionPanel > summary").click();
 await expect(page.locator("#knownRosterSelect")).toBeVisible();
 await expect(page.locator("#applyKnownRoster")).toHaveText("Für aktuelles Spiel verwenden");
 await expect(page.locator("#loadRosterCollection")).toHaveText("Spieler für aktuelle Mannschaft ergänzen");
 await expect(page.locator("#updateRosterCollection")).toHaveText("Spielkader in Sammlung speichern");
 await expect(page.locator("#deleteKnownRoster")).toHaveText("Aus Sammlung löschen");
});

import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const hknFixture = path.resolve(here, "../fixtures/hkn_reference.json");
const h360Fixture = path.resolve(here, "../fixtures/handball360_378107.json");

test("loads the HKN reference game and lets the user change Mein Team", async ({ page }) => {
  await page.goto("/");

  await page.locator("#continueGameInput").setInputFiles(hknFixture);

  await expect(page.locator("#homeName")).toContainText("Mein Team");
  await expect(page.locator("#setupOwnTeamSide")).toHaveValue("away");
  await expect(page.locator("#setupHomeName")).toHaveValue("HSG Herzhorn/Kollmar/Neuendorf");
  await expect(page.locator("#setupAwayName")).toHaveValue("Mein Team");

  await page.getByRole("button", { name: "Setup" }).click();
  await page.locator("#setupOwnTeamSide").selectOption("home");

  await expect(page.locator("#setupOwnTeamSide")).toHaveValue("home");
  await expect(page.locator("#homeName")).toContainText("Mein Team · HSG Herzhorn/Kollmar/Neuendorf");
});

test("imports the Handball360 reference payload without using the live proxy", async ({ page }) => {
  const fixture = JSON.parse(
    await (await import("node:fs/promises")).readFile(h360Fixture, "utf8")
  );

  await page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:4173",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Authorization"
        }
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4173"
      },
      body: JSON.stringify(fixture)
    });
  });

  await page.goto("/");
  await page.locator("#newGame").click();
  await page.locator("#newGameHandball360").click();
  await page.locator("#handballNetUrl").fill("https://www.handball.net/match/378107");
  await page.locator("#handballNetCreateDirect").click();

  await expect(page.locator("#newGameHandball360Status")).toContainText("Spiel erfolgreich geladen");
  await expect(page.locator("#handballNetRawDetails")).not.toHaveAttribute("open", "");

  await page.locator("#handballNetCreateDirect").click();

  await expect(page.locator("#score")).toHaveText("35 : 26");
  await expect(page.locator("#homeName")).toContainText("Mein Team · MEIN TEAM");

  await expect.poll(async () => page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open("handball-spielanalyse", 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("rosters", "readonly");
        const getAll = tx.objectStore("rosters").getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const records = getAll.result || [];
          db.close();
          resolve(records);
        };
      };
    });
  })).toEqual(expect.arrayContaining([
    expect.objectContaining({
      players: expect.arrayContaining([
        expect.objectContaining({
          handballNetId: expect.any(String)
        })
      ])
    })
  ]));

  await page.getByRole("button", { name: "Setup" }).click();
  await page.locator("#setupTab details").filter({has:page.locator("summary", {hasText:"Spielkader bearbeiten"})}).locator("summary").click();
  await page.locator("#setupTeamCollectionPanel > summary").click();
  await expect(page.locator("#rosterCollectionStatus")).toContainText("H360-ID");

  await expect.poll(async () => page.locator("#knownRosterSelect option").count()).toBeGreaterThan(1);
  const firstKnownValue = await page.locator("#knownRosterSelect option").nth(1).getAttribute("value");
  const firstKnownLabel = await page.locator("#knownRosterSelect option").nth(1).textContent();
  await page.locator("#knownRosterSelect").selectOption(firstKnownValue);
  await page.locator("#applyKnownRoster").click();
  await expect(page.locator("#setupAwayName")).toHaveValue((firstKnownLabel || "").split(" · ")[0]);
});

test("setup stays usable on a mobile viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only smoke test");
  await page.goto("/");
  await expect(page.locator("#setupTab")).toBeVisible();
  await expect(page.locator("#newGame")).toBeVisible();
  await expect(page.locator("#setupOwnTeamSide")).toBeVisible();
});

test("Video Scouting places selectors before video and capture below without game clock buttons",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("body")).toHaveClass(/video-scouting-layout/);
 await expect(page.locator("#matchReviewTopHost #modeSelect")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOwnKeeper")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOpponentKeeper")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOwnDefense")).toBeVisible();
 await expect(page.locator("#matchReviewTopHost #activeOpponentDefense")).toBeVisible();
 await expect(page.locator("#runBtn")).toBeHidden();
 await expect(page.locator("#gameClock")).toBeHidden();
 await expect(page.locator("#idleStep")).toBeVisible();
 const positions=await page.evaluate(()=>{
  const rect=id=>document.querySelector(id).getBoundingClientRect();
  return {selectors:rect("#matchReviewTopHost").bottom,video:rect("#matchVideoHost").top,capture:rect("#idleStep").top};
 });
 expect(positions.selectors).toBeLessThanOrEqual(positions.video+3);
 expect(positions.video).toBeLessThan(positions.capture);
});

test("nearby events use a horizontal strip in Match video scouting",async({page})=>{
 await page.goto("/");
 await page.locator('[data-tab="match"]').click();
 await page.locator("#modeSelect").selectOption("video");
 await expect(page.locator("#matchNearbyEvents")).toBeVisible();
 await expect(page.locator("#matchNearbyList")).toBeVisible();
 await expect(page.locator("#matchNearbyList")).toContainText("Video laden");
 await expect(page.locator("#idleStep")).toBeVisible();
 await expect(page.locator("#matchNearbyEditorHost")).toBeHidden();
 await expect(page.locator("#matchNearbyList")).toHaveCSS("overflow-x","auto");
});

test("neutral perspective shows real teams and symmetric shot capture",async({page})=>{
 await page.goto("/");
 await page.locator("#setupOwnTeamSide").selectOption("neutral");
 await expect(page.locator("#setupOwnTeamSide")).toHaveValue("neutral");
 await page.locator('[data-tab="match"]').click();
 await expect(page.locator("#homePoss")).toContainText("Ballbesitz");
 await expect(page.locator("#awayPoss")).toContainText("Ballbesitz");
 await expect(page.locator("#homePoss")).not.toContainText("Mein Team");
 await expect(page.locator("#awayPoss")).not.toContainText("Gegner");
 await expect(page.locator("#activeOwnKeeper").locator("..")).toContainText("Heim");
 await expect(page.locator("#activeOpponentKeeper").locator("..")).toContainText("Gast");
 await page.locator('[data-tab="setup"]').click();
 await expect(page.locator("#setupOwnTeamSide")).toHaveValue("neutral");
});
