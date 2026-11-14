const cachePrefix = `flip-clock:${self.registration.scope}:`;
// Bump this version when changing the files in the offline bundle.
const cacheName = `${cachePrefix}3`;
const home = self.registration.scope;
const index = new URL('index.html', home).href;
const assets = new Set([
  'clock.css?v=3',
  'clock.js?v=3',
  'manifest.webmanifest',
  'favicon.ico',
  'assets/barlow-condensed-extrabold.ttf',
  'assets/flip-clock-192.png',
  'assets/flip-clock-512.png',
].map((path) => new URL(path, home).href));

self.addEventListener('install', (event) => {
  const requests = [home, ...assets].map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(requests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous = keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName);
    await Promise.all(previous.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    url.search = '';
    if (url.href !== home && url.href !== index) return;

    // Keep online launches fresh and serve the matching cached bundle offline.
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(home)) ?? Response.error();
    }));
  } else if (assets.has(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(request)) ?? fetch(request);
    })());
  }
});
