const CACHE_NAME = "handball-spielanalyse-network-first-v24";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/game-model.js",
  "./src/game-format.js",
  "./src/game-files.js",
  "./src/season-files.js",
  "./src/season-archive.js",
  "./src/season-handball360.js",
  "./src/nuliga-html.js",
  "./src/nuliga-reconcile.js",
  "./src/season-roster-refresh.js",
  "./src/roster.js",
  "./src/team-rosters.js",
  "./src/video-sync.js",
  "./src/clip-core.js",
  "./src/video-playback.js",
  "./src/video-reference.js",
  "./src/clip-export.js",
  "./src/clip-recorder.js",
  "./src/clip-renderer.js",
  "./src/clip-audio.js",
  "./src/storage.js",
  "./src/instagram-template.js",
  "./src/instagram-template-manager.js",
  "./src/instagram-export.js",
  "./src/instagram-html-renderer.js",
  "./src/instagram-workflow.js",
  "./src/handball360.js",
  "./src/analysis-core.js",
  "./src/season-core.js",
  "./src/season-trends.js",
  "./src/special-teams.js",
  "./icons/logo-ball-flow.svg?v=34",
  "./icons/apple-touch-icon-v29.png?v=34",
  "./icons/icon-192.png?v=34",
  "./icons/icon-512.png?v=34",
  "./docs/handbuch/images/generated/setup-desktop.jpg",
  "./docs/handbuch/images/generated/w1-live-desktop.jpg",
  "./docs/handbuch/images/generated/w1-live-mobile.jpg",
  "./docs/handbuch/images/generated/w2-review-desktop.jpg",
  "./docs/handbuch/images/generated/w2-review-mobile.jpg",
  "./docs/handbuch/images/generated/w3-video-desktop.jpg",
  "./docs/handbuch/images/generated/w3-video-mobile.jpg",
  "./docs/handbuch/images/generated/analysis-desktop.jpg",
  "./docs/handbuch/images/generated/video-desktop.jpg",
  "./docs/handbuch/images/generated/data-desktop.jpg"
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

  // JavaScript modules must not be served from an older app version.
  // Prefer network on reload, but preserve offline support.
  if (requestUrl.pathname.endsWith(".js") || requestUrl.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
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
