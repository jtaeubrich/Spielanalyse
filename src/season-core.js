import { percentage, playerMetrics } from "./analysis-core.js";

const SHOT_TYPES = ["shot", "goal", "save", "miss", "block"];

export function seasonGameSummary(game) {
  const events = game?.state?.events || [];
  const own = game?.ownTeam;
  const opponent = game?.opponentTeam;

  const ownShots = events.filter(
    (event) => event.team === own && SHOT_TYPES.includes(event.type)
  );
  const opponentShots = events.filter(
    (event) => event.team === opponent && SHOT_TYPES.includes(event.type)
  );

  const goals = events.filter(
    (event) => event.team === own && event.type === "goal"
  ).length;
  const against = events.filter(
    (event) => event.team === opponent && event.type === "goal"
  ).length;
  const saves = events.filter(
    (event) => event.team === opponent && event.type === "save"
  ).length;
  const errors = events.filter(
    (event) => event.team === own && event.type === "error"
  ).length;

  return {
    goals,
    against,
    ownShots: ownShots.length,
    oppShots: opponentShots.length,
    saves,
    errors,
    shotPct: ownShots.length ? (goals / ownShots.length) * 100 : 0,
    savePct: saves + against ? (saves / (saves + against)) * 100 : 0
  };
}

export function seasonAttackTeam(event) {
  if (!event) return null;
  if (event.type === "save" || event.type === "block") {
    return event.team === "home"
      ? "away"
      : event.team === "away"
        ? "home"
        : null;
  }
  return event.team ?? null;
}

export function seasonTeamAggregate(games = [], role = "own") {
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
    const opponent = team === "home" ? "away" : "home";
    const events = game?.state?.events || [];

    const teamShots = events.filter(
      (event) =>
        SHOT_TYPES.includes(event.type) &&
        seasonAttackTeam(event) === team
    );

    decided += teamShots.filter((event) => event.type !== "shot").length;
    goals += teamShots.filter((event) => event.type === "goal").length;
    misses += teamShots.filter((event) => event.type === "miss").length;

    saves += events.filter(
      (event) => event.type === "save" && event.team === team
    ).length;
    against += events.filter(
      (event) => event.type === "goal" && event.team === opponent
    ).length;
    errors += events.filter(
      (event) => event.type === "error" && event.team === team
    ).length;
    blocks += events.filter(
      (event) => event.type === "block" && event.team === team
    ).length;
    steals += events.filter(
      (event) => event.type === "steal" && event.team === team
    ).length;

    for (const event of events) {
      if (event.team !== team) continue;
      if (event.type === "2min" || event.type === "red") penalties += 1;
      else if (event.type === "2plus2") penalties += 2;
    }
  }

  return {
    goals,
    misses,
    shotRate: percentage(goals, decided),
    attackEff: percentage(goals, decided + errors),
    saves,
    saveRate: percentage(saves, saves + against),
    steals,
    blocks,
    errors,
    penalties
  };
}


export function seasonPlayerAggregate(
  games = [],
  {
    playerKey,
    playerLabel = (player) =>
      [player?.vorname, player?.nachname].filter(Boolean).join(" ").trim() || "Unbekannt"
  } = {}
) {
  if (typeof playerKey !== "function") {
    throw new TypeError("seasonPlayerAggregate benötigt eine playerKey-Funktion.");
  }

  const aggregated = new Map();

  for (const game of games) {
    const ownTeam = game?.ownTeam;
    const state = game?.state;
    if (!state || !ownTeam) continue;

    const allPlayers = [
      ...(state.home?.players || []).map((player) => ({ ...player, team: "home" })),
      ...(state.away?.players || []).map((player) => ({ ...player, team: "away" }))
    ];
    const getPlayer = (id) =>
      allPlayers.find((player) => String(player.id) === String(id)) || null;

    for (const player of state[ownTeam]?.players || []) {
      const key = playerKey(player);
      if (!key) continue;

      const stats = playerMetrics({
        player,
        team: ownTeam,
        ownTeam,
        events: state.events || [],
        gameState: state,
        getPlayer
      });

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          key,
          label: playerLabel(player),
          isTW: Boolean(player.isTW),
          games: new Set(),
          shots: 0,
          decidedShots: 0,
          goals: 0,
          assists: 0,
          saves: 0,
          against: 0,
          penalties: 0,
          errors: 0
        });
      }

      const target = aggregated.get(key);
      target.isTW = target.isTW || Boolean(player.isTW);
      target.games.add(game.id);

      if (!player.isTW) {
        target.shots += Number(stats.attempts) || 0;
        target.decidedShots += Number(stats.decidedAttempts) || 0;
        target.goals += Number(stats.goals) || 0;
      }

      target.assists += Number(stats.assists) || 0;
      target.saves += Number(stats.saves) || 0;
      target.against += Number(stats.conceded) || 0;
      target.penalties += Number(stats.penalties) || 0;
      target.errors += Number(stats.errors) || 0;
    }
  }

  return [...aggregated.values()].map((player) => ({
    ...player,
    rate: player.isTW
      ? percentage(player.saves, player.saves + player.against)
      : percentage(player.goals, player.decidedShots),
    value: player.isTW ? player.saves : player.goals
  }));
}
