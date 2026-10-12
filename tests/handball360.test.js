import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  handballNetMatchId,
  hbPrepare,
  hbEventType,
  hbNameKey
} from "../src/handball360.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(
  fs.readFileSync(path.join(here, "fixtures", "handball360_378107.json"), "utf8")
);

describe("Handball360 pure module", () => {
  test("extracts match ids from ids and URLs", () => {
    expect(handballNetMatchId("378107")).toBe("378107");
    expect(handballNetMatchId("https://www.handball.net/match/378107")).toBe("378107");
    expect(handballNetMatchId("invalid")).toBeNull();
  });

  test("normalizes names for matching", () => {
    expect(hbNameKey("Täubrich, Jespe Mats")).toBe("taubrich jespe mats");
  });

  test("maps official event types", () => {
    expect(hbEventType({ event_type: { is_goal: true, name: "Tor" } })).toBe("goal");
    expect(
      hbEventType({
        event_type: {
          is_goal: false,
          name: "Zwei Minuten",
          sanction_class: "suspension"
        }
      })
    ).toBe("2min");
  });

  test("prepares the recorded Handball360 fixture", () => {
    const prepared = hbPrepare(payload);

    expect(prepared.matchId).toBe("378107");
    expect(prepared.duration).toBe(25);
    expect(prepared.teams).toEqual({
      home: "HSG Herzhorn/Kollmar/Neuendorf",
      away: "MEIN TEAM"
    });
    expect(prepared.normalized.filter((event) => event.type === "goal")).toHaveLength(61);

    const lastGoal = [...prepared.normalized]
      .reverse()
      .find((event) => event.type === "goal");
    expect([lastGoal.scoreH, lastGoal.scoreA]).toEqual([26, 35]);
  });

  test("uses an explicit fallback match id without DOM access", () => {
    const clone = structuredClone(payload);
    delete clone.match_id;
    clone.match.data[0].id = null;

    expect(hbPrepare(clone, { fallbackMatchId: "999999" }).matchId).toBe("999999");
  });
  test("retains lineup jersey numbers in rosters and event player numbers", () => {
    const clone = structuredClone(payload);
    const first = clone.events.data.find(e => e.player && e.is_home !== undefined);
    expect(first).toBeDefined();
    const playerId = first.player.id;
    const side = first.is_home ? "local" : "visitor";
    clone.lineups = { data: { [side]: { players: [{ number: 17, player: first.player }] } } };
    const result = hbPrepare(clone);
    expect(result.lineupNumbers).toBe(1);
    expect((first.is_home ? result.homePlayers : result.awayPlayers)[0].nr).toBe(17);
    expect(result.normalized.find(e => String(e.pId) === String(playerId))?.pNr).toBe(17);
  });

  test("an empty lineup never fabricates player numbers", () => {
    const result = hbPrepare(payload);
    expect(result.lineupNumbers).toBe(0);
  });

  test("imports a future fixture with metadata and no events", () => {
    const upcoming = {
      match_id: "378112",
      match: { data: [{
        id: 378112,
        local: { name: "TSV Kronshagen" },
        visitor: { name: "Gastmannschaft" },
        duration: { minutes_per_period: 25 },
        date: "2026-10-24T15:00:00"
      }] },
      events: { data: [] }
    };
    const result = hbPrepare(upcoming);
    expect(result.matchId).toBe("378112");
    expect(result.teams).toEqual({ home: "TSV Kronshagen", away: "Gastmannschaft" });
    expect(result.events).toEqual([]);
    expect(result.normalized).toEqual([]);
    expect(result.duration).toBe(25);
  });

  test("rejects a response without metadata or events", () => {
    expect(() => hbPrepare({ events: { data: [] } })).toThrow(/Weder Spieldaten noch/);
  });

  test("extracts both club logos and stable IDs from a future match", () => {
    const upcoming={
      match_id:"378112",
      match:{data:[{
        id:378112,
        local:{id:85814,name:"TSV KRONSHAGEN",club:{id:"04ea29f",logo:"https://handball360.isquad.de/tsv.jpg"}},
        visitor:{id:85816,name:"SG FLENSBURG-HANDEWITT II",club:{id:"1jxzqma",logo:"https://handball360.isquad.de/sg.jpg"}},
        duration:{minutes_per_period:25}
      }]},
      events:{data:[]},lineups:{data:[]}
    };
    const result=hbPrepare(upcoming);
    expect(result.normalized).toEqual([]);
    expect(result.clubLogos).toEqual({
      home:{teamId:"85814",clubId:"04ea29f",logoUrl:"https://handball360.isquad.de/tsv.jpg"},
      away:{teamId:"85816",clubId:"1jxzqma",logoUrl:"https://handball360.isquad.de/sg.jpg"}
    });
  });

});
