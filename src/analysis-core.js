export const SHOT_EVENT_TYPES = ["shot", "goal", "miss", "save", "block"];

export function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function attackingTeamOf(event, getPlayer = () => null) {
  if (!event) return null;

  if (["save", "block"].includes(event.type)) {
    return (
      event.endedPossessionOf ||
      getPlayer(event.throwerId)?.team ||
      (event.team === "home"
        ? "away"
        : event.team === "away"
          ? "home"
          : null)
    );
  }

  return event.team ?? null;
}

export function defendingTeamOf(event, getPlayer = () => null) {
  const attacking = attackingTeamOf(event, getPlayer);
  return attacking === "home"
    ? "away"
    : attacking === "away"
      ? "home"
      : null;
}

/**
 * Match an event to a game half. Explicitly recorded halves take precedence.
 * For legacy events without a half, use cumulative game seconds and the
 * configured minutes per half. Untimed events remain part of "all" only.
 */
export function matchesGameHalf(event, half = "all", durationMinutes = 25) {
  if (half === "all") return true;
  if (half !== "1" && half !== "2") return false;

  const explicitHalf = event?.half;
  if (explicitHalf !== null && explicitHalf !== undefined && explicitHalf !== "") {
    const recorded = Number(explicitHalf);
    if (recorded === 1 || recorded === 2) return recorded === Number(half);
  }

  if (event?.time === null || event?.time === undefined || event?.time === "") return false;
  const seconds = Number(event.time);
  const halfSeconds = Number(durationMinutes) * 60;
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(halfSeconds) || halfSeconds <= 0) return false;
  return (seconds < halfSeconds ? 1 : 2) === Number(half);
}

export function summarizeShots(shots = []) {
  const list = Array.isArray(shots) ? shots : [];
  const decided = list.filter((event) => event?.type !== "shot");
  const goals = list.filter((event) => event?.type === "goal").length;
  const held = list.filter((event) => event?.type === "save").length;
  const misses = list.filter((event) =>
    ["miss", "block"].includes(event?.type)
  ).length;

  return {
    goals,
    shots: list.length,
    decided: decided.length,
    held,
    misses,
    shotRate: percentage(goals, decided.length)
  };
}

export function teamMetrics(events = [], team, getPlayer = () => null) {
  const list = Array.isArray(events) ? events : [];
  const shots = list.filter(
    (event) =>
      SHOT_EVENT_TYPES.includes(event?.type) &&
      attackingTeamOf(event, getPlayer) === team
  );
  const decided = shots.filter((event) => event.type !== "shot");
  const goals = shots.filter((event) => event.type === "goal").length;
  const saves = list.filter(
    (event) => event?.type === "save" && event.team === team
  ).length;
  const against = list.filter(
    (event) =>
      event?.type === "goal" &&
      attackingTeamOf(event, getPlayer) !== team
  ).length;
  const errors = list.filter(
    (event) =>
      event?.type === "error" &&
      attackingTeamOf(event, getPlayer) === team
  ).length;
  const steals = list.filter(
    (event) => event?.type === "steal" && event.team === team
  ).length;
  const blocks = list.filter(
    (event) => event?.type === "block" && event.team === team
  ).length;

  return {
    goals,
    misses: shots.filter((event) => event.type === "miss").length,
    shotRate: percentage(goals, decided.length),
    attackEff: percentage(goals, decided.length + errors),
    saves,
    saveRate: percentage(saves, saves + against),
    steals,
    blocks,
    errors
  };
}

export function goalkeeperForGoal(
  goal,
  defendingTeam,
  gameState,
  getPlayer = () => null
) {
  if (!goal || !gameState?.[defendingTeam]) return null;

  const explicit = goal.againstTwId ?? goal.twId ?? goal.keeperId;
  const explicitPlayer = getPlayer(explicit);

  if (explicitPlayer?.team === defendingTeam && explicitPlayer.isTW) {
    return explicitPlayer.id;
  }

  const keepers = (gameState[defendingTeam].players || []).filter(
    (player) => player.isTW
  );
  if (!keepers.length) return null;

  const keeperIds = new Set(keepers.map((player) => String(player.id)));
  const saves = (gameState.events || []).filter(
    (event) =>
      event?.type === "save" &&
      event.team === defendingTeam &&
      keeperIds.has(String(event.pId))
  );

  const before = saves
    .filter((event) => Number(event.time) <= Number(goal.time))
    .sort((a, b) => Number(b.time) - Number(a.time))[0];

  const after = saves
    .filter((event) => Number(event.time) > Number(goal.time))
    .sort((a, b) => Number(a.time) - Number(b.time))[0];

  const nearest =
    before && after
      ? Number(goal.time) - Number(before.time) <=
        Number(after.time) - Number(goal.time)
        ? before
        : after
      : before || after;

  return (
    nearest?.pId ??
    gameState.activeTw?.[defendingTeam] ??
    (keepers.length === 1 ? keepers[0].id : null)
  );
}


