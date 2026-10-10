export function normalizeSceneWindow(preRoll = 4, postRoll = 2) {
  return {
    preRoll: Number.isFinite(Number(preRoll)) ? Math.max(0, Number(preRoll)) : 0,
    postRoll: Number.isFinite(Number(postRoll)) ? Math.max(0, Number(postRoll)) : 0
  };
}

export function clipWindowAt(at, {
  preRoll = 4,
  postRoll = 2,
  duration = null
} = {}) {
  if (at === null || at === undefined || at === "") return null;
  const time = Number(at);
  if (!Number.isFinite(time) || time < 0) return null;

  const window = normalizeSceneWindow(preRoll, postRoll);
  const hasExplicitDuration = duration !== null && duration !== undefined && duration !== "";
  const maxDuration = Number(duration);
  const hasDuration = hasExplicitDuration && Number.isFinite(maxDuration) && maxDuration >= 0;
  if (hasDuration && time > maxDuration) return null;
  const start = Math.max(0, time - window.preRoll);
  const end = hasDuration
    ? Math.min(maxDuration, time + window.postRoll)
    : time + window.postRoll;

  if (!(end > start)) return null;
  return {
    at: time,
    start,
    end,
    duration: end - start,
    preRoll: window.preRoll,
    postRoll: window.postRoll
  };
}

export function buildClipEntry({
  event,
  index = -1,
  at,
  preRoll = 4,
  postRoll = 2,
  duration = null,
  groupLabel = ""
} = {}) {
  const window = clipWindowAt(at, { preRoll, postRoll, duration });
  if (!window) return null;

  return {
    event,
    index,
    ...window,
    groupLabel
  };
}

export function buildClipEntries(entries = [], {
  resolveVideoTime,
  preRoll = 4,
  postRoll = 2,
  duration = null,
  selectedIndexes = null
} = {}) {
  if (typeof resolveVideoTime !== "function") {
    throw new TypeError("buildClipEntries benötigt resolveVideoTime.");
  }

  const selected = selectedIndexes instanceof Set
    ? selectedIndexes
    : Array.isArray(selectedIndexes)
      ? new Set(selectedIndexes)
      : null;

  return (Array.isArray(entries) ? entries : [])
    .filter((item) => !selected || selected.has(item.index))
    .map((item) =>
      buildClipEntry({
        event: item.event,
        index: item.index,
        at: resolveVideoTime(item.event, item.index),
        preRoll,
        postRoll,
        duration,
        groupLabel: item.groupLabel || ""
      })
    )
    .filter(Boolean);
}

export function totalClipDuration(entries = []) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item?.end) - Number(item?.start) || 0),
    0
  );
}

export function eventActiveInWindow(videoSeconds, eventAt, {
  preRoll = 4,
  postRoll = 2
} = {}) {
  const current = Number(videoSeconds);
  const at = Number(eventAt);
  if (!Number.isFinite(current) || !Number.isFinite(at)) return false;
  const window = normalizeSceneWindow(preRoll, postRoll);
  return current >= at - window.preRoll && current <= at + window.postRoll;
}

export function nearestActiveClip(entries = [], videoSeconds, options = {}) {
  let best = null;
  for (const item of Array.isArray(entries) ? entries : []) {
    const at = Number(item?.video ?? item?.at);
    if (!eventActiveInWindow(videoSeconds, at, options)) continue;
    const delta = Math.abs(at - Number(videoSeconds));
    if (!best || delta < best.delta) {
      best = { ...item, delta };
    }
  }
  return best;
}
