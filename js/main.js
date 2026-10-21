import { getNow, appDate, timeSlot } from './date.js';
import { loadDiaries } from './diaries.js';
import { newState, normalizeState, recordOpen, isReturnOpen, markOpened, markRead, setFavorite } from './state.js';
import { renderIsland, updateClock } from './island.js';
import { renderDiary } from './diary.js';
import { renderReread, newRereadView } from './reread.js';
import { renderRecord } from './record.js';
import * as store from './store.js';

const app = document.getElementById('app');

// ?reset=1 で保存データを消す（デバッグ用）。再読み込みで消え続けないよう URL から外す
const params = new URLSearchParams(location.search);
if (params.has('reset')) {
  store.clear();
  params.delete('reset');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
}

let now = getNow();
let today = appDate(now);
let slot = timeSlot(now);

const saved = store.load();
const state = saved ? normalizeState(saved, today) : newState(today);
recordOpen(state, now);
store.save(state);

let data;
try {
  data = await loadDiaries();
} catch (e) {
  app.textContent = e.message;
  throw e;
}

let screen = 'island';

function showIsland() {
  screen = 'island';
  renderIsland(app, {
    now, today, data, state,
    onMekuri: () => showDiary(),
    onReread: showReread,
    onRecord: showRecord,
  });
}

// startId を渡すとその日から、渡さなければいちばん古い未読から開く
// fromReread なら、閉じたときに読み返しへ戻る
function showDiary(startId, fromReread = false) {
  screen = 'diary';
  markOpened(state, 'mekuri');
  store.save(state);
  renderDiary(app, {
    data, state, today, startId,
    backLabel: fromReread ? '読み返し' : '島',
    onShow: (id) => {
      markRead(state, id);
      store.save(state);
    },
    onFavorite: (id, on) => {
      setFavorite(state, id, on);
      store.save(state);
    },
    onClose: fromReread ? showReread : showIsland,
  });
}

// 読み返しの表示（月・週・絞り込み）は、アプリを開いているあいだ覚えておく
const rereadView = newRereadView();

function showReread() {
  screen = 'reread';
  markOpened(state, 'reread');
  store.save(state);
  renderReread(app, {
    data, state, today, view: rereadView,
    onOpen: (id) => showDiary(id, true),
    onClose: showIsland,
  });
}

function showRecord() {
  screen = 'record';
  renderRecord(app, { data, state, today, onClose: showIsland });
}

// 時計を進める。島を見ているときに日付（5時）や時間帯が変わったら描き直す
function tick() {
  now = getNow();
  const changed = appDate(now) !== today || timeSlot(now) !== slot;
  today = appDate(now);
  slot = timeSlot(now);
  if (screen !== 'island') return; // ほかの画面からは、島に戻るときに新しい日付で描かれる
  if (changed) showIsland();
  else updateClock(app, now, today);
}
setInterval(tick, 30 * 1000);

// 10分以上裏にいて戻ってきたら、1回開いたと数える（iPhone はアプリを閉じても裏で生きていることが多いため）
// 戻った画面が日記や読み返しなら、その回はそれを開いた回として記録する
// 裏にいた時間は ?now ではなく本当の時刻で測る
let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    return;
  }
  if (isReturnOpen(hiddenAt, Date.now())) {
    recordOpen(state, getNow());
    if (screen === 'diary') markOpened(state, 'mekuri');
    if (screen === 'reread') markOpened(state, 'reread');
    store.save(state);
  }
  hiddenAt = null;
  tick();
});

showIsland();
