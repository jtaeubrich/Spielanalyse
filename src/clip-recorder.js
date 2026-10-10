// Pure geometry plus an injected browser recorder boundary for clip capture.
export function clipCanvasSize(profile, video) {
  if (profile === "feed") return { width: 1080, height: 1350 };
  if (profile === "vertical") return { width: 1080, height: 1920 };
  const maxWidth = 1280;
  const ratio = video.videoWidth / video.videoHeight || 16 / 9;
  const width = Math.min(maxWidth, video.videoWidth || maxWidth);
  return { width, height: Math.round(width / ratio) };
}

export function startClipRecording(stream, { mimeType = "", MediaRecorderClass, videoBitsPerSecond = 6000000 } = {}) {
  if (typeof MediaRecorderClass !== "function") throw new TypeError("MediaRecorder fehlt.");
  const recorder = new MediaRecorderClass(stream, mimeType ? { mimeType, videoBitsPerSecond } : undefined);
  const chunks = [];
  recorder.ondataavailable = event => {
    if (event.data?.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = () => reject(recorder.error || Error("Videoexport fehlgeschlagen."));
  });
  return { recorder, chunks, stopped };
}
