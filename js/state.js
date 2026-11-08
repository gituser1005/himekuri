// 保存データ（cottage.v1）の形と、それを変える操作。読み書き自体は store.js。
//
// {
//   installedOn: '2026-10-21',                     初回起動日（アプリ上の日付）
//   islandSeed: 'k3x9q2ab',                        家庭ごとの乱数の種（島のぬいの過ごし方のくじに使う。家庭ごとに配置が変わる）
//   read: ['d20261020'],                           既読の日記ID（読んだ順）
//   favorites: ['d20261024'],                      お気に入りの日記ID
//   bgm: false,                                    BGM を鳴らすか（島の画面のボタン。最初は音なし。bgm.js）
//   usage: { ... },                               利用ログ（usage.js。コテージを始めたあとだけ。docs/SPEC.md「4. 記録（テスト用）」）
//   cottage: null,                                 コテージとぬいぐるみの登録（形は profile.js）と、日記の記録（cottage.diaryRecord。journal.js）。
//                                                  まだ1体も登録していなければ null
// }                                                写真は IndexedDB（photos.js）。ここには写真のキーだけを持つ

import { newSeed } from './rng.js';

export function newState(today, islandSeed = newSeed()) {
  return { installedOn: today, islandSeed, read: [], favorites: [], bgm: false, cottage: null };
}

// 保存データを読み込んだあとに呼ぶ。足りない項目を補い、使わなくなった項目を消す
// （島の種がない前の版の保存データには、ここで種を作る）
export function normalizeState(saved, today) {
  const s = { ...newState(today), ...saved };
  delete s.stamps; // スタンプは仕様変更でなくなった
  delete s.opens; // 開いた記録は、利用ログ（usage.js）に置き換えた（11/4）
  return s;
}

export function markRead(state, diaryId) {
  if (!state.read.includes(diaryId)) state.read.push(diaryId);
}

export function setFavorite(state, diaryId, on) {
  const has = state.favorites.includes(diaryId);
  if (on && !has) state.favorites.push(diaryId);
  if (!on && has) state.favorites = state.favorites.filter((id) => id !== diaryId);
}
