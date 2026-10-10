import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(here, "fixtures", name), "utf8"));

function score(events) {
  return events.reduce(
    ([home, away], event) =>
      event.type === "goal"
        ? event.team === "home"
          ? [home + 1, away]
          : event.team === "away"
            ? [home, away + 1]
            : [home, away]
        : [home, away],
    [0, 0]
  );
}

describe("HKN reference game", () => {
  const game = fixture("hkn_reference.json");

  test("keeps the known game structure stable", () => {
    expect(game.ownTeam).toBe("away");
    expect(game.timer.duration).toBe(25);
    expect(game.home.players).toHaveLength(15);
    expect(game.away.players).toHaveLength(14);
    expect(game.events).toHaveLength(136);
  });

  test("keeps the final score and key event counts stable", () => {
    expect(score(game.events)).toEqual([26, 35]);

    const counts = game.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    expect(counts.goal).toBe(61);
    expect(counts.save).toBe(19);
    expect(counts.miss).toBe(17);
    expect(counts.error).toBe(25);
    expect(counts["2min"]).toBe(5);
    expect(counts.timeout).toBe(2);
    expect(counts.yellow).toBe(1);
  });

  test("contains the expected goalkeeper flags", () => {
    expect(game.home.players.filter((p) => p.isTW)).toHaveLength(2);
    expect(game.away.players.filter((p) => p.isTW)).toHaveLength(3);
  });
});

describe("Handball360 reference payload", () => {
  const payload = fixture("handball360_378107.json");
  const events = payload.events.data;

  test("keeps the upstream wrapper shape stable", () => {
    expect(payload.match_id).toBe("378107");
    expect(payload.match.data[0].duration.minutes_per_period).toBe(25);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(50);
  });

  test("keeps the official final score stable", () => {
    const lastScore = [...events].reverse().find((event) => event.score)?.score;
    expect(lastScore).toEqual({ local: 26, visitor: 35 });
  });

  test("keeps stable Handball360 player ids", () => {
    const jespe = events.find(
      (event) =>
        event.player?.first_name === "Jespe Mats" &&
        event.player?.last_name === "Täubrich"
    );
    const liebich = events.find(
      (event) =>
        event.player?.first_name === "Jakob Leo" &&
        event.player?.last_name === "Liebich"
    );

    expect(jespe?.player?.id).toBe("0uw6qtm");
    expect(liebich?.player?.id).toBe("01di90c");
  });
});
