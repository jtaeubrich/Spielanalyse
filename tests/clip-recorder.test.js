import { describe, expect, test, vi } from "vitest";
import { clipCanvasSize, startClipRecording } from "../src/clip-recorder.js";

describe("clip capture boundary", () => {
  test("preserves original and social format geometry", () => {
    const source = { videoWidth: 1920, videoHeight: 1080 };
    expect(clipCanvasSize("feed", source)).toEqual({ width: 1080, height: 1350 });
    expect(clipCanvasSize("vertical", source)).toEqual({ width: 1080, height: 1920 });
    expect(clipCanvasSize("original", source)).toEqual({ width: 1280, height: 720 });
    expect(clipCanvasSize("original", { videoWidth: 0, videoHeight: 0 })).toEqual({ width: 1280, height: 720 });
  });

  test("passes supported mime settings and collects non-empty chunks", async () => {
    const constructor = vi.fn(function(stream, options) { this.state = "recording"; this.mimeType = options?.mimeType; });
    const stream = {};
    const { recorder, chunks, stopped } = startClipRecording(stream, { mimeType: "video/webm", MediaRecorderClass: constructor });
    expect(constructor).toHaveBeenCalledWith(stream, { mimeType: "video/webm", videoBitsPerSecond: 6000000 });
    recorder.ondataavailable({ data: { size: 0 } });
    recorder.ondataavailable({ data: { size: 5 } });
    expect(chunks).toHaveLength(1);
    recorder.onstop();
    await expect(stopped).resolves.toBeUndefined();
  });

  test("recorder failure propagates and missing mime does not force options", async () => {
    const constructor = vi.fn(function() {});
    const { recorder, stopped } = startClipRecording({}, { MediaRecorderClass: constructor });
    expect(constructor.mock.calls[0][1]).toBeUndefined();
    recorder.error = Error("device failure");
    recorder.onerror();
    await expect(stopped).rejects.toThrow("device failure");
    expect(() => startClipRecording({}, {})).toThrow("MediaRecorder fehlt");
  });
});
