import { clipWindowAt } from './clip-core.js';

// One scene lifecycle for both review views. Adapters own media-specific seeking.
export function createScenePlayback({ getMedia, onError = () => {} }) {
  let revision = 0;
  let scene = null;
  let starting = false;

  function cancel() {
    revision++;
    scene = null;
    starting = false;
  }

  async function playAt(at, options = {}) {
    const media = getMedia();
    const window = clipWindowAt(at, { ...options, duration: media?.duration() });
    if (!media || !window) return null;
    cancel();
    const request = revision;
    scene = window;
    starting = true;
    const current = () => request === revision && getMedia()?.identity === media.identity;
    try {
      media.pause();
      await media.seek(window.start, current);
      if (!current()) return null;
      await media.play();
      if (!current()) return null;
      starting = false;
      return window;
    } catch (error) {
      if (current()) {
        cancel();
        onError(error);
      }
      return null;
    }
  }

  function tick() {
    if (!scene || starting) return;
    const media = getMedia();
    if (!media) return cancel();
    if (media.seconds() >= scene.end) {
      cancel();
      media.pause();
    }
  }

  return { playAt, cancel, tick };
}

export function localVideoAdapter(video) {
  return {
    identity: video,
    duration: () => video.duration,
    seconds: () => video.currentTime,
    pause: () => video.pause(),
    play: () => video.play(),
    seek: (seconds, current = () => true) => new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('seeked', done);
        video.removeEventListener('error', failed);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Videoposition konnte nicht gesetzt werden.')); };
      if (!current()) return resolve();
      if (Math.abs(video.currentTime - seconds) < 0.01 && !video.seeking) return resolve();
      video.addEventListener('seeked', done);
      video.addEventListener('error', failed);
      timer = setTimeout(failed, 5000);
      try { video.currentTime = seconds; } catch (error) { cleanup(); reject(error); }
    })
  };
}

export function youtubeAdapter(player) {
  return {
    identity: player,
    duration: () => player.getDuration() || null,
    seconds: () => player.getCurrentTime(),
    pause: () => player.pauseVideo(),
    play: () => player.playVideo(),
    seek: (seconds, current = () => true) => new Promise((resolve, reject) => {
      if (!current()) return resolve();
      player.seekTo(seconds, true);
      let attempts = 0;
      const check = () => {
        if (!current()) return resolve();
        try {
          if (Math.abs(player.getCurrentTime() - seconds) < 0.5) return resolve();
          if (++attempts >= 50) return reject(new Error('YouTube-Videoposition konnte nicht gesetzt werden.'));
          setTimeout(check, 100);
        } catch (error) { reject(error); }
      };
      check();
    })
  };
}