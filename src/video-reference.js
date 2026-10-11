export function resolveYoutubeReference(video = {}) {
  const url = String(video?.youtubeUrl || "").trim();
  const id = String(video?.youtubeId || "").trim();
  return url || (id ? "https://www.youtube.com/watch?v=" + id : "");
}

export function storeYoutubeReference(video = {}, input = "", parseId) {
  const text = String(input || "").trim();
  if (!text) return { ...video };
  try {
    const id = parseId(text);
    return {
      ...video,
      youtubeUrl: "https://www.youtube.com/watch?v=" + id,
      youtubeId: id,
      localFileName: null
    };
  } catch {
    // Do not replace a valid saved reference with an invalid input.
    return { ...video };
  }
}
