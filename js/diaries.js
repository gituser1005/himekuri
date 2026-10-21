// 日記データ（data/diaries.json）と、日記の届き方。
// 日記の date は「その日記に書かれている日」。日記は date の翌日 5:00 から読める。
// （5:00 の切り替えは appDate が受け持つので、ここでは「アプリ上の今日 > date」で判定する）

import { addDays } from './date.js';

export async function loadDiaries(url = 'data/diaries.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`日記を読み込めませんでした（${res.status}）`);
  const data = await res.json();
  data.diaries.sort((a, b) => (a.date < b.date ? -1 : 1));
  return data; // { writers, diaries }
}

// 日記が届く日（アプリ上の日付）
export function deliveredOn(diary) {
  return addDays(diary.date, 1);
}

// 今日までに届いた日記（古い順）
export function availableDiaries(diaries, today) {
  return diaries.filter((d) => deliveredOn(d) <= today);
}

// 届いているがまだ読んでいない日記（古い順。この順にめくる）
export function unreadDiaries(diaries, readIds, today) {
  const read = new Set(readIds);
  return availableDiaries(diaries, today).filter((d) => !read.has(d.id));
}

// すべての日記を読み終えたか（最後の日記のあとに「試作の日記はここまでです」を出す）
export function isAllRead(diaries, readIds) {
  const read = new Set(readIds);
  return diaries.every((d) => read.has(d.id));
}

// 今日の島の天気。今日の日付の日記がなければ sunny
export function weatherOn(diaries, today) {
  return diaries.find((d) => d.date === today)?.weather ?? 'sunny';
}
