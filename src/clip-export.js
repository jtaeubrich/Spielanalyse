const RECORDER_TYPES = Object.freeze([
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
]);

export function selectRecorderMimeType(isSupported) {
  if (typeof isSupported !== "function") return "";
  return RECORDER_TYPES.find(type => isSupported(type)) || "";
}

export function exportClipFilename(fileBase, mime) {
  const extension = String(mime || "").toLowerCase().includes("mp4") ? "mp4" : "webm";
  return String(fileBase).replace(/[^a-z0-9äöüß_-]+/gi, "_") + "." + extension;
}
