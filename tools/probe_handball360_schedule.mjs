/**
 * Small, read-only Handball360 endpoint probe for the existing TSV Kronshagen
 * club (5601) and B-youth team (85814).
 *
 * No bulk downloads, no PII, no credentials and no match/event persistence.
 * This tests undocumented endpoints only; it is not an API authorization.
 */
const base = "https://www.handball.net";
const probes = [
  {
    name: "club-matches",
    path: "/api/new/matches?club_id=5601&date_from=2026-07-01&date_to=2027-06-30&per_page=5&page=1",
  },
  {
    name: "team-matches",
    path: "/api/new/matches?team_id=85814&date_from=2026-07-01&date_to=2027-06-30&per_page=5&page=1",
  },
  {
    name: "club-teams",
    path: "/api/new/teams?club_id=5601&season_id=2627&per_page=5&page=1",
  },
  {
    name: "full-team-schedule",
    path: "/api/new/matches?team_id=85814&date_from=2026-07-01&date_to=2027-06-30&per_page=50&page=1",
  },
  {
    name: "known-match-control",
    path: "/api/new/matches?match_id=378112",
  },
  {
    name: "known-match-events",
    path: "/api/new/matches/378112/events",
  },
  {
    name: "earlier-match-events-378087",
    path: "/api/new/matches/378087/events",
  },
  {
    name: "earlier-match-events-378092",
    path: "/api/new/matches/378092/events",
  },
];

function safeShape(obj) {
  if (!obj || typeof obj !== "object") return { kind: typeof obj };
  const keys = Object.keys(obj).slice(0, 16);
  const data = Array.isArray(obj.data) ? obj.data
    : Array.isArray(obj.results) ? obj.results
    : Array.isArray(obj.items) ? obj.items
    : null;
  const page = obj.pagination ?? obj.meta?.pagination ?? obj.meta ?? null;
  // Never log roster or participant names, event details or raw JSON.
  const ids = (data ?? []).slice(0, 5).map(x => x?.id ?? x?.match_id ?? x?.match?.id ?? null);
  return {
    topLevelFields: keys,
    firstEntryFields: data?.length ? Object.keys(data[0] ?? {}).slice(0, 24) : [],
    listCountOnFirstPage: data?.length ?? null,
    pagination: page && typeof page === "object" ? {
      total: page.total ?? page.total_items ?? null,
      last_page: page.last_page ?? page.total_pages ?? null,
      current_page: page.current_page ?? page.page ?? null
    } : null,
    sampleNumericIds: ids.filter(v => typeof v === "number" || /^\\d+$/.test(String(v ?? ""))),
  };
}

let scheduleUsable = false;
let fullSeasonComplete = false;
let eventEndpointUsable = false;
let observedPastEvents = 0;
for (const probe of probes) {
  const url = new URL(probe.path, base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Referer: "https://www.handball.net/club/5601",
        "User-Agent": "Spielanalyse-Endpoint-Probe/1.0"
      }
    });
    const ct = res.headers.get("content-type") || "";
    let parsed = null;
    let parseError = null;
    if (ct.includes("json") && res.ok) {
      try {
        const body = await res.text();
        if (body.length > 500000) throw new Error("response exceeds safety limit");
        parsed = JSON.parse(body);
      } catch (e) { parseError = e.message; }
    } else {
      await res.body?.cancel();
    }
    const shape = parsed ? safeShape(parsed) : null;
    console.log(JSON.stringify({
      probe: probe.name,
      urlPath: url.pathname,
      httpStatus: res.status,
      contentType: ct.split(";")[0],
      redirect: res.status >= 300 && res.status < 400,
      ...shape,
      parseError
    }));
    if ((probe.name === "club-matches" || probe.name === "team-matches")
      && res.ok && shape?.listCountOnFirstPage > 0) scheduleUsable = true;
    if (probe.name === "full-team-schedule" && res.ok && Array.isArray(parsed?.data)) {
      const ids = parsed.data.map(match => String(match?.id ?? match?.match_id ?? ""));
      const expected = Number(parsed.pagination?.total);
      fullSeasonComplete = expected > 0 && expected === ids.length
        && ids.every(Boolean) && new Set(ids).size === ids.length;
      console.log(JSON.stringify({
        probe: "full-team-verification", expected, received: ids.length,
        uniqueIds: new Set(ids).size,
        includesReferenceMatch378112: ids.includes("378112"),
        allMatchesCovered: fullSeasonComplete
      }));
    }
    if (probe.name.startsWith("earlier-match-events-") && res.ok && Array.isArray(parsed?.data)) {
      observedPastEvents += parsed.data.length;
      console.log(JSON.stringify({
        probe: "past-match-events-verification", matchId: probe.name.split("-").at(-1),
        eventCount: parsed.data.length
      }));
    }
    if (probe.name === "known-match-events" && res.ok && parsed) {
      eventEndpointUsable = Array.isArray(parsed.data);
      console.log(JSON.stringify({
        probe: "known-match-events-verification",
        eventsCount: Array.isArray(parsed.data) ? parsed.data.length : null,
        eventEndpointUsable
      }));
    }
  } catch (err) {
    console.log(JSON.stringify({ probe: probe.name, error: err?.name === "AbortError" ? "request timed out" : String(err?.message ?? err) }));
  } finally {
    clearTimeout(timeout);
  }
}
if (!scheduleUsable || !fullSeasonComplete || !eventEndpointUsable) {
  console.error("RESULT: Schedule import validation incomplete; do not assume a reliable full-season importer. Existing game files were not touched.");
  process.exitCode = 2;
} else {
  console.log("RESULT: Whole team match list and reference-match events endpoint both verified. Earlier-match events found: " + observedPastEvents + ". This is an endpoint-availability test, not a usage license.");
}
