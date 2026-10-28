import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSeasonPlayerKeyResolver,
  createAliasedSeasonPlayerKeyResolver,
  seasonPlayerAggregate,
  seasonEventMatchesPlayer,
  setSeasonPlayerAlias,
  resolveSeasonPlayerAliasKey,
  normalizeSeasonPlayerAliases
} from "../src/season-core.js";
import { normalizeSeasonArchive } from "../src/season-files.js";
import { SEASON_FORMAT, SEASON_VERSION } from "../src/storage.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(
  path.join(here, "fixtures", "hkn_reference.json"), "utf8"
));

function match(id, mutate = () => {}) {
  const state = structuredClone(fixture);
  mutate(state[state.ownTeam].players[0], state);
  return {
    id, state, ownTeam: state.ownTeam,
    opponentTeam: state.ownTeam === "home" ? "away" : "home"
  };
}
const label = p => [p.vorname, p.nachname].filter(Boolean).join(" ");

describe("safe season player merge", () => {
  test("automatically recognizes the exact same name with changing/unknown shirt number", () => {
    const first = match("one", p => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = "";
      p.handballNetId = "";
    });
    const second = match("two", p => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = 17;
      p.handballNetId = "";
    });
    const playerOne = first.state[first.ownTeam].players[0];
    const playerTwo = second.state[second.ownTeam].players[0];
    const resolve = createSeasonPlayerKeyResolver([first, second]);
    expect(resolve(playerOne)).toBe("name:beispiel|mia");
    expect(resolve(playerOne)).toBe(resolve(playerTwo));
    const rows = seasonPlayerAggregate([first, second], { playerKey: resolve, playerLabel: label });
    expect(rows.filter(p => p.key === resolve(playerOne))).toHaveLength(1);
    expect(rows.find(p => p.key === resolve(playerOne)).games.size).toBe(2);
  });

  test("collapses an unnamed-number duplicate with the same full name in one match", () => {
    const first = match("same", (p,state) => {
      p.vorname="Jan-Mika";p.nachname="Langhein";p.nr=null;p.handballNetId="";
      state[state.ownTeam].players.push({...p,id:"known-number",nr:1});
    });
    const players=first.state[first.ownTeam].players;
    const resolve=createSeasonPlayerKeyResolver([first]);
    expect(resolve(players[0])).toEqual(resolve(players.at(-1)));
    const rows=seasonPlayerAggregate([first],{playerKey:resolve,playerLabel:label});
    expect(rows.filter(row=>row.key===resolve(players[0]))).toHaveLength(1);
    expect(first.state[first.ownTeam].players).toHaveLength(fixture[fixture.ownTeam].players.length+1);
  });

  test("preserves distinct official identities even with one numberless duplicate", () => {
    const first=match("same",(p,state)=>{
      p.vorname="Mia";p.nachname="Beispiel";p.nr=null;p.handballNetId="A";
      state[state.ownTeam].players.push({...p,id:"other",nr:17,handballNetId:"B"});
    });
    const players=first.state[first.ownTeam].players;
    const resolve=createSeasonPlayerKeyResolver([first]);
    expect(resolve(players[0])).toBe("h360:a");
    expect(resolve(players.at(-1))).toBe("h360:b");
  });

  test("ambiguous repeated names inside a game are never silently merged", () => {
    const first = match("one", (p, state) => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = 6; p.handballNetId = "";
      state[state.ownTeam].players.push({
        ...p, id: "other-person", nr: 17
      });
    });
    const players = first.state[first.ownTeam].players;
    const resolve = createSeasonPlayerKeyResolver([first]);
    expect(resolve(players[0])).toBe("legacy:beispiel|mia|6");
    expect(resolve(players.at(-1))).toBe("legacy:beispiel|mia|17");
  });

  test("conflicting Handball360 IDs are kept separate", () => {
    const first = match("one", p => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = 6; p.handballNetId = "A";
    });
    const second = match("two", p => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = 17; p.handballNetId = "B";
    });
    const third = match("three", p => {
      p.vorname = "Mia"; p.nachname = "Beispiel"; p.nr = 99; p.handballNetId = "";
    });
    const resolve = createSeasonPlayerKeyResolver([first, second, third]);
    expect(resolve(first.state[first.ownTeam].players[0])).toBe("h360:a");
    expect(resolve(second.state[second.ownTeam].players[0])).toBe("h360:b");
    expect(resolve(third.state[third.ownTeam].players[0])).toBe("legacy:beispiel|mia|99");
  });

  test("manual Pohl/Pöhl alias combines records, then removing it restores separation", () => {
    const first = match("one", p => {
      p.vorname = "Laurids"; p.nachname = "Pohl"; p.nr = 22; p.handballNetId = "";
    });
    const second = match("two", p => {
      p.vorname = "Laurids"; p.nachname = "Pöhl"; p.nr = 22; p.handballNetId = "";
    });
    const games = [first, second];
    const raw = createSeasonPlayerKeyResolver(games);
    const source = raw(first.state[first.ownTeam].players[0]);
    const target = raw(second.state[second.ownTeam].players[0]);
    expect(source).not.toBe(target);
    const mappings = setSeasonPlayerAlias({}, source, target);
    const merged = createAliasedSeasonPlayerKeyResolver(games, mappings);
    expect(merged(first.state[first.ownTeam].players[0])).toBe(target);
    expect(merged(second.state[second.ownTeam].players[0])).toBe(target);

    const rows = seasonPlayerAggregate(games, { playerKey: merged, playerLabel: label });
    const combined = rows.filter(row => row.key === target);
    expect(combined).toHaveLength(1);
    expect(combined[0].games.size).toBe(2);

    // All events remain in the original game states.
    expect(games[0].state.events).toEqual(fixture.events);
    expect(games[1].state.events).toEqual(fixture.events);

    delete mappings[source];
    const reverted = createAliasedSeasonPlayerKeyResolver(games, mappings);
    const split = seasonPlayerAggregate(games, { playerKey: reverted, playerLabel: label });
    expect(split.find(row => row.key === source).games.size).toBe(1);
    expect(split.find(row => row.key === target).games.size).toBe(1);
  });

  test("manual mappings reject cycles, preserve target and support safe chained lookups", () => {
    const first = "name:beispiel|mia";
    const second = "name:beispiel|anna";
    const third = "h360:stable-person";
    let mappings = setSeasonPlayerAlias({}, first, second);
    mappings = setSeasonPlayerAlias(mappings, second, third);
    expect(resolveSeasonPlayerAliasKey(first, mappings)).toBe(third);
    expect(() => setSeasonPlayerAlias(mappings, third, first)).toThrow();
    expect(normalizeSeasonPlayerAliases({ [first]: second, "_unsafe": third })).toEqual({
      [first]: second
    });
  });

  test("saves manual aliases in the season archive without changing match files", () => {
    const data = {
      format: SEASON_FORMAT, version: SEASON_VERSION,
      name: "Saison",
      games: [{ fileName: "hkn.json", selected: true, data: fixture }],
      playerAliases: { "name:pohl|laurids": "name:pöhl|laurids" }
    };
    const restored = normalizeSeasonArchive(data, fixture.away.name);
    expect(restored.playerAliases).toEqual(data.playerAliases);
    expect(restored.games).toHaveLength(1);
    expect(normalizeSeasonArchive({ ...data, playerAliases: undefined }).playerAliases).toEqual({});
  });
});
