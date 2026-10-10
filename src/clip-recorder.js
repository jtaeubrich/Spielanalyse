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

export function createClipProgress(entries) {
  const total = entries.reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0);
  let done = 0;
  return {
    percent(elapsed = 0) {
      if (total <= 0) return 100;
      return Math.min(100, Math.max(0, Math.round((done + Math.max(0, elapsed)) / total * 100)));
    },
    complete(item) {
      done += Math.max(0, item.end - item.start);
    }
  };
}

export async function restoreClipPlayback({ video, time, rate, index, seek, setIndex, refresh }) {
  video.playbackRate = rate;
  try {
    await seek(video, time);
  } catch {
    // Preserve the original best-effort restoration semantics.
  } finally {
    setIndex(index);
    refresh();
  }
}

export async function runClipScenes({ entries, video, isCancelled, seek, setActiveIndex, draw, onProgress, requestFrame }) {
  const progress = createClipProgress(entries);
  const checkCancelled = () => {
    if (isCancelled()) throw Error("Clip-Export abgebrochen.");
  };
  for (const item of entries) {
    checkCancelled();
    setActiveIndex(item.index);
    await seek(video, item.start);
    checkCancelled();
    await video.play();
    await new Promise((resolve, reject) => {
      const frame = () => {
        try {
          checkCancelled();
          draw(item);
          const elapsed = Math.max(0, video.currentTime - item.start);
          onProgress(progress.percent(elapsed));
          if (video.currentTime >= item.end || video.ended) {
            video.pause();
            resolve();
          } else {
            requestFrame(frame);
          }
        } catch (error) {
          video.pause();
          reject(error);
        }
      };
      requestFrame(frame);
    });
    progress.complete(item);
  }
}

export async function stopClipRecording(recorder, stopped) {
  if (recorder.state !== "inactive") recorder.stop();
  await stopped.catch(() => {});
}

// Own the full recording lifecycle. Never leave a canvas capture track running.
export async function runClipCapture({ video, recorder, stopped, stream, restore, run }) {
  const tracks = stream.getVideoTracks?.() || [];
  let started = false;
  try {
    recorder.start(250);
    started = true;
    await run();
  } finally {
    video.pause();
    try {
      if (started) await stopClipRecording(recorder, stopped);
    } finally {
      for (const track of tracks) track.stop();
      await restore();
    }
  }
}
