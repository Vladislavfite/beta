const CACHE = 'addagedon-v1';
const CORE = [
  '/',               // если сайт в корне домена; если в подпапке — оставь пустым.
  '/index.html',
  '/manifest.json',
  // Критичные ассеты (быстрый первый старт)
  '/assets/map.png',
  '/assets/elements/play.png',
  '/assets/elements/playagain.png',
  '/assets/menu.webm',
  '/assets/gameover.webm'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Сначала сеть, если упало — из кэша (для ассетов обычно ок)
  e.respondWith(
    fetch(req).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(req, clone));
      return res;
    }).catch(() => caches.match(req))
  );
});
