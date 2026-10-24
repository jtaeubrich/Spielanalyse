import { hbPrepare, hbLineupSides, hbRosterFromLineup, hbNameKey } from "./handball360.js";
import { seasonMatchIdentity } from "./season-handball360.js";

const idOf = player => String(player?.handballNetId ?? "").trim();
const nameOf = player => hbNameKey([player?.vorname, player?.nachname].filter(Boolean).join(" "));
const numberOf = player => String(player?.nr ?? "").trim();
const labelOf = player => {
  const number = numberOf(player);
  return (number ? "#" + number + " " : "") +
    [player?.vorname, player?.nachname].filter(Boolean).join(" ").trim();
};
function pairedPlayers(current, official) {
  const remaining = new Set(current.map((_, index) => index));
  return official.map(incoming => {
    const incomingId = idOf(incoming);
    let match = incomingId ? [...remaining].find(i => idOf(current[i]) === incomingId) : undefined;
    if (match === undefined) {
      // Only match on a name when it identifies exactly one existing player.
      const matches = [...remaining].filter(i => nameOf(current[i]) && nameOf(current[i]) === nameOf(incoming));
      if (matches.length === 1) match = matches[0];
    }
    if (match !== undefined) remaining.delete(match);
    return { incoming, existing: match === undefined ? null : current[match] };
  }).concat([...remaining].map(i => ({ incoming: null, existing: current[i] })));
}
function officialMatchRoster(raw, side) {
  const lineups = hbLineupSides(raw);
  const data = side === "home" ? lineups.local : lineups.visitor;
  // Do not silently use event-derived player lists as a confirmed lineup.
  return hbRosterFromLineup(data);
}
function playerChanges(before, after) {
  const changes = [];
  if (numberOf(before) !== numberOf(after)) changes.push("Nr. " + (numberOf(before) || "–") + " → " + (numberOf(after) || "–"));
  if (Boolean(before.isTW) !== Boolean(after.isTW)) changes.push("TW-Status geändert");
  if (nameOf(before) !== nameOf(after)) changes.push("Name geändert");
  if (idOf(before) !== idOf(after) && idOf(after)) changes.push("H360-ID ergänzt/geändert");
  return changes;
}
function mergedOfficialPlayer(existing, incoming) {
  if (!existing) return structuredClone(incoming);
  return {
    ...structuredClone(existing),
    ...structuredClone(incoming),
    // Stable app-local player IDs protect references outside the roster.
    id: existing.id ?? incoming.id,
    handballNetId: idOf(incoming) || idOf(existing),
    // A missing shirt number from Handball360 should not erase a manually
    // assigned number; confirmed nonempty official numbers take precedence.
    nr: numberOf(incoming) ? incoming.nr : existing.nr ?? ""
  };
}

export function previewOfficialSeasonRosters(game, raw) {
  const matchId = seasonMatchIdentity(game);
  if (!matchId) throw new Error("Für dieses Saisonspiel ist keine Handball360-Match-ID hinterlegt.");
  const prepared = hbPrepare(raw, { fallbackMatchId: matchId });
  if (String(prepared.matchId) !== matchId) throw new Error("Die Handball360-Antwort gehört zu einer anderen Match-ID.");
  // Protect against accidentally reversed home/away allocation. Abbreviated
  // manually assigned team names remain allowed.
  const localHome=String(game.state?.home?.name||"").trim().toLocaleLowerCase("de");
  const localAway=String(game.state?.away?.name||"").trim().toLocaleLowerCase("de");
  const officialHome=prepared.teams.home.trim().toLocaleLowerCase("de");
  const officialAway=prepared.teams.away.trim().toLocaleLowerCase("de");
  if (localHome&&localAway&&localHome===officialAway&&localAway===officialHome&&officialHome!==officialAway) {
    throw new Error("Heim- und Gastmannschaft sind gegenüber Handball360 vertauscht. Bitte Spielzuordnung prüfen.");
  }
  const plan = {
    matchId, officialNames: prepared.teams,
    sides: {}, availableSides: 0, totalChanges: 0,
    hasScoutingEvents: Boolean(game.state?.events?.length)
  };
  for (const side of ["home", "away"]) {
    const oldPlayers = game.state?.[side]?.players || [];
    const incomingPlayers = officialMatchRoster(raw, side);
    const available = incomingPlayers.length > 0;
    const paired = available ? pairedPlayers(oldPlayers, incomingPlayers) : [];
    const added = paired.filter(p => !p.existing && p.incoming).map(p => labelOf(p.incoming));
    const removed = paired.filter(p => p.existing && !p.incoming).map(p => labelOf(p.existing));
    const changed = paired.filter(p => p.existing && p.incoming)
      .map(p => {
        const merged = mergedOfficialPlayer(p.existing, p.incoming);
        return { name: labelOf(merged), changes: playerChanges(p.existing, merged) };
      }).filter(p => p.changes.length);
    const players = paired.filter(p => p.incoming).map(p => mergedOfficialPlayer(p.existing, p.incoming));
    plan.sides[side] = {
      available, name: prepared.teams[side], oldCount: oldPlayers.length,
      newCount: incomingPlayers.length, players, added, removed, changed
    };
    if (available) {
      plan.availableSides++;
      plan.totalChanges += added.length + removed.length + changed.length;
    }
  }
  if (!plan.availableSides) {
    throw new Error("Handball360 liefert für diese Begegnung noch keine offizielle Aufstellung. Bitte kurz vor Spielbeginn erneut versuchen.");
  }
  return plan;
}

export function applyOfficialSeasonRosters(game, plan, updatedAt = new Date().toISOString()) {
  if (String(seasonMatchIdentity(game)) !== String(plan?.matchId)) {
    throw new Error("Die Match-ID der Kaderaktualisierung passt nicht zum Saisonspiel.");
  }
  if (game.state?.events?.length) {
    throw new Error("Nach Beginn des Scoutings werden Spielkader nicht automatisch ersetzt. Vorhandene Ereigniszuordnungen bleiben geschützt.");
  }
  const updated = structuredClone(game.state);
  for (const side of ["home", "away"]) {
    const part = plan.sides?.[side];
    if (!part?.available) continue;
    updated[side].players = structuredClone(part.players);
    if (updated.provisionalRosters) delete updated.provisionalRosters[side];
  }
  updated.officialSource = {
    ...(updated.officialSource || {}),
    matchId: String(plan.matchId),
    rosterSource: plan.availableSides === 2 ? "lineups" : "partial-lineups",
    lineupUpdatedAt: updatedAt
  };
  updated.lineupSync = {
    provider: "handball.net",
    matchId: String(plan.matchId),
    updatedAt,
    homeConfirmed: Boolean(plan.sides?.home?.available),
    awayConfirmed: Boolean(plan.sides?.away?.available)
  };
  return { ...game, state: updated };
}
