// めくった紙の裏を読む画面。左右スワイプ（または ‹ › ボタン）で前後の日へ。

import { dateParts } from './date.js';
import { lineText, writerName, reactionText } from './content.js';
import { stampMarkHtml } from './stamp.js';

const SWIPE_DISTANCE = 40;

// dates: めくった紙の日付（古い順）、index: 最初に開く位置、getPage: 日付 → 保存データの紙
export function openBack(dates, index, getPage) {
  const backdrop = document.createElement('div');
  backdrop.className = 'back-backdrop';
  backdrop.innerHTML = `
    <div class="back-card" role="dialog" aria-label="紙の裏">
      <button class="back-close" aria-label="とじる">×</button>
      <div class="back-body"></div>
      <nav class="back-nav">
        <button class="back-prev" aria-label="前の日">‹</button>
        <span class="back-pos"></span>
        <button class="back-next" aria-label="次の日">›</button>
      </nav>
    </div>
  `;
  const card = backdrop.querySelector('.back-card');
  const body = backdrop.querySelector('.back-body');
  const pos = backdrop.querySelector('.back-pos');
  const prev = backdrop.querySelector('.back-prev');
  const next = backdrop.querySelector('.back-next');

  function show(i, direction = 0) {
    index = i;
    const ymd = dates[index];
    body.innerHTML = backHtml(ymd, getPage(ymd));
    pos.textContent = `${index + 1} / ${dates.length}`;
    prev.disabled = index === 0;
    next.disabled = index === dates.length - 1;
    if (direction) {
      body.classList.remove('slide-from-left', 'slide-from-right');
      void body.offsetWidth; // アニメーションをやり直す
      body.classList.add(direction < 0 ? 'slide-from-left' : 'slide-from-right');
    }
  }
  const go = (delta) => {
    const i = index + delta;
    if (i >= 0 && i < dates.length) show(i, delta);
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  backdrop.querySelector('.back-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  // 右へ払うと古い日、左へ払うと新しい日
  let startX = null;
  card.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  card.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (dx > SWIPE_DISTANCE) go(-1);
    else if (dx < -SWIPE_DISTANCE) go(1);
  });
  card.addEventListener('pointercancel', () => { startX = null; });

  show(index);
  document.body.append(backdrop);
}

function backHtml(ymd, page) {
  const { month, day, weekday } = dateParts(ymd);
  const line = lineText(page.lineId);
  const reaction = page.stamp ? reactionText(page.stamp, ymd) : null;
  const writer = (line || reaction) ? writerName(page.writer) : '';
  return `
    <div class="back-date">${month}月${day}日（${weekday}）</div>
    <div class="back-text">
      ${line ? `<p class="back-line">${line}</p>` : ''}
      ${reaction ? `<p class="back-reaction">${reaction}</p>` : ''}
      ${writer ? `<p class="back-writer">— ${writer}</p>` : ''}
    </div>
    ${page.stamp ? `<div class="back-stamp">${stampMarkHtml(page.stamp, ymd)}</div>` : ''}
  `;
}
