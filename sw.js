/* Offline shell cache: keeps the page itself readable without a network.
   Audio is intentionally NOT intercepted — Safari/Chrome need real HTTP range
   responses to seek inside a media file, and a cached full response can make
   the progress bar non-seekable.
   config.js is network-first: it changes every time you swap a song, and a stale
   cached config makes the page show the old song and point at a deleted clip. */
const VERSION = "mixtape-v6";
const CORE = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.destination === "audio") return; // let the browser handle media ranges

  if (url.pathname.endsWith("/config.js")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
