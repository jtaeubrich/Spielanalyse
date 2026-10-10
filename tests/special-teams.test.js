import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  specialTeamsForState,
  SUSPENSION_DURATIONS
} from "../src/special-teams.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const hkn = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "hkn_reference.json"), "utf8")
);

describe("special teams core", () => {
  test("uses the existing suspension durations", () => {
    expect(SUSPENSION_DURATIONS).toEqual({
      "2min": 120,
      "2plus2": 240,
      red: 120,
      blue: 120
    });
  });

  test("calculates a simple power-play and short-handed phase", () => {
    const state = {
      timer: { duration: 25 },
      events: [
        { type: "2min", team: "home", time: 100 },
        { type: "goal", team: "away", time: 110 },
        { type: "save", team: "home", endedPossessionOf: "away", time: 130 },
        { type: "goal", team: "home", time: 150 },
        { type: "error", team: "away", time: 170 }
      ]
    };

    const stats = specialTeamsForState(state);

    expect(stats.home.shortHandedSeconds).toBe(120);
    expect(stats.away.powerPlaySeconds).toBe(120);

    expect(stats.home.shortHandedGoals).toBe(1);
    expect(stats.home.shortHandedAgainstGoals).toBe(1);
    expect(stats.away.powerPlayGoals).toBe(1);
    expect(stats.away.powerPlayAgainstGoals).toBe(1);

    expect(stats.away.powerPlayAttacks).toBe(3);
    expect(stats.away.powerPlayAttackEff).toBe(33);
    expect(stats.away.powerPlayNet).toBe(0);
    expect(stats.away.powerPlayNetPer2).toBe(0);

    expect(stats.home.byStrength["5:6"].seconds).toBe(120);
    expect(stats.away.byStrength["6:5"].seconds).toBe(120);
  });

  test("counts 2+2 as four minutes", () => {
    const state = {
      timer: { duration: 25 },
      events: [{ type: "2plus2", team: "away", time: 500 }]
    };

    const stats = specialTeamsForState(state);
    expect(stats.home.powerPlaySeconds).toBe(240);
    expect(stats.away.shortHandedSeconds).toBe(240);
  });

  test("returns stable finite metrics for the HKN reference game", () => {
    const stats = specialTeamsForState(hkn);

    for (const team of ["home", "away"]) {
      const row = stats[team];
      for (const key of [
        "powerPlaySeconds",
        "shortHandedSeconds",
        "powerPlayGoals",
        "powerPlayAgainstGoals",
        "shortHandedGoals",
        "shortHandedAgainstGoals",
        "powerPlayAttacks",
        "shortHandedAttacks",
        "powerPlayAttackEff",
        "shortHandedAttackEff",
        "powerPlayNet",
        "shortHandedNet",
        "powerPlayNetPer2",
        "shortHandedNetPer2"
      ]) {
        expect(Number.isFinite(row[key])).toBe(true);
      }

      expect(row.powerPlayAttackEff).toBeGreaterThanOrEqual(0);
      expect(row.powerPlayAttackEff).toBeLessThanOrEqual(100);
      expect(row.shortHandedAttackEff).toBeGreaterThanOrEqual(0);
      expect(row.shortHandedAttackEff).toBeLessThanOrEqual(100);
    }

    expect(stats.home.powerPlaySeconds).toBe(stats.away.shortHandedSeconds);
    expect(stats.away.powerPlaySeconds).toBe(stats.home.shortHandedSeconds);
  });
});
