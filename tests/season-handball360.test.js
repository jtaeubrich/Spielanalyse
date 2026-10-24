import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseHandball360TeamId,
  validateHandball360SeasonSchedule,
  seasonMatchIdentity,
  seasonScheduleStatus,
  buildHandball360SeasonGame,
  appendNewHandball360SeasonGames
} from "../src/season-handball360.js";
import {
  validateTeamScheduleRequest,
  summarizeHandball360Match,
  fetchHandball360TeamSchedule
} from "../cloud-run-proxy/schedule.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(fs.readFileSync(path.join(here, "fixtures", "handball360_378107.json"), "utf8"));
const raw = structuredClone(ref);
raw.match.data[0].local.id = 200;
raw.match.data[0].visitor.id = 85814;
raw.match.data[0].date = "2026-09-05T16:00:00Z";
const m = raw.match.data[0];
const summary = {
  id: "378107", date: m.date, status: "finished",
  local: { id: "200", name: m.local.name },
  visitor: { id: "85814", name: m.visitor.name }
};

describe("Handball360 team season import", () => {
  test("accepts only exact numeric IDs or the intended HTTPS team URL", () => {
    expect(parseHandball360TeamId("85814")).toBe("85814");
    expect(parseHandball360TeamId("https://www.handball.net/team/85814")).toBe("85814");
    expect(parseHandball360TeamId("https://handball.net/team/85814/")).toBe("85814");
    expect(parseHandball360TeamId("https://evil.example/team/85814")).toBeNull();
    expect(parseHandball360TeamId("https://www.handball.net/match/378107")).toBeNull();
    expect(parseHandball360TeamId("garbage")).toBeNull();
  });

  test("rejects missing or foreign fixtures and duplicate match IDs", () => {
    expect(validateHandball360SeasonSchedule({
      teamId: "85814", total: 1, matches: [summary]
    }, "85814")).toHaveLength(1);
    expect(() => validateHandball360SeasonSchedule({
      teamId: "85814", total: 1, matches: [summary, summary]
    }, "85814")).toThrow();
    expect(() => validateHandball360SeasonSchedule({
      teamId: "85814", total: 1,
      matches: [{ ...summary, visitor: { id: "99", name: "Fremd" } }]
    }, "85814")).toThrow();
  });

  test("converts a known real match payload to an independent season game", () => {
    const game = buildHandball360SeasonGame(raw, "378107", "85814", summary);
    expect(game.state.officialSource.matchId).toBe("378107");
    expect(game.ownTeam).toBe("away");
    expect(game.fileName).toBe("handball360_378107.json");
    expect(game.state.events.length).toBeGreaterThan(1);
    expect(game.state.home.name).toBe(m.local.name);
    expect(game.state.away.name).toBe(m.visitor.name);
    expect(game.state.isVideoscoutingFile).toBe(true);
    expect(game.state.officialData).toBeUndefined(); // no huge raw payload
    expect(game.state.events.some(e => e.type === "goal")).toBe(true);
    expect(seasonMatchIdentity(game)).toBe("378107");
    expect(() => buildHandball360SeasonGame(raw, "378107", "99999", summary)).toThrow();
    expect(() => buildHandball360SeasonGame(raw, "999999", "85814", summary)).toThrow();
  });

  test("never overwrites existing scouting events, video data or comment fields", () => {
    const existing = buildHandball360SeasonGame(raw, "378107", "85814", summary);
    existing.state.events[0].comment = "Meine private Analyse";
    existing.state.video = { youtubeUrl: "https://www.youtube.com/watch?v=test" };
    const before = structuredClone(existing.state);
    const incoming = buildHandball360SeasonGame(raw, "378107", "85814", summary);
    const result = appendNewHandball360SeasonGames([existing], [incoming]);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].state).toEqual(before);
  });

  test("identifies existing games and protects manually analyzed possible duplicates", () => {
    const current = buildHandball360SeasonGame(raw, "378107", "85814", summary);
    expect(seasonScheduleStatus(summary, [current])).toBe("existing");
    const withoutId = structuredClone(current);
    delete withoutId.state.officialSource;
    withoutId.fileName = "manuelle_analyse.json";
    expect(seasonScheduleStatus(summary, [withoutId])).toBe("possible-existing");
    expect(seasonScheduleStatus(summary, [], new Date("2026-09-06T00:00:00Z"))).toBe("available");
    expect(seasonScheduleStatus(summary, [], new Date("2026-09-01T00:00:00Z"))).toBe("upcoming");
  });

  test("validates bounded timeframes and complete multi-page retrieval", async () => {
    expect(validateTeamScheduleRequest("85814", "2026-07-01", "2027-06-30").teamId).toBe("85814");
    expect(() => validateTeamScheduleRequest("abc", "2026-07-01", "2027-06-30")).toThrow();
    expect(() => validateTeamScheduleRequest("85814", "2026-02-30", "2027-06-30")).toThrow();
    expect(() => validateTeamScheduleRequest("85814", "2026-01-01", "2027-12-31")).toThrow();
    const requestPaths = [];
    const getPage = async url => {
      requestPaths.push(url);
      const page = Number(new URL(url, "https://www.handball.net").searchParams.get("page"));
      return {
        data: page === 1
          ? [{ ...m, id: 378107 }]
          : [{ ...m, id: 378108, date: "2026-09-06T16:00:00Z" }],
        pagination: { total: 2, last_page: 2, current_page: page }
      };
    };
    const result = await fetchHandball360TeamSchedule("85814","2026-07-01","2027-06-30",getPage);
    expect(result.total).toBe(2);
    expect(result.matches.map(x=>x.id)).toEqual(["378107","378108"]);
    expect(requestPaths).toHaveLength(2);
    const bad = () => fetchHandball360TeamSchedule("85814", "2026-07-01", "2027-06-30",
      async () => ({ data: [{ ...m, id: 378107 }], pagination: {total: 2,last_page: 1} }));
    await expect(bad()).rejects.toThrow(/unvollstaendig/);
  });

  test("summarizes upstream matches without including lineups or private event fields", () => {
    const match = summarizeHandball360Match({ ...m, events: [{ note: "private" }], id: 378107 });
    expect(match).not.toHaveProperty("events");
    expect(match).toHaveProperty("local.id", "200");
    expect(match).toHaveProperty("visitor.id", "85814");
  });
});
