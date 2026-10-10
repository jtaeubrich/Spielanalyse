import { describe, expect, test } from "vitest";
import { scoreEvents } from "../src/game-model.js";

describe("scoreEvents", () => {
  test("counts only valid home and away goals", () => {
    expect(
      scoreEvents([
        { type: "goal", team: "home" },
        { type: "save", team: "away" },
        { type: "goal", team: "away" },
        { type: "goal", team: "away" },
        { type: "goal", team: "unknown" }
      ])
    ).toEqual([1, 2]);
  });

  test("handles missing input safely", () => {
    expect(scoreEvents()).toEqual([0, 0]);
    expect(scoreEvents(null)).toEqual([0, 0]);
  });
});
