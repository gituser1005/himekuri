// 島の画面（ホーム）。時間帯と天気で絵を選び、未読があれば下に案内の帯を出す。
// いちばん下には「読み返し」「記録」のボタンをいつも出し、帯はその上に出す。
// 日記の本文はここでは見せない（めくって初めて読める）。

import { dateParts, timeSlot, addDays } from './date.js';
import { unreadDiaries, weatherOn } from './diaries.js';
import { SPRITES } from './sprites.js';

export const WEATHER_LABEL = { sunny: '晴れ', cloudy: 'くもり', rain: '雨' };

const WEATHER_ICON = {
  sunny: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  cloudy: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 7 18z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>',
};

// くもりの日に、晴れの絵の太陽を隠す雲（絵の中の太陽の位置に合わせて置く）
const SUN_CLOUD = `
  <svg class="sun-cloud" viewBox="0 0 220 110" aria-hidden="true">
    <path d="M30 98 a26 26 0 0 1 8-51 a36 36 0 0 1 64-22 a40 40 0 0 1 72 14 a30 30 0 0 1 20 59 z"/>
  </svg>`;

export function weatherIcon(weather) {
  return `<svg class="weather-icon" viewBox="0 0 24 24" aria-hidden="true">${WEATHER_ICON[weather]}</svg>`;
}

// 時間帯と天気 → 島の背景、キャラの切り抜き、重ねる色
// 朝・夕方・くもりは昼の絵に半透明の色を重ねる。夜は天気に関係なく夜の絵
export function islandScene(slot, weather) {
  if (slot === 'night') return { image: 'assets/island_night_bg.png', sprites: 'night', tints: [] };
  const rain = weather === 'rain';
  const tints = [];
  if (weather === 'cloudy') tints.push('cloudy');
  if (slot === 'morning' || slot === 'evening') tints.push(slot);
  return {
    image: rain ? 'assets/island_day_rain_bg.png' : 'assets/island_day_sunny_bg.png',
    sprites: rain ? 'rain' : 'sunny',
    tints,
  };
}

// キャラの切り抜きを、元の絵と同じ位置に置く（絵の大きさに対する割合で指定する）
// 昼はぴょこぴょこ跳ねる。1人ずつ間隔とタイミングをずらし、そろって跳ばないようにする（style.css）
// 夜のキャラは寝息のように揺れ、上の「zzz」だけが昼のキャラと同じように跳ねる
const PIC_W = 780;
const PIC_H = 1688;
const ZZZ = 'assets/sprites/night_0.png';
const CHARA_H = 170; // キャラの切り抜きの高さの目安。跳ねる高さを、小さい「zzz」でもキャラと同じにするのに使う
// 元の絵と違う位置に置くキャラ。晴れのポテサラは右下にいて未読の帯に隠れるので、画面中央あたりの道の上へ移す
const MOVED = { 'assets/sprites/sunny_2.png': { x: 300, y: 820 } };
function spritesHtml(key) {
  return SPRITES[key].map((s) => ({ ...s, ...MOVED[s.src] })).map((s, i) => `
    <img class="sprite ${key === 'night' && s.src !== ZZZ ? 'is-sleeping' : ''}" src="${s.src}" alt=""
      style="left:${(s.x / PIC_W) * 100}%;top:${(s.y / PIC_H) * 100}%;width:${(s.w / PIC_W) * 100}%;--delay:${-i * 1.7}s;--dur:${4.2 + i * 0.9}s;--hop:${(CHARA_H / s.h).toFixed(2)}">`).join('');
}

// 未読の案内の帯の文言。未読がなければ null（帯を出さない）
export function bandText(unread, today, writers) {
  if (!unread.length) return null;
  if (unread.length > 1) return { title: `日記が${unread.length}枚届いています`, writer: null };
  const diary = unread[0];
  const { month, day } = dateParts(diary.date);
  const when = diary.date === addDays(today, -1) ? 'きのう' : `${month}月${day}日`;
  return { title: `${when}の日記が届いています`, writer: writers[diary.writer] };
}

function clockText(now, today) {
  const { month, day, weekday } = dateParts(today);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { date: `${month}月${day}日（${weekday}）`, time: `${hh}:${mm}` };
}

export function renderIsland(root, { now, today, data, state, onMekuri, onReread, onRecord }) {
  const slot = timeSlot(now);
  const weather = weatherOn(data.diaries, today);
  const scene = islandScene(slot, weather);
  const band = bandText(unreadDiaries(data.diaries, state.read, today), today, data.writers);
  const clock = clockText(now, today);

  root.innerHTML = `
    <section class="island is-${slot}">
      <div class="island-stage">
        <img class="island-bg" src="${scene.image}" alt="">
        ${weather === 'cloudy' && slot !== 'night' ? SUN_CLOUD : ''}
        ${spritesHtml(scene.sprites)}
      </div>
      ${scene.tints.map((t) => `<div class="island-tint tint-${t}"></div>`).join('')}
      <header class="island-top">
        <div class="chip island-clock">
          <span class="island-date">${clock.date}</span>
          <span class="island-time">${clock.time}</span>
        </div>
        <div class="chip island-weather">${weatherIcon(weather)}<span>${WEATHER_LABEL[weather]}</span></div>
      </header>
      <div class="island-bottom">
        ${band ? `
        <div class="island-band">
          <div class="band-text">
            <p class="band-title">${band.title}</p>
            ${band.writer ? `
            <p class="band-writer">
              <img class="avatar" src="${band.writer.avatar}" alt="">書いたのは ${band.writer.name}
            </p>` : ''}
          </div>
          <button class="band-go">めくる</button>
        </div>` : ''}
        <nav class="island-nav">
          <button class="go-reread">読み返し</button>
          <button class="go-record">記録</button>
        </nav>
      </div>
    </section>
  `;

  root.querySelector('.band-go')?.addEventListener('click', onMekuri);
  root.querySelector('.go-reread').addEventListener('click', onReread);
  root.querySelector('.go-record').addEventListener('click', onRecord);
}

// 時刻だけを書き換える（日付や時間帯が変わったときは renderIsland し直す）
export function updateClock(root, now, today) {
  const clock = clockText(now, today);
  const date = root.querySelector('.island-date');
  const time = root.querySelector('.island-time');
  if (date) date.textContent = clock.date;
  if (time) time.textContent = clock.time;
}
