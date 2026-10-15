function finiteValue(value) {
  return value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));
}

export function syncPointSeconds(value, syncUnit = "seconds") {
  if (value === null || value === undefined || value === "") return NaN;
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return number / (syncUnit === "ms" ? 1000 : 1);
}

export function eventHalf(event, durationMinutes = 25, { boundaryToSecondHalf = false } = {}) {
  if ([1, 2].includes(Number(event?.half))) return Number(event.half);
  const duration = Number(durationMinutes || 25) * 60;
  const time = Number(event?.time || 0);
  return boundaryToSecondHalf ? (time < duration ? 1 : 2) : (time <= duration ? 1 : 2);
}

export function syncForHalf(video = {}, half = 1) {
  const raw =
    half === 1
      ? video?.h1SyncRealTime ?? video?.kickoff
      : video?.h2SyncRealTime;
  return syncPointSeconds(raw, video?.syncUnit || "seconds");
}

// Estimate imported official events without writing the estimate into realTime.
// Explicit video offsets always take precedence. A manually matched event can
// serve as a new anchor after a cut; no interpolation across cuts is attempted.
export function eventVideoPosition(event, options = {}) {
  if (!event) return { seconds: NaN, status: "unassigned" };
  if (options.isVideoscoutingFile && finiteValue(event.realTime)) {
    return { seconds: Number(event.realTime) / 1000, status: "confirmed" };
  }
  if (!options.isVideoscoutingFile) {
    return { seconds: eventVideoSeconds(event, options), status: "derived" };
  }
  if (event.officialSource !== "handball.net" || !finiteValue(event.time)) {
    return { seconds: NaN, status: "unassigned" };
  }
  const duration = Number(options.durationMinutes || 25) * 60;
  const half = eventHalf(event, options.durationMinutes);
  const halfStart = (half - 1) * duration;
  let baseTime = halfStart;
  let baseVideo = syncForHalf(options.video, half);
  const originalTime = Number(event.time);
  const timestamp = value => {
    if (value === null || value === undefined || value === "") return NaN;
    if (typeof value === "number" || /^\\d{10,13}$/.test(String(value))) {
      const n = Number(value);
      return Number.isFinite(n) ? (n > 1e11 ? n / 1000 : n) : NaN;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms / 1000 : NaN;
  };
  let baseEvent = null;
  for (const point of options.events || []) {
    if (point === event || !finiteValue(point.realTime) ||
        eventHalf(point, options.durationMinutes) !== half || !finiteValue(point.time) ||
        Number(point.time) > originalTime || Number(point.time) < halfStart) continue;
    if (!baseEvent || Number(point.time) > Number(baseEvent.time) ||
        (Number(point.time) === Number(baseEvent.time) &&
          Number(point.realTime) > Number(baseEvent.realTime))) baseEvent = point;
  }
  if (baseEvent) {
    baseTime = Number(baseEvent.time);
    baseVideo = Number(baseEvent.realTime) / 1000;
  }
  // A confirmed event is a local anchor even when the initial H1/H2 sync is unavailable.
  // Never extrapolate a later confirmed position; it remains an independent anchor.
  if (!Number.isFinite(baseVideo)) return { seconds: NaN, status: "unassigned" };
  let elapsed = originalTime - baseTime;
  if (baseEvent) {
    const from = timestamp(baseEvent.officialTimestamp);
    const to = timestamp(event.officialTimestamp);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from && to - from < 3600) {
      elapsed = to - from;
    }
  }
  const seconds = baseVideo + elapsed;
  return { seconds: seconds >= 0 ? seconds : NaN, status: "estimated" };
}

export function eventVideoSeconds(
  event,
  {
    video = {},
    isVideoscoutingFile = false,
    durationMinutes = 25
  } = {}
) {
  if (!event) return NaN;

  const hasReal = finiteValue(event.realTime);
  if (isVideoscoutingFile) return hasReal ? Number(event.realTime) / 1000 : NaN;

  const half = eventHalf(event, durationMinutes);
  const sync = syncForHalf(video, half);
  if (!Number.isFinite(sync)) return NaN;

  const liveKey = half === 1 ? "h1LiveStartMs" : "h2LiveStartMs";
  const hasLiveStart = finiteValue(video?.[liveKey]);
  const liveStart = hasLiveStart ? Number(video[liveKey]) : 0;
  const duration = Number(durationMinutes || 25) * 60;

  const elapsedMs = hasReal
    ? hasLiveStart
      ? Number(event.realTime) - liveStart
      : Number(event.realTime)
    : half === 1
      ? Number(event.time || 0) * 1000
      : (Number(event.time || 0) - duration) * 1000;

  return sync + elapsedMs / 1000;
}

export function estimateReviewGameTime(
  videoSeconds,
  half,
  {
    events = [],
    video = {},
    isVideoscoutingFile = false,
    durationMinutes = 25
  } = {}
) {
  const duration = Number(durationMinutes || 25) * 60;
  const offset = (half - 1) * duration;

  const points = (Array.isArray(events) ? events : [])
    .map((event) => ({
      event,
      video: eventVideoSeconds(event, {
        video,
        isVideoscoutingFile,
        durationMinutes
      })
    }))
    .filter(
      (item) =>
        eventHalf(item.event, durationMinutes, { boundaryToSecondHalf: true }) === half &&
        Number.isFinite(item.video) &&
        Number.isFinite(Number(item.event.time))
    )
    .map((item) => ({
      video: item.video,
      time: Math.max(
        offset,
        Math.min(offset + duration, Number(item.event.time))
      )
    }))
    .sort((a, b) => a.video - b.video);

  if (!points.length) {
    const sync = syncForHalf(video, half);
    return offset + Math.max(0, Math.min(duration, videoSeconds - sync));
  }

  let before = null;
  let after = null;
  for (const point of points) {
    if (point.video <= videoSeconds) before = point;
    if (point.video >= videoSeconds) {
      after = point;
      break;
    }
  }

  if (before && after && after.video > before.video) {
    const ratio = (videoSeconds - before.video) / (after.video - before.video);
    return Math.round(before.time + (after.time - before.time) * ratio);
  }
  if (before) return Math.round(before.time);
  if (after) return Math.round(after.time);
  return offset;
}

