const CACHE_NAME = 'prodtracker-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/store.js',
  './js/reports.js',
  './js/firebase-config.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Fallback to network if not in cache
        return response || fetch(event.request).catch(() => {
          // Return generic 404 if fetch fails (e.g. missing favicon)
          return new Response('Not found', { status: 404, statusText: 'Not found' });
        });
      })
  );
});
