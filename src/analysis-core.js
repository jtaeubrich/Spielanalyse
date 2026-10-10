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
