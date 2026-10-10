export function handballNetMatchId(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:handball\.net\/match\/)?(\d{4,})/i);
  return match ? match[1] : null;
}

export function hbMinuteSeconds(value) {
  const parts = String(value || "0:00").trim().split(":").map(Number);
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

export function hbHalf(event) {
  return /2\.\s*Halbzeit/i.test(String(event?.block || "")) ? 2 : 1;
}

export function hbEventType(event) {
  const name = String(event?.event_type?.name || "").toLocaleLowerCase("de");
  const sanction = String(event?.event_type?.sanction_class || "").toLowerCase();

  if (event?.event_type?.is_goal) return "goal";
  if (name.includes("siebenmeter fehlwurf")) return "miss";
  if (sanction === "warning" || name.includes("verwarnung")) return "yellow";
  if (sanction === "suspension" || name.includes("zwei minuten")) return "2min";
  if (sanction === "red" || name.includes("rote karte")) return "red";
  if (sanction === "blue" || name.includes("blaue karte")) return "blue";
  if (name.includes("auszeit")) return "timeout";
  return null;
}

export function hbPlayerName(player) {
  return player
    ? [player.first_name, player.last_name].filter(Boolean).join(" ").trim()
    : "";
}

export function hbNameKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hbDuration(events = []) {
  const ends = events
    .filter((event) => event?.event_type?.id === 10002 && hbHalf(event) === 1)
    .map((event) => hbMinuteSeconds(event.minute) / 60)
    .filter(Number.isFinite);

  const duration = ends[0] || 25;
  return [20, 25, 30].includes(Math.round(duration))
    ? Math.round(duration)
    : Math.max(1, Math.round(duration));
}

export function hbTeams(events = []) {
  const home = events.find((event) => event?.is_home && event?.team)?.team?.name || "Heim";
  const away = events.find((event) => event?.is_home === false && event?.team)?.team?.name || "Gast";
  return { home, away };
}

export function hbRoster(events = [], isHome) {
  const players = new Map();

  for (const event of events) {
    if (Boolean(event?.is_home) !== Boolean(isHome) || !event?.player) continue;

    const player = event.player;
    const key = String(player.id || hbNameKey(hbPlayerName(player)));

    if (!players.has(key)) {
      players.set(key, {
        id: player.id || "hb-" + key,
        nr: null,
        nachname: String(player.last_name || "").trim(),
        vorname: String(player.first_name || "").trim(),
        isTW: false,
        handballNetId: player.id || null
      });
    }
  }

  return [...players.values()].sort((a, b) =>
    (a.nachname || "").localeCompare(b.nachname || "", "de")
  );
}

export function hbRosterFromLineup(side) {
  const entries = Array.isArray(side?.players) ? side.players : [];

  return entries
    .filter((entry) => entry?.player && !entry?.is_staff)
    .map((entry, index) => {
      const player = entry.player;
      const handballNetId = String(player.id || "").trim();
      const fallbackKey = hbNameKey(hbPlayerName(player));

      return {
        id: handballNetId || "hb-lineup-" + fallbackKey + "-" + index,
        nr: entry.number ?? "",
        nachname: String(player.last_name || "").trim(),
        vorname: String(player.first_name || "").trim(),
        isTW: Boolean(entry.is_goalkeeper),
        handballNetId
      };
    })
    .sort((a, b) => {
      const aNumber = Number(a.nr);
      const bNumber = Number(b.nr);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
        return aNumber - bNumber;
      }
      return (a.nachname || "").localeCompare(b.nachname || "", "de");
    });
}

