import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  seasonGameSummary,
  seasonTeamAggregate
} from "../src/season-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const state = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "hkn_reference.json"), "utf8")
);

const game = {
  id: "hkn-reference",
  state,
  ownTeam: state.ownTeam,
  opponentTeam: state.ownTeam === "home" ? "away" : "home",
  selected: true
};

function legacyGameSummary(game) {
  const events = game.state.events || [];
  const own = game.ownTeam;
  const opp = game.opponentTeam;
  const ownShots = events.filter(
    (e) => e.team === own && ["goal", "save", "miss", "block", "shot"].includes(e.type)
  );
  const oppShots = events.filter(
    (e) => e.team === opp && ["goal", "save", "miss", "block", "shot"].includes(e.type)
  );
  const goals = events.filter((e) => e.team === own && e.type === "goal").length;
  const against = events.filter((e) => e.team === opp && e.type === "goal").length;
  const saves = events.filter((e) => e.team === opp && e.type === "save").length;
  const errors = events.filter((e) => e.team === own && e.type === "error").length;
  return {
    goals,
    against,
    ownShots: ownShots.length,
    oppShots: oppShots.length,
    saves,
    errors,
    shotPct: ownShots.length ? (goals / ownShots.length) * 100 : 0,
    savePct: saves + against ? (saves / (saves + against)) * 100 : 0
  };
}

function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

function legacyTeamAggregate(games, role) {
  let decided = 0;
  let goals = 0;
  let misses = 0;
  let saves = 0;
  let against = 0;
  let errors = 0;
  let blocks = 0;
  let steals = 0;
  let penalties = 0;

  for (const game of games) {
    const team = role === "own" ? game.ownTeam : game.opponentTeam;
    const opp = team === "home" ? "away" : "home";
    const events = game.state.events || [];

    const teamShots = events.filter((e) => {
      const attack =
        e.type === "save" || e.type === "block"
          ? e.team === "home"
            ? "away"
            : "home"
          : e.team;
      return ["shot", "goal", "save", "miss", "block"].includes(e.type) && attack === team;
    });

    decided += teamShots.filter((e) => e.type !== "shot").length;
    goals += teamShots.filter((e) => e.type === "goal").length;
    misses += teamShots.filter((e) => e.type === "miss").length;
    saves += events.filter((e) => e.type === "save" && e.team === team).length;
    against += events.filter((e) => e.type === "goal" && e.team === opp).length;
    errors += events.filter((e) => e.type === "error" && e.team === team).length;
    blocks += events.filter((e) => e.type === "block" && e.team === team).length;
    steals += events.filter((e) => e.type === "steal" && e.team === team).length;

    for (const e of events) {
      if (e.team !== team) continue;
      if (e.type === "2min" || e.type === "red") penalties += 1;
      else if (e.type === "2plus2") penalties += 2;
    }
  }

  return {
    goals,
    misses,
    shotRate: pct(goals, decided),
    attackEff: pct(goals, decided + errors),
    saves,
    saveRate: pct(saves, saves + against),
    steals,
    blocks,
    errors,
    penalties
  };
}

describe("season core", () => {
  test("preserves the existing HKN game summary exactly", () => {
    expect(seasonGameSummary(game)).toEqual(legacyGameSummary(game));
    expect(seasonGameSummary(game).goals).toBe(35);
    expect(seasonGameSummary(game).against).toBe(26);
  });

  test("preserves own-team aggregation exactly", () => {
    expect(seasonTeamAggregate([game], "own")).toEqual(
      legacyTeamAggregate([game], "own")
    );
  });

  test("preserves opponent aggregation exactly", () => {
    expect(seasonTeamAggregate([game], "opponent")).toEqual(
      legacyTeamAggregate([game], "opponent")
    );
  });

  test("aggregates multiple games additively for count metrics", () => {
    const once = seasonTeamAggregate([game], "own");
    const twice = seasonTeamAggregate([game, game], "own");

    expect(twice.goals).toBe(once.goals * 2);
    expect(twice.misses).toBe(once.misses * 2);
    expect(twice.saves).toBe(once.saves * 2);
    expect(twice.errors).toBe(once.errors * 2);
    expect(twice.penalties).toBe(once.penalties * 2);
    expect(twice.shotRate).toBe(once.shotRate);
    expect(twice.attackEff).toBe(once.attackEff);
    expect(twice.saveRate).toBe(once.saveRate);
  });
});
