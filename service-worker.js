/* on-camp, offline service worker */
const CACHE = 'scout-v241';
const CORE = [
  './',
  './index.html',
  './assets/ios.css',
  './assets/icons.svg',
  './assets/fonts/lato-400.woff2',
  './assets/fonts/lato-700.woff2',
  './assets/fonts/noto-400.woff2',
  './assets/fonts/noto-400i.woff2',
  './assets/fonts/noto-700.woff2',
  './share.js',
  './app.js',
  './data/parks.js',
  './data/ecosystem.js',
  './manifest.json',
  './parks-data.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* A release is fetched whole: every file, past the browser's HTTP cache and
   the CDN's (the query string is new each release), so this cache holds one
   version of the app and never a mix of two. Any failed file fails the
   install and the browser tries again later (the app asks on every return);
   a file an earlier try already stored is kept, so a weak signal still gets
   there in a few goes instead of starting over each time. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.match(u).then((hit) => hit ||
        fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 'v=' + CACHE, { cache: 'no-store' }).then((res) => {
          if (!res || !res.ok) throw new Error('could not fetch ' + u);
          return c.put(u, res);
        })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first, same-origin only, offline nav fallback. A cached file is
   served as it is: refreshing files one by one in the background is what let
   a new page run on an old script, so new files arrive only as a whole new
   release (the CACHE name above changes with every one). Only this
   release's own cache is read, never a newer one still being filled. A
   launch with a query string still gets this release's page.
   Cross-origin requests are left to the browser: caching opaque responses
   pads each entry by megabytes and blows through the origin storage quota. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: nav })).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && !nav) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (nav ? caches.open(CACHE).then((c) => c.match('./index.html')) : undefined));
    })
  );
});
