import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const reference = JSON.parse(await readFile(path.resolve(here, "../fixtures/hkn_reference.json"), "utf8"));

function asGame(surname) {
  const data = structuredClone(reference);
  const player = data[data.ownTeam].players[0];
  player.vorname = "Laurids";
  player.nachname = surname;
  player.nr = 22;
  player.handballNetId = "";
  return data;
}
function upload(name, json) {
  return { name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(json)) };
}

test("season merges only user-selected name variants and can undo the mapping", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    upload("saison_pohl.json", asGame("Pohl")),
    upload("saison_poehl.json", asGame("Pöhl"))
  ]);
  await expect(page.locator("#seasonPlayerRows")).toContainText("Laurids Pohl");
  await expect(page.locator("#seasonPlayerRows")).toContainText("Laurids Pöhl");
  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonMergePlayers").click();
  await expect(page.locator("#seasonMergeDialog")).toBeVisible();
  const options = await page.locator("#seasonMergeFrom option").evaluateAll(
    options => options.map(o => ({ label: o.textContent, value: o.value }))
  );
  const source = options.find(o => o.label.includes("Laurids Pohl"));
  const target = options.find(o => o.label.includes("Laurids Pöhl"));
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();
  await page.locator("#seasonMergeFrom").selectOption(source.value);
  await page.locator("#seasonMergeInto").selectOption(target.value);
  await page.locator("#seasonMergeConfirm").click();

  await expect(page.locator("#seasonPlayerRows")).toContainText("Laurids Pöhl");
  await expect(page.locator("#seasonPlayerRows")).not.toContainText("Laurids Pohl");
  const targetRow = page.locator("#seasonPlayerRows tr").filter({hasText:"Laurids Pöhl"});
  await expect(targetRow.locator("td").nth(1)).toHaveText("2");

  // Season-only: the original import buffers and roster names are not modified.
  await page.locator("#seasonMergeClose").click();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#seasonExport").click()
  ]);
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.playerAliases[source.value]).toBe(target.value);
  expect(exported.games[0].data[exported.games[0].data.ownTeam].players[0].nachname).toBe("Pohl");
  expect(exported.games[1].data[exported.games[1].data.ownTeam].players[0].nachname).toBe("Pöhl");

  await page.locator('[data-tab="season"]').click();
  await page.locator("#seasonMergePlayers").click();
  await page.locator("#seasonMergeMappings button").first().click();
  await expect(page.locator("#seasonPlayerRows")).toContainText("Laurids Pohl");
  await expect(page.locator("#seasonPlayerRows")).toContainText("Laurids Pöhl");

  // Exported association is restored if the season is imported again.
  await page.locator("#seasonMergeClose").click();
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonImportInput").setInputFiles(upload("season.json", exported));
  await expect(page.locator("#seasonPlayerRows")).not.toContainText("Laurids Pohl");
  await expect(page.locator("#seasonPlayerRows tr").filter({hasText:"Laurids Pöhl"}).locator("td").nth(1)).toHaveText("2");
});

test("exact names are aggregated regardless of shirt number", async ({ page }) => {
  const a = asGame("Beispiel");
  const b = asGame("Beispiel");
  a[a.ownTeam].players[0].nr = "";
  b[b.ownTeam].players[0].nr = 17;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#setupModeSeason").click();
  await page.locator("#seasonGameInput").setInputFiles([
    upload("game_no_number.json", a), upload("game_with_number.json", b)
  ]);
  await expect(page.locator("#seasonPlayerRows tr").filter({hasText:"Laurids Beispiel"})).toHaveCount(1);
  const row = page.locator("#seasonPlayerRows tr").filter({hasText:"Laurids Beispiel"});
  await expect(row.locator("td").nth(1)).toHaveText("2");
  await expect(row.locator("td").first()).toContainText("#17");
});
