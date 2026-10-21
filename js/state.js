// 保存データ（island.v1）の形と、それを変える操作。読み書き自体は store.js。
//
// {
//   installedOn: '2026-10-21',                     初回起動日（アプリ上の日付）
//   read: ['d20261020'],                           既読の日記ID（読んだ順）
//   favorites: ['d20261024'],                      お気に入りの日記ID
//   opens: [{ at: '2026-10-21T07:12', day: '2026-10-21', mekuri: false, reread: false }]
// }                                                開いた記録（mekuri は日記を開いたか、reread は読み返しを開いたか）

import { appDate, toLocalIso } from './date.js';

export function newState(today) {
  return { installedOn: today, read: [], favorites: [], opens: [] };
}

// 保存データを読み込んだあとに呼ぶ。足りない項目を補い、使わなくなった項目を消す
export function normalizeState(saved, today) {
  const s = { ...newState(today), ...saved };
  delete s.stamps; // スタンプは仕様変更でなくなった
  return s;
}

// 裏にいた時間がこれ以上なら、戻ってきたときも「開いた」と数える
export const RETURN_OPEN_MS = 10 * 60 * 1000;

export function isReturnOpen(hiddenAtMs, nowMs) {
  return hiddenAtMs !== null && nowMs - hiddenAtMs >= RETURN_OPEN_MS;
}

// 起動したとき（と、しばらく裏にいて戻ってきたとき）に呼ぶ
export function recordOpen(state, now) {
  state.opens.push({ at: toLocalIso(now), day: appDate(now), mekuri: false, reread: false });
}

// 今回開いているあいだに日記（mekuri）や読み返し（reread）を開いたことを記録する
export function markOpened(state, screen) {
  const last = state.opens.at(-1);
  if (last) last[screen] = true;
}

export function markRead(state, diaryId) {
  if (!state.read.includes(diaryId)) state.read.push(diaryId);
}

export function setFavorite(state, diaryId, on) {
  const has = state.favorites.includes(diaryId);
  if (on && !has) state.favorites.push(diaryId);
  if (!on && has) state.favorites = state.favorites.filter((id) => id !== diaryId);
}
