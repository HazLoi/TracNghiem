const CACHE_NAME = 'trac-nghiem-pwa-v9';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './questions-easy.json',
  './questions-hard.json',
  './questions-third.json',
  './questions-level-1.json',
  './questions-level-2.json',
  './questions-level-3.json',
  './questions-level-4.json',
  './questions-level-5.json',
  './vendor/xlsx.full.min.js',
  './mau-nhap-cau-hoi.xlsx',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith('trac-nghiem-pwa-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        return await caches.match(event.request)
          || await caches.match('./index.html')
          || await caches.match('./');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      throw error;
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'REFRESH_APP') return;

  const stagingCacheName = `${CACHE_NAME}-staging-${Date.now()}`;
  const responsePort = event.ports[0];
  event.waitUntil((async () => {
    try {
      const stagingCache = await caches.open(stagingCacheName);
      for (const asset of APP_SHELL) {
        const request = new Request(new URL(asset, self.registration.scope), { cache: 'no-store' });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`Tải không thành công: ${asset}`);
        await stagingCache.put(request, response);
      }

      const activeCache = await caches.open(CACHE_NAME);
      for (const request of await stagingCache.keys()) {
        await activeCache.put(request, await stagingCache.match(request));
      }
      await caches.delete(stagingCacheName);
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames
        .filter(name => name.startsWith('trac-nghiem-pwa-') && name !== CACHE_NAME)
        .map(name => caches.delete(name)));
      responsePort?.postMessage({ ok: true });
    } catch (error) {
      await caches.delete(stagingCacheName);
      responsePort?.postMessage({ ok: false, message: error.message });
    }
  })());
});
