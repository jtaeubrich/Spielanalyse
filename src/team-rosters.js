import { normalizeHandballNetId, rosterPlayerNameKey } from "./roster.js";

export function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/\s+/g, " ");
}

export function rosterHandballIds(players = []) {
  return new Set(
    (Array.isArray(players) ? players : [])
      .map((player) => normalizeHandballNetId(player?.handballNetId).toLowerCase())
      .filter(Boolean)
  );
}

export function sharedHandballIds(a = [], b = []) {
  const left = rosterHandballIds(a);
  const right = rosterHandballIds(b);
  let shared = 0;
  for (const id of left) if (right.has(id)) shared += 1;
  return shared;
}

export function findKnownTeamRecord(records = [], { teamName = "", players = [] } = {}) {
  const list = Array.isArray(records) ? records : [];
  const name = normalizeTeamName(teamName);

  const exact = list.find((record) => {
    if (normalizeTeamName(record?.teamName) === name && name) return true;
    return (record?.aliases || []).some((alias) => normalizeTeamName(alias) === name && name);
  });
  if (exact) return { record: exact, reason: "name", sharedIds: sharedHandballIds(exact.players, players) };

  const scored = list
    .map((record) => ({
      record,
      sharedIds: sharedHandballIds(record?.players, players)
    }))
    .filter((entry) => entry.sharedIds >= 2)
    .sort((a, b) => b.sharedIds - a.sharedIds);

  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].sharedIds === scored[1].sharedIds) return null;

  return { ...scored[0], reason: "h360-overlap" };
}

export function mergeAliases(record, teamName) {
  const current = String(record?.teamName || "").trim();
  const next = String(teamName || "").trim();
  const aliases = new Set(
    (Array.isArray(record?.aliases) ? record.aliases : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  if (current && normalizeTeamName(current) !== normalizeTeamName(next)) aliases.add(next);
  return [...aliases].filter(Boolean);
}

export function renameKnownTeamRecord(record, newName) {
  const name = String(newName || "").trim();
  if (!name) throw new Error("Mannschaftsname darf nicht leer sein.");
  const previous = String(record?.teamName || "").trim();
  const aliases = new Set(Array.isArray(record?.aliases) ? record.aliases : []);
  if (previous && normalizeTeamName(previous) !== normalizeTeamName(name)) aliases.add(previous);
  aliases.delete(name);
  return {
    ...record,
    teamName: name,
    aliases: [...aliases].filter(Boolean)
  };
}

export function teamRosterStats(record) {
  const players = Array.isArray(record?.players) ? record.players : [];
  const h360 = players.filter((player) => normalizeHandballNetId(player?.handballNetId)).length;
  const keepers = players.filter((player) => Boolean(player?.isTW)).length;
  return {
    players: players.length,
    h360,
    keepers,
    conflicts: Array.isArray(record?.conflicts) ? record.conflicts.length : 0
  };
}

export function sameNamedDifferentIds(players = []) {
  const groups = new Map();
  for (const player of Array.isArray(players) ? players : []) {
    const name = rosterPlayerNameKey(player);
    const id = normalizeHandballNetId(player?.handballNetId).toLowerCase();
    if (!name || !id) continue;
    if (!groups.has(name)) groups.set(name, new Set());
    groups.get(name).add(id);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([name, ids]) => ({ name, handballNetIds: [...ids] }));
}
