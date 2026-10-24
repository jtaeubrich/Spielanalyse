import { hbPrepare } from "./handball360.js";
import { normalizeSeasonGame } from "./season-files.js";

export function parseHandball360TeamId(input) {
  const value = String(input ?? "").trim();
  if (/^[0-9]{1,12}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["handball.net", "www.handball.net"].includes(url.hostname)) return null;
    return /^\\/team\\/(\\d{1,12})\\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}

export function validateHandball360SeasonSchedule(payload, expectedTeamId) {
  const teamId = String(expectedTeamId);
  if (String(payload?.teamId) !== teamId || !Array.isArray(payload.matches)) {
    throw new Error("Der Spielplan gehoert nicht zur gewaehlten Mannschaft.");
  }
  if (payload.matches.length !== payload.total) {
    throw new Error("Der Spielplan ist unvollstaendig.");
  }
  const uniqueIds = new Set();
  return payload.matches.map(entry => {
    const id = String(entry?.id ?? "");
    if (!/^\\d+$/.test(id) || uniqueIds.has(id)) throw new Error("Ungueltige oder doppelte Match-ID.");
    uniqueIds.add(id);
    if (![String(entry.local?.id), String(entry.visitor?.id)].includes(teamId)) {
      throw new Error("Spiel einer anderen Mannschaft in der Antwort.");
    }
    return entry;
  });
}

export function seasonMatchIdentity(game) {
  const id = game?.state?.officialSource?.matchId ??
    game?.state?.officialData?.matchId ??
    game?.state?.officialData?.payload?.match_id;
  if (id != null && /^\\d+$/.test(String(id))) return String(id);
  // Only filenames created by this dedicated importer are reliable fallback IDs.
  return /^handball360_(\\d+)\\.json$/i.exec(String(game?.fileName ?? ""))?.[1] ?? null;
}

function sameDate(a, b) {
  return String(a ?? "").slice(0, 10) === String(b ?? "").slice(0, 10) && Boolean(a && b);
}

function sameTeams(game, match) {
  const a = game?.state?.home?.name?.trim().toLocaleLowerCase("de") ?? "";
  const b = game?.state?.away?.name?.trim().toLocaleLowerCase("de") ?? "";
  return Boolean(a && b &&
    a === String(match.local?.name ?? "").trim().toLocaleLowerCase("de") &&
    b === String(match.visitor?.name ?? "").trim().toLocaleLowerCase("de"));
}

export function seasonScheduleStatus(match, existingGames, now = new Date()) {
  const id = String(match.id);
  if (existingGames.some(game => seasonMatchIdentity(game) === id)) return "existing";
  // Protect own scouting imported under a different filename, including
  // games without handball.net metadata. Requires manual review outside bulk import.
  if (existingGames.some(game =>
    sameDate(game?.state?.officialSource?.matchDate ??
      game?.state?.gameDate ?? game?.state?.matchDate, match.date) &&
    sameTeams(game, match)
  )) return "possible-existing";
  const date = Date.parse(match.date);
  if (!Number.isFinite(date)) return "unknown-date";
  return date > now.getTime() ? "upcoming" : "available";
}

export function buildHandball360SeasonGame(raw, matchId, teamId) {
  const x = hbPrepare(raw, { fallbackMatchId: matchId });
  const id = String(x.matchId ?? matchId);
  if (id !== String(matchId)) throw new Error("Match-ID der Antwort stimmt nicht ueberein.");
  const meta = x.matchMeta;
  const homeId = String(meta?.local?.id ?? "");
  const awayId = String(meta?.visitor?.id ?? "");
  const ownTeam = homeId === String(teamId) ? "home" : awayId === String(teamId) ? "away" : null;
  if (!ownTeam) throw new Error("Match gehoert nicht zur gewaehlten Mannschaft.");
  const localDate = String(x.matchDate ?? "").slice(0, 10);
  const dateLabel = /^\\d{4}-\\d{2}-\\d{2}$/.test(localDate)
    ? localDate.split("-").reverse().join(".") + " | " : "";
  const gameState = {
    format: "handball-spielanalyse", version: 1,
    gameName: dateLabel + x.teams.home + " - " + x.teams.away,
    gameDate: x.matchDate || null,
    competition: x.competition || "",
    ownTeam, analysisPerspective: ownTeam,
    home: { name: x.teams.home, players: x.homePlayers },
    away: { name: x.teams.away, players: x.awayPlayers },
    events: x.normalized, gameTime: x.duration * 120,
    timer: { duration: x.duration, half: 1, secondsElapsed: 0, active: false },
    isVideoscoutingFile: true, isHistorical: true,
    video: { h1SyncRealTime: null, h2SyncRealTime: null },
    officialSource: {
      provider: "handball.net", matchId: id, matchDate: x.matchDate || null,
      venue: x.venue || null, competition: x.competition || null,
      importedAt: new Date().toISOString()
    }
  };
  const filename = "handball360_" + id + ".json";
  const game = normalizeSeasonGame(gameState, filename);
  game.ownTeam = ownTeam;
  game.opponentTeam = ownTeam === "home" ? "away" : "home";
  return game;
}

// No automatic replacement, even if handball.net gains events later.
// Manual scouting and annotations in any existing season game remain intact.
export function appendNewHandball360SeasonGames(existingGames, importedGames) {
  const games = [...existingGames];
  const ids = new Set(games.map(seasonMatchIdentity).filter(Boolean));
  let added = 0, skipped = 0;
  for (const incoming of importedGames) {
    const id = seasonMatchIdentity(incoming);
    if (!id || ids.has(id)) { skipped++; continue; }
    ids.add(id);
    games.push(incoming);
    added++;
  }
  return { games, added, skipped };
}
