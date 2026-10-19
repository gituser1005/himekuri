import { getNow, isNowOverridden, appDate, dateParts } from './date.js';
import { koyomiFor } from './calendar.js';
import { attachSwipe } from './swipe.js';
import { syncPages, visibleDates } from './pages.js';
import { autoFlipText } from './content.js';
import { stampMarkHtml, openStampPicker } from './stamp.js';
import { openBack } from './back.js';
import { openRecord } from './record.js';
import * as store from './store.js';

const MAX_THICKNESS_LAYERS = 6;
const MAX_PILE_CARDS = 12; // 置き場に描くのは新しい方からこの枚数まで

const pad = document.getElementById('pad');
const pile = document.getElementById('pile');

// ?reset=1 で保存データを消す（デバッグ用）。再読み込みで消え続けないよう URL から外す
const params = new URLSearchParams(location.search);
if (params.has('reset')) {
  store.clear();
  params.delete('reset');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
}

let today = null;
let state = null;

function sync() {
  today = appDate(getNow());
  const result = syncPages(store.load(), today);
  state = result.state;
  store.save(state);
  renderAll();
  if (result.autoFlipped) showNotice(autoFlipText());
}

function renderPage(ymd) {
  const data = state.pages[ymd];
  const { year, month, day, weekday, weekdayIndex } = dateParts(ymd);
  const koyomi = koyomiFor(ymd);
  const weekdayClass = weekdayIndex === 0 ? 'is-sun' : weekdayIndex === 6 ? 'is-sat' : '';

  const page = document.createElement('article');
  page.className = 'page';
  page.innerHTML = `
    <header class="page-head">
      <span class="page-ym">${year}年 ${month}月</span>
    </header>
    <div class="page-date">
      <span class="page-day">${day}</span>
      <span class="page-weekday ${weekdayClass}">${weekday}</span>
    </div>
    ${koyomi ? `
    <div class="page-koyomi">
      <div class="koyomi-sekki"><ruby>${koyomi.sekki}<rt>${koyomi.sekkiYomi}</rt></ruby></div>
      <div class="koyomi-kou">${koyomi.kou}<span class="koyomi-kou-yomi">${koyomi.kouYomi}</span></div>
    </div>` : ''}
    <div class="page-photo" aria-label="写真（仮）"><span class="photo-id">${data.photoId ?? ''}</span></div>
    <button class="page-stamp ${data.stamp ? 'has-stamp' : ''}" aria-label="ハンコ欄">${data.stamp ? stampMarkHtml(data.stamp, ymd) : ''}</button>
  `;
  return page;
}

// いちばん上の紙のハンコ欄。タップで選んで押す（押し直し可）
function attachStamp(page, ymd) {
  const slot = page.querySelector('.page-stamp');
  slot.addEventListener('pointerdown', (e) => e.stopPropagation()); // 紙のスワイプを始めない
  slot.addEventListener('click', () => {
    openStampPicker(state.pages[ymd].stamp, (id) => {
      state.pages[ymd].stamp = id;
      store.save(state);
      slot.classList.add('has-stamp');
      slot.innerHTML = stampMarkHtml(id, ymd, 'is-pressed');
    });
  });
}

function renderAll() {
  renderPad();
  renderPile();
}

function renderPad() {
  pad.replaceChildren();

  const dates = visibleDates(state, today);
  const unflipped = dates.filter((d) => !state.pages[d].flipped);
  // 通常は今日の紙が必ず残る。時計を戻された場合などで空なら、いちばん新しい紙を出す
  const stack = unflipped.length ? unflipped : dates.slice(-1);
  if (!stack.length) return;

  const layers = Math.min(stack.length - 1, MAX_THICKNESS_LAYERS);
  for (let i = layers; i >= 1; i--) {
    const layer = document.createElement('div');
    layer.className = 'thickness';
    layer.style.setProperty('--i', i);
    pad.append(layer);
  }

  if (stack[1]) {
    const under = renderPage(stack[1]);
    under.classList.add('is-under');
    pad.append(under);
  }

  const topDate = stack[0];
  const top = renderPage(topDate);
  pad.append(top);
  attachStamp(top, topDate);
  attachSwipe(top, {
    canFlip: topDate < today, // 今日の紙はめくれない
    onFlip: () => {
      state.pages[topDate].flipped = true;
      store.save(state);
      pile.append(pileCard(topDate, true));
      trimPile();
      renderPad();
    },
  });
}

const flippedDates = () => visibleDates(state, today).filter((d) => state.pages[d].flipped);

function renderPile() {
  pile.replaceChildren(...flippedDates().slice(-MAX_PILE_CARDS).map((d) => pileCard(d, false)));
}

// 束をタップすると、いちばん新しい紙の裏が開く
pile.addEventListener('click', () => {
  const dates = flippedDates();
  if (dates.length) openBack(dates, dates.length - 1, (d) => state.pages[d]);
});

document.getElementById('record-btn').addEventListener('click', () => openRecord(state, today));

function trimPile() {
  while (pile.children.length > MAX_PILE_CARDS) pile.firstElementChild.remove();
}

function pileCard(ymd, animate) {
  const { month, day } = dateParts(ymd);
  const card = document.createElement('div');
  card.className = 'pile-card' + (animate ? ' is-new' : '');
  // 日付から決まる小さな傾きとずれで、無造作に重なって見えるようにする
  const r = ((day * 37) % 11) - 5;
  const x = ((day * 53) % 21) - 10;
  card.style.setProperty('--r', `${r}deg`);
  card.style.setProperty('--x', `${x}px`);
  card.textContent = `${month}/${day}`;
  return card;
}

function showNotice(text) {
  document.querySelector('.notice')?.remove();
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.textContent = text;
  notice.addEventListener('click', () => notice.remove());
  document.body.append(notice);
}

if (isNowOverridden()) {
  const badge = document.createElement('div');
  badge.className = 'debug-badge';
  badge.textContent = `now: ${getNow().toLocaleString('ja-JP')} → ${appDate(getNow())}`;
  document.body.append(badge);
}

// 開いたまま午前5時をまたいだ場合に備え、アプリに戻ってきたら日付を確かめ直す
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && appDate(getNow()) !== today) sync();
});

sync();
