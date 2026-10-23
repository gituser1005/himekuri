// 日記：届いた日記を1冊の本のように横にめくって読む。
// 左へスワイプか「›」で次の日、右へスワイプか「‹」で前の日。紙は左端を綴じ目にしてめくれる。
// 紙を表示した時点で既読になる。届いている最後の日記の次は「ここまで」の紙。

import { availableDiaries, unreadDiaries } from './diaries.js';
import { paperHtml } from './paper.js';

const TURN_ANGLE = 115;       // めくり切ったときの角度
const TURN_DISTANCE = 0.18;   // 幅に対してこれ以上めくったら、離したときにめくり切る
const TURN_VELOCITY = 0.3;    // px/ms。これより速く払ったらめくり切る

// 「ここまで」の紙の文言
export function endText(diaries, today) {
  return availableDiaries(diaries, today).length >= diaries.length ? '試作の日記はここまでです' : '日記はここまでです。';
}

// 開く位置。startId があればその日、なければいちばん古い未読、未読がなければ「ここまで」の紙
export function startIndex(pages, readIds, startId) {
  if (startId) {
    const i = pages.findIndex((d) => d.id === startId);
    if (i >= 0) return i;
  }
  const read = new Set(readIds);
  const i = pages.findIndex((d) => !read.has(d.id));
  return i >= 0 ? i : pages.length;
}

// onShow(id): 既読にして保存 / onFavorite(id, on): お気に入りを保存
// onClose(): 開いた元（島か読み返し）に戻る。backLabel はその名前
export function renderDiary(root, { data, state, today, startId, backLabel = '島', onShow, onFavorite, onClose }) {
  const pages = availableDiaries(data.diaries, today);
  let index = startIndex(pages, state.read, startId);

  root.innerHTML = `
    <section class="diary">
      <header class="diary-head">
        <span class="diary-unread"></span>
      </header>
      <div class="book"></div>
      <nav class="diary-nav">
        <button class="nav-btn nav-prev" aria-label="前の日">‹</button>
        <button class="home-btn back-btn">${backLabel}にもどる</button>
        <button class="nav-btn nav-next" aria-label="次の日">›</button>
      </nav>
    </section>
  `;
  const book = root.querySelector('.book');
  const prevBtn = root.querySelector('.nav-prev');
  const nextBtn = root.querySelector('.nav-next');
  const unreadEl = root.querySelector('.diary-unread');
  root.querySelector('.back-btn').addEventListener('click', onClose);
  prevBtn.addEventListener('click', () => turn(-1));
  nextBtn.addEventListener('click', () => turn(1));

  function pageEl(i) {
    const el = document.createElement('article');
    if (i >= pages.length) {
      el.className = 'paper paper-end';
      el.innerHTML = `<p>${endText(data.diaries, today)}</p><button class="end-back">${backLabel}にもどる</button>`;
      el.querySelector('.end-back').addEventListener('click', onClose);
      return el;
    }
    const diary = pages[i];
    el.className = 'paper';
    el.innerHTML = `<div class="paper-scroll">${paperHtml(diary, data.writers, state.favorites.includes(diary.id))}</div>`;
    const fav = el.querySelector('.fav-btn');
    fav.addEventListener('click', () => {
      const on = !state.favorites.includes(diary.id);
      onFavorite(diary.id, on);
      fav.classList.toggle('is-on', on);
      fav.setAttribute('aria-pressed', String(on));
    });
    return el;
  }

  function show() {
    const el = pageEl(index);
    el.classList.add('is-current');
    book.replaceChildren(el);
    if (index < pages.length) onShow(pages[index].id);
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index >= pages.length;
    const unread = unreadDiaries(data.diaries, state.read, today).length;
    unreadEl.textContent = unread ? `未読 あと${unread}枚` : '';
  }

  // ---- めくる動き ----
  // 次へ: いまの紙が左端を軸に回って去り、下から次の紙が見える
  // 前へ: 前の紙が回った状態から戻ってきて、いまの紙の上に重なる
  let turning = false;

  function prepare(dir) {
    const target = index + dir;
    if (target < 0 || target > pages.length) return null;
    const current = book.querySelector('.is-current');
    const other = pageEl(target);
    if (dir > 0) {
      book.insertBefore(other, current);
      return { dir, target, moving: current, other };
    }
    setAngle(other, -TURN_ANGLE);
    book.append(other);
    return { dir, target, moving: other, other };
  }

  const angleAt = (t, p) => (t.dir > 0 ? -TURN_ANGLE * p : -TURN_ANGLE * (1 - p));

  function setAngle(el, deg) {
    el.style.transform = `rotateY(${deg}deg)`;
    el.style.setProperty('--shade', Math.min(1, -deg / 90).toFixed(2));
  }

  function settle(t, complete) {
    void t.moving.offsetWidth; // 直前の角度から動き出すように
    t.moving.style.transition = 'transform 0.4s ease-out';
    setAngle(t.moving, angleAt(t, complete ? 1 : 0));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (complete) {
        index = t.target;
        show();
      } else {
        t.other.remove();
        if (t.dir < 0) t.moving.remove();
        book.querySelector('.is-current')?.style.removeProperty('transform');
      }
      turning = false;
    };
    t.moving.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 500); // transitionend が来ない場合の保険
  }

  function turn(dir) {
    if (turning) return;
    const t = prepare(dir);
    if (!t) return;
    turning = true;
    settle(t, true);
  }

  // 横のスワイプでめくる。縦の動きは紙の中のスクロールに任せる
  let drag = null;
  book.addEventListener('pointerdown', (e) => {
    if (turning || e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, v: 0, p: 0, t: null };
  });
  book.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.t) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.t = prepare(dx < 0 ? 1 : -1);
      if (!drag.t) { drag = null; return; }
      turning = true;
      drag.t.moving.style.transition = 'none';
      book.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    const w = book.clientWidth;
    drag.p = Math.min(1, Math.max(0, drag.t.dir > 0 ? -dx / w : dx / w));
    setAngle(drag.t.moving, angleAt(drag.t, drag.p));
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.t) return;
    const fast = d.t.dir > 0 ? d.v < -TURN_VELOCITY : d.v > TURN_VELOCITY;
    settle(d.t, d.p > TURN_DISTANCE || fast);
  };
  book.addEventListener('pointerup', end);
  book.addEventListener('pointercancel', end);

  show();
}
