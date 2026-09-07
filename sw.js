/*
  Service Worker для Mirage City.
  Кэширует само приложение (index.html) и внешние скрипты (Firebase SDK, шрифты,
  Telegram Web App SDK), чтобы повторный запуск мини-аппа не ждал заново их загрузки
  из интернета — они читаются из локального кэша браузера почти мгновенно.

  Стратегия: "сначала кэш, затем сеть в фоне" (stale-while-revalidate).
  Пользователь сразу видит закэшированную версию, а в фоне тихо подтягивается
  свежая — она подставится при СЛЕДУЮЩЕМ запуске. Так что после правок в самом
  index.html людям может понадобиться открыть апп два раза, чтобы увидеть новую
  версию (первый раз подтягивает обновление в фон, второй раз его показывает).

  Установка не нужна отдельно — index.html сам регистрирует этот файл при загрузке.
*/

const CACHE_NAME = 'mirage-city-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  'https://telegram.org/js/telegram-web-app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/firebase-app-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/firebase-firestore-compat.min.js',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      // Если есть кэш — отдаём его мгновенно, сеть обновляет кэш в фоне.
      // Если кэша ещё нет (первый запуск) — ждём сеть.
      return cached || networkFetch;
    })
  );
});
