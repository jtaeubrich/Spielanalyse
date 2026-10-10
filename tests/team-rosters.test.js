import { describe, expect, test } from "vitest";
import {
  normalizeTeamName,
  rosterHandballIds,
  sharedHandballIds,
  findKnownTeamRecord,
  mergeAliases,
  renameKnownTeamRecord,
  teamRosterStats,
  sameNamedDifferentIds
} from "../src/team-rosters.js";

const player = (id, nr = 1, name = "Max Muster") => {
  const [vorname, ...rest] = name.split(" ");
  return {
    id: "local-" + (id || nr),
    nr,
    vorname,
    nachname: rest.join(" "),
    handballNetId: id,
    isTW: false
  };
};

describe("known team roster identity", () => {
  test("normalizes team names", () => {
    expect(normalizeTeamName("  TSV   Beispiel ")).toBe("tsv beispiel");
  });

  test("counts shared Handball360 IDs", () => {
    expect(sharedHandballIds(
      [player("a"), player("b"), player("c")],
      [player("b"), player("c"), player("d")]
    )).toBe(2);
    expect([...rosterHandballIds([player("A")])]).toEqual(["a"]);
  });

  test("prefers exact team name matching", () => {
    const record = {
      id: "stable-team",
      teamName: "TSV Beispiel",
      aliases: [],
      players: [player("a"), player("b")]
    };
    const result = findKnownTeamRecord([record], {
      teamName: " tsv   beispiel ",
      players: []
    });
    expect(result?.record.id).toBe("stable-team");
    expect(result?.reason).toBe("name");
  });

  test("recognizes a renamed team by unique Handball360 roster overlap", () => {
    const record = {
      id: "stable-team",
      teamName: "Alter Vereinsname",
      aliases: [],
      players: [player("a"), player("b"), player("c")]
    };
    const result = findKnownTeamRecord([record], {
      teamName: "Neuer Vereinsname",
      players: [player("a", 23), player("b", 42)]
    });
    expect(result?.record.id).toBe("stable-team");
    expect(result?.reason).toBe("h360-overlap");
    expect(result?.sharedIds).toBe(2);
  });

  test("does not guess when Handball360 overlap is tied", () => {
    const incoming = [player("a"), player("b")];
    const records = [
      { id: "one", teamName: "One", players: [player("a"), player("b")] },
      { id: "two", teamName: "Two", players: [player("a"), player("b")] }
    ];
    expect(findKnownTeamRecord(records, { teamName: "Other", players: incoming })).toBeNull();
  });

  test("renaming keeps stable record id and old name as alias", () => {
    const record = {
      id: "stable-team",
      teamName: "Alt",
      aliases: [],
      players: []
    };
    const renamed = renameKnownTeamRecord(record, "Neu");
    expect(renamed.id).toBe("stable-team");
    expect(renamed.teamName).toBe("Neu");
    expect(renamed.aliases).toContain("Alt");
  });

  test("mergeAliases remembers alternate observed team names", () => {
    const aliases = mergeAliases(
      { teamName: "Alt", aliases: ["Früher"] },
      "Neu"
    );
    expect(aliases).toEqual(expect.arrayContaining(["Früher", "Neu"]));
  });

  test("summarizes roster metadata including conflicts", () => {
    const record = {
      players: [player("a"), { ...player("b"), isTW: true }, player("")],
      conflicts: [{ type: "x" }]
    };
    expect(teamRosterStats(record)).toEqual({
      players: 3,
      h360: 2,
      keepers: 1,
      conflicts: 1
    });
  });

  test("finds duplicate names bound to different Handball360 IDs", () => {
    const conflicts = sameNamedDifferentIds([
      player("hb-a", 8, "Max Muster"),
      player("hb-b", 9, "Max Muster")
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].handballNetIds.sort()).toEqual(["hb-a", "hb-b"]);
  });
});
