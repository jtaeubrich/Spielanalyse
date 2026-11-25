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
  goalkeeperForGoal,
  playerMetrics,
  trackedPlayerIds,
  matchesGameHalf
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
  test("recognizes involvement in either team's events and ignores a bench penalty", () => {
    const events = [
      {team:"home", type:"goal", pId:"scorer", assistPId:"assist"},
      {team:"away", type:"save", pId:"opponent", throwerId:"thrower"},
      {team:"away", type:"goal", keeperId:"keeper", playerTags:[{team:"home",pId:"defender"}]},
      {team:"home", type:"2min", pId:"bench", penalizedBank:true}
    ];
    expect(trackedPlayerIds(events, "home")).toEqual(new Set(["scorer","assist","thrower","keeper","defender"]));
  });

  test("calculates percentages safely", () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(4, 0)).toBe(0);
  });

  test("uses recorded halves before cumulative game seconds", () => {
    expect(matchesGameHalf({ half: 1, time: 1800 }, "1", 25)).toBe(true);
    expect(matchesGameHalf({ half: 1, time: 1800 }, "2", 25)).toBe(false);
    expect(matchesGameHalf({ half: "2", time: 1200 }, "2", 25)).toBe(true);
    expect(matchesGameHalf({ half: 2, time: 1200 }, "1", 25)).toBe(false);
    expect(matchesGameHalf({ half: null, time: 1499 }, "1", 25)).toBe(true);
    expect(matchesGameHalf({ time: 1500 }, "2", 25)).toBe(true);
    expect(matchesGameHalf({ time: 1800 }, "1", 30)).toBe(false);
    expect(matchesGameHalf({ time: 1799 }, "1", 30)).toBe(true);
    expect(matchesGameHalf({ time: 1800 }, "2", 30)).toBe(true);
  });

  test("keeps untimed events in the full game without guessing a half", () => {
    for (const event of [{}, { time: null }, { time: "" }, { time: "invalid" }, { time: -2 }]) {
      expect(matchesGameHalf(event, "all")).toBe(true);
      expect(matchesGameHalf(event, "1")).toBe(false);
      expect(matchesGameHalf(event, "2")).toBe(false);
    }
    expect(matchesGameHalf({ half: 2, time: null }, "2")).toBe(true);
    expect(matchesGameHalf({ time: 100 }, "3")).toBe(false);
  });

  test("repartitions a real match into consistent half-specific efficiency rates", () => {
    const halves = [1, 2].map(half => {
      const events = hkn.events.filter(event => matchesGameHalf(event, String(half), 25));
      const shots = events.filter(event => ["shot", "goal", "miss", "save", "block"].includes(event.type));
      const goals = shots.filter(event => event.type === "goal").length;
      const decided = shots.filter(event => event.type !== "shot").length;
      const errors = events.filter(event => event.type === "error").length;
      return { goals, decided, errors, rate: percentage(goals, decided), attack: percentage(goals, decided + errors) };
    });
    expect(halves).toEqual([
      { goals: 31, decided: 52, errors: 12, rate: 60, attack: 48 },
      { goals: 30, decided: 45, errors: 13, rate: 67, attack: 52 }
    ]);
    expect(halves.reduce((sum, half) => sum + half.goals, 0)).toBe(61);
    expect(halves.reduce((sum, half) => sum + half.errors, 0)).toBe(25);
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


describe("playerMetrics", () => {
  test("calculates field player goals, assists, errors and penalties", () => {
    const player = { id: "p1", isTW: false };
    const state = {
      home: { players: [player] },
      away: { players: [] },
      events: [],
      activeTw: { home: null, away: null }
    };
    const events = [
      { type: "goal", team: "home", pId: "p1", assistPId: "x", z: "9M" },
      { type: "miss", team: "home", pId: "p1", z: "9M" },
      { type: "shot", team: "home", pId: "p1", z: "9M" },
      { type: "goal", team: "home", pId: "x", assistPId: "p1", z: "9M" },
      { type: "error", team: "home", pId: "p1" },
      { type: "2min", team: "home", pId: "p1" },
      { type: "2plus2", team: "home", pId: "p1" },
      { type: "goal", team: "home", pId: "p1", z: "6M" }
    ];
    state.events = events;

    const stats = playerMetrics({
      player,
      team: "home",
      ownTeam: "home",
      events,
      gameState: state,
      getPlayer: () => null,
      zone: "9M"
    });

    expect(stats.attempts).toBe(3);
    expect(stats.goals).toBe(1);
    expect(stats.assists).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.penalties).toBe(3);
    expect(stats.rate).toBe(50);
  });

  test("calculates goalkeeper save rate from assigned goals", () => {
    const keeper = { id: "k1", isTW: true, team: "home" };
    const state = {
      home: { players: [keeper] },
      away: { players: [] },
      events: [
        { type: "save", team: "home", pId: "k1", time: 20 },
        { type: "save", team: "home", pId: "k1", time: 40 },
        { type: "goal", team: "away", againstTwId: "k1", time: 50 }
      ],
      activeTw: { home: "k1", away: null }
    };

    const stats = playerMetrics({
      player: keeper,
      team: "home",
      ownTeam: "away",
      events: state.events,
      gameState: state,
      getPlayer: (id) => (String(id) === "k1" ? keeper : null)
    });

    expect(stats.attempts).toBeNull();
    expect(stats.saves).toBe(2);
    expect(stats.conceded).toBe(1);
    expect(stats.value).toBe(2);
    expect(stats.rate).toBe(67);
  });
});
