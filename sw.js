'use strict';
const CACHE = 'aninexus-shell-v44-19-0';
const IMAGE_CACHE = 'aninexus-images-v1';
const MAX_IMAGES = 48;
const MAX_IMAGE_BYTES = 512 * 1024;
const HOME = new URL('./', self.registration.scope).href;

async function keepImage(request, response) {
  if (!response.ok || response.type !== 'basic' || !response.headers.get('content-type')?.startsWith('image/')) return;
  const bytes = Number(response.headers.get('content-length'));
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_IMAGE_BYTES) return;
  const cache = await caches.open(IMAGE_CACHE);
  await cache.put(request, response);
  const entries = await cache.keys();
  await Promise.all(entries.slice(0, Math.max(0, entries.length - MAX_IMAGES)).map(entry => cache.delete(entry)));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => fetch(HOME, { cache: 'reload' }).then(response => response.ok ? cache.put(HOME, response) : undefined))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('aninexus-') && key !== CACHE && key !== IMAGE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (event.request.destination === 'image' && url.origin === self.location.origin &&
      (url.pathname.startsWith(new URL('assets/', self.registration.scope).pathname) || url.pathname.startsWith('/media/profile/'))) {
    let imageToCache = null;
    const response = (async () => {
      const cached = await caches.match(event.request, { cacheName: IMAGE_CACHE });
      if (cached) return cached;
      const result = await fetch(event.request);
      imageToCache = result.clone();
      return result;
    })();
    event.respondWith(response);
    event.waitUntil(response.then(() => imageToCache ? keepImage(event.request, imageToCache) : undefined).catch(() => undefined));
    return;
  }
  if (event.request.mode !== 'navigate') return;
  let shellToCache = null;
  const response = fetch(event.request)
    .then(result => { if (result.ok && event.request.url === HOME) shellToCache = result.clone(); return result; })
    .catch(async () => (await caches.match(event.request)) || (await caches.match(HOME)));
  event.respondWith(response);
  if (event.request.url === HOME) event.waitUntil(response.then(() => shellToCache ? caches.open(CACHE).then(cache => cache.put(HOME, shellToCache)) : undefined).catch(() => undefined));
});
