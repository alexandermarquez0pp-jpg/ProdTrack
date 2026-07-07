const CACHE_NAME = 'prodtracker-v16';
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
  self.skipWaiting(); // Forzar activación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Borrar cachés antiguos
          }
        })
      );
    })
  );
  self.clients.claim(); // Tomar control de las pestañas abiertas
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si hay red, guardamos la versión más reciente en caché y la devolvemos
        return caches.open(CACHE_NAME).then((cache) => {
          // Solo cacheamos peticiones GET
          if (event.request.method === 'GET') {
              cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Si no hay internet, devolvemos lo que esté guardado en caché
        return caches.match(event.request).then((response) => {
          return response || new Response('Not found (Offline)', { status: 404, statusText: 'Offline' });
        });
      })
  );
});
