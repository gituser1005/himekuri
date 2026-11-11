// Service Worker。アプリのファイルを全部キャッシュし、2回目以降はネットなしで開けるようにする。
// ファイルを直して公開し直すときは VERSION を上げる（tools/deploy.py が上げ忘れを止める）。
// 新しい版は裏で取ってきて、次に開いたときから使われる。

const VERSION = 'v18';
// キャッシュの名前は cottage- で始める。試用版 v1（ぬいアイランド）は同じドメインで island- を使っている
const PREFIX = 'cottage-';
const CACHE = `${PREFIX}${VERSION}`;

// 公開するファイルの一覧（tools/deploy.py もこの一覧を見てコピーする）
// キャラ入りの元の島の絵（assets/island_day_sunny.png）はアイコンを作るためだけに使うので入れない（tools/make-icons.ps1）
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
  'js/island-life.js',
  'js/places.js',
  'js/rng.js',
  'js/paper.js',
  'js/diary.js',
  'js/reread.js',
  'js/calendar.js',
  'js/record.js',
  'js/store.js',
  'js/profile.js',
  'js/photos.js',
  'js/register.js',
  'js/journal.js',
  'js/snapshot.js',
  'js/trial-record.js',
  'js/usage.js',
  'js/usage-summary.js',
  'js/bgm.js',
  'selection/index.js',
  'selection/config.js',
  'selection/rng.js',
  'selection/record.js',
  'selection/weather.js',
  'selection/writers.js',
  'selection/text.js',
  'selection/stories.js',
  'selection/habits.js',
  'selection/arcs.js',
  'selection/festivals.js',
  'selection/events.js',
  'selection/anniversary.js',
  'selection/letter.js',
  'selection/welcome.js',
  'selection/snapshots.js',
  'data/nui_scripts.json',
  'data/diaries.json',
  'fonts/fonts.css',
  'fonts/zen-maru-gothic-500-1.woff2',
  'fonts/zen-maru-gothic-500-2.woff2',
  'fonts/zen-maru-gothic-700-1.woff2',
  'fonts/zen-maru-gothic-700-2.woff2',
  'fonts/klee-one-400-1.woff2',
  'fonts/klee-one-400-2.woff2',
  'fonts/klee-one-600-1.woff2',
  'fonts/klee-one-600-2.woff2',
  'assets/island_day_sunny_bg_spring.svg',
  'assets/island_day_sunny_bg_summer.svg',
  'assets/island_day_sunny_bg_autumn.svg',
  'assets/island_day_sunny_bg_winter.svg',
  'assets/island_day_sunny_bg_xmas.svg',
  'assets/island_day_rain_bg_spring.svg',
  'assets/island_day_rain_bg_summer.svg',
  'assets/island_day_rain_bg_autumn.svg',
  'assets/island_day_rain_bg_winter.svg',
  'assets/island_day_rain_bg_xmas.svg',
  'assets/island_night_bg_spring.svg',
  'assets/island_night_bg_summer.svg',
  'assets/island_night_bg_autumn.svg',
  'assets/island_night_bg_winter.svg',
  'assets/island_night_bg_xmas.svg',
  'assets/island_late_bg_spring.svg',
  'assets/island_late_bg_summer.svg',
  'assets/island_late_bg_autumn.svg',
  'assets/island_late_bg_winter.svg',
  'assets/island_late_bg_xmas.svg',
  'assets/island_tree_spring.svg',
  'assets/island_tree_summer.svg',
  'assets/island_tree_autumn.svg',
  'assets/island_tree_winter.svg',
  'assets/island_tree_xmas.svg',
  'assets/island_day_sunny_bg_imo.svg',
  'assets/island_day_rain_bg_imo.svg',
  'assets/island_night_bg_imo.svg',
  'assets/island_late_bg_imo.svg',
  'assets/island_tree_imo.svg',
  'assets/island_day_sunny_bg_newyear.svg',
  'assets/island_day_rain_bg_newyear.svg',
  'assets/island_night_bg_newyear.svg',
  'assets/island_late_bg_newyear.svg',
  'assets/photo_bg_momiji.webp',
  'assets/zzz.png',
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

// BGM の音源（docs/SPEC.md「BGM」）。公開はするが、ここではキャッシュしない。音ありにした人だけが、
// 鳴らすときに js/bgm.js が取って別のキャッシュ（cottage-bgm- で始まる）に置く。tools/deploy.py もこの一覧を見てコピーする
const BGM_FILES = [
  'assets/bgm/day.m4a',
  'assets/bgm/night.m4a',
];
const BGM_PREFIX = 'cottage-bgm-';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

// 古い版のキャッシュを消す。消すのは自分（cottage-）の古い版だけで、v1 のキャッシュ（island-）には触らない。
// BGM のキャッシュ（cottage-bgm-）は版を上げても残す（取った曲を通信なしで鳴らせるように。古い音源は js/bgm.js が消す）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && !k.startsWith(BGM_PREFIX)).map((k) => caches.delete(k))))
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
