const CACHE_NAME = 'fel-bakery-pos-v13';

// 1. Install: Cache the core entry point
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.png'
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

// 3. Fetch Handler: HARD NETWORK-FIRST for HTML/JS
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // IGNORE API calls and external domains
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return;
  }

  // FORCE NETWORK-FIRST for navigation (index.html) and JS/CSS bundles
  // This ensures we always get the latest code if online.
  const isCoreAsset = request.mode === 'navigate' || 
                      url.pathname.endsWith('.js') || 
                      url.pathname.endsWith('.css') ||
                      url.pathname.includes('/assets/');

  if (isCoreAsset) {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match(request); // Fallback to cache only if network is down
      })
    );
    return;
  }

  // Stale-While-Revalidate for other assets (images, fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
