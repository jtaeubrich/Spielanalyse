import { migrateGameData } from "./game-format.js";
import { SEASON_FORMAT, SEASON_VERSION } from "./storage.js";

export const LEGACY_SEASON_FORMAT = "handball-match-flow-season";

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
    game.selected = item.selected !== false;
    restored.set(game.id, game);
  });

  return {
    format: SEASON_FORMAT,
    version: SEASON_VERSION,
    name: String(data.name || "Saison").trim() || "Saison",
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
