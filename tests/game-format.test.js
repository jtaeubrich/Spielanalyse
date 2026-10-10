import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GAME_FORMAT,
  CURRENT_GAME_VERSION,
  migrateGameData,
  stampCurrentGameFormat
} from "../src/game-format.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const current = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "hkn_reference.json"), "utf8")
);

describe("game format and migrations", () => {
  test("defines the current format explicitly", () => {
    expect(GAME_FORMAT).toBe("handball-spielanalyse");
    expect(CURRENT_GAME_VERSION).toBe(1);
  });

  test("migrates an unversioned legacy game to version 1", () => {
    const legacy = structuredClone(current);
    delete legacy.format;
    delete legacy.version;
    delete legacy.ownTeam;
    delete legacy.activeDefense;

    for (const team of ["home", "away"]) {
      for (const player of legacy[team].players || []) {
        delete player.handballNetId;
      }
    }

    const migrated = migrateGameData(legacy);

    expect(migrated.format).toBe(GAME_FORMAT);
    expect(migrated.version).toBe(1);
    expect(migrated.ownTeam).toBe("away");
    expect(migrated.activeDefense).toEqual({ home: null, away: null });

    for (const team of ["home", "away"]) {
      expect(
        migrated[team].players.every((player) => player.handballNetId === "")
      ).toBe(true);
    }

    expect(migrated.events).toHaveLength(current.events.length);
    expect(migrated.gameName).toBe(current.gameName);
  });

  test("keeps current versioned games stable", () => {
    const migrated = migrateGameData(current);

    expect(migrated.format).toBe(GAME_FORMAT);
    expect(migrated.version).toBe(CURRENT_GAME_VERSION);
    expect(migrated.events).toEqual(current.events);
    expect(migrated.home.name).toBe(current.home.name);
    expect(migrated.away.name).toBe(current.away.name);
  });

  test("preserves unknown forward-compatible data while stamping the format", () => {
    const input = {
      ...structuredClone(current),
      customExtension: { enabled: true, value: 42 }
    };

    const stamped = stampCurrentGameFormat(input);

    expect(stamped.customExtension).toEqual({ enabled: true, value: 42 });
    expect(stamped.format).toBe(GAME_FORMAT);
    expect(stamped.version).toBe(CURRENT_GAME_VERSION);
  });

  test("rejects files from a future game version", () => {
    const future = {
      ...structuredClone(current),
      format: GAME_FORMAT,
      version: CURRENT_GAME_VERSION + 1
    };

    expect(() => migrateGameData(future)).toThrow(
      /verwendet Version 2.*Unterstützt wird derzeit Version 1/
    );
  });

  test("rejects unrelated file formats", () => {
    const wrong = {
      ...structuredClone(current),
      format: "anderes-format",
      version: 1
    };

    expect(() => migrateGameData(wrong)).toThrow(/Unbekanntes Spielformat/);
  });

  test("does not mutate the source object during migration", () => {
    const legacy = structuredClone(current);
    delete legacy.format;
    delete legacy.version;
    const before = JSON.stringify(legacy);

    migrateGameData(legacy);

    expect(JSON.stringify(legacy)).toBe(before);
  });
});
