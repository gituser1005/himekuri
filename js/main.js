import { getNow, appDate, timeSlot, isNowOverridden } from './date.js';
import { loadScripts, catchUp, weatherOf, eventTreeToday, appDiaries, pendingSnapshots, snapshotKeys } from './journal.js';
import { renderSnapshot } from './snapshot.js';
import { newState, normalizeState, markRead, setFavorite } from './state.js';
import { renderIsland, updateClock } from './island.js';
import { renderDiary } from './diary.js';
import { renderReread, newRereadView } from './reread.js';
import { renderRecord } from './record.js';
import { renderTrialRecord, renderTrialRecordOff } from './trial-record.js';
import { renderStart, renderForm, renderList, renderEdit, renderDeleteConfirm, renderResetConfirm, renderDone } from './register.js';
import {
  emptyForm, formOf, newCottage, addNui, editNui, removeNui, startCottage, startPreset, setManagerName, isStarted, PRESET_FORMS,
} from './profile.js';
import { processAsset, putPhoto, prunePhotos, usedPhotoKeys, clearPhotos, requestPersist, sceneNuis, photoUrl } from './photos.js';
import * as store from './store.js';
import { logEvent, noteFirstRead, pruneUsage } from './usage.js';
import { summarize } from './usage-summary.js';

const app = document.getElementById('app');

// ?reset=1 で保存データと写真を消す（デバッグ用）。再読み込みで消え続けないよう URL から外す
const params = new URLSearchParams(location.search);
if (params.has('reset')) {
  store.clear();
  await clearPhotos().catch((e) => console.warn('写真を消せませんでした', e));
  params.delete('reset');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
}

let now = getNow();
let today = appDate(now);
let slot = timeSlot(now);

const saved = store.load();
const state = saved ? normalizeState(saved, today) : newState(today);

// 利用ログ（usage.js。docs/SPEC.md「4. 記録（テスト用）」）。?now= で時刻を変えているあいだは記録しない。
// 記録したら保存する。初期化を始めたら記録しない（読み込み直すときの「裏へ移った」で、消す前の保存データを書き戻さないように）
const LOGGING = !isNowOverridden();
let resetting = false;
function logUsage(type, extra) {
  if (LOGGING && !resetting && logEvent(state, getNow(), navigator.userAgent, type, extra)) store.save(state);
}
const logScreen = (s) => logUsage('screen', { s });
if (LOGGING) pruneUsage(state.usage, today);
logUsage('launch');
store.save(state);

// 登録の途中でやめた写真など、保存データから使われていない写真を消す
prunePhotos(usedPhotoKeys(state.cottage, snapshotKeys(state.cottage))).catch((e) => console.warn('写真を片付けられませんでした', e));

// 日記の台本（日記の選び方の部品 selection/ が使う）
let scripts;
try {
  scripts = await loadScripts();
} catch (e) {
  app.textContent = e.message;
  throw e;
}

// 画面が読む日記 { writers, diaries }（journal.js の appDiaries。届いた日記だけ）。島を描くたびに作り直す
let data = { writers: {}, diaries: [] };

// まだ決めていない日の日記を今日まで決めて（何日も開かなかったときは、空いた日のぶんを1日ずつ順に）、画面が読む形にする。
// 書き手の写真は IndexedDB から読む
async function refreshDiaries() {
  if (catchUp(state.cottage, scripts, state.islandSeed, today)) store.save(state);
  const photos = await sceneNuis(state.cottage?.nuis ?? []);
  await makeSnapshots(photos);
  const keys = snapshotKeys(state.cottage);
  const urls = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await photoUrl(k).catch(() => null)])));
  data = appDiaries(state.cottage, photos, today, urls);
  return photos;
}

