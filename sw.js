/* Service worker — offline cache (app shell) */
const CACHE = 'billa-trener-v4';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'icons/icon.svg',
  'assets/billa-logo-white.svg',
  'assets/billa-logo-green.svg',
  'js/money.js',
  'js/data.js',
  'js/icons.js',
  'js/storage.js',
  'js/ui.js',
  'js/games/change.js',
  'js/games/rounding.js',
  'js/games/till.js',
  'js/games/scenarios.js',
  'js/games/pos.js',
  'js/app.js',
  'assets/money/note-100.jpg',
  'assets/money/note-200.jpg',
  'assets/money/note-500.jpg',
  'assets/money/note-1000.jpg',
  'assets/money/note-2000.jpg',
  'assets/money/note-5000.jpg',
  'assets/money/coin-1.jpg',
  'assets/money/coin-2.jpg',
  'assets/money/coin-5.jpg',
  'assets/money/coin-10.jpg',
  'assets/money/coin-20.jpg',
  'assets/money/coin-50.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});
