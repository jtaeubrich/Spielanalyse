export const GAME_FORMAT = "handball-spielanalyse";
export const CURRENT_GAME_VERSION = 1;

function cloneGame(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Keine gültige Spiel-JSON.");
  }
  return structuredClone(data);
}

function migrateLegacyToV1(data) {
  const migrated = cloneGame(data);

  migrated.format = GAME_FORMAT;
  migrated.version = 1;

  if (!["home", "away"].includes(migrated.ownTeam)) {
    migrated.ownTeam = "away";
  }

  for (const team of ["home", "away"]) {
    if (!migrated[team] || typeof migrated[team] !== "object") {
      migrated[team] = { name: team === "home" ? "Heim" : "Gast", players: [] };
    }

    if (!Array.isArray(migrated[team].players)) {
      migrated[team].players = [];
    }

    migrated[team].players = migrated[team].players.map((player) => ({
      ...player,
      handballNetId:
        player?.handballNetId === undefined || player?.handballNetId === null
          ? ""
          : String(player.handballNetId)
    }));
  }

  if (!Array.isArray(migrated.events)) migrated.events = [];

  if (!migrated.activeDefense || typeof migrated.activeDefense !== "object") {
    migrated.activeDefense = { home: null, away: null };
  } else {
    migrated.activeDefense = {
      home: migrated.activeDefense.home ?? null,
      away: migrated.activeDefense.away ?? null
    };
  }

  return migrated;
}

export function migrateGameData(input) {
  const data = cloneGame(input);

  const format = data.format ?? null;
  const rawVersion = data.version ?? null;

  if (format && format !== GAME_FORMAT) {
    throw new Error(
      `Unbekanntes Spielformat „${format}“. Erwartet wird „${GAME_FORMAT}“.`
    );
  }

  if (rawVersion !== null && rawVersion !== undefined) {
    const version = Number(rawVersion);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error("Ungültige Versionsnummer in der Spieldatei.");
    }
    if (version > CURRENT_GAME_VERSION) {
      throw new Error(
        `Diese Spieldatei verwendet Version ${version}. Unterstützt wird derzeit Version ${CURRENT_GAME_VERSION}.`
      );
    }
  }

  let migrated = data;
  let version = rawVersion == null ? 0 : Number(rawVersion);

  if (version === 0) {
    migrated = migrateLegacyToV1(migrated);
    version = 1;
  }

  if (version === 1) {
    migrated = migrateLegacyToV1(migrated);
  }

  migrated.format = GAME_FORMAT;
  migrated.version = CURRENT_GAME_VERSION;

  return migrated;
}

export function stampCurrentGameFormat(data) {
  const stamped = cloneGame(data);
  stamped.format = GAME_FORMAT;
  stamped.version = CURRENT_GAME_VERSION;
  return stamped;
}
