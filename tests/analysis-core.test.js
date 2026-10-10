import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  percentage,
  attackingTeamOf,
  defendingTeamOf,
  summarizeShots,
  teamMetrics,
  goalkeeperForGoal
} from "../src/analysis-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const hkn = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "hkn_reference.json"), "utf8")
);

const players = [
  ...(hkn.home.players || []).map((player) => ({ ...player, team: "home" })),
  ...(hkn.away.players || []).map((player) => ({ ...player, team: "away" }))
];
const getPlayer = (id) =>
  players.find((player) => String(player.id) === String(id)) || null;

describe("analysis core", () => {
  test("calculates percentages safely", () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(4, 0)).toBe(0);
  });

  test("resolves attacking and defending teams for saves", () => {
    const save = {
      type: "save",
      team: "home",
      endedPossessionOf: "away"
    };
    expect(attackingTeamOf(save, getPlayer)).toBe("away");
    expect(defendingTeamOf(save, getPlayer)).toBe("home");
  });

  test("summarizes the HKN shot events", () => {
    const shots = hkn.events.filter((event) =>
      ["shot", "goal", "miss", "save", "block"].includes(event.type)
    );
    const summary = summarizeShots(shots);

    expect(summary.goals).toBe(61);
    expect(summary.held).toBe(19);
    expect(summary.misses).toBe(17);
    expect(summary.shots).toBe(97);
    expect(summary.shotRate).toBe(63);
  });

  test("keeps team metrics internally consistent", () => {
    const home = teamMetrics(hkn.events, "home", getPlayer);
    const away = teamMetrics(hkn.events, "away", getPlayer);

    expect(home.goals + away.goals).toBe(61);
    expect(home.errors + away.errors).toBe(25);
    expect(home.saves + away.saves).toBe(19);
    expect(home.shotRate).toBeGreaterThanOrEqual(0);
    expect(home.shotRate).toBeLessThanOrEqual(100);
    expect(away.shotRate).toBeGreaterThanOrEqual(0);
    expect(away.shotRate).toBeLessThanOrEqual(100);
  });

  test("prefers an explicitly assigned goalkeeper", () => {
    const keeper = {
      id: "keeper-home",
      team: "home",
      isTW: true
    };
    const state = {
      home: { players: [keeper] },
      away: { players: [] },
      events: [],
      activeTw: { home: keeper.id, away: null }
    };
    const lookup = (id) => (String(id) === keeper.id ? keeper : null);

    expect(
      goalkeeperForGoal(
        { type: "goal", time: 100, againstTwId: keeper.id },
        "home",
        state,
        lookup
      )
    ).toBe(keeper.id);
  });

  test("falls back to the nearest save when goalkeeper is not explicitly stored", () => {
    const keepers = [
      { id: "k1", isTW: true },
      { id: "k2", isTW: true }
    ];
    const state = {
      home: { players: keepers },
      away: { players: [] },
      events: [
        { type: "save", team: "home", pId: "k1", time: 80 },
        { type: "save", team: "home", pId: "k2", time: 140 }
      ],
      activeTw: { home: null, away: null }
    };

    expect(
      goalkeeperForGoal(
        { type: "goal", time: 100 },
        "home",
        state,
        () => null
      )
    ).toBe("k1");

    expect(
      goalkeeperForGoal(
        { type: "goal", time: 130 },
        "home",
        state,
        () => null
      )
    ).toBe("k2");
  });
});
