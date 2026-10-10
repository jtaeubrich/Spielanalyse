import { describe, expect, test } from "vitest";
import {
  normalizeSceneWindow,
  clipWindowAt,
  buildClipEntry,
  buildClipEntries,
  totalClipDuration,
  eventActiveInWindow,
  nearestActiveClip
} from "../src/clip-core.js";

describe("clip core", () => {
  test("normalizes negative and invalid scene windows", () => {
    expect(normalizeSceneWindow(-2, "x")).toEqual({ preRoll: 0, postRoll: 0 });
    expect(normalizeSceneWindow(4, 2)).toEqual({ preRoll: 4, postRoll: 2 });
  });

  test("builds a scene window around an event", () => {
    expect(clipWindowAt(10, { preRoll: 4, postRoll: 2 })).toEqual({
      at: 10,
      start: 6,
      end: 12,
      duration: 6,
      preRoll: 4,
      postRoll: 2
    });
  });

  test("clamps a scene at the start and end of a local video", () => {
    expect(clipWindowAt(2, { preRoll: 4, postRoll: 2, duration: 100 })).toMatchObject({
      start: 0,
      end: 4
    });
    expect(clipWindowAt(99, { preRoll: 4, postRoll: 5, duration: 100 })).toMatchObject({
      start: 95,
      end: 100
    });
  });

  test("rejects invalid clip positions", () => {
    expect(clipWindowAt(null)).toBeNull();
    expect(clipWindowAt("")).toBeNull();
    expect(clipWindowAt(101, {duration: 100})).toBeNull();
    expect(normalizeSceneWindow(Infinity, Infinity)).toEqual({preRoll: 0, postRoll: 0});
    expect(clipWindowAt(NaN)).toBeNull();
    expect(clipWindowAt(-1)).toBeNull();
    expect(buildClipEntry({ at: 0, preRoll: 0, postRoll: 0 })).toBeNull();
  });

  test("builds selected clip entries and preserves event indexes", () => {
    const entries = [
      { event: { id: "a" }, index: 2 },
      { event: { id: "b" }, index: 5 }
    ];
    const times = new Map([["a", 10], ["b", 20]]);

    const clips = buildClipEntries(entries, {
      resolveVideoTime: (event) => times.get(event.id),
      preRoll: 3,
      postRoll: 1,
      selectedIndexes: new Set([5])
    });

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      index: 5,
      at: 20,
      start: 17,
      end: 21
    });
  });

  test("drops events without a valid synchronized video time", () => {
    const clips = buildClipEntries(
      [
        { event: { id: "ok" }, index: 0 },
        { event: { id: "missing" }, index: 1 }
      ],
      {
        resolveVideoTime: (event) => event.id === "ok" ? 15 : NaN,
        preRoll: 4,
        postRoll: 2
      }
    );

    expect(clips).toHaveLength(1);
    expect(clips[0].event.id).toBe("ok");
  });

  test("sums clip duration", () => {
    expect(totalClipDuration([
      { start: 1, end: 5 },
      { start: 10, end: 13 }
    ])).toBe(7);
  });

  test("identifies the nearest active event in overlapping windows", () => {
    const entries = [
      { index: 1, video: 10 },
      { index: 2, video: 12 }
    ];

    expect(eventActiveInWindow(11.4, 10, { preRoll: 2, postRoll: 2 })).toBe(true);
    expect(nearestActiveClip(entries, 11.4, { preRoll: 2, postRoll: 2 }).index).toBe(2);
  });
});
