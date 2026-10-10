export const INTERNAL_DB_NAME = "handball-spielanalyse";
export const INTERNAL_DB_VERSION = 3;
export const INTERNAL_GAME_STORE = "games";
export const INTERNAL_GAME_KEY = "current";
export const INTERNAL_SEASON_STORE = "seasons";
export const INTERNAL_SEASON_KEY = "current";
export const INTERNAL_ROSTER_STORE = "rosters";
export const SESSION_STORAGE_KEY = "handballSpielanalyse.session";
export const SEASON_FORMAT = "handball-spielanalyse-season";
export const SEASON_VERSION = 1;

export function buildInternalGameRecord({
  text,
  fileName,
  gameName,
  savedAt = new Date().toISOString()
}) {
  return {
    id: INTERNAL_GAME_KEY,
    text: String(text ?? ""),
    fileName: fileName || null,
    gameName: gameName || "Handball-Spiel",
    savedAt
  };
}

export function buildSeasonRecord({
  name = "Saison",
  games = [],
  updatedAt = new Date().toISOString()
}) {
  return {
    id: INTERNAL_SEASON_KEY,
    format: SEASON_FORMAT,
    version: SEASON_VERSION,
    name: String(name || "Saison").trim() || "Saison",
    updatedAt,
    games: (Array.isArray(games) ? games : []).map((game) => ({
      id: game.id,
      fileName: game.fileName,
      selected: game.selected !== false,
      data: game.state
    }))
  };
}

export function buildSeasonExport({
  name = "Saison",
  games = [],
  createdAt = new Date().toISOString()
}) {
  const record = buildSeasonRecord({ name, games, updatedAt: createdAt });
  const { id, updatedAt, ...rest } = record;
  return {
    ...rest,
    createdAt
  };
}

export function buildSessionRecord({
  state,
  ownTeam,
  myTeamLeft = true,
  gameBase = 0,
  analysisMode = "live",
  currentGameFileName = null
}) {
  return {
    state,
    ownTeam,
    myTeamLeft: myTeamLeft !== false,
    gameBase: Number(gameBase) || 0,
    analysisMode: analysisMode === "video" ? "video" : "live",
    currentGameFileName: currentGameFileName || null
  };
}

export function openInternalDb(indexedDb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDb) {
      reject(new Error("IndexedDB nicht verfügbar"));
      return;
    }

    const request = indexedDb.open(INTERNAL_DB_NAME, INTERNAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INTERNAL_GAME_STORE)) {
        db.createObjectStore(INTERNAL_GAME_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(INTERNAL_SEASON_STORE)) {
        db.createObjectStore(INTERNAL_SEASON_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(INTERNAL_ROSTER_STORE)) {
        db.createObjectStore(INTERNAL_ROSTER_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Interner Speicher konnte nicht geöffnet werden"));
  });
}

export async function readInternalRecord(storeName, key, indexedDb = globalThis.indexedDB) {
  const db = await openInternalDb(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function listInternalRecords(storeName, indexedDb = globalThis.indexedDB) {
  const db = await openInternalDb(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function writeInternalRecord(storeName, record, indexedDb = globalThis.indexedDB) {
  const db = await openInternalDb(indexedDb);
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return record;
  } finally {
    db.close();
  }
}

export async function deleteInternalRecord(storeName, key, indexedDb = globalThis.indexedDB) {
  const db = await openInternalDb(indexedDb);
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}


export function buildRosterRecord({
  id,
  teamName,
  players = [],
  updatedAt = new Date().toISOString()
}) {
  if (!id) throw new Error("Roster-ID fehlt.");
  return {
    id,
    teamName: String(teamName || "").trim() || "Mannschaft",
    updatedAt,
    players: structuredClone(Array.isArray(players) ? players : [])
  };
}