export function formatGameTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const remainingSeconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function hbNormalizeEvents(events = [], duration = 25) {
  const normalized = [];

  for (const event of events) {
    const type = hbEventType(event);
    if (!type) continue;

    const half = hbHalf(event);
    const localTime = hbMinuteSeconds(event.minute);
    const time = (half - 1) * duration * 60 + localTime;
    const team = event.team ? (event.is_home ? "home" : "away") : null;

    if (!team && type !== "timeout") continue;

    const name = hbPlayerName(event.player);
    const parts = name.split(/\s+/).filter(Boolean);
    const lastName = parts.pop() || "";
    const is7 = String(event?.event_type?.name || "")
      .toLocaleLowerCase("de")
      .includes("siebenmeter");

    normalized.push({
      id: Number(event.id) || Date.now() + normalized.length,
      time,
      displayTime: formatGameTime(time),
      half,
      realTime: null,
      attackPhase: is7 ? "7-Meter" : null,
      tags: [],
      scoreH: Number(event?.score?.local) || 0,
      scoreA: Number(event?.score?.visitor) || 0,
      scoreChanged: type === "goal",
      defenderUnknown: false,
      playerTags: [],
      pId: event?.player?.id ?? null,
      pName: name ? lastName + ", " + parts.join(" ") : "Unbekannt",
      pNr: null,
      team,
      type,
      endedPossessionOf: ["goal", "miss"].includes(type) ? team : undefined,
      z: is7 ? "7M" : undefined,
      gz: null,
      is7: is7 || undefined,
      shotDistance: is7 ? 7 : undefined,
      shotLane: is7 ? "M" : undefined,
      penalizedBank: false,
      officialTimestamp: event.timestamp || null,
      officialEventId: event.id ?? null,
      officialEventType: event?.event_type?.name || null,
      officialSource: "handball.net"
    });
  }

  return normalized.sort(
    (a, b) => a.time - b.time || Number(a.officialEventId || 0) - Number(b.officialEventId || 0)
  );
}

export function hbPrepare(raw, { fallbackMatchId = null } = {}) {
  const matchMeta = Array.isArray(raw?.match?.data)
    ? raw.match.data[0]
    : Array.isArray(raw?.match)
      ? raw.match[0]
      : null;

  const events =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.data) ? raw.data :
    Array.isArray(raw?.events) ? raw.events :
    Array.isArray(raw?.events?.data) ? raw.events.data :
    Array.isArray(raw?.event?.data) ? raw.event.data :
    Array.isArray(raw?.match_events?.data) ? raw.match_events.data :
    null;

  if (!events?.length) {
    const keys = raw && typeof raw === "object" ? Object.keys(raw).join(", ") : typeof raw;
    throw Error(
      "Keine handball.net-Ereignisse im JSON gefunden. Gefundene Top-Level-Felder: " + keys
    );
  }

  const metadataDuration = Number(matchMeta?.duration?.minutes_per_period);
  const duration =
    Number.isFinite(metadataDuration) && metadataDuration > 0
      ? metadataDuration
      : hbDuration(events);

  const eventTeams = hbTeams(events);
  const teams = {
    home: String(matchMeta?.local?.name || eventTeams.home || "Heim"),
    away: String(matchMeta?.visitor?.name || matchMeta?.away?.name || eventTeams.away || "Gast")
  };

  const matchId =
    String(raw?.match_id || matchMeta?.id || fallbackMatchId || "") || null;

  const lineupLocal = raw?.lineups?.data?.local || null;
  const lineupVisitor = raw?.lineups?.data?.visitor || null;
  const lineupHomePlayers = hbRosterFromLineup(lineupLocal);
  const lineupAwayPlayers = hbRosterFromLineup(lineupVisitor);

  const homePlayers = lineupHomePlayers.length
    ? lineupHomePlayers
    : hbRoster(events, true);
  const awayPlayers = lineupAwayPlayers.length
    ? lineupAwayPlayers
    : hbRoster(events, false);

  return {
    events,
    normalized: hbNormalizeEvents(events, duration),
    duration,
    teams,
    matchId,
    matchDate: matchMeta?.date || null,
    competition: matchMeta?.phase?.competition?.name || null,
    homePlayers,
    awayPlayers,
    rosterSource:
      lineupHomePlayers.length || lineupAwayPlayers.length ? "lineups" : "events",
    matchMeta,
    additionalInfo:
      raw?.additional_info ?? raw?.["additional-info"] ?? raw?.additionalInfo ?? null,
    raw: structuredClone(raw)
  };
}
