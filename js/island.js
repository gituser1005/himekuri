// 島の画面（ホーム）。時間帯と天気で絵とぬいの過ごし方を選び、未読があれば下に案内の帯を出す。
// いちばん下には「読み返し」「記録」のボタンをいつも出し、帯はその上に出す。
// 日記の本文はここでは見せない（めくって初めて読める）。

import { dateParts, timeSlot, addDays, treeOf } from './date.js';
import { unreadDiaries } from './diaries.js';
import { lifeLayout, homeLayout, layoutBoxes, sleepLayout, sleepScene, COVER_COLOR } from './island-life.js';
import { PICTURE, PLACES, pictureFile, treeFile } from './places.js';

export const WEATHER_LABEL = { sunny: '晴れ', cloudy: 'くもり', rain: '雨' };

const WEATHER_ICON = {
  sunny: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  cloudy: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 7 18z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>',
};

// BGM のボタンの印（スピーカー。音なしは斜線を入れる）
const SPEAKER = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>';
function bgmIcon(on) {
  const mark = on ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>';
  return `<svg class="weather-icon" viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}${mark}</svg>`;
}

// くもりの日に、晴れの絵の太陽を隠す雲（絵の中の太陽の位置に合わせて置く）
const SUN_CLOUD = `
  <svg class="sun-cloud" viewBox="0 0 220 110" aria-hidden="true">
    <path d="M30 98 a26 26 0 0 1 8-51 a36 36 0 0 1 64-22 a40 40 0 0 1 72 14 a30 30 0 0 1 20 59 z"/>
  </svg>`;

export function weatherIcon(weather) {
  return `<svg class="weather-icon" viewBox="0 0 24 24" aria-hidden="true">${WEATHER_ICON[weather]}</svg>`;
}

// 時間帯と天気 → 島の背景、ぬいの出し方、重ねる色
//   深夜（22〜6時）：夜の絵で、みんなベッドで寝ている（sleep）
//   夜（19〜22時）：夜の絵で、家の中で起きて過ごす（home）
//   雨の朝・昼・夕方：雨の絵で、家の中で過ごす（rain。並びは夜と同じく日ごとのくじ）
//   晴れ・くもりの朝・昼・夕方：ぬいごとにくじで過ごし方を決める（life。island-life.js）
// 朝・夕方・くもりは昼の絵に半透明の色を重ねる。日付（date.js の treeOf）で公園の木の姿が変わる（season は treeOf の値）
export function islandScene(slot, weather, season) {
  if (slot === 'late') return { image: pictureFile('late', season), sprites: 'sleep', tints: [] };
  if (slot === 'night') return { image: pictureFile('night', season), sprites: 'home', tints: [] };
  const rain = weather === 'rain';
  const tints = [];
  if (weather === 'cloudy') tints.push('cloudy');
  if (slot === 'morning' || slot === 'evening') tints.push(slot);
  return {
    image: pictureFile(rain ? 'rain' : 'sunny', season),
    sprites: rain ? 'rain' : 'life',
    tints,
  };
}

// ぬいを絵の上に置く（絵の大きさに対する割合で指定する）
// 昼はぴょこぴょこ跳ねる。1人ずつ間隔とタイミングをずらし、そろって跳ばないようにする（style.css）
// 寝る時間は2段ベッドで、正面向きの写真を掛け布団から出し、寝息のように揺れる。「zzz」だけが昼と同じように跳ねる
// 夜（起きている）のぬいは部屋のあかりに合わせて少し暖かく、寝る時間のぬいは暗くする
const CHARA_H = 170; // キャラの高さの目安。跳ねる高さを、小さい「zzz」や家の中のぬいでも同じにするのに使う
function imgHtml({ src, x, y, w, h }, i, cls = '') {
  return `
    <img class="sprite ${cls}" src="${src}" alt=""
      style="left:${(x / PICTURE.w) * 100}%;top:${(y / PICTURE.h) * 100}%;width:${(w / PICTURE.w) * 100}%;height:${(h / PICTURE.h) * 100}%;--delay:${-i * 1.7}s;--dur:${4.2 + i * 0.9}s;--hop:${(CHARA_H / h).toFixed(2)}">`;
}

// 場面ごとの並び（key は islandScene の sprites）→ 画像の位置と、付ける見た目
function sceneBoxes(key, { nuis, seed, today, sleepDate, slot }) {
  if (key === 'life') return { boxes: layoutBoxes(lifeLayout({ nuis, seed, date: today, slot }), nuis), cls: '' };
  if (key === 'sleep') {
    const { boxes, covers, zzz } = sleepScene(sleepLayout({ nuis, seed, date: sleepDate }), nuis);
    return { boxes, covers, zzz, cls: 'is-asleep' };
  }
  return { boxes: layoutBoxes(homeLayout({ nuis, seed, date: today }), nuis), cls: key === 'home' ? 'is-home-night' : '' };
}

