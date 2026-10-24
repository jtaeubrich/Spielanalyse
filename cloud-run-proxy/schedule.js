// Read-only, strictly bounded Handball360 team fixture listing.
// The upstream API is undocumented. Keeping it behind this narrow endpoint
// prevents arbitrary-path proxying and preserves the existing /match API.
export function validateTeamScheduleRequest(teamId, from, to) {
  const id = String(teamId ?? "").trim();
  if (!/^[0-9]{1,12}$/.test(id)) throw new Error("Ungueltige numerische Team-ID.");
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
    const date = new Date(String(value) + "T00:00:00Z");
    return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(from) || !validDate(to)) throw new Error("Zeitraum im Format JJJJ-MM-TT angeben.");
  const days = (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000;
  if (days < 0 || days > 400) throw new Error("Zeitraum darf maximal 400 Tage umfassen.");
  return { teamId: id, from, to };
}

export function summarizeHandball360Match(match) {
  const id = String(match?.id ?? "");
  if (!/^\d+$/.test(id)) return null;
  const side = entry => ({
    id: String(entry?.id ?? ""), name: String(entry?.name ?? "").trim()
  });
  return {
    id,
    date: match?.date ?? null,
    status: match?.status ?? null,
    local: side(match?.local),
    visitor: side(match?.visitor),
    phase: {
      name: match?.phase?.name ?? "",
      competition: { name: match?.phase?.competition?.name ?? "" }
    },
    result: match?.result ?? null,
    duration: match?.duration ?? null
  };
}

export async function fetchHandball360TeamSchedule(teamId, from, to, getPage) {
  const request = validateTeamScheduleRequest(teamId, from, to);
  const pageSize = 50, maxPages = 10;
  const byId = new Map();
  let declaredTotal = null;
  let expectedLastPage = 1;
  for (let page = 1; page <= expectedLastPage; page++) {
    if (page > maxPages) throw new Error("Spielplan hat zu viele Seiten.");
    const query = new URLSearchParams({
      team_id: request.teamId, date_from: from, date_to: to,
      per_page: String(pageSize), page: String(page)
    });
    const result = await getPage("/api/new/matches?" + query.toString());
    if (!Array.isArray(result?.data)) throw new Error("Spielplanantwort hat keine Datenliste.");
    const total = Number(result?.pagination?.total);
    const lastPage = Number(result?.pagination?.last_page);
    if (!Number.isSafeInteger(total) || total < 0 ||
        !Number.isInteger(lastPage) || lastPage < 1 || lastPage > maxPages) {
      throw new Error("Unplausible oder unvollstaendige Paginierung.");
    }
    if (declaredTotal !== null && declaredTotal !== total) {
      throw new Error("Spielplan waehrend des Abrufs geaendert; bitte wiederholen.");
    }
    declaredTotal = total;
    expectedLastPage = lastPage;
    for (const raw of result.data) {
      const match = summarizeHandball360Match(raw);
      if (!match) throw new Error("Spiel ohne gueltige Match-ID.");
      if (![match.local.id, match.visitor.id].includes(request.teamId)) {
        throw new Error("Spielplan enthaelt ein Spiel einer anderen Mannschaft.");
      }
      byId.set(match.id, match);
    }
  }
  if (byId.size !== declaredTotal) {
    throw new Error("Spielplan unvollstaendig; erwartete " + declaredTotal +
      " Spiele, erhalten: " + byId.size);
  }
  return {
    teamId: request.teamId, dateFrom: from, dateTo: to,
    total: byId.size,
    matches: [...byId.values()].sort((a, b) =>
      String(a.date ?? "").localeCompare(String(b.date ?? "")) ||
      Number(a.id) - Number(b.id))
  };
}
