import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseHandball360TeamId,
  validateHandball360SeasonSchedule,
  seasonMatchIdentity,
  seasonMatchUrl,
  syncSeasonFixtureSchedule,
  seasonScheduleStatus,
  buildHandball360SeasonGame,
  appendNewHandball360SeasonGames,
  officialSeasonLogoEntries,
  mergeOfficialSeasonLogoRecord
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
    expect(seasonMatchUrl(game)).toBe("https://www.handball.net/match/378107");
    expect(game.state.officialSource.matchUrl).toBe(seasonMatchUrl(game));
    expect(() => buildHandball360SeasonGame(raw, "378107", "99999", summary)).toThrow();
    expect(() => buildHandball360SeasonGame(raw, "999999", "85814", summary)).toThrow();
  });


  test("constructs links for previously imported seasons without persisting a second copy",()=>{
    const legacy={
      fileName:"handball360_378112.json",
      state:{officialSource:{provider:"handball.net",matchId:"378112"}}
    };
    expect(seasonMatchUrl(legacy)).toBe("https://www.handball.net/match/378112");
    expect(seasonMatchUrl({fileName:"handball360_378114.json",state:{home:{},away:{}}}))
      .toBe("https://www.handball.net/match/378114");
    expect(seasonMatchUrl({fileName:"manual.json",state:{home:{},away:{}}})).toBe("");
    expect(seasonMatchUrl({state:{officialSource:{matchId:"https://bad.example/"}}})).toBe("");
  });


  test("synchronises postponed matches without changing scouting, video or goalkeeper markings",()=>{
    const game=buildHandball360SeasonGame(raw,"378107","85814",summary);
    game.state.events[0].comment="Eigene Wurfanalyse";
    game.state.home.players[0].isTW=true;
    game.state.home.players[0].isTWOverride=true;
    game.state.video.youtubeUrl="https://www.youtube.com/watch?v=personal";
    game.state.gameTimeOfDay="18:00"; // previous official start: 18:00 Berlin
    const changed={...summary,date:"2026-11-07T15:00:00Z"};
    const result=syncSeasonFixtureSchedule(game,changed,"2026-10-28T00:00:00Z");
    expect(result.changed).toBe(true);
    expect(result.game.state.gameDate).toBe("2026-11-07");
    expect(result.game.state.gameTimeOfDay).toBe("16:00");
    expect(result.game.state.officialSource.matchDate).toBe(changed.date);
    expect(result.game.state.events).toEqual(game.state.events);
    expect(result.game.state.home.players).toEqual(game.state.home.players);
    expect(result.game.state.video).toEqual(game.state.video);
    expect(result.game.id).toBe(game.id);
    expect(result.game.fileName).toBe(game.fileName);
    expect(() => syncSeasonFixtureSchedule(game,{...changed,id:"999999"})).toThrow(/Match-ID/);
  });

  test("preserves manually set match preparation date/time when schedule changes",()=>{
    const game=buildHandball360SeasonGame(raw,"378107","85814",summary);
    game.state.gameDate="2026-11-12";
    game.state.gameTimeOfDay="19:30";
    game.state.gameName="Meine selbst benannte Partie";
    const updated=syncSeasonFixtureSchedule(game,{...summary,date:"2026-11-07T15:00:00Z"});
    expect(updated.manualDatePreserved).toBe(true);
    expect(updated.manualTimePreserved).toBe(true);
    expect(updated.game.state.gameDate).toBe("2026-11-12");
    expect(updated.game.state.gameTimeOfDay).toBe("19:30");
    expect(updated.game.state.gameName).toBe("Meine selbst benannte Partie");
    expect(updated.game.state.officialSource.matchDate).toBe("2026-11-07T15:00:00Z");
  });

  test("keeps official club logos on season game without copying image data into games", () => {
    const fixture=structuredClone(raw);
    fixture.match.data[0].local.club={id:"club-200",logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/square_home.jpg"};
    fixture.match.data[0].visitor.club={id:"club-85814",logo:"https://handball360.isquad.de/images/afiliacion_clubs/5512/square_away.jpg"};
    const game=buildHandball360SeasonGame(fixture,"378107","85814",summary);
    const entries=officialSeasonLogoEntries(game);
    expect(entries).toHaveLength(2);
    expect(entries.map(e=>e.teamName)).toEqual([m.local.name,m.visitor.name]);
    expect(entries[0].logoUrl).toContain("square_home.jpg");
    expect(entries[1].teamId).toBe("85814");
    expect(game.state.officialSource.clubLogos.away.clubId).toBe("club-85814");
    expect(game.state.officialData).toBeUndefined();
    const manual={id:"custom",teamName:m.local.name,players:[{id:"p1",isTW:true}],
      logoDataUrl:"data:image/png;base64,bWFudWFs",logoUrl:"https://my.example/logo.png"};
    const retained=mergeOfficialSeasonLogoRecord(manual,entries[0]);
    expect(retained.logoDataUrl).toBe(manual.logoDataUrl);
    expect(retained.logoUrl).toBe(manual.logoUrl);
    expect(retained.players).toEqual(manual.players);
    const blank={id:"new",teamName:m.visitor.name,players:[]};
    const filled=mergeOfficialSeasonLogoRecord(blank,entries[1]);
    expect(filled.logoUrl).toBe(entries[1].logoUrl);
    expect(filled.handball360TeamId).toBe("85814");
    expect(filled.handball360ClubId).toBe("club-85814");
    expect(officialSeasonLogoEntries({state:{home:{name:"Test"},officialSource:{clubLogos:{home:{logoUrl:"http://evil.test/logo"}}}}})).toEqual([]);
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
