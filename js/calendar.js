// 読み返しのカレンダーで使う日付の計算と絞り込み（画面に依存しない）。週は日曜はじまり。

import { addDays, dateParts, toYmd } from './date.js';
import { availableDiaries } from './diaries.js';

// 日記がある月 ['2026-10', '2026-11']
export function monthKeys(diaries) {
  return [...new Set(diaries.map((d) => d.date.slice(0, 7)))].sort();
}

// 月のマス。先頭と末尾の空きマスは null。7の倍数になる
export function monthCells(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toYmd(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function weekStart(ymd) {
  return addDays(ymd, -dateParts(ymd).weekdayIndex);
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// 日記がある週の、始まりの日の一覧
export function weekStarts(diaries) {
  const first = weekStart(diaries[0].date);
  const last = weekStart(diaries.at(-1).date);
  const starts = [];
  for (let d = first; d <= last; d = addDays(d, 7)) starts.push(d);
  return starts;
}

// 絞り込み。お気に入り・写真あり・書き手（複数選べる。どれか1人に当てはまればよい）
export function matchesFilter(diary, filters, favorites) {
  if (filters.fav && !favorites.includes(diary.id)) return false;
  if (filters.photo && !diary.snapshot) return false;
  if (filters.writers.length && !filters.writers.includes(diary.writer)) return false;
  return true;
}

export function isFiltering(filters) {
  return filters.fav || filters.photo || filters.writers.length > 0;
}

// 日付を入力して飛ぶ。開ける日記なら { id }、開けなければ { message }
export function jumpTo(diaries, today, ymd) {
  const diary = diaries.find((d) => d.date === ymd);
  if (!diary) return { message: 'この日の日記はありません' };
  if (!availableDiaries(diaries, today).includes(diary)) return { message: 'この日の日記は、まだ届いていません' };
  return { id: diary.id };
}
