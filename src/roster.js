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


export function rosterTeamKey(teamName) {
  const normalized = String(teamName || "")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/\s+/g, " ");
  if (!normalized) return null;
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "team-" + (hash >>> 0).toString(16);
}

export function mergeRosterCollection(existingPlayers = [], incomingPlayers = []) {
  const players = structuredClone(Array.isArray(existingPlayers) ? existingPlayers : []);
  const conflicts = [];
  let added = 0;
  let updated = 0;
  let enrichedIds = 0;

  const findByHbId = (hbId) =>
    players.find(
      (player) =>
        hbId &&
        normalizeHandballNetId(player.handballNetId).toLowerCase() === hbId.toLowerCase()
    );

  const findNameMatches = (incoming) => {
    const key = rosterPlayerNameKey(incoming);
    if (!key) return [];
    return players.filter((player) => rosterPlayerNameKey(player) === key);
  };

  for (const raw of Array.isArray(incomingPlayers) ? incomingPlayers : []) {
    const incoming = normalizeRosterPlayer(raw, 0, []);
    const hbId = normalizeHandballNetId(incoming.handballNetId);
    let existing = hbId ? findByHbId(hbId) : null;

    if (!existing && hbId) {
      const nameMatches = findNameMatches(incoming);
      const emptyIdMatches = nameMatches.filter(
        (player) => !normalizeHandballNetId(player.handballNetId)
      );
      const conflictingIds = nameMatches.filter(
        (player) =>
          normalizeHandballNetId(player.handballNetId) &&
          normalizeHandballNetId(player.handballNetId).toLowerCase() !== hbId.toLowerCase()
      );

      if (conflictingIds.length) {
        conflicts.push({
          type: "same-name-different-h360-id",
          incoming: structuredClone(incoming),
          existing: conflictingIds.map((player) => structuredClone(player))
        });
      }

      if (emptyIdMatches.length === 1 && !conflictingIds.length) {
        existing = emptyIdMatches[0];
        existing.handballNetId = hbId;
        enrichedIds += 1;
      }
    }

    if (!existing && !hbId) {
      const nameMatches = findNameMatches(incoming);
      if (nameMatches.length === 1) existing = nameMatches[0];
      else if (nameMatches.length > 1) {
        conflicts.push({
          type: "ambiguous-name",
          incoming: structuredClone(incoming),
          existing: nameMatches.map((player) => structuredClone(player))
        });
      } else if (incoming.nr !== "" && incoming.nr !== null && incoming.nr !== undefined) {
        const numberMatches = players.filter(
          (player) => String(player.nr) === String(incoming.nr)
        );
        if (numberMatches.length === 1) existing = numberMatches[0];
      }
    }

    if (existing) {
      const before = JSON.stringify(existing);
      if (!existing.vorname && incoming.vorname) existing.vorname = incoming.vorname;
      if (!existing.nachname && incoming.nachname) existing.nachname = incoming.nachname;
      if (
        incoming.nr !== "" &&
        incoming.nr !== null &&
        incoming.nr !== undefined &&
        String(existing.nr ?? "") !== String(incoming.nr)
      ) {
        existing.nr = incoming.nr;
      }
      if (!existing.isTW && incoming.isTW) existing.isTW = true;
      if (!existing.handballNetId && hbId) {
        existing.handballNetId = hbId;
        enrichedIds += 1;
      }
      if (JSON.stringify(existing) !== before) updated += 1;
      continue;
    }

    players.push(incoming);
    added += 1;
  }

  return { players, added, updated, enrichedIds, conflicts };
}
