import { describe, expect, test } from "vitest";
import { resolveYoutubeReference, storeYoutubeReference } from "../src/video-reference.js";

const parseId = value => {
  const match = String(value).match(/(?:watch\\?v=|youtu\\.be\\/)([A-Za-z0-9_-]{11})/);
  if (!match) throw Error("Invalid YouTube link");
  return match[1];
};

describe("YouTube reference persistence", () => {
  test("restores saved full URL or legacy ID", () => {
    expect(resolveYoutubeReference({ youtubeUrl: "https://youtu.be/sLAq3M30ZBY", youtubeId: "sLAq3M30ZBY" }))
      .toBe("https://youtu.be/sLAq3M30ZBY");
    expect(resolveYoutubeReference({ youtubeId: "sLAq3M30ZBY" }))
      .toBe("https://www.youtube.com/watch?v=sLAq3M30ZBY");
  });
  test("captures a valid changed link when saving a match", () => {
    const next = storeYoutubeReference({ playbackRate: 1, youtubeId: "old" },
      "https://youtu.be/sLAq3M30ZBY", parseId);
    expect(next).toMatchObject({
      youtubeId: "sLAq3M30ZBY",
      youtubeUrl: "https://www.youtube.com/watch?v=sLAq3M30ZBY",
      playbackRate: 1
    });
  });
  test("preserves saved reference when the form is empty or invalid", () => {
    const original = { youtubeUrl: "https://www.youtube.com/watch?v=sLAq3M30ZBY", youtubeId: "sLAq3M30ZBY" };
    expect(storeYoutubeReference(original, "", parseId)).toEqual(original);
    expect(storeYoutubeReference(original, "invalid", parseId)).toEqual(original);
  });
});
