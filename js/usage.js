// 利用ログ（docs/SPEC.md「4. 記録（テスト用）」）。端末の中（cottage.v1 の usage）にだけ残し、送らない。
// ここは記録するだけ。集計（開いた回数・初読までの時間など）は別の部品で、このログから作る。
//
// state.usage = {
//   version: 1,                          記録の形の版（集計画面の見出しに出す）
//   startedOn: '2026-11-09',             記録開始日（アプリ上の日付）。ふつうはコテージを始めた日。始めたあとに入れた端末は、入れた日
//   keptFrom: null,                      90日を超えて古いログを消したとき、欠けずに残っている期間の始まりの日（それより前は「保存期間外」）
//   device: 'iphone',                    端末の種類：iphone／android／other（細かな機種名は残さない）
//   events: [{ at: '2026-11-09T07:12:30', type: 'launch' }, ...],
//       type：launch（起動）・show（裏から表へ）・hide（表から裏へ）・screen（画面を開いた。s に画面の名前）・
//             nui（始めたあとのぬいの追加・編集・削除。op・id、編集なら変えた項目の名前 fields。入力した値は残さない）
//   firstRead: { d20261109: '2026-11-10T07:13:05' },   日記のページを初めて表示した時刻（ページの id ごと。読み返しの紙も含む）
// }
// 記録はコテージを始めたあと（isStarted）だけ。?now= で時刻を変えているあいだは、呼ぶ側（main.js）が記録しない。
// 初期化（保存データを消す）で、利用ログも一緒に消える

import { appDate, addDays } from './date.js';
import { isStarted } from './profile.js';

export const USAGE_VERSION = 1;
export const KEEP_DAYS = 90;

// 'YYYY-MM-DDTHH:MM:SS'（端末の現地時刻。開いた回数の区切り（10分）を秒まで見るので、秒まで持つ）
export function isoSec(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ブラウザが名乗る端末の情報から、iPhone か Android かを見分ける（iPad とそれ以外は other）
export function deviceKind(userAgent = '') {
  if (/iPhone|iPod/.test(userAgent)) return 'iphone';
  if (/Android/.test(userAgent)) return 'android';
  return 'other';
}

// 利用ログ。コテージを始める前は null。始めたあとで、まだなければ作る（作った時刻を最初の起動とする）
function ensure(state, now, userAgent) {
  if (!isStarted(state.cottage)) return { usage: null, created: false };
  if (state.usage) return { usage: state.usage, created: false };
  state.usage = { version: USAGE_VERSION, startedOn: appDate(now), keptFrom: null, device: deviceKind(userAgent), events: [{ at: isoSec(now), type: 'launch' }], firstRead: {} };
  return { usage: state.usage, created: true };
}

export const usageOf = (state, now, userAgent) => ensure(state, now, userAgent).usage;

// 1つ記録する。記録したら true（呼ぶ側が保存する）。作ったときの起動は ensure が入れているので、重ねない
export function logEvent(state, now, userAgent, type, extra = {}) {
  const { usage, created } = ensure(state, now, userAgent);
  if (!usage) return false;
  if (!(created && type === 'launch')) usage.events.push({ at: isoSec(now), type, ...extra });
  return true;
}

// 日記のページを初めて表示した時刻。2回目からは変えない
export function noteFirstRead(state, now, userAgent, pageId) {
  const usage = usageOf(state, now, userAgent);
  if (!usage || usage.firstRead[pageId]) return false;
  usage.firstRead[pageId] = isoSec(now);
  return true;
}

// 90日（今日を含む）より前のログを消す。消した、または記録開始日がそれより前なら、残っている期間の始まりの日（keptFrom）を進める
export function pruneUsage(usage, today) {
  if (!usage) return false;
  const from = addDays(today, -(KEEP_DAYS - 1));
  const day = (at) => appDate(new Date(at));
  const before = usage.events.length + Object.keys(usage.firstRead).length;
  usage.events = usage.events.filter((e) => day(e.at) >= from);
  usage.firstRead = Object.fromEntries(Object.entries(usage.firstRead).filter(([, at]) => day(at) >= from));
  const removed = usage.events.length + Object.keys(usage.firstRead).length !== before;
  if (usage.startedOn < from && (usage.keptFrom ?? '') < from) {
    usage.keptFrom = from;
    return true;
  }
  return removed;
}
