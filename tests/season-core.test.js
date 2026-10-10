import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  seasonGameSummary,
  seasonTeamAggregate,
  seasonPlayerAggregate,
  seasonEventPlayerKey,
  seasonEventMatchesTeam,
  seasonEventMatchesPlayer,
  seasonMatchesType,
  seasonDimension,
  filterSeasonEntries,
  filterSeasonShots
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


describe("season player aggregation", () => {
  const playerKey = (player) => {
    if (!player) return null;
    const first = String(player.vorname || "").trim().toLocaleLowerCase("de");
    const last = String(player.nachname || "").trim().toLocaleLowerCase("de");
    const nr = String(player.nr ?? "").trim();
    return [last, first, nr].join("|");
  };

  const playerLabel = (player) =>
    [player?.vorname, player?.nachname].filter(Boolean).join(" ").trim() || "Unbekannt";

  test("matches single-game playerMetrics semantics for the HKN reference", () => {
    const players = seasonPlayerAggregate([game], { playerKey, playerLabel });

    expect(players.length).toBe((state[state.ownTeam]?.players || []).length);

    for (const row of players) {
      expect(row.games.size).toBe(1);
      expect(row.penalties).toBeGreaterThanOrEqual(0);
      expect(row.errors).toBeGreaterThanOrEqual(0);

      if (row.isTW) {
        expect(row.shots).toBe(0);
        expect(row.decidedShots).toBe(0);
        expect(row.value).toBe(row.saves);
      } else {
        expect(row.value).toBe(row.goals);
        expect(row.shots).toBeGreaterThanOrEqual(row.decidedShots);
      }
    }
  });

  test("doubles count metrics across identical games while keeping rates stable", () => {
    const once = seasonPlayerAggregate([game], { playerKey, playerLabel });
    const twice = seasonPlayerAggregate(
      [game, { ...game, id: "hkn-reference-2" }],
      { playerKey, playerLabel }
    );

    expect(twice).toHaveLength(once.length);

    for (const one of once) {
      const two = twice.find((row) => row.key === one.key);
      expect(two).toBeTruthy();
      expect(two.games.size).toBe(2);
      expect(two.shots).toBe(one.shots * 2);
      expect(two.decidedShots).toBe(one.decidedShots * 2);
      expect(two.goals).toBe(one.goals * 2);
      expect(two.assists).toBe(one.assists * 2);
      expect(two.saves).toBe(one.saves * 2);
      expect(two.against).toBe(one.against * 2);
      expect(two.penalties).toBe(one.penalties * 2);
      expect(two.errors).toBe(one.errors * 2);
      expect(two.rate).toBe(one.rate);
    }
  });
});


describe("season filters", () => {
  const playerKey = (player) => {
    if (!player) return null;
    const first = String(player.vorname || "").trim().toLocaleLowerCase("de");
    const last = String(player.nachname || "").trim().toLocaleLowerCase("de");
    const nr = String(player.nr ?? "").trim();
    return [last, first, nr].join("|");
  };

  test("resolves event player keys and team membership", () => {
    const ownPlayer = state[state.ownTeam].players[0];
    const event = state.events.find((candidate) =>
      String(candidate.pId) === String(ownPlayer.id)
    );
    expect(event).toBeTruthy();
    expect(seasonEventPlayerKey(event, game, playerKey)).toBe(playerKey(ownPlayer));
    expect(seasonEventMatchesTeam(event, game, "own")).toBe(true);
    expect(seasonEventMatchesTeam(event, game, "opponent")).toBe(false);
    expect(seasonEventMatchesPlayer(event, game, playerKey(ownPlayer), playerKey)).toBe(true);
  });

  test("matches grouped event types and OT dimensions", () => {
    expect(seasonMatchesType({ type: "goal" }, "shot")).toBe(true);
    expect(seasonMatchesType({ type: "2plus2" }, "2min")).toBe(true);
    expect(seasonMatchesType({ type: "error" }, "shot")).toBe(false);
    expect(seasonDimension("OTL", "OT")).toBe(true);
    expect(seasonDimension("OM", "OT")).toBe(false);
    expect(seasonDimension("9M", "9M")).toBe(true);
  });

  test("filters season entries by team, type and tag without changing source data", () => {
    const before = JSON.stringify(game.state.events);
    const tagged = structuredClone(game);
    const ownGoal = tagged.state.events.find(
      (event) => event.type === "goal" && event.team === tagged.ownTeam
    );
    ownGoal.tags = [...(ownGoal.tags || []), "RegressionTag"];

    const entries = filterSeasonEntries([tagged], {
      team: "own",
      type: "shot",
      tag: "RegressionTag",
      playerKey
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].event.type).toBe("goal");
    expect(entries[0].game.id).toBe(tagged.id);
    expect(JSON.stringify(game.state.events)).toBe(before);
  });

  test("filters shot entries by role and dimensions", () => {
    const ownShots = filterSeasonShots([game], "own", { playerKey });
    const opponentShots = filterSeasonShots([game], "opponent", { playerKey });

    expect(ownShots.length).toBeGreaterThan(0);
    expect(opponentShots.length).toBeGreaterThan(0);
    expect(ownShots.every(({ game: g, event }) =>
      g.ownTeam === (event.type === "save" || event.type === "block"
        ? (event.team === "home" ? "away" : "home")
        : event.team)
    )).toBe(true);
  });
});
