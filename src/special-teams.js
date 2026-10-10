import { percentage } from "./analysis-core.js";

export const SUSPENSION_DURATIONS = {
  "2min": 120,
  "2plus2": 240,
  red: 120,
  blue: 120
};

export function specialTeamsForState(gameState) {
  const matchEnd = Math.max(Number(gameState?.timer?.duration) || 0, 1) * 120;
  const rawEvents = Array.isArray(gameState?.events) ? gameState.events : [];
  const events = rawEvents.map((event, index) => ({ event, index }));

  const penalties = events
    .filter(
      ({ event }) =>
        SUSPENSION_DURATIONS[event.type] &&
        ["home", "away"].includes(event.team)
    )
    .map(({ event, index }) => {
      const start = Math.max(0, Number(event.time) || 0);
      return {
        team: event.team,
        start,
        end: Math.min(matchEnd, start + SUSPENSION_DURATIONS[event.type]),
        realTime: Number(event.realTime),
        index
      };
    })
    .filter((penalty) => penalty.end > penalty.start);

  const blank = () => ({
    powerPlaySeconds: 0,
    shortHandedSeconds: 0,
    powerPlayGoals: 0,
    powerPlayAgainstGoals: 0,
    shortHandedGoals: 0,
    shortHandedAgainstGoals: 0,
    powerPlayAttacks: 0,
    shortHandedAttacks: 0,
    byStrength: {}
  });

  const stats = { home: blank(), away: blank() };

  const activeAt = (time, eventReal = NaN, eventIndex = Infinity) => {
    const active = { home: 0, away: 0 };

    for (const penalty of penalties) {
      if (penalty.end <= time || penalty.start > time) continue;

      let started = penalty.start < time;
      if (penalty.start === time) {
        const comparable =
          Number.isFinite(penalty.realTime) && Number.isFinite(eventReal);
        started = comparable
          ? penalty.realTime <= eventReal
          : penalty.index <= eventIndex;
      }

      if (started) active[penalty.team] += 1;
    }

    return active;
  };

  const strength = (team, active) => {
    const other = team === "home" ? "away" : "home";
    const own = Math.max(0, 6 - active[team]);
    const opponent = Math.max(0, 6 - active[other]);

    return {
      own,
      opponent,
      key: own + ":" + opponent,
      mode: own > opponent ? "powerPlay" : own < opponent ? "shortHanded" : "even"
    };
  };

  const strengthBucket = (team, key) =>
    stats[team].byStrength[key] ||
    (stats[team].byStrength[key] = {
      seconds: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      attacks: 0
    });

  const points = [
    ...new Set([0, matchEnd, ...penalties.flatMap((penalty) => [penalty.start, penalty.end])])
  ].sort((a, b) => a - b);

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const seconds = end - start;
    if (seconds <= 0) continue;

    const active = activeAt(start + 0.0001);

    for (const team of ["home", "away"]) {
      const teamStrength = strength(team, active);
      if (teamStrength.mode === "even") continue;

      if (teamStrength.mode === "powerPlay") {
        stats[team].powerPlaySeconds += seconds;
      } else {
        stats[team].shortHandedSeconds += seconds;
      }

      strengthBucket(team, teamStrength.key).seconds += seconds;
    }
  }

  for (const { event, index } of events) {
    const time = Math.max(0, Number(event.time) || 0);
    const eventReal = Number(event.realTime);
    const active = activeAt(time, eventReal, index);

    const attackingTeam = ["save", "block"].includes(event.type)
      ? event.endedPossessionOf ||
        (["home", "away"].includes(event.team)
          ? event.team === "home"
            ? "away"
            : "home"
          : null)
      : event.team;

    const countsAsAttackEnd = ["goal", "miss", "save", "block", "error"].includes(
      event.type
    );

    for (const team of ["home", "away"]) {
      const teamStrength = strength(team, active);
      if (teamStrength.mode === "even") continue;

      const bucket = strengthBucket(team, teamStrength.key);
      const other = team === "home" ? "away" : "home";

      if (event.type === "goal" && event.team === team) {
        bucket.goalsFor += 1;
        if (teamStrength.mode === "powerPlay") {
          stats[team].powerPlayGoals += 1;
        } else {
          stats[team].shortHandedGoals += 1;
        }
      }

      if (event.type === "goal" && event.team === other) {
        bucket.goalsAgainst += 1;
        if (teamStrength.mode === "powerPlay") {
          stats[team].powerPlayAgainstGoals += 1;
        } else {
          stats[team].shortHandedAgainstGoals += 1;
        }
      }

      if (countsAsAttackEnd && attackingTeam === team) {
        bucket.attacks += 1;
        if (teamStrength.mode === "powerPlay") {
          stats[team].powerPlayAttacks += 1;
        } else {
          stats[team].shortHandedAttacks += 1;
        }
      }
    }
  }

  for (const team of ["home", "away"]) {
    const result = stats[team];
    result.powerPlayAttackEff = percentage(
      result.powerPlayGoals,
      result.powerPlayAttacks
    );
    result.shortHandedAttackEff = percentage(
      result.shortHandedGoals,
      result.shortHandedAttacks
    );
    result.powerPlayNet =
      result.powerPlayGoals - result.powerPlayAgainstGoals;
    result.shortHandedNet =
      result.shortHandedGoals - result.shortHandedAgainstGoals;
    result.powerPlayNetPer2 = result.powerPlaySeconds
      ? (result.powerPlayNet * 120) / result.powerPlaySeconds
      : 0;
    result.shortHandedNetPer2 = result.shortHandedSeconds
      ? (result.shortHandedNet * 120) / result.shortHandedSeconds
      : 0;
  }

  return stats;
}
