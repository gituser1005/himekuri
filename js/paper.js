// 日記の紙1枚の中身。

import { dateParts } from './date.js';
import { WEATHER_LABEL, weatherIcon } from './island.js';

const HEART = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.3A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.6c0 5.7-7.6 10.3-7.6 10.3z"/></svg>';

export function heartIcon() {
  return HEART;
}

export function paperHtml(diary, writers, isFavorite) {
  const { month, day, weekday } = dateParts(diary.date);
  const writer = writers[diary.writer];
  const snap = diary.snapshot;
  return `
    <header class="paper-head">
      <span class="paper-date">${month}月${day}日<small>（${weekday}）</small></span>
      <span class="paper-weather">${weatherIcon(diary.weather)}${WEATHER_LABEL[diary.weather]}</span>
    </header>
    <h2 class="paper-title">${diary.title}</h2>
    <p class="paper-body">${diary.body}</p>
    ${snap ? `
    <figure class="polaroid">
      <img src="${snap.image}" alt="">
      <figcaption>${snap.caption}</figcaption>
    </figure>` : ''}
    <footer class="paper-foot">
      <button class="fav-btn ${isFavorite ? 'is-on' : ''}" aria-pressed="${isFavorite}">${HEART}<span>お気に入り</span></button>
      <span class="paper-writer"><img class="avatar avatar-lg" src="${writer.avatar}" alt="">${writer.name}</span>
    </footer>
  `;
}
