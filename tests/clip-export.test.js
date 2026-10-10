import { describe, expect, test } from "vitest";
import { selectRecorderMimeType, exportClipFilename } from "../src/clip-export.js";

describe("browser clip export helpers", () => {
  test("prefers MP4 when available", () => {
    expect(selectRecorderMimeType(type => type === "video/mp4")).toBe("video/mp4");
  });

  test("falls back to supported WebM codecs", () => {
    expect(selectRecorderMimeType(type => type === "video/webm;codecs=vp8,opus")).toBe("video/webm;codecs=vp8,opus");
  });

  test("handles unsupported or unavailable recorder types", () => {
    expect(selectRecorderMimeType(() => false)).toBe("");
    expect(selectRecorderMimeType(null)).toBe("");
  });

  test("uses original clip filename cleanup and correct extension", () => {
    expect(exportClipFilename("Highlights: Spieler 10", "video/mp4")).toBe("Highlights_Spieler_10.mp4");
    expect(exportClipFilename("Kronshagen_ÄÖÜ ß", "video/webm")).toBe("Kronshagen_ÄÖÜ_ß.webm");
    expect(exportClipFilename("clip", "")).toBe("clip.webm");
  });
});
