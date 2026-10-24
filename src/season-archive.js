// Portable, dependency-free ZIP export. The archive contains plain JSON and
// directory entries so it works on mobile Safari without File System Access.
function safePart(value, fallback = "Unbenannt") {
  const clean = String(value ?? "").normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
  return clean || fallback;
}

export function seasonArchiveTeamFolder(name) {
  return safePart(name, "Mannschaft");
}

export function seasonMatchFolder(game) {
  const official = game?.state?.officialSource?.matchId ??
    game?.state?.officialData?.matchId;
  if (official != null && /^\d+$/.test(String(official))) return String(official);
  const id = String(game?.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  return "manuell_" + (id || "spiel");
}

export function buildTeamArchiveEntries({
  teamName, seasonName, games = [], createdAt = new Date().toISOString()
}) {
  const team = seasonArchiveTeamFolder(teamName);
  const season = safePart(seasonName, "Saison");
  const entries = [];
  const index = {
    format: "handball-spielanalyse-team-archive-index",
    version: 1,
    teamName: String(teamName || ""),
    seasonName: String(seasonName || ""),
    createdAt,
    games: []
  };
  const seen = new Set();
  for (const game of games) {
    const folder = seasonMatchFolder(game);
    if (seen.has(folder)) throw new Error("Doppelte Spiel-ID im Archiv: " + folder);
    seen.add(folder);
    const root = team + "/" + folder + "/";
    const path = root + "spiel.json";
    entries.push({ path, data: JSON.stringify(game.state, null, 2) });
    entries.push({ path: root + "videos/", data: "" });
    entries.push({ path: root + "exports/", data: "" });
    index.games.push({
      matchId: game?.state?.officialSource?.matchId ?? null,
      gameId: game.id,
      gameName: game?.state?.gameName ?? "",
      date: game?.state?.gameDate ?? null,
      selected: game.selected !== false,
      path: folder + "/spiel.json"
    });
  }
  entries.push({
    path: team + "/" + season + "_index.json",
    data: JSON.stringify(index, null, 2)
  });
  return { entries, team, index };
}

const encoder = new TextEncoder();
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let j = 0; j < 8; j++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function write16(v, offset, value) { v.setUint16(offset, value, true); }
function write32(v, offset, value) { v.setUint32(offset, value, true); }

// ZIP "store" mode: no compression and no third-party script dependency.
// Reject ZIP64-sized archives instead of silently writing corrupt lengths.
export function createStoredZip(files) {
  if (!Array.isArray(files) || files.length > 65535) throw new Error("Zu viele Archivdateien.");
  const output = [], central = [];
  let offset = 0, centralSize = 0;
  for (const item of files) {
    const name = encoder.encode(String(item.path));
    const data = encoder.encode(String(item.data ?? ""));
    if (!name.length || name.length > 65535 || data.length > 0xffffffff) {
      throw new Error("Archivdatei ist zu groß oder ungültig.");
    }
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    write32(header, 0, 0x04034b50);
    write16(header, 4, 20); write16(header, 6, 0x0800); // UTF-8
    write16(header, 8, 0); // store
    write16(header, 10, 0); write16(header, 12, 33); // 1980-01-01
    write32(header, 14, crc);
    write32(header, 18, data.length); write32(header, 22, data.length);
    write16(header, 26, name.length); write16(header, 28, 0);
    local.set(name, 30);
    const record = new Uint8Array(46 + name.length);
    const info = new DataView(record.buffer);
    write32(info, 0, 0x02014b50);
    write16(info, 4, 20); write16(info, 6, 20);
    write16(info, 8, 0x0800); write16(info, 10, 0);
    write16(info, 12, 0); write16(info, 14, 33);
    write32(info, 16, crc);
    write32(info, 20, data.length); write32(info, 24, data.length);
    write16(info, 28, name.length);
    write16(info, 30, 0); write16(info, 32, 0);
    write16(info, 34, 0); write16(info, 36, 0);
    write32(info, 38, item.path.endsWith("/") ? 0x10 : 0);
    write32(info, 42, offset);
    record.set(name, 46);
    output.push(local, data);
    central.push(record);
    offset += local.length + data.length;
    centralSize += record.length;
    if (offset + centralSize > 0xffffffff) throw new Error("Archiv ist zu groß (ZIP64 nicht unterstützt).");
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  write32(view, 0, 0x06054b50);
  write16(view, 8, files.length); write16(view, 10, files.length);
  write32(view, 12, centralSize); write32(view, 16, offset);
  return new Blob([...output, ...central, end], { type: "application/zip" });
}

export function createTeamArchive(options) {
  const { entries, team, index } = buildTeamArchiveEntries(options);
  return {
    blob: createStoredZip(entries),
    fileName: team + "_" + safePart(options.seasonName, "Saison") + "_archiv.zip",
    index
  };
}
