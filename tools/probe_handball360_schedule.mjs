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
    name: "known-match-control",
    path: "/api/new/matches?match_id=378112",
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
  } catch (err) {
    console.log(JSON.stringify({ probe: probe.name, error: err?.name === "AbortError" ? "request timed out" : String(err?.message ?? err) }));
  } finally {
    clearTimeout(timeout);
  }
}
if (!scheduleUsable) {
  console.error("RESULT: No usable team/club match-list endpoint confirmed. This does NOT change the working single-match import.");
  process.exitCode = 2;
} else {
  console.log("RESULT: Match-list endpoint returned a non-empty page. Schema and team filtering still require follow-up verification.");
}
