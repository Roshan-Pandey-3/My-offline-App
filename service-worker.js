/* RoshanOS — Service Worker
   Strategy:
   - App shell (index, manifest, icons): precached on install
   - Navigation requests: network-first, cache fallback (updates cache on success)
   - Google Fonts (CSS + woff2): cache-first, populate on first fetch
   - Anything else: cache-first with network fallback that updates the cache

   ⚠️ When you push a new version of the app, bump CACHE_NAME below.
   That's what forces browsers to discard the old cached files.
*/

const CACHE_NAME = 'roshanos-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400&family=Inter:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] precache failed:', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // Navigation → network first, cache fallback (and update cache on success)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put('./index.html', clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match('./index.html').then(r => r || caches.match('./'))
        )
    );
    return;
  }

  // Everything else → cache-first, then network (cache on success)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
