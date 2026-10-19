// 紙の中身（一行・書き手・写真）を選ぶ。紙を作るときに1回だけ呼び、結果は保存する。
// rng を差し替えられるようにして、テストで結果を固定できるようにしている。

import { DAILY, SEASONAL, STAMP_REACTIONS, AUTO_FLIP, LINE_BY_ID, WRITERS, WRITER_IDS } from './lines.js';
import { PHOTOS } from './photos.js';
import { koyomiFor } from './calendar.js';
import { daysBetween } from './date.js';

export const BLANK_RATE = 1 / 3;   // 何も書かない日の割合
export const SEASONAL_RATE = 0.4;  // 季節の一行が使える日に、季節の一行を選ぶ割合
const RECENT_PHOTOS = 2;           // 直近この枚数と同じ写真は避ける

// 直近この枚数の紙で使った一行は避ける（プールの半分まで）
const recentLineWindow = () => Math.min(14, Math.floor(DAILY.length / 2));

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// ymd の紙の中身を選ぶ。pages は既存の紙 { 'YYYY-MM-DD': page }
export function pickContent(ymd, pages, { forceLine = false } = {}, rng = Math.random) {
  const before = Object.keys(pages).filter((d) => d < ymd).sort().map((d) => pages[d]);
  const usedLines = new Set(before.slice(-recentLineWindow()).map((p) => p.lineId));
  const usedPhotos = new Set(before.slice(-RECENT_PHOTOS).map((p) => p.photoId));

  let line = null;
  if (forceLine || rng() >= BLANK_RATE) {
    const sekki = koyomiFor(ymd)?.sekki;
    const seasonal = SEASONAL.filter((l) => l.sekki.includes(sekki) && !usedLines.has(l.id));
    const daily = DAILY.filter((l) => !usedLines.has(l.id));
    if (seasonal.length && rng() < SEASONAL_RATE) line = pick(seasonal, rng);
    else line = pick(daily.length ? daily : DAILY, rng);
  }

  const photos = PHOTOS.filter((id) => !usedPhotos.has(id));
  return {
    lineId: line?.id ?? null,
    writer: line?.writer ?? pick(WRITER_IDS, rng), // 書かない日も、ハンコへの反応の書き手として持っておく
    photoId: pick(photos.length ? photos : PHOTOS, rng),
  };
}

export function lineText(lineId) {
  return LINE_BY_ID[lineId]?.text ?? null;
}

export function writerName(writerId) {
  return WRITERS[writerId] ?? '';
}

// ハンコへの反応。押し直しても同じ日・同じハンコなら同じ一行になるよう、日付から決める
export function reactionText(stamp, ymd) {
  const pool = STAMP_REACTIONS[stamp];
  if (!pool) return null;
  return pool[daysBetween('2000-01-01', ymd) % pool.length].text;
}

export function autoFlipText(rng = Math.random) {
  return pick(AUTO_FLIP, rng).text;
}