export function matchesAnalysisDimension(value, filter) {
  return (
    filter === "all" ||
    (filter === "OT" && ["OTL", "OTM", "OTR"].includes(String(value ?? ""))) ||
    String(value ?? "") === String(filter)
  );
}

export function trackedPlayerIds(events = [], team) {
  const ids = new Set();
  const add = (...values) => {
    for (const value of values) {
      if (value != null && String(value).trim()) ids.add(String(value));
    }
  };

  for (const event of events) {
    if (!event) continue;
    if (event.team === team) {
      add(event.penalizedBank ? null : event.pId, event.assistPId, event.attackerId, event.defenderId);
    } else if (event.team === "home" || event.team === "away") {
      if (event.type === "save" || event.type === "block") add(event.throwerId);
      add(event.againstTwId ?? event.twId ?? event.keeperId);
    }
    for (const tag of event.playerTags || []) {
      if (tag?.team === team) add(tag.pId);
    }
  }
  return ids;
}

export function playerMetrics({
  player,
  playerIds,
  team,
  ownTeam,
  events = [],
  gameState,
  getPlayer = () => null,
  zone = "all",
  target = "all",
  phase = "all"
}) {
  if (!player) return null;

  const list = Array.isArray(events) ? events : [];
  const ids = playerIds || new Set([String(player.id)]);
  const matchesPlayer = id => ids.has(String(id));
  const inDimensions = (event) =>
    matchesAnalysisDimension(event?.z, zone) &&
    matchesAnalysisDimension(event?.gz, target) &&
    matchesAnalysisDimension(event?.attackPhase, phase);

  const playerShots = list.filter((event) => {
    if (!SHOT_EVENT_TYPES.includes(event?.type) || !inDimensions(event)) return false;
    if (["shot", "goal", "miss"].includes(event.type)) {
      return matchesPlayer(event.pId);
    }
    if (["save", "block"].includes(event.type)) {
      return matchesPlayer(event.throwerId);
    }
    return false;
  });

  const decidedShots = playerShots.filter((event) => event.type !== "shot");
  const goals = playerShots.filter((event) => event.type === "goal").length;
  const assists =
    team === ownTeam
      ? list.filter(
          (event) =>
            event?.type === "goal" &&
            event.team === ownTeam &&
            matchesPlayer(event.assistPId) &&
            inDimensions(event)
        ).length
      : 0;

  const saves = list.filter(
    (event) =>
      event?.type === "save" &&
      matchesPlayer(event.pId) &&
      inDimensions(event)
  ).length;

  const mentions = list.filter((event) =>
    (event?.playerTags || []).some((tag) => matchesPlayer(tag.pId))
  ).length;

  const keepers = (gameState?.[team]?.players || []).filter(candidate => candidate.isTW);
  const onlyGroupedKeeper = ids.size > 1 && keepers.length && keepers.every(candidate => matchesPlayer(candidate.id))
    ? player.id : null;
  const conceded = player.isTW
    ? list.filter(
        (event) =>
          event?.type === "goal" &&
          attackingTeamOf(event, getPlayer) !== team &&
          inDimensions(event) &&
          matchesPlayer(goalkeeperForGoal(event, team, gameState, getPlayer) ?? onlyGroupedKeeper)
      ).length
    : 0;

  const errors = list.filter(
    (event) =>
      event?.type === "error" &&
      event.team === team &&
      matchesPlayer(event.pId)
  ).length;

  const penalties = list.reduce((sum, event) => {
    if (event?.team !== team || !matchesPlayer(event.pId)) return sum;
    if (event.type === "2plus2") return sum + 2;
    if (event.type === "2min" || event.type === "red") return sum + 1;
    return sum;
  }, 0);

  const rate = player.isTW
    ? percentage(saves, saves + conceded)
    : percentage(goals, decidedShots.length);

  return {
    playerId: player.id,
    isGoalkeeper: Boolean(player.isTW),
    attempts: player.isTW ? null : playerShots.length,
    decidedAttempts: player.isTW ? null : decidedShots.length,
    value: player.isTW ? saves : goals,
    goals,
    assists,
    saves,
    conceded,
    mentions,
    errors,
    penalties,
    rate
  };
}
