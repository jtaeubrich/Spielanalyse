import { describe, expect, test } from "vitest";
import {
  INTERNAL_DB_NAME,
  INTERNAL_DB_VERSION,
  INTERNAL_GAME_STORE,
  INTERNAL_GAME_KEY,
  INTERNAL_SEASON_STORE,
  INTERNAL_SEASON_KEY,
  INTERNAL_ROSTER_STORE,
  SESSION_STORAGE_KEY,
  SEASON_FORMAT,
  SEASON_VERSION,
  buildInternalGameRecord,
  buildSeasonRecord,
  buildSeasonExport,
  buildSessionRecord,
  buildRosterRecord,
  openInternalDb
} from "../src/storage.js";

describe("storage core", () => {
  test("keeps persistence identifiers stable", () => {
    expect(INTERNAL_DB_NAME).toBe("handball-spielanalyse");
    expect(INTERNAL_DB_VERSION).toBe(3);
    expect(INTERNAL_GAME_STORE).toBe("games");
    expect(INTERNAL_GAME_KEY).toBe("current");
    expect(INTERNAL_SEASON_STORE).toBe("seasons");
    expect(INTERNAL_SEASON_KEY).toBe("current");
    expect(INTERNAL_ROSTER_STORE).toBe("rosters");
    expect(SESSION_STORAGE_KEY).toBe("handballSpielanalyse.session");
  });

  test("builds the internal game record deterministically", () => {
    const record = buildInternalGameRecord({
      text: '{"test":true}',
      fileName: "spiel.json",
      gameName: "Testspiel",
      savedAt: "2026-10-10T10:00:00.000Z"
    });

    expect(record).toEqual({
      id: "current",
      text: '{"test":true}',
      fileName: "spiel.json",
      gameName: "Testspiel",
      savedAt: "2026-10-10T10:00:00.000Z"
    });
  });

  test("builds internal season records without changing games", () => {
    const state = { gameName: "A", events: [{ type: "goal" }] };
    const games = [{
      id: "g1",
      fileName: "a.json",
      selected: false,
      state
    }];

    const record = buildSeasonRecord({
      name: " Saison 26/27 ",
      games,
      updatedAt: "2026-10-10T10:00:00.000Z"
    });

    expect(record.format).toBe(SEASON_FORMAT);
    expect(record.version).toBe(SEASON_VERSION);
    expect(record.name).toBe("Saison 26/27");
    expect(record.games).toEqual([
      {
        id: "g1",
        fileName: "a.json",
        selected: false,
        data: state
      }
    ]);
    expect(record.updatedAt).toBe("2026-10-10T10:00:00.000Z");
  });

  test("builds season exports without internal IndexedDB metadata", () => {
    const exported = buildSeasonExport({
      name: "Test",
      games: [],
      createdAt: "2026-10-10T10:00:00.000Z"
    });

    expect(exported).toEqual({
      format: SEASON_FORMAT,
      version: SEASON_VERSION,
      name: "Test",
      games: [],
      createdAt: "2026-10-10T10:00:00.000Z"
    });
    expect(exported).not.toHaveProperty("id");
    expect(exported).not.toHaveProperty("updatedAt");
  });

  test("normalizes session metadata while preserving state", () => {
    const state = { format: "handball-spielanalyse", version: 1 };
    const record = buildSessionRecord({
      state,
      ownTeam: "away",
      myTeamLeft: false,
      gameBase: 123.4,
      analysisMode: "video",
      currentGameFileName: "spiel.json"
    });

    expect(record).toEqual({
      state,
      ownTeam: "away",
      myTeamLeft: false,
      gameBase: 123.4,
      analysisMode: "video",
      currentGameFileName: "spiel.json"
    });
  });

  test("reports missing IndexedDB explicitly", async () => {
    await expect(openInternalDb(null)).rejects.toThrow("IndexedDB nicht verfügbar");
  });
});


test("builds persistent roster records with Handball360 IDs intact", () => {
  const record = buildRosterRecord({
    id: "team-test",
    teamName: "TSV Beispiel",
    updatedAt: "2026-10-10T12:00:00.000Z",
    players: [{
      id: "p1",
      nr: 8,
      vorname: "Anna",
      nachname: "Beispiel",
      handballNetId: "hb-1"
    }]
  });

  expect(record.id).toBe("team-test");
  expect(record.teamName).toBe("TSV Beispiel");
  expect(record.players[0].handballNetId).toBe("hb-1");
  expect(record.updatedAt).toBe("2026-10-10T12:00:00.000Z");
});
