// Offline support: serve from cache, refresh the cache in the background.
// Bump VERSION when files are added or removed.
const VERSION = 'v19';
const CACHE = 'learn-french-' + VERSION;
const CORE = ['./', 'index.html', 'fonts.css', 'fonts/literata-normal-latin.woff2', 'fonts/literata-normal-cyrillic.woff2', 'fonts/literata-italic-latin.woff2', 'fonts/literata-italic-cyrillic.woff2', 'fonts/onest-normal-latin.woff2', 'fonts/onest-normal-cyrillic.woff2', 'style.css', 'analytics.js', 'privacy.html', 'data.js', 'app.js', 'dictation.js', 'speaking.js', 'pairs.js', 'dialogues-data.js', 'dialogues.js', 'explain.js', 'when.js', 'etre-avoir.js', 'listen.js', 'progress.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// install with fresh files from the network, not from the browser's HTTP cache, so a new
// version never starts with an old copy of a file
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // only this site's own files; anything from other sites (statistics, for example) goes
  // straight to the network and is never stored
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then(res => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      try { e.waitUntil(fresh.then(() => {}, () => {})); } catch (err) {}   // let the background refresh finish
      return cached || fresh;
    })
  );
});
