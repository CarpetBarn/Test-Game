const CACHE_NAME = 'rpg-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(resp => resp || fetch(request))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(resp => {
      if (resp) return resp;
      return fetch(request).then(networkResp => {
        const clone = networkResp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return networkResp;
      });
    })
  );
});
