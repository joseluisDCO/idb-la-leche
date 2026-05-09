const CACHE_NAME = 'idb-la-leche-v8';

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './app.js',
        './supabaseClient.js',
        './manifest.json',
        './icon-192.png',
        './icon-512.png'
      ]);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames
        .filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (
    url.includes('/index.html') ||
    url.includes('/app.js') ||
    url.includes('/supabaseClient.js') ||
    url.includes('/manifest.json') ||
    url.includes('/icon-192.png') ||
    url.includes('/icon-512.png') ||
    url.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
