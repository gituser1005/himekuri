// 記録ページ（テスト用）。保存データから集計して表示するだけで、新しく保存するものはない。

import { dateParts } from './date.js';
import { STAMPS, stampMarkHtml } from './stamp.js';

export function recordStats(state) {
  const dates = Object.keys(state.pages).sort();
  const pages = dates.map((d) => state.pages[d]);

  const byType = Object.fromEntries(STAMPS.map((s) => [s.id, 0]));
  const byMonth = [];
  for (const d of dates) {
    const stamp = state.pages[d].stamp;
    if (!stamp) continue; // 押さなかった日は一覧に出さない（抜けに見せない）
    byType[stamp] = (byType[stamp] ?? 0) + 1;
    const ym = d.slice(0, 7);
    let month = byMonth.at(-1);
    if (month?.ym !== ym) {
      month = { ym, items: [] };
      byMonth.push(month);
    }
    month.items.push({ ymd: d, stamp });
  }

  return {
    installedOn: state.installedOn,
    openedDays: state.openedDays.length,
    flippedSelf: pages.filter((p) => p.flipped && !p.autoFlipped).length,
    flippedAuto: pages.filter((p) => p.autoFlipped).length,
    stampTotal: byMonth.reduce((n, m) => n + m.items.length, 0),
    byType,
    byMonth,
  };
}

const jpDate = (ymd) => {
  const { year, month, day } = dateParts(ymd);
  return `${year}年${month}月${day}日`;
};

export function openRecord(state, today) {
  const s = recordStats(state);
  const overlay = document.createElement('div');
  overlay.className = 'record';
  overlay.innerHTML = `
    <header class="record-head">
      <h1>きろく</h1>
      <button class="record-close" aria-label="とじる">×</button>
    </header>
    <dl class="record-stats">
      <div><dt>使い始めた日</dt><dd>${jpDate(s.installedOn)}</dd></div>
      <div><dt>開いた日数</dt><dd>${s.openedDays}<small>日</small></dd></div>
      <div>
        <dt>めくった枚数</dt>
        <dd>${s.flippedSelf}<small>枚</small></dd>
        ${s.flippedAuto ? `<dd class="record-sub">ぬいぐるみが代わりにめくった ${s.flippedAuto}枚</dd>` : ''}
      </div>
      <div><dt>押したハンコ</dt><dd>${s.stampTotal}<small>個</small></dd></div>
    </dl>
    <ul class="record-types">
      ${STAMPS.map((t) => `
        <li><span class="record-mark">${stampMarkHtml(t.id, '2000-01-01')}</span><span>${s.byType[t.id]}</span></li>
      `).join('')}
    </ul>
    ${s.byMonth.map((m) => `
      <section class="record-month">
        <h2>${Number(m.ym.slice(0, 4))}年${Number(m.ym.slice(5))}月</h2>
        <ul class="record-stamps">
          ${m.items.map((it) => `
            <li><span class="record-mark">${stampMarkHtml(it.stamp, it.ymd)}</span><span class="record-day">${Number(it.ymd.slice(8))}日</span></li>
          `).join('')}
        </ul>
      </section>
    `).join('')}
    <footer class="record-foot">${jpDate(today)} 時点</footer>
  `;
  overlay.querySelector('.record-close').addEventListener('click', () => overlay.remove());
  document.body.append(overlay);
}
