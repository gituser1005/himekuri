// Service Worker。アプリのファイルを全部キャッシュし、2回目以降はネットなしで開けるようにする。
// ファイルを直して公開し直すときは VERSION を上げる（tools/deploy.py が上げ忘れを止める）。
// 新しい版は裏で取ってきて、次に開いたときから使われる。

const VERSION = 'v2';
const CACHE = `island-${VERSION}`;

// 公開するファイルの一覧（tools/deploy.py もこの一覧を見てコピーする）
// キャラ入りの元の島の絵（assets/island_day_sunny.png など）は切り抜きを作るためだけに使うので入れない
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'js/main.js',
  'js/date.js',
  'js/diaries.js',
  'js/state.js',
  'js/island.js',
  'js/sprites.js',
  'js/paper.js',
  'js/diary.js',
  'js/reread.js',
  'js/calendar.js',
  'js/record.js',
  'js/store.js',
  'data/diaries.json',
  'fonts/zen-maru-gothic-500.woff2',
  'fonts/zen-maru-gothic-700.woff2',
  'fonts/klee-one-400.woff2',
  'fonts/klee-one-600.woff2',
  'assets/island_day_sunny_bg.png',
  'assets/island_day_rain_bg.png',
  'assets/island_night_bg.png',
  'assets/sprites/sunny_0.png',
  'assets/sprites/sunny_1.png',
  'assets/sprites/sunny_2.png',
  'assets/sprites/rain_0.png',
  'assets/sprites/rain_1.png',
  'assets/sprites/rain_2.png',
  'assets/sprites/night_0.png',
  'assets/snap_1024_group.png',
  'assets/snap_1031_halloween.png',
  'assets/snap_1106_dance.png',
  'assets/fuuka.webp',
  'assets/potesara.webp',
  'assets/komachi.webp',
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
