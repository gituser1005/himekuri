// 読み返し：届いた日記をカレンダー（月・週）で見る。日付をタップするとその日から日記が開く。
// 絞り込み（お気に入り・写真あり・書き手）と、日付を入力して飛ぶこともできる。
// view（表示中の月・週・絞り込み）は呼び出し側が持ち、日記から戻ってきたときも同じ表示にする。

import { dateParts } from './date.js';
import { availableDiaries } from './diaries.js';
import { heartIcon } from './paper.js';
import { monthKeys, monthCells, weekStart, weekDays, weekStarts, matchesFilter, isFiltering, jumpTo } from './calendar.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const CAMERA = '<svg class="camera" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/></svg>';

export function newRereadView() {
  return { mode: 'month', month: null, week: null, filters: { fav: false, photo: false, writers: [] }, message: '' };
}

// onOpen(diaryId): その日から日記を開く / onClose(): 島に戻る
export function renderReread(root, { data, state, today, view, onOpen, onClose }) {
  const diaries = data.diaries; // 日付順
  const byDate = new Map(diaries.map((d) => [d.date, d]));
  const delivered = new Set(availableDiaries(diaries, today).map((d) => d.id));
  const read = new Set(state.read);
  const months = monthKeys(diaries);
  const weeks = weekStarts(diaries);

  // 最初は、いちばん新しく届いた日記のある月・週を出す
  const latest = availableDiaries(diaries, today).at(-1)?.date ?? diaries[0].date;
  view.month ??= latest.slice(0, 7);
  view.week ??= weekStart(latest);

  function render() {
    root.innerHTML = `
      <section class="screen reread">
        <header class="screen-head">
          <button class="back-btn">‹ 島</button>
          <h1 class="screen-title">読み返し</h1>
          <span class="screen-head-space"></span>
        </header>
        <div class="cal-bar">
          <div class="cal-mode" role="tablist">
            <button data-mode="month" class="${view.mode === 'month' ? 'is-on' : ''}">月</button>
            <button data-mode="week" class="${view.mode === 'week' ? 'is-on' : ''}">週</button>
          </div>
          <div class="cal-nav">
            <button class="cal-prev" aria-label="前へ">‹</button>
            <span class="cal-label">${label()}</span>
            <button class="cal-next" aria-label="次へ">›</button>
          </div>
        </div>
        <div class="cal-filters">
          <button data-filter="fav" class="chip-btn ${view.filters.fav ? 'is-on' : ''}">${heartIcon()}お気に入り</button>
          <button data-filter="photo" class="chip-btn ${view.filters.photo ? 'is-on' : ''}">${CAMERA}写真あり</button>
          ${Object.entries(data.writers).map(([id, w]) => `
            <button data-writer="${id}" class="chip-btn ${view.filters.writers.includes(id) ? 'is-on' : ''}"><img class="avatar" src="${w.avatar}" alt="">${w.name}</button>
          `).join('')}
          ${isFiltering(view.filters) ? '<button class="chip-clear">クリア</button>' : ''}
        </div>
        ${view.mode === 'month' ? monthHtml() : weekHtml()}
        <form class="cal-jump">
          <label>日付で探す <input type="date" name="date" min="${diaries[0].date}" max="${diaries.at(-1).date}" required></label>
          <button>ひらく</button>
        </form>
        <p class="cal-message" role="status">${view.message}</p>
      </section>
    `;
    view.message = '';
    bind();
  }

  function label() {
    if (view.mode === 'month') {
      const [y, m] = view.month.split('-').map(Number);
      return `${y}年${m}月`;
    }
    const a = dateParts(view.week);
    const b = dateParts(weekDays(view.week)[6]);
    return `${a.month}/${a.day}〜${b.month}/${b.day}`;
  }

  // 日記が開ける日か、当てはまらない日（薄く表示）か
  function dayInfo(ymd) {
    const diary = byDate.get(ymd);
    if (!diary || !delivered.has(diary.id)) return { diary: null };
    const dim = isFiltering(view.filters) && !matchesFilter(diary, view.filters, state.favorites);
    return {
      diary,
      dim,
      fav: state.favorites.includes(diary.id),
      unread: !read.has(diary.id),
      writer: data.writers[diary.writer],
    };
  }

  function marks(info) {
    return `
      ${info.fav ? `<span class="mark-fav">${heartIcon()}</span>` : ''}
      ${info.diary.snapshot ? `<span class="mark-photo">${CAMERA}</span>` : ''}
      ${info.unread ? '<span class="mark-unread">未読</span>' : ''}`;
  }

  function monthHtml() {
    const cells = monthCells(view.month).map((ymd) => {
      if (!ymd) return '<div class="cal-cell is-blank"></div>';
      const { day } = dateParts(ymd);
      const info = dayInfo(ymd);
      const todayClass = ymd === today ? 'is-today' : '';
      if (!info.diary) return `<div class="cal-cell is-empty ${todayClass}"><span class="cal-day">${day}</span></div>`;
      return `
        <button class="cal-cell ${info.dim ? 'is-dim' : ''} ${todayClass}" data-id="${info.diary.id}">
          <span class="cal-day">${day}</span>
          <img class="avatar" src="${info.writer.avatar}" alt="${info.writer.name}">
          <span class="cal-marks">${marks(info)}</span>
        </button>`;
    });
    return `
      <div class="cal-month">
        ${WEEKDAYS.map((w, i) => `<div class="cal-weekday ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}">${w}</div>`).join('')}
        ${cells.join('')}
      </div>`;
  }

  function weekHtml() {
    const rows = weekDays(view.week).map((ymd) => {
      const { month, day, weekday } = dateParts(ymd);
      const info = dayInfo(ymd);
      const date = `<span class="week-date">${month}/${day}<small>（${weekday}）</small></span>`;
      if (!info.diary) return `<li class="week-row is-empty">${date}</li>`;
      return `
        <li>
          <button class="week-row ${info.dim ? 'is-dim' : ''}" data-id="${info.diary.id}">
            ${date}
            <span class="week-main">
              <span class="week-title">${info.diary.title}</span>
              <span class="week-writer"><img class="avatar" src="${info.writer.avatar}" alt="">${info.writer.name}</span>
            </span>
            <span class="cal-marks">${marks(info)}</span>
          </button>
        </li>`;
    });
    return `<ul class="cal-week">${rows.join('')}</ul>`;
  }

  function step(delta) {
    if (view.mode === 'month') {
      const i = months.indexOf(view.month) + delta;
      if (i >= 0 && i < months.length) view.month = months[i];
    } else {
      const i = weeks.indexOf(view.week) + delta;
      if (i >= 0 && i < weeks.length) view.week = weeks[i];
    }
    render();
  }

  function bind() {
    root.querySelector('.back-btn').addEventListener('click', onClose);
    const list = view.mode === 'month' ? months : weeks;
    const pos = list.indexOf(view.mode === 'month' ? view.month : view.week);
    const prev = root.querySelector('.cal-prev');
    const next = root.querySelector('.cal-next');
    prev.disabled = pos <= 0;
    next.disabled = pos >= list.length - 1;
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));

    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      view.mode = b.dataset.mode;
      render();
    }));
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      view.filters[b.dataset.filter] = !view.filters[b.dataset.filter];
      render();
    }));
    root.querySelectorAll('[data-writer]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.writer;
      const w = view.filters.writers;
      view.filters.writers = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      render();
    }));
    root.querySelector('.chip-clear')?.addEventListener('click', () => {
      view.filters = newRereadView().filters;
      render();
    });
    root.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => onOpen(b.dataset.id)));

    root.querySelector('.cal-jump').addEventListener('submit', (e) => {
      e.preventDefault();
      const ymd = new FormData(e.target).get('date');
      const result = jumpTo(diaries, today, ymd);
      if (result.id) {
        onOpen(result.id);
      } else {
        view.message = result.message;
        render();
      }
    });
  }

  render();
}
