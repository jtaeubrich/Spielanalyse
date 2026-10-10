import { describe, test, expect, vi } from "vitest";
import { runClipScenes, stopClipRecording } from "../src/clip-recorder.js";

function fixture() {
  const video = { currentTime: 0, ended: false, pause: vi.fn(), play: vi.fn().mockResolvedValue() };
  const seek = vi.fn(async (_, at) => { video.currentTime = at; });
  const draw = vi.fn();
  const setActiveIndex = vi.fn();
  const onProgress = vi.fn();
  const requestFrame = callback => { video.currentTime += 1; callback(); };
  return { video, seek, draw, setActiveIndex, onProgress, requestFrame };
}

describe("clip export scene orchestration", () => {
  test("exports scenes sequentially and reports bounded progress", async () => {
    const f = fixture();
    await runClipScenes({ ...f, entries: [{ index: 1, start: 2, end: 4 }, { index: 2, start: 10, end: 12 }], isCancelled: () => false });
    expect(f.seek.mock.calls.map(call => call[1])).toEqual([2, 10]);
    expect(f.setActiveIndex.mock.calls.map(call => call[0])).toEqual([1, 2]);
    expect(f.video.play).toHaveBeenCalledTimes(2);
    expect(f.onProgress).toHaveBeenCalled();
    expect(Math.max(...f.onProgress.mock.calls.map(call => call[0]))).toBeLessThanOrEqual(100);
  });

  test("cancel before seeking blocks playback", async () => {
    const f = fixture();
    await expect(runClipScenes({ ...f, entries: [{ index: 1, start: 1, end: 2 }], isCancelled: () => true })).rejects.toThrow("abgebrochen");
    expect(f.video.play).not.toHaveBeenCalled();
  });

  test("cancel during frames pauses and rejects", async () => {
    const f = fixture();
    let cancelled = false;
    const draw = () => { cancelled = true; };
    await expect(runClipScenes({ ...f, draw, entries: [{ index: 1, start: 1, end: 5 }], isCancelled: () => cancelled })).rejects.toThrow("abgebrochen");
    expect(f.video.pause).toHaveBeenCalled();
  });

  test("recorder cleanup waits for stop and tolerates recorder errors", async () => {
    const recorder = { state: "recording", stop: vi.fn(function() { this.state = "inactive"; }) };
    await stopClipRecording(recorder, Promise.reject(Error("recorder failed")));
    expect(recorder.stop).toHaveBeenCalledOnce();
    await stopClipRecording(recorder, Promise.resolve());
    expect(recorder.stop).toHaveBeenCalledOnce();
  });
});
