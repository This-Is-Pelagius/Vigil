/*
 * Vigil — Service Worker
 * Strategy: cache-first for app shell; network-first for Google Fonts.
 * When a new version is deployed, increment CACHE_VERSION to bust the cache.
 */

const CACHE_VERSION = 'vigil-v8';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-16.png',
  '/icons/icon-32.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

/* ── INSTALL: cache the app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: delete old cache versions ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Google Fonts: network-first (so new typeface updates reach users),
     fall back to cache if offline */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* App shell and all other requests: cache-first */
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            /* Only cache valid same-origin responses */
            if (
              !response ||
              response.status !== 200 ||
              response.type !== 'basic'
            ) return response;
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
            return response;
          });
      })
  );
});
