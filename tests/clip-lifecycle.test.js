import { describe, expect, test, vi } from "vitest";
import { createClipProgress, restoreClipPlayback } from "../src/clip-recorder.js";

describe("clip export lifecycle helpers", () => {
  test("tracks completed scenes and bounds progress", () => {
    const first = { start: 2, end: 6 }, second = { start: 10, end: 16 };
    const progress = createClipProgress([first, second]);
    expect(progress.percent()).toBe(0);
    expect(progress.percent(2)).toBe(20);
    progress.complete(first);
    expect(progress.percent(3)).toBe(70);
    progress.complete(second);
    expect(progress.percent()).toBe(100);
    expect(progress.percent(20)).toBe(100);
  });

  test("zero-duration clips produce finite progress", () => {
    expect(createClipProgress([{ start: 4, end: 4 }]).percent()).toBe(100);
  });

  test("restores playback and selection even when seeking rejects", async () => {
    const video = { playbackRate: 1 };
    const seek = vi.fn().mockRejectedValue(Error("seek failed"));
    const setIndex = vi.fn(), refresh = vi.fn();
    await restoreClipPlayback({ video, time: 18, rate: 1.5, index: 3, seek, setIndex, refresh });
    expect(video.playbackRate).toBe(1.5);
    expect(seek).toHaveBeenCalledWith(video, 18);
    expect(setIndex).toHaveBeenCalledWith(3);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
