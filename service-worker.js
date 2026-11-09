self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(cacheName => cacheName.startsWith('trac-nghiem-pwa-'))
      .map(cacheName => caches.delete(cacheName)));
    await self.registration.unregister();
  })());
});
