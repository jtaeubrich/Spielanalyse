import { describe, expect, test, vi } from "vitest";
import { runClipCapture, runClipScenes, restoreClipPlayback } from "../src/clip-recorder.js";
import { connectClipAudio } from "../src/clip-audio.js";
import { drawClipFrame } from "../src/clip-renderer.js";

function captureFixture() {
  const video = { currentTime: 0, playbackRate: 1, ended: false, pause: vi.fn(), play: vi.fn().mockResolvedValue() };
  const track = { stop: vi.fn() };
  const stream = { getVideoTracks: () => [track] };
  let stoppedResolve;
  const stopped = new Promise(resolve => { stoppedResolve = resolve; });
  const recorder = {
    state: "inactive",
    start: vi.fn(function () { this.state = "recording"; }),
    stop: vi.fn(function () { this.state = "inactive"; stoppedResolve(); })
  };
  const restore = vi.fn().mockResolvedValue();
  return { video, stream, track, recorder, stopped, restore };
}

describe("clip export stability regression", () => {
  test("two consecutive captures independently stop their tracks and restore state", async () => {
    const first = captureFixture(), second = captureFixture();
    await runClipCapture({ ...first, run: async () => {} });
    await runClipCapture({ ...second, run: async () => {} });
    for (const f of [first, second]) {
      expect(f.recorder.start).toHaveBeenCalledOnce();
      expect(f.recorder.stop).toHaveBeenCalledOnce();
      expect(f.track.stop).toHaveBeenCalledOnce();
      expect(f.restore).toHaveBeenCalledOnce();
    }
  });

  test("capture can be retried after cancelling a previous capture", async () => {
    const first = captureFixture();
    await expect(runClipCapture({ ...first, run: async () => { throw Error("Clip-Export abgebrochen."); } }))
      .rejects.toThrow("abgebrochen");
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(first.restore).toHaveBeenCalledOnce();
    const retry = captureFixture();
    await expect(runClipCapture({ ...retry, run: async () => {} })).resolves.toBeUndefined();
    expect(retry.recorder.stop).toHaveBeenCalledOnce();
    expect(retry.restore).toHaveBeenCalledOnce();
  });

  test("restore preserves selection and playback rate after failed seeking", async () => {
    const video = { playbackRate: 1 };
    const setIndex = vi.fn(), refresh = vi.fn();
    await restoreClipPlayback({ video, time: 34, rate: 1.25, index: 7,
      seek: vi.fn().mockRejectedValue(Error("seek failed")), setIndex, refresh });
    expect(video.playbackRate).toBe(1.25);
    expect(setIndex).toHaveBeenCalledWith(7);
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("audio permission failures leave video export available", async () => {
    const stream = { addTrack: vi.fn() };
    const result = await connectClipAudio({
      video: {}, stream, getState: () => ({}), setState: vi.fn(),
      AudioContextClass: class { constructor() { throw Error("audio blocked"); } }
    });
    expect(result).toEqual({ withAudio: false });
    expect(stream.addTrack).not.toHaveBeenCalled();
  });

  test("annotation rendering includes shapes and comments", () => {
    const ctx = {
      fillRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(),
      translate: vi.fn(), restore: vi.fn(), fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 45 }))
    };
    const canvas = { width: 1280, height: 720 };
    const video = { videoWidth: 1920, videoHeight: 1080 };
    const drawAnnotationShape = vi.fn();
    drawClipFrame(ctx, canvas, video, {}, "Gruppe A", { profile: "original", labels: false }, {
      eventAnnotation: () => ({ shapes: [{ id: "arrow" }], comment: "Starker Wurf" }),
      drawAnnotationShape,
      socialFrameInfo: () => ({})
    });
    expect(drawAnnotationShape).toHaveBeenCalledOnce();
    expect(ctx.fillText).toHaveBeenCalledWith("Starker Wurf", 640, expect.any(Number), expect.any(Number));
  });

  test("scene playback aborts after seek before video starts", async () => {
    const video = { currentTime: 0, pause: vi.fn(), play: vi.fn() };
    let cancelled = false;
    await expect(runClipScenes({
      entries: [{ index: 2, start: 6, end: 8 }], video,
      isCancelled: () => cancelled,
      seek: async () => { cancelled = true; },
      setActiveIndex: vi.fn(), draw: vi.fn(), onProgress: vi.fn(), requestFrame: vi.fn()
    })).rejects.toThrow("abgebrochen");
    expect(video.play).not.toHaveBeenCalled();
  });
});
