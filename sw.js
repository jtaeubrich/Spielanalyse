const CACHE_NAME = "handball-spielanalyse-v140";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/game-model.js",
  "./src/game-format.js",
  "./src/game-files.js",
  "./src/season-files.js",
  "./src/roster.js",
  "./src/team-rosters.js",
  "./src/video-sync.js",
  "./src/clip-core.js",
  "./src/video-playback.js",
  "./src/clip-export.js",
  "./src/clip-recorder.js",
  "./src/clip-renderer.js",
  "./src/clip-audio.js",
  "./src/storage.js",
  "./src/handball360.js",
  "./src/analysis-core.js",
  "./src/season-core.js",
  "./src/special-teams.js",
  "./icons/logo-ball-flow.svg?v=34",
  "./icons/apple-touch-icon-v29.png?v=34",
  "./icons/icon-192.png?v=34",
  "./icons/icon-512.png?v=34"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