// まだ作っていない日記の写真を、日付順に1回だけ作って IndexedDB に保存する（作れなかったら、次に開いたときにもう一度）。
// 写る子は、今の子の写真で作る。写真がない子（消した子など）は外し、写る子がいなければ写真を付けない
async function makeSnapshots(photos) {
  const before = JSON.stringify(state.cottage?.diaryRecord ?? null).length;
  const pending = pendingSnapshots(state.cottage); // 登録済みのキャラクターの v1 の写真は、ここで決まる
  for (const p of pending) {
    const cast = p.diary.snapshot.cast.map((id) => photos.find((x) => x.id === id)).filter(Boolean);
    if (!cast.length) {
      p.diary.snapshot = null;
      continue;
    }
    try {
      const blob = await renderSnapshot(p.diary.snapshot, { date: p.date, weather: p.weather, cast });
      await putPhoto(p.key, { blob, w: 600, h: 450, cutout: false, at: new Date().toISOString() });
      p.diary.snapshot.key = p.key;
    } catch (e) {
      console.warn('日記の写真を作れませんでした', p.id, e);
    }
  }
  if (pending.length || JSON.stringify(state.cottage?.diaryRecord ?? null).length !== before) store.save(state);
}

let screen = 'island';

// ---- 画面の行き来 ----
// Android の「戻る」でアプリが閉じず1つ前の画面に戻るよう、画面を開くたびに履歴を1つ積み、
// 戻った先の画面を描き直す関数を stack に積んでおく。
// 画面の「○○にもどる」も履歴を戻すだけにして、どちらで戻っても同じ動きにする
let current = null; // 今の画面を描く関数
const stack = [];
let unwinding = false;
let popCount = 1; // 次の popstate で戻る画面の数

function forward(show) {
  stack.push(current);
  history.pushState(null, '');
  current = show;
  show();
}
const back = () => history.back();
// n 画面まとめて戻る（削除の最終確認から一覧へ、など）
function backBy(n) {
  popCount = n;
  history.go(-n);
}

// いちばん最初の画面：始めたあとは島、登録の途中なら一覧、まだなら、はじめ方
function rootScreen() {
  if (isStarted(state.cottage)) return showIsland;
  if (state.cottage?.nuis.length) return showList;
  return showStart;
}
function showRoot() {
  current = rootScreen();
  current();
}
// 積んだ履歴をすべて戻して、いちばん最初の画面を出す（登録を終えて島へ、など）
function goRoot() {
  const n = stack.length;
  stack.length = 0;
  if (n === 0) return showRoot();
  unwinding = true;
  history.go(-n);
}
window.addEventListener('popstate', () => {
  if (resetting) return location.reload();
  // 登録が終わったときの画面から戻るときは、登録の画面ではなく島へ
  if (unwinding || screen === 'done') {
    unwinding = false;
    stack.length = 0;
    showRoot();
    return;
  }
  let prev;
  for (let i = 0; i < popCount; i++) prev = stack.pop();
  popCount = 1;
  current = prev ?? rootScreen();
  current();
});

// ---- 島・日記・読み返し・記録 ----

// コテージの絵に出すぬいの写真を IndexedDB から読んでから描く（読んだ写真は開いているあいだ覚えておくので、2回目からはすぐ）。
// 読んでいるあいだに別の画面へ移ったら描かない
let islandTicket = 0;
async function showIsland() {
  screen = 'island';
  const ticket = ++islandTicket;
  const nuis = await refreshDiaries();
  if (ticket !== islandTicket || screen !== 'island') return;
  renderIsland(app, {
    now, today, data, state, nuis, weather: weatherOf(state.cottage, today),
    eventTree: eventTreeToday(state.cottage, scripts, state.islandSeed, today),
    onMekuri: () => forward(() => showDiary()),
    onReread: () => forward(showReread),
    onRecord: () => forward(showRecord),
  });
}