export function reviewPosition(
  videoSeconds,
  {
    events = [],
    video = {},
    isVideoscoutingFile = false,
    durationMinutes = 25
  } = {}
) {
  if (!Number.isFinite(videoSeconds)) return null;

  const h1 = syncForHalf(video, 1);
  const h2 = syncForHalf(video, 2);
  let half = 1;
  let sync = h1;

  if (Number.isFinite(h2) && videoSeconds >= h2 - 0.25) {
    half = 2;
    sync = h2;
  } else if (!Number.isFinite(h1)) {
    return null;
  }

  const elapsed = videoSeconds - sync;
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;

  const time = estimateReviewGameTime(videoSeconds, half, {
    events,
    video,
    isVideoscoutingFile,
    durationMinutes
  });

  const liveKey = half === 1 ? "h1LiveStartMs" : "h2LiveStartMs";
  const liveStart = Number.isFinite(Number(video?.[liveKey]))
    ? Number(video[liveKey])
    : 0;

  return {
    half,
    elapsed,
    time,
    realTime: Math.round(liveStart + elapsed * 1000)
  };
}

export function eventRealTimeFromVideoPosition(
  event,
  videoSeconds,
  {
    video = {},
    isVideoscoutingFile = false,
    durationMinutes = 25
  } = {}
) {
  if (!event || !Number.isFinite(videoSeconds) || videoSeconds < 0) {
    return { ok: false, reason: "invalid-video-position" };
  }

  if (isVideoscoutingFile) {
    return {
      ok: true,
      half: eventHalf(event, durationMinutes),
      realTime: Math.round(videoSeconds * 1000)
    };
  }

  const half = eventHalf(event, durationMinutes);
  const sync = syncForHalf(video, half);
  if (!Number.isFinite(sync)) {
    return { ok: false, reason: "missing-sync", half };
  }

  const delta = videoSeconds - sync;
  if (delta < 0) {
    return { ok: false, reason: "before-sync", half };
  }

  const liveKey = half === 1 ? "h1LiveStartMs" : "h2LiveStartMs";
  const liveStart = Number.isFinite(Number(video?.[liveKey]))
    ? Number(video[liveKey])
    : 0;

  return {
    ok: true,
    half,
    realTime: Math.round(liveStart + delta * 1000)
  };
}

/** New video-scouting events retain their exact video position and, when a
 * valid sync anchor exists, the estimated game clock at capture time. */
export function videoScoutingEventStamp(videoSeconds, options = {}) {
  if (!Number.isFinite(videoSeconds) || videoSeconds < 0) {
    return { time: null, displayTime: null, half: null, realTime: null };
  }
  const realTime = Math.round(videoSeconds * 1000);
  const position = reviewPosition(videoSeconds, options);
  if (!position || !Number.isFinite(position.time)) {
    return { time: null, displayTime: null, half: null, realTime };
  }
  const time = Math.round(position.time);
  const minute = Math.floor(time / 60);
  const second = time % 60;
  return {
    time,
    displayTime: minute + ":" + String(second).padStart(2, "0"),
    half: position.half,
    realTime
  };
}

/** Reconstruct a match clock from events and explicit pause/resume anchors.
 * Automatic event anchors may adjust running clock estimates, but must never
 * restart a clock that a user explicitly paused. */
export function reconstructedGameClock(videoAt, half, start, halfLength, events = [], anchors = []) {
  if (!Number.isFinite(videoAt) || !Number.isFinite(start) || videoAt < start) return null;
  const lower=(half-1)*halfLength,upper=half*halfLength;
  const points=[{video:start,game:lower,running:true,source:"start"}];
  for(const e of events){
    if(Number.isFinite(e.video)&&e.video>=start&&Number.isFinite(e.game)&&e.game>=lower&&e.game<=upper)
      points.push({video:e.video,game:e.game,running:true,source:"event"});
  }
  for(const a of anchors){
    if(Number(a.half)===half&&Number.isFinite(Number(a.videoAt))&&Number(a.videoAt)>=start&&Number.isFinite(Number(a.gameAt)))
      points.push({video:Number(a.videoAt),game:Number(a.gameAt),running:a.running!==false,source:"manual"});
  }
  const priority={start:0,event:1,manual:2};
  points.sort((a,b)=>a.video-b.video||priority[a.source]-priority[b.source]);
  const merged=[];
  for(const p of points){
    if(merged.length&&Math.abs(merged[merged.length-1].video-p.video)<0.01)merged[merged.length-1]=p;
    else merged.push(p);
  }
  let previous=merged[0],next=null;
  for(const p of merged.slice(1)){
    if(p.video>videoAt){next=p;break;}
    // Events after a manual pause are only estimates; they cannot resume it.
    if(previous.running===false&&p.source!=="manual")continue;
    previous=p;
  }
  // The next automatic event must not create a fast-forward across a cut.
  // Use video elapsed time at normal speed; manual pauses remain frozen.
  const seconds=previous.running===false?previous.game:
    previous.game+Math.max(0,videoAt-previous.video);
  return {seconds:Math.max(lower,Math.min(upper,seconds)),half,
    running:previous.running!==false,manual:previous.source==="manual"};
}
