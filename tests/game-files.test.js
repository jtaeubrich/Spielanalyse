import { describe, expect, test, vi } from "vitest";
import {
  GAME_FILE_TYPES,
  parseGameText,
  defaultGameFileName,
  gameOpenPickerOptions,
  gameSavePickerOptions,
  writeTextFileHandle
} from "../src/game-files.js";

describe("game file helpers", () => {
  test("parses and migrates legacy game JSON", () => {
    const parsed = parseGameText(JSON.stringify({
      gameName: "Alt",
      home: { name: "H", players: [] },
      away: { name: "A", players: [] },
      events: []
    }));

    expect(parsed.format).toBe("handball-spielanalyse");
    expect(parsed.version).toBe(1);
    expect(parsed.ownTeam).toBe("away");
  });

  test("reports malformed JSON clearly", () => {
    expect(() => parseGameText("{broken")).toThrow("JSON konnte nicht gelesen werden.");
  });

  test("builds safe default filenames", () => {
    expect(defaultGameFileName("HSG A / TSV B")).toBe("HSG_A_TSV_B_spielanalyse.json");
    expect(defaultGameFileName("", null)).toBe("HandballMatch_spielanalyse.json");
    expect(defaultGameFileName("Test", "bestehend.json")).toBe("bestehend.json");
  });

  test("builds picker options consistently", () => {
    expect(gameOpenPickerOptions()).toEqual({
      id: "handball-spielanalyse-games",
      types: GAME_FILE_TYPES,
      multiple: false
    });

    const handle = { name: "alt.json" };
    expect(gameSavePickerOptions("neu.json", handle)).toEqual({
      id: "handball-spielanalyse-games",
      suggestedName: "neu.json",
      types: GAME_FILE_TYPES,
      startIn: handle
    });
  });

  test("writes text through an approved file handle", async () => {
    const write = vi.fn();
    const close = vi.fn();
    const handle = {
      queryPermission: vi.fn(async () => "granted"),
      createWritable: vi.fn(async () => ({ write, close }))
    };

    await writeTextFileHandle(handle, "abc");

    expect(write).toHaveBeenCalledWith("abc");
    expect(close).toHaveBeenCalled();
  });

  test("requests permission and rejects denied writes", async () => {
    const handle = {
      queryPermission: vi.fn(async () => "prompt"),
      requestPermission: vi.fn(async () => "denied")
    };

    await expect(writeTextFileHandle(handle, "abc")).rejects.toThrow(
      "Schreibzugriff auf die Datei wurde nicht erteilt."
    );
  });
});
