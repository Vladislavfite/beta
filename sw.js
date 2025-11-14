const CACHE = 'addagedon-v1';
const CORE = [
  'index.html',
  'manifest.json',
  // Критичные ассеты (быстрый первый старт)
  'assets/map.png',
  'assets/elements/play.png',
  'assets/elements/playagain.png',
  'assets/menu.webm',
  'assets/gameover.webm'
];

// Установка SW и предзагрузка ядра
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

// Активация и чистка старых кэшей
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Обработка запросов: кэш → сеть с подзагрузкой
self.addEventListener('fetch', event => {
  const req = event.request;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // отдаем из кэша, а сеть параллельно обновляет
        fetch(req).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, clone));
        }).catch(() => {});
        return cached;
      }

      // нет в кэше — идём в сеть и кладём в кэш
      return fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
