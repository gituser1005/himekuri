// Service Worker。アプリのファイルを全部キャッシュし、2回目以降はネットなしで開けるようにする。
// ファイルを直して公開し直すときは VERSION を上げる（tools/deploy.py が上げ忘れを止める）。
// 新しい版は裏で取ってきて、次に開いたときから使われる。

const VERSION = 'v1';
const CACHE = `himekuri-${VERSION}`;

// 公開するファイルの一覧（tools/deploy.py もこの一覧を見てコピーする）
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'js/main.js',
  'js/date.js',
  'js/calendar.js',
  'js/swipe.js',
  'js/store.js',
  'js/pages.js',
  'js/lines.js',
  'js/photos.js',
  'js/content.js',
  'js/stamp.js',
  'js/back.js',
  'js/record.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// キャッシュにあればそれを返す。?now= などの URL パラメータは無視して照合する
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req)),
  );
});
