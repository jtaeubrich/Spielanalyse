import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_SEASON_FORMAT,
  seasonIdentityText,
  seasonGameId,
  resolveSeasonOwnTeam,
  normalizeSeasonGame,
  normalizeSeasonArchive,
  parseSeasonText,
  mergeSeasonGames,
  readSeasonGameFiles
} from "../src/season-files.js";
import { SEASON_FORMAT, SEASON_VERSION } from "../src/storage.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const hkn = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "hkn_reference.json"), "utf8")
);

describe("season file helpers", () => {
  test("normalizes season identity text and creates stable game ids", () => {
    expect(seasonIdentityText("  HSG   Test  ")).toBe("hsg test");
    expect(seasonGameId("spiel.json", hkn)).toBe(seasonGameId("spiel.json", hkn));
    expect(seasonGameId("spiel.json", hkn)).toMatch(/^sg-[0-9a-f]+$/);
  });

  test("resolves own team from saved data before name fallback", () => {
    expect(resolveSeasonOwnTeam({ ...hkn, ownTeam: "away" }, "HSG Herzhorn/Kollmar/Neuendorf")).toBe("away");

    const withoutOwn = structuredClone(hkn);
    delete withoutOwn.ownTeam;
    expect(resolveSeasonOwnTeam(withoutOwn, withoutOwn.home.name)).toBe("home");
    expect(resolveSeasonOwnTeam(withoutOwn, withoutOwn.away.name)).toBe("away");
  });

  test("normalizes a game and migrates its format", () => {
    const legacy = structuredClone(hkn);
    delete legacy.format;
    delete legacy.version;

    const game = normalizeSeasonGame(legacy, "hkn.json", legacy.away.name);

    expect(game.state.format).toBe("handball-spielanalyse");
    expect(game.state.version).toBe(1);
    expect(game.fileName).toBe("hkn.json");
    expect(game.ownTeam).toBe("away");
    expect(game.opponentTeam).toBe("home");
    expect(game.selected).toBe(true);
  });

  test("imports the current season archive format", () => {
    const archive = normalizeSeasonArchive({
      format: SEASON_FORMAT,
      version: SEASON_VERSION,
      name: " Saison 26/27 ",
      games: [
        {
          fileName: "hkn.json",
          selected: false,
          data: hkn
        }
      ]
    }, hkn.away.name);

    expect(archive.format).toBe(SEASON_FORMAT);
    expect(archive.version).toBe(SEASON_VERSION);
    expect(archive.name).toBe("Saison 26/27");
    expect(archive.games).toHaveLength(1);
    expect(archive.games[0].selected).toBe(false);
  });

  test("keeps legacy season archives importable", () => {
    const archive = normalizeSeasonArchive({
      format: LEGACY_SEASON_FORMAT,
      games: [{ state: hkn, fileName: "alt.json" }]
    }, hkn.away.name);

    expect(archive.format).toBe(SEASON_FORMAT);
    expect(archive.version).toBe(SEASON_VERSION);
    expect(archive.games).toHaveLength(1);
  });

  test("rejects future season versions", () => {
    expect(() => normalizeSeasonArchive({
      format: SEASON_FORMAT,
      version: SEASON_VERSION + 1,
      games: []
    })).toThrow(/verwendet Version 2.*Unterstützt wird derzeit Version 1/);
  });

  test("parses season JSON with clear malformed-json errors", () => {
    expect(() => parseSeasonText("{broken")).toThrow(
      "Saison-JSON konnte nicht gelesen werden."
    );
  });

  test("merges updated games while preserving their selected state", () => {
    const oldGame = normalizeSeasonGame(hkn, "hkn.json", hkn.away.name);
    oldGame.selected = false;

    const updated = normalizeSeasonGame(hkn, "hkn.json", hkn.away.name);
    updated.state = { ...updated.state, gameName: "Aktualisiert" };

    const merged = mergeSeasonGames([oldGame], [updated]);

    expect(merged.added).toBe(0);
    expect(merged.updated).toBe(1);
    expect(merged.games).toHaveLength(1);
    expect(merged.games[0].selected).toBe(false);
    expect(merged.games[0].state.gameName).toBe("Aktualisiert");
  });

  test("reads multiple season game files and reports invalid files separately", async () => {
    const files = [
      {
        name: "ok.json",
        text: async () => JSON.stringify(hkn)
      },
      {
        name: "defekt.json",
        text: async () => "{broken"
      }
    ];

    const result = await readSeasonGameFiles(files, hkn.away.name);

    expect(result.loaded).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fileName).toBe("defekt.json");
  });
});