// 登録したぬいを描く。nuis は photos.js の sceneNuis の形
// 写真には白いふちを付けてシールのように見せる（切り抜き写真は輪郭に沿って is-cutout、背景のある写真は四角く is-print）。写真は読み込めてからふわっと出す（is-loading）
// 寝る時間は、ぬいの手前に掛け布団を重ね、段ごとに「zzz」を出す（跳ねるタイミングは段ごとにずらす）。
// 描く順：背景の絵（ベッド・敷き布団・枕）→ ぬいの写真 → 掛け布団 → zzz
function coverHtml({ x, y, w, h, d, edge }) {
  return `
    <svg class="bed-cover" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"
      style="left:${(x / PICTURE.w) * 100}%;top:${(y / PICTURE.h) * 100}%;width:${(w / PICTURE.w) * 100}%;height:${(h / PICTURE.h) * 100}%">
      <path d="${d}" fill="${COVER_COLOR.fill}"/><path d="${edge}" fill="none" stroke="${COVER_COLOR.edge}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
}
// 晴れ・くもりの昼は、奥の段（道・鉢）の子 → 公園の木だけの絵 → ほかの子 の順に描く（木が奥の段の子より手前に来る）
function spritesHtml(key, ctx) {
  const { boxes, cls, covers = [], zzz = [] } = sceneBoxes(key, ctx);
  const sprite = (b, i) => {
    const nui = ctx.nuis.find((n) => n.id === b.id);
    return imgHtml({ ...b, src: nui.url }, i, ['is-loading', nui.cutout ? 'is-cutout' : 'is-print', cls].join(' '));
  };
  const behind = (b) => key === 'life' && PLACES[b.place]?.behindTree;
  const html = [
    ...boxes.map((b, i) => (behind(b) ? sprite(b, i) : '')),
    key === 'life' ? `<img class="island-tree" src="${treeFile(ctx.tree)}" alt="">` : '',
    ...boxes.map((b, i) => (behind(b) ? '' : sprite(b, i))),
  ];
  for (const c of covers) html.push(coverHtml(c));
  zzz.forEach((z, i) => html.push(imgHtml(z, i * 2)));
  return html.join('');
}

// 写真が読み込めたら出す（読み込み済みならすぐ）
function showWhenLoaded(root) {
  for (const img of root.querySelectorAll('.sprite.is-loading')) {
    const show = () => img.classList.remove('is-loading');
    if (img.complete) show();
    else {
      img.addEventListener('load', show, { once: true });
      img.addEventListener('error', show, { once: true });
    }
  }
}

// 未読の案内の帯の文言。未読がなければ null（帯を出さない）
// 書き手の名前と写真は出さない（日記は v1 のふうかたちが書いたものなので、自分の子を登録した人が混乱しないように。
// 日記の選び方の部品を組み込むまで）
export function bandText(unread, today) {
  if (!unread.length) return null;
  if (unread.length > 1) return { title: `日記が${unread.length}ページ届いています` };
  const diary = unread[0];
  const { month, day } = dateParts(diary.date);
  const when = diary.date === addDays(today, -1) ? 'きのう' : `${month}月${day}日`;
  return { title: `${when}の日記が届いています` };
}

function clockText(now, today) {
  const { month, day, weekday } = dateParts(today);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { date: `${month}月${day}日（${weekday}）`, time: `${hh}:${mm}` };
}

// 深夜の寝る並びのくじに使う日付：寝始めた夜の日付。アプリ上の日付は5時に変わるが、6時までは深夜なので、
// 5〜6時は前の日付のくじを使い、寝ている途中で並びが変わらないようにする
export function sleepDateOf(now, today) {
  return now.getHours() === 5 ? addDays(today, -1) : today;
}

// nuis：コテージの絵に出すぬい（photos.js の sceneNuis で、写真を読み込んでから渡す）
// weather：その日の天気（日記の記録の天気。journal.js の weatherOf）
// eventTree：その日の、季節のイベントの木のオブジェ（journal.js の eventTreeToday。なければ null）
export function renderIsland(root, { now, today, data, state, nuis, weather, eventTree = null, onMekuri, onReread, onRecord, onBgm }) {
  const slot = timeSlot(now);
  const tree = treeOf(today, eventTree);
  const scene = islandScene(slot, weather, tree);
  const band = bandText(unreadDiaries(data.diaries, state.read, today), today);
  const clock = clockText(now, today);

  root.innerHTML = `
    <section class="island is-${slot} ${slot === 'late' ? 'is-night' : ''}">
      <div class="island-stage">
        <img class="island-bg" src="${scene.image}" alt="">
        ${weather === 'cloudy' && scene.sprites === 'life' ? SUN_CLOUD : ''}
        ${spritesHtml(scene.sprites, { nuis, seed: state.islandSeed, today, tree, sleepDate: sleepDateOf(now, today), slot })}
      </div>
      ${scene.tints.map((t) => `<div class="island-tint tint-${t}"></div>`).join('')}
      <header class="island-top">
        <div class="chip island-clock">
          <span class="island-date">${clock.date}</span>
          <span class="island-time">${clock.time}</span>
        </div>
        <div class="island-top-right">
          <div class="chip island-weather">${weatherIcon(weather)}<span>${WEATHER_LABEL[weather]}</span></div>
          <button class="chip island-bgm" aria-label="${state.bgm ? '音楽をけす' : '音楽をつける'}" aria-pressed="${state.bgm}">${bgmIcon(state.bgm)}</button>
        </div>
      </header>
      <div class="island-bottom">
        ${band ? `
        <div class="island-band">
          <div class="band-text">
            <p class="band-title">${band.title}</p>
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

  showWhenLoaded(root);
  root.querySelector('.band-go')?.addEventListener('click', onMekuri);
  root.querySelector('.go-reread').addEventListener('click', onReread);
  root.querySelector('.go-record').addEventListener('click', onRecord);
  const bgm = root.querySelector('.island-bgm');
  bgm.addEventListener('click', () => {
    onBgm();
    bgm.innerHTML = bgmIcon(state.bgm);
    bgm.setAttribute('aria-label', state.bgm ? '音楽をけす' : '音楽をつける');
    bgm.setAttribute('aria-pressed', String(state.bgm));
  });
}

// 時刻だけを書き換える（日付や時間帯が変わったときは renderIsland し直す）
export function updateClock(root, now, today) {
  const clock = clockText(now, today);
  const date = root.querySelector('.island-date');
  const time = root.querySelector('.island-time');
  if (date) date.textContent = clock.date;
  if (time) time.textContent = clock.time;
}
