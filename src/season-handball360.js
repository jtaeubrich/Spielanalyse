import { hbPrepare } from "./handball360.js";
import { normalizeSeasonGame } from "./season-files.js";

export function parseHandball360TeamId(input) {
  const value = String(input ?? "").trim();
  if (/^[0-9]{1,12}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["handball.net", "www.handball.net"].includes(url.hostname)) return null;
    return /^\/team\/(\d{1,12})\/?$/.exec(url.pathname)?.[1] ?? null;
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
    if (!/^\d+$/.test(id) || uniqueIds.has(id)) throw new Error("Ungueltige oder doppelte Match-ID.");
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
  if (id != null && /^\d+$/.test(String(id))) return String(id);
  // Only filenames created by this dedicated importer are reliable fallback IDs.
  return /^handball360_(\d+)\.json$/i.exec(String(game?.fileName ?? ""))?.[1] ?? null;
}

// Stable, canonical match URL; older stored seasons can derive this from matchId.
export function seasonMatchUrl(game) {
  const id=seasonMatchIdentity(game);
  return id ? "https://www.handball.net/match/"+id : "";
}

// Synchronise fixture metadata only. Player lists, goalkeeper flags, events,
// comments, videos and manual preparation fields are not re-imported.
function berlinKickoff(value) {
  const raw=String(value||"");
  if(!/^\d{4}-\d{2}-\d{2}/.test(raw))return null;
  if(!raw.includes("T"))return {date:raw.slice(0,10),time:""};
  const timestamp=new Date(raw);
  if(!Number.isFinite(timestamp.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(timestamp).filter(part=>part.type!=="literal")
    .map(part=>[part.type,part.value]));
  return {date:parts.year+"-"+parts.month+"-"+parts.day,time:parts.hour+":"+parts.minute};
}

export function syncSeasonFixtureSchedule(game,match,updatedAt=new Date().toISOString()) {
  const id=seasonMatchIdentity(game);
  if(!id||id!==String(match?.id??""))throw new Error("Match-ID passt nicht zum Saisonspiel.");
  const incoming=String(match?.date||"").trim();
  const next=berlinKickoff(incoming);
  if(!next)throw new Error("Kein gültiger offizieller Spieltermin verfügbar.");
  const result=structuredClone(game);
  const state=result.state;
  const oldOfficial=String(state.officialSource?.matchDate||"").trim();
  const previous=berlinKickoff(oldOfficial);
  const previousLocalDate=previous?.date||"";
  const previousTime=previous?.time||"";
  const currentGameDate=String(state.gameDate||"");
  const currentDate=currentGameDate.slice(0,10);
  const wasOfficialDate=!currentGameDate||
    currentGameDate===oldOfficial||currentDate===oldOfficial.slice(0,10)||
    currentDate===previousLocalDate;
  const wasOfficialTime=!String(state.gameTimeOfDay||"")||
    String(state.gameTimeOfDay)===previousTime;
  if(wasOfficialDate)state.gameDate=next.date;
  if(next.time&&wasOfficialTime)state.gameTimeOfDay=next.time;
  // Preserve manually customised game names. Only replace the importer date prefix.
  const oldLabel=previousLocalDate&&previousLocalDate.split("-").reverse().join(".")+" | ";
  const currentLabel=String(state.gameName||"");
  if(oldLabel&&currentLabel.startsWith(oldLabel)){
    state.gameName=next.date.split("-").reverse().join(".")+" | "+currentLabel.slice(oldLabel.length);
  }
  state.officialSource={
    ...(state.officialSource||{}),
    provider:"handball.net",
    matchId:id,
    matchUrl:seasonMatchUrl(game),
    matchDate:incoming,
    competition:state.officialSource?.competition||match.phase?.competition?.name||null,
    scheduleCheckedAt:updatedAt
  };
  return {game:result,changed:oldOfficial!==incoming,manualDatePreserved:!wasOfficialDate,
    manualTimePreserved:!wasOfficialTime};
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

export function buildHandball360SeasonGame(raw, matchId, teamId, scheduleMatch = null) {
  const x = hbPrepare(raw, { fallbackMatchId: matchId });
  const id = String(x.matchId ?? matchId);
  if (id !== String(matchId)) throw new Error("Match-ID der Antwort stimmt nicht ueberein.");
  const meta = x.matchMeta;
  const homeId = String(meta?.local?.id ?? scheduleMatch?.local?.id ?? "");
  const awayId = String(meta?.visitor?.id ?? scheduleMatch?.visitor?.id ?? "");
  if (scheduleMatch && (String(meta?.local?.name ?? "").trim() !== String(scheduleMatch.local?.name ?? "").trim() ||
      String(meta?.visitor?.name ?? "").trim() !== String(scheduleMatch.visitor?.name ?? "").trim())) {
    throw new Error("Mannschaftsnamen stimmen nicht mit dem Spielplan ueberein.");
  }
  const ownTeam = homeId === String(teamId) ? "home" : awayId === String(teamId) ? "away" : null;
  if (!ownTeam) throw new Error("Match gehoert nicht zur gewaehlten Mannschaft.");
  const localDate = String(x.matchDate ?? "").slice(0, 10);
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(localDate)
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
    // New Handball360 fixtures use the current capture order by default.
    shotCapture: { attackerOrder: "last" },
    timer: { duration: x.duration, half: 1, secondsElapsed: 0, active: false },
    isVideoscoutingFile: true, isHistorical: true,
    video: { h1SyncRealTime: null, h2SyncRealTime: null },
    officialSource: {
      provider: "handball.net", matchId: id, matchUrl: seasonMatchUrl({state:{officialSource:{matchId:id}}}), matchDate: x.matchDate || null,
      venue: x.venue || null, competition: x.competition || null,
      rosterSource: x.rosterSource, importedAt: new Date().toISOString(),
      // Keep only lightweight official club metadata; images stay in the team collection.
      clubLogos: x.clubLogos
    }
  };
  const filename = "handball360_" + id + ".json";
  const game = normalizeSeasonGame(gameState, filename);
  game.ownTeam = ownTeam;
  game.opponentTeam = ownTeam === "home" ? "away" : "home";
  return game;
}

// The season import stores official logo references, while actual image data
// belongs in the persistent team collection (shared by matchday and other games).
export function officialSeasonLogoEntries(game) {
  const logos=game?.state?.officialSource?.clubLogos||{};
  return ["home","away"].flatMap(side=>{
    const team=game?.state?.[side]||{};
    const info=logos?.[side]||{};
    const teamName=String(team.name||"").trim();
    const logoUrl=String(info.logoUrl||"").trim();
    if(!teamName||!/^https:\/\//i.test(logoUrl))return [];
    return [{teamName,players:team.players||[],logoUrl,
      teamId:String(info.teamId||""),clubId:String(info.clubId||"")}];
  });
}

export function mergeOfficialSeasonLogoRecord(record,entry) {
  const updated={...record};
  // Never overwrite a manually uploaded or previously stored image.
  if(!updated.handball360TeamId&&entry.teamId)updated.handball360TeamId=entry.teamId;
  if(!updated.handball360ClubId&&entry.clubId)updated.handball360ClubId=entry.clubId;
  if(!updated.logoDataUrl&&entry.logoUrl)updated.logoUrl=entry.logoUrl;
  return updated;
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


// An explicit assignment links a manually scouted game to an official fixture.
// Never replace its filename, events, video, comments, or internal game ID.
export function assignHandball360Match(existingGames, gameId, match, teamId) {
  const matchId = String(match?.id ?? "");
  if (!/^\d+$/.test(matchId)) throw new Error("Ungültige Match-ID.");
  if (![match?.local?.id, match?.visitor?.id].some(id => String(id) === String(teamId))) {
    throw new Error("Match gehört nicht zur ausgewählten Mannschaft.");
  }
  if (existingGames.some(game => game.id !== gameId && seasonMatchIdentity(game) === matchId)) {
    throw new Error("Diese Match-ID wurde bereits einem anderen Spiel zugeordnet.");
  }
  const target = existingGames.find(game => game.id === gameId);
  if (!target) throw new Error("Manuelles Saisonspiel nicht gefunden.");
  const former = seasonMatchIdentity(target);
  if (former && former !== matchId) {
    throw new Error("Das Spiel ist bereits mit einer anderen offiziellen Match-ID verknüpft.");
  }
  return existingGames.map(game => game.id !== gameId ? game : {
    ...game,
    state: {
      ...game.state,
      gameDate: game.state.gameDate || match.date || null,
      competition: game.state.competition || match.phase?.competition?.name || "",
      officialSource: {
        ...(game.state.officialSource || {}),
        provider: "handball.net",
        matchId,
        matchUrl: seasonMatchUrl({state:{officialSource:{matchId}}}),
        teamId: String(teamId),
        matchDate: match.date || null,
        associatedAt: new Date().toISOString()
      }
    }
  });
}

function sameRosterPlayer(a, b) {
  if (a?.handballNetId && b?.handballNetId) {
    return String(a.handballNetId) === String(b.handballNetId);
  }
  const name = p => [p?.vorname, p?.nachname].map(x => String(x || "").trim().toLowerCase()).join("|");
  return Boolean(name(a).replace("|", "") && name(a) === name(b) &&
    String(a?.nr ?? "") === String(b?.nr ?? ""));
}

function mergeRosterPlayers(existing = [], fetched = []) {
  const result = structuredClone(existing || []);
  for (const incoming of fetched || []) {
    const current = result.find(player => sameRosterPlayer(player, incoming));
    if (!current) { result.push(structuredClone(incoming)); continue; }
    // Only fill absent attributes; never change manually edited values.
    for (const [key, value] of Object.entries(incoming)) {
      if ((current[key] === undefined || current[key] === null || current[key] === "") &&
          value !== undefined && value !== null && value !== "") current[key] = value;
    }
  }
  return result;
}

// Team roster from previously analyzed fixtures, not an official match lineup.
export function seedKnownSeasonRosters(incoming, existingGames = []) {
  const game = { ...incoming, state: structuredClone(incoming.state) };
  const tentative = {};
  for (const side of ["home", "away"]) {
    if ((game.state[side]?.players || []).length) continue;
    const name = String(game.state[side]?.name || "").trim().toLocaleLowerCase("de");
    if (!name) continue;
    const candidates = existingGames
      .flatMap(entry => ["home", "away"].map(s => entry.state?.[s]))
      .filter(team => String(team?.name || "").trim().toLocaleLowerCase("de") === name &&
        Array.isArray(team.players) && team.players.length);
    if (!candidates.length) continue;
    // A known squad is only a provisional roster, not a confirmed lineup.
    game.state[side].players = mergeRosterPlayers([], candidates.flatMap(team => team.players));
    tentative[side] = true;
  }
  if (Object.keys(tentative).length) {
    game.state.provisionalRosters = { ...(game.state.provisionalRosters || {}), ...tentative };
  }
  return game;
}

// Update official metadata and available lineups. If we have already scouted
// events, never replace or append official events (that would double count).
export function enrichSeasonGameFromOfficial(existing, fetched) {
  const id = seasonMatchIdentity(existing);
  if (!id || id !== seasonMatchIdentity(fetched)) throw new Error("Match-ID passt nicht zum Saisonspiel.");
  const old = existing.state;
  const fresh = fetched.state;
  if (!old.officialSource?.associatedAt && (String(old.home?.name || "").trim().toLocaleLowerCase("de") !==
      String(fresh.home?.name || "").trim().toLocaleLowerCase("de") ||
      String(old.away?.name || "").trim().toLocaleLowerCase("de") !==
      String(fresh.away?.name || "").trim().toLocaleLowerCase("de"))) {
    throw new Error("Mannschaften stimmen nicht mit dem vorhandenen Spiel überein.");
  }
  const hadEvents = Array.isArray(old.events) && old.events.length > 0;
  const hasNewEvents = Array.isArray(fresh.events) && fresh.events.length > 0;
  const state = structuredClone(old);
  state.gameDate ||= fresh.gameDate || null;
  state.competition ||= fresh.competition || "";
  state.officialSource = {
    ...(state.officialSource || {}),
    ...(fresh.officialSource || {}),
    matchUrl: seasonMatchUrl(existing),
    associatedAt: state.officialSource?.associatedAt,
    refreshedAt: new Date().toISOString()
  };
  for (const side of ["home", "away"]) {
    const officialPlayers = fresh[side]?.players || [];
    const provisional = Boolean(state.provisionalRosters?.[side]);
    const confirmedLineup = fresh.officialSource?.rosterSource === "lineups";
    state[side].players = provisional && confirmedLineup && officialPlayers.length
      ? mergeRosterPlayers(officialPlayers, [])
      : mergeRosterPlayers(state[side]?.players, officialPlayers);
    if (officialPlayers.length && confirmedLineup && state.provisionalRosters) delete state.provisionalRosters[side];
  }
  if (!hadEvents && hasNewEvents) {
    state.events = structuredClone(fresh.events);
    state.isHistorical = true;
    state.isVideoscoutingFile = true;
  }
  return {
    ...existing,
    state,
    selected: hadEvents ? existing.selected : (hasNewEvents ? true : existing.selected)
  };
}
