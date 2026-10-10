import { describe, expect, test } from "vitest";
import {
  normalizeHandballNetId,
  normalizeRosterPlayer,
  rowsToPlayers,
  parseRosterJson,
  mergeRosterByHandballId,
  rosterTeamKey,
  mergeRosterCollection
} from "../src/roster.js";

describe("roster import core", () => {
  test("normalizes Handball360 IDs", () => {
    expect(normalizeHandballNetId(" 0uw6qtm ")).toBe("0uw6qtm");
    expect(normalizeHandballNetId(null)).toBe("");
  });

  test("prefers Handball360 ID when matching existing players", () => {
    const existing = [
      {
        id: "local-1",
        nr: 7,
        vorname: "Jespe",
        nachname: "Täubrich",
        isTW: false,
        handballNetId: "0uw6qtm"
      }
    ];

    const imported = normalizeRosterPlayer(
      {
        nr: 99,
        vorname: "Jespe",
        nachname: "Täubrich",
        handball360Id: "0uw6qtm"
      },
      0,
      existing
    );

    expect(imported.id).toBe("local-1");
    expect(imported.handballNetId).toBe("0uw6qtm");
    expect(imported.nr).toBe(99);
  });

  test("imports Handball360 ID aliases from JSON", () => {
    const players = parseRosterJson(
      [
        {
          id: "p1",
          nr: 12,
          vorname: "Max",
          nachname: "Muster",
          "H360-ID": "abc123"
        }
      ],
      "away",
      []
    );

    expect(players).toHaveLength(1);
    expect(players[0].handballNetId).toBe("abc123");
  });

  test("imports H360-ID from tabular roster data", () => {
    const players = rowsToPlayers([
      ["Nr.", "Vorname", "Nachname", "H360-ID", "TW"],
      [8, "Anna", "Beispiel", "player-8", ""]
    ]);

    expect(players).toHaveLength(1);
    expect(players[0].handballNetId).toBe("player-8");
    expect(players[0].nr).toBe(8);
  });

  test("keeps existing Handball360 ID when spreadsheet omits it", () => {
    const existing = [
      {
        id: "p1",
        nr: 8,
        vorname: "Anna",
        nachname: "Beispiel",
        isTW: false,
        handballNetId: "player-8"
      }
    ];

    const players = rowsToPlayers([
      ["Nr.", "Vorname", "Nachname"],
      [8, "Anna", "Beispiel"]
    ], existing);

    expect(players[0].id).toBe("p1");
    expect(players[0].handballNetId).toBe("player-8");
  });

  test("matches same Handball360 player even when shirt number changes", () => {
    const existing = [
      {
        id: "p1",
        nr: 8,
        vorname: "Anna",
        nachname: "Beispiel",
        handballNetId: "stable-id",
        isTW: false
      }
    ];

    const players = rowsToPlayers([
      ["Nr.", "Vorname", "Nachname", "Handball360-ID"],
      [23, "Anna", "Beispiel", "stable-id"]
    ], existing);

    expect(players[0].id).toBe("p1");
    expect(players[0].nr).toBe(23);
    expect(players[0].handballNetId).toBe("stable-id");
  });

  test("mergeRosterByHandballId preserves local IDs", () => {
    const existing = [
      {
        id: "local",
        nr: 4,
        vorname: "Alt",
        nachname: "Name",
        handballNetId: "hb-1"
      }
    ];
    const imported = [
      {
        id: "remote",
        nr: 14,
        vorname: "Neu",
        nachname: "Name",
        handballNetId: "hb-1"
      }
    ];

    const merged = mergeRosterByHandballId(existing, imported);

    expect(merged[0].id).toBe("local");
    expect(merged[0].nr).toBe(14);
    expect(merged[0].handballNetId).toBe("hb-1");
  });
});


describe("persistent roster collection", () => {
  test("creates a stable team key", () => {
    expect(rosterTeamKey("  TSV   Beispiel ")).toBe(rosterTeamKey("tsv beispiel"));
    expect(rosterTeamKey("TSV Beispiel")).toMatch(/^team-[0-9a-f]+$/);
  });

  test("enriches an existing player with a newly discovered Handball360 ID", () => {
    const existing = [{
      id: "local-1",
      nr: 8,
      vorname: "Anna",
      nachname: "Beispiel",
      isTW: false,
      handballNetId: ""
    }];
    const incoming = [{
      id: "remote-1",
      nr: 23,
      vorname: "Anna",
      nachname: "Beispiel",
      isTW: false,
      handballNetId: "hb-stable"
    }];

    const result = mergeRosterCollection(existing, incoming);

    expect(result.players).toHaveLength(1);
    expect(result.players[0].id).toBe("local-1");
    expect(result.players[0].nr).toBe(23);
    expect(result.players[0].handballNetId).toBe("hb-stable");
    expect(result.enrichedIds).toBe(1);
    expect(result.conflicts).toHaveLength(0);
  });

  test("keeps equal names with different Handball360 IDs as separate players", () => {
    const existing = [{
      id: "local-a",
      nr: 8,
      vorname: "Max",
      nachname: "Muster",
      handballNetId: "hb-a"
    }];
    const incoming = [{
      id: "remote-b",
      nr: 8,
      vorname: "Max",
      nachname: "Muster",
      handballNetId: "hb-b"
    }];

    const result = mergeRosterCollection(existing, incoming);

    expect(result.players).toHaveLength(2);
    expect(result.players.map((p) => p.handballNetId).sort()).toEqual(["hb-a", "hb-b"]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe("same-name-different-h360-id");
  });

  test("does not match a different Handball360 player only because the shirt number is equal", () => {
    const existing = [{
      id: "local-a",
      nr: 10,
      vorname: "Erster",
      nachname: "Spieler",
      handballNetId: "hb-a"
    }];

    const imported = normalizeRosterPlayer({
      nr: 10,
      vorname: "Zweiter",
      nachname: "Spieler",
      handballNetId: "hb-b"
    }, 0, existing);

    expect(imported.id).not.toBe("local-a");
    expect(imported.handballNetId).toBe("hb-b");
  });

  test("preserves an existing Handball360 ID when incoming legacy data has none", () => {
    const existing = [{
      id: "local-1",
      nr: 8,
      vorname: "Anna",
      nachname: "Beispiel",
      handballNetId: "hb-stable"
    }];
    const incoming = [{
      nr: 8,
      vorname: "Anna",
      nachname: "Beispiel"
    }];

    const result = mergeRosterCollection(existing, incoming);

    expect(result.players).toHaveLength(1);
    expect(result.players[0].handballNetId).toBe("hb-stable");
  });
});
