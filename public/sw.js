const CACHE_NAME = 'fel-bakery-pos-v5';

// 1. Install: Cache the core entry point
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/logo.png',
        'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap'
      ]);
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clear old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Dynamic Caching (Stale-While-Revalidate)
// This is the "secret sauce" that makes development mode and hashed VITE builds work offline.
// It caches EVERY file the app requests during the first "online" visit.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // IGNORE API calls, external domains, and Vite-specific dev assets
  if (
    url.pathname.startsWith('/api') || 
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.endsWith('.jsx') ||
    url.search.includes('v=') // Vite versioning params
  ) {
    return;
  }

  // Only handle GET requests
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // If we have it in cache, return it but also refresh from network in background
      if (cachedResponse) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {}); // Network error? No problem, we have the cache.
        return cachedResponse;
      }

      // If not in cache, fetch and then SAVE to cache for next time
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});
