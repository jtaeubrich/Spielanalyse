import { describe, expect, test } from "vitest";
import {
  normalizeHandballNetId,
  normalizeRosterPlayer,
  rowsToPlayers,
  parseRosterJson,
  mergeRosterByHandballId
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