// startId を渡すとその日から、渡さなければいちばん古い未読から開く
// fromReread なら、閉じたときに読み返しへ戻る（戻る先は stack が覚えている）
function showDiary(startId, fromReread = false) {
  screen = 'diary';
  logScreen('diary');
  renderDiary(app, {
    data, state, today, startId,
    backLabel: fromReread ? '読み返し' : 'コテージ',
    onShow: (id) => {
      markRead(state, id);
      if (LOGGING) noteFirstRead(state, getNow(), navigator.userAgent, id);
      store.save(state);
    },
    onFavorite: (id, on) => {
      setFavorite(state, id, on);
      store.save(state);
    },
    onClose: back,
  });
}

// 読み返しの表示（月・週・絞り込み）は、アプリを開いているあいだ覚えておく
const rereadView = newRereadView();

function showReread() {
  screen = 'reread';
  logScreen('reread');
  renderReread(app, {
    data, state, today, view: rereadView,
    onOpen: (id) => forward(() => showDiary(id, true)),
    onClose: back,
  });
}

// confirm が 1・2 なら、初期化の確認をその上に重ねる（戻るで1つずつ閉じる）
function showRecord(confirm = 0) {
  screen = 'record';
  logScreen('record');
  renderRecord(app, {
    onClose: back,
    onTrial: () => forward(showTrial),
    onNuis: isStarted(state.cottage) ? () => forward(showList) : undefined,
    onReset: () => forward(() => showRecord(1)),
  });
  if (!confirm) return;
  renderResetConfirm(app, {
    step: confirm,
    onNext: confirm === 1 ? () => forward(() => showRecord(2)) : resetAll,
    onCancel: () => backBy(confirm),
  });
}

// 試用の記録（集計画面）。数字は開いたときに一度だけ作り、撮影のため裏へ移って戻っても、この画面にいるあいだは変えない
// （戻るで記録の画面へ戻り、もう一度開いたときに作り直す）。?now= で時刻を変えているあいだは出さない
function showTrial() {
  screen = 'trial';
  logScreen('trial');
  if (!LOGGING || !state.usage) {
    renderTrialRecordOff(app, { onClose: back });
    return;
  }
  renderTrialRecord(app, { summary: summarize(state, getNow()), onClose: back });
}

// 初期化：保存データ（cottage.v1）と写真を消し、積んだ履歴をすべて戻してから読み込み直す（はじめ方から）。
// 島の種も消えるので、読み込み直したときに新しく作る
async function resetAll() {
  resetting = true;
  store.clear();
  await clearPhotos().catch((e) => console.warn('写真を消せませんでした', e));
  const n = stack.length;
  stack.length = 0;
  if (n === 0) return location.reload();
  history.go(-n);
}

// ---- ぬいの登録（docs/nui-register.md）----

function showStart() {
  screen = 'start';
  logScreen('register');
  renderStart(app, {
    onRegister: () => openNewForm(),
    onPreset: async () => {
      const cottage = startPreset(getNow());
      for (const n of cottage.nuis) {
        const { avatar } = PRESET_FORMS.find((p) => p.id === n.id);
        await putPhoto(n.photo, await processAsset(avatar));
      }
      state.cottage = cottage;
      store.save(state);
      requestPersist();
      forward(showDone);
    },
  });
}

// 1体の登録。入力（form）は、この画面を開いているあいだだけ持つ
function openNewForm() {
  const form = emptyForm();
  forward(() => showForm(form));
}

function showForm(form) {
  screen = 'form';
  logScreen('register');
  const cottage = state.cottage ?? newCottage();
  const count = cottage.nuis.length + 1;
  renderForm(app, {
    form,
    topLabel: `${count}体目${isStarted(cottage) ? '' : '（2体以上で始めます）'}`,
    others: cottage.nuis,
    submitLabel: 'このぬいぐるみを登録する',
    onBack: back,
    onSubmit: () => {
      state.cottage ??= cottage;
      const added = addNui(state.cottage, form, getNow());
      store.save(state);
      if (isStarted(state.cottage) && added.joined) logUsage('nui', { op: 'add', id: added.id });
      requestPersist();
      // 始める前は一覧（いちばん最初の画面）へ。始めたあとは、開いてきた一覧へ戻る
      if (isStarted(state.cottage)) back();
      else goRoot();
    },
  });
}

