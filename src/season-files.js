import { migrateGameData } from "./game-format.js";
import { SEASON_FORMAT, SEASON_VERSION } from "./storage.js";
import { normalizeSeasonPlayerAliases } from "./season-core.js";

export const LEGACY_SEASON_FORMAT = "handball-match-flow-season";

// Only suggest a team label for an otherwise generic season title.
export function suggestedSeasonName(name,preferredTeam="",games=[]) {
  const current=String(name||"").trim();
  const match=/^Saison (20\d{2}\/\d{2})$/i.exec(current);
  if(!match)return current||"Saison";
  const pairs=(Array.isArray(games)?games:[]).map(game=>{
    const state=game?.state??game?.data??{};
    return [String(state.home?.name||"").trim(),String(state.away?.name||"").trim()].filter(Boolean);
  }).filter(row=>row.length===2);
  if(!pairs.length)return current;
  const norm=value=>value.toLocaleLowerCase("de").replace(/\s+/g," ").trim();
  const prefer=String(preferredTeam||"").trim();
  const preferredMatches=prefer?pairs.filter(row=>row.some(team=>norm(team)===norm(prefer))).length:0;
  if(prefer&&preferredMatches>=Math.ceil(pairs.length*0.75)){
    return (pairs.flat().find(team=>norm(team)===norm(prefer))||prefer)+" · Saison "+match[1];
  }
  if(pairs.length<3)return current;
  const count=new Map();
  for(const pair of pairs)for(const key of new Set(pair.map(norm))){
    const item=count.get(key)||{name:pair.find(v=>norm(v)===key),total:0};
    item.total++;count.set(key,item);
  }
  const sorted=[...count.values()].sort((a,b)=>b.total-a.total);
  return sorted[0]?.total>=Math.ceil(pairs.length*0.75)&&sorted[0].total>(sorted[1]?.total||0)
    ?sorted[0].name+" · Saison "+match[1]:current;
}



export function seasonIdentityText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/\s+/g, " ");
}

export function seasonGameId(fileName, data) {
  const date = data?.gameDate ?? data?.matchDate ?? data?.date ?? "";
  const raw = [
    seasonIdentityText(fileName),
    seasonIdentityText(data?.gameName),
    seasonIdentityText(data?.home?.name),
    seasonIdentityText(data?.away?.name),
    seasonIdentityText(date)
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "sg-" + (hash >>> 0).toString(16);
}

export function resolveSeasonOwnTeam(data, currentOwnName = "") {
  if (["home", "away"].includes(data?.ownTeam)) return data.ownTeam;

  const home = String(data?.home?.name || "").trim().toLowerCase();
  const away = String(data?.away?.name || "").trim().toLowerCase();
  const own = String(currentOwnName || "").trim().toLowerCase();

  if (own && home === own) return "home";
  if (own && away === own) return "away";
  return "away";
}

export function normalizeSeasonGame(data, fileName, currentOwnName = "") {
  const migrated = migrateGameData(data);
  if (!Array.isArray(migrated.events) || !migrated.home || !migrated.away) {
    throw new Error("Keine gültige Spiel-JSON.");
  }

  const ownTeam = resolveSeasonOwnTeam(migrated, currentOwnName);
  return {
    id: seasonGameId(fileName, migrated),
    fileName: fileName || "Spiel.json",
    state: migrated,
    selected: true,
    ownTeam,
    opponentTeam: ownTeam === "home" ? "away" : "home"
  };
}

export function normalizeSeasonArchive(data, currentOwnName = "") {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Keine gültige Saison-Datei.");
  }

  if (![SEASON_FORMAT, LEGACY_SEASON_FORMAT].includes(data.format)) {
    throw new Error("Keine gültige Saison-Datei.");
  }

  if (!Array.isArray(data.games)) {
    throw new Error("Die Saison-Datei enthält keine Spiele.");
  }

  const rawVersion = data.version ?? 1;
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Ungültige Versionsnummer in der Saison-Datei.");
  }
  if (data.format === SEASON_FORMAT && version > SEASON_VERSION) {
    throw new Error(
      `Diese Saison-Datei verwendet Version ${version}. Unterstützt wird derzeit Version ${SEASON_VERSION}.`
    );
  }

  const restored = new Map();
  data.games.forEach((item, index) => {
    const raw = item?.data ?? item?.state;
    if (!raw) return;

    const game = normalizeSeasonGame(
      raw,
      item.fileName || `Spiel_${index + 1}.json`,
      currentOwnName
    );
    // Keep the archive's stable game ID so a renamed match does not lose its
    // Setup/session link when the season is reloaded.
    if (typeof item?.id === "string" && /^sg-[a-z0-9_-]{1,80}$/i.test(item.id)) game.id = item.id;
    game.selected = item.selected !== false;
    restored.set(game.id, game);
  });

  return {
    format: SEASON_FORMAT,
    version: SEASON_VERSION,
    name: String(data.name || "Saison").trim() || "Saison",
    playerAliases: normalizeSeasonPlayerAliases(data.playerAliases),
    games: [...restored.values()]
  };
}

export function parseSeasonText(text, currentOwnName = "") {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error("Saison-JSON konnte nicht gelesen werden.");
  }
  return normalizeSeasonArchive(parsed, currentOwnName);
}

export function mergeSeasonGames(existingGames = [], loadedGames = []) {
  const map = new Map(
    (Array.isArray(existingGames) ? existingGames : []).map((game) => [
      game.id,
      game
    ])
  );

  let added = 0;
  let updated = 0;

  for (const loaded of Array.isArray(loadedGames) ? loadedGames : []) {
    const previous = map.get(loaded.id);
    if (previous) {
      loaded.selected = previous.selected !== false;
      updated += 1;
    } else {
      added += 1;
    }
    map.set(loaded.id, loaded);
  }

  return {
    games: [...map.values()],
    added,
    updated
  };
}

export async function readSeasonGameFiles(
  files = [],
  currentOwnName = ""
) {
  const loaded = [];
  const errors = [];

  for (const file of Array.from(files || [])) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      loaded.push(normalizeSeasonGame(data, file.name, currentOwnName));
    } catch (error) {
      errors.push({
        fileName: file?.name || "Unbekannte Datei",
        message: error?.message || "Datei konnte nicht gelesen werden"
      });
    }
  }

  return { loaded, errors };
}
