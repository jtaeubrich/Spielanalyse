export const HANDBALL_ID_FIELDS = [
  "handballNetId",
  "handball360Id",
  "handball360_id",
  "Handball360-ID",
  "H360-ID",
  "handball net id",
  "handballnetid"
];

export function normalizeHandballNetId(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function rosterPlayerNameKey(player) {
  return `${String(player?.vorname || "").trim()} ${String(player?.nachname || "").trim()}`
    .trim()
    .toLowerCase();
}

export function normalizeRosterPlayer(raw = {}, index = 0, existingPlayers = []) {
  const idValue = HANDBALL_ID_FIELDS
    .map((field) => raw?.[field])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== "");

  const handballNetId = normalizeHandballNetId(idValue);
  const nr =
    raw.nr ??
    raw.Nr ??
    raw["Nr."] ??
    raw.nummer ??
    raw.Nummer ??
    raw.Rückennummer ??
    raw.number ??
    "";

  const vorname = String(raw.vorname ?? raw.Vorname ?? "").trim();
  const nachname = String(
    raw.nachname ?? raw.Nachname ?? (vorname ? "" : raw.name ?? raw.Name ?? "")
  ).trim();

  const nameKey = `${vorname} ${nachname}`.trim().toLowerCase();

  const match = (existingPlayers || []).find((player) => {
    if (
      handballNetId &&
      normalizeHandballNetId(player.handballNetId) === handballNetId
    ) {
      return true;
    }
    if (nr !== "" && String(player.nr) === String(nr)) return true;
    return rosterPlayerNameKey(player) === nameKey && Boolean(nameKey);
  });

  return {
    id: raw.id ?? match?.id ?? Date.now() + index,
    nr: nr === "" ? match?.nr ?? "" : Number.isNaN(Number(nr)) ? nr : Number(nr),
    nachname,
    vorname,
    isTW: Boolean(raw.isTW ?? raw.TW ?? match?.isTW ?? false),
    handballNetId: handballNetId || normalizeHandballNetId(match?.handballNetId)
  };
}

export function rowsToPlayers(rows, existingPlayers = []) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Leere Liste");

  const clean = rows
    .map((row) => (Array.isArray(row) ? row : Object.values(row)))
    .filter((row) => row.some((value) => String(value ?? "").trim()));

  const header = clean[0].map((value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[.]/g, "")
      .replace(/[_\s-]+/g, " ")
      .replace(
        /^(rückennummer|rueckennummer|trikotnummer|number|jersey number)$/,
        "nr"
      )
  );

  const hasHeader = header.some((value) =>
    /^(nr|nummer|name|nachname|vorname|tw|torwart|handball360 id|handball net id|handballnetid|h360 id)$/.test(
      value
    )
  );
  const data = hasHeader ? clean.slice(1) : clean;

  const idx = (...names) => header.findIndex((value) => names.includes(value));
  const iNr = idx("nr", "nummer");
  const iName = idx("name");
  const iLast = idx("nachname");
  const iFirst = idx("vorname");
  const iTw = idx("tw", "torwart");
  const iHb = idx(
    "handball360 id",
    "handball net id",
    "handballnetid",
    "h360 id"
  );

  return data
    .map((row, index) => {
      let nr = iNr >= 0 ? row[iNr] : "";
      let first = "";
      let last = "";
      const hbId = iHb >= 0 ? normalizeHandballNetId(row[iHb]) : "";

      if (iFirst >= 0 || iLast >= 0) {
        first = String(row[iFirst] ?? "").trim();
        last = String(row[iLast] ?? "").trim();
      } else {
        const full = String(
          row[iName >= 0 ? iName : iNr === 0 ? 1 : 0] ?? ""
        ).trim();
        const parts = full.split(/\s+/);
        last = parts.pop() || "";
        first = parts.join(" ");
      }

      if (!first && !last) return null;

      const nameKey = `${first} ${last}`.trim().toLowerCase();
      const match = existingPlayers.find(
        (player) =>
          (hbId &&
            normalizeHandballNetId(player.handballNetId) === hbId) ||
          (nr !== "" && String(player.nr) === String(nr)) ||
          rosterPlayerNameKey(player) === nameKey
      );

      return {
        id: match?.id ?? Date.now() + index,
        nr:
          nr === ""
            ? match?.nr ?? ""
            : Number.isNaN(Number(nr))
              ? nr
              : Number(nr),
        nachname: last,
        vorname: first,
        isTW:
          iTw >= 0
            ? /^(1|ja|true|x|tw)$/i.test(String(row[iTw] ?? ""))
            : match?.isTW ?? false,
        handballNetId: hbId || normalizeHandballNetId(match?.handballNetId)
      };
    })
    .filter(Boolean);
}

export function parseRosterJson(data, team, existingPlayers = []) {
  let players;
  if (Array.isArray(data)) players = data;
  else if (Array.isArray(data?.players)) players = data.players;
  else if (Array.isArray(data?.[team]?.players)) players = data[team].players;
  else throw new Error("Kein Spielerkader gefunden");

  return players
    .map((player, index) => normalizeRosterPlayer(player, index, existingPlayers))
    .filter((player) => player.vorname || player.nachname);
}

export function mergeRosterByHandballId(existingPlayers = [], importedPlayers = []) {
  const byId = new Map();
  for (const player of existingPlayers) {
    const key = normalizeHandballNetId(player.handballNetId);
    if (key) byId.set(key, player);
  }

  return importedPlayers.map((player) => {
    const hbId = normalizeHandballNetId(player.handballNetId);
    const existing = hbId ? byId.get(hbId) : null;
    return existing
      ? {
          ...existing,
          ...player,
          id: existing.id,
          handballNetId: hbId
        }
      : player;
  });
}