function showList() {
  screen = 'list';
  logScreen('register');
  renderList(app, {
    cottage: state.cottage,
    onAdd: () => openNewForm(),
    onEdit: (id) => forward(() => showEdit(id)),
    onManagerName: (name) => {
      setManagerName(state.cottage, name, getNow());
      store.save(state);
    },
    onStart: (name) => {
      startCottage(state.cottage, name, getNow());
      store.save(state);
      forward(showDone);
    },
    onClose: back,
  });
}

// プロフィールの編集。confirm が 1・2 なら、削除の確認をその上に重ねる（戻るで1つずつ閉じる）
async function showEdit(id, confirm = 0) {
  screen = 'edit';
  logScreen('register');
  const nui = state.cottage.nuis.find((n) => n.id === id);
  if (!nui) return back(); // 削除したあとなど
  await renderEdit(app, {
    cottage: state.cottage,
    nui,
    onBack: back,
    onChange: (field) => {
      const form = formOf(nui);
      forward(() => showEditForm(id, form, field));
    },
    onDelete: () => forward(() => showEdit(id, 1)),
  });
  if (!confirm) return;
  renderDeleteConfirm(app, {
    step: confirm,
    nui,
    started: isStarted(state.cottage),
    // 1回目の「削除に進む」で2回目へ。「やめる」は編集へ戻る（2回目からは2つ戻る）
    onNext: confirm === 1 ? () => forward(() => showEdit(id, 2)) : () => deleteNui(id),
    onCancel: () => backBy(confirm),
  });
}

// 削除：写真とプロフィールを消して一覧へ（編集・確認1・確認2の3つ戻る）。始まりの日の控えの写真は残す
function deleteNui(id) {
  removeNui(state.cottage, id);
  store.save(state);
  logUsage('nui', { op: 'delete', id });
  prunePhotos(usedPhotoKeys(state.cottage, snapshotKeys(state.cottage))).catch((e) => console.warn('写真を消せませんでした', e));
  // 始める前に1体もいなくなったら、はじめ方へ
  if (!state.cottage.nuis.length) goRoot();
  else backBy(3);
}

// 「変える」：1体の登録と同じ画面を、今の値を入れて開き、押した項目まで移る
function showEditForm(id, form, field) {
  screen = 'form';
  logScreen('register');
  const nui = state.cottage.nuis.find((n) => n.id === id);
  renderForm(app, {
    form,
    topLabel: nui.name,
    others: state.cottage.nuis.filter((n) => n.id !== id),
    submitLabel: '変更を保存する',
    focus: field,
    onBack: back,
    onSubmit: () => {
      const fields = editNui(state.cottage, id, form, getNow());
      store.save(state);
      if (fields.length) logUsage('nui', { op: 'edit', id, fields });
      // 写真を変えたら、前の写真を消す（始まりの日の控えの写真は残す）
      prunePhotos(usedPhotoKeys(state.cottage, snapshotKeys(state.cottage))).catch((e) => console.warn('写真を消せませんでした', e));
      back();
    },
  });
}

function showDone() {
  screen = 'done';
  logScreen('register');
  renderDone(app, { cottage: state.cottage, onGo: goRoot });
}

// ---- 時計と、裏から戻ったとき ----

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

// 裏へ移ったときと、表に戻ったときを利用ログに残す（iPhone はアプリを閉じても裏で生きていることが多いので、
// 10分以上裏にいて戻ったときを新しい「開いた回」と数える。数えるのは集計の側。usage-summary.js）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    logUsage('hide');
    return;
  }
  logUsage('show');
  tick();
});

showRoot();
