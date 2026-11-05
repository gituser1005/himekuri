// 試用の記録の数字（docs/SPEC.md「4. 記録（テスト用）」）。利用ログ（usage.js）と保存データから、
// 集計画面（trial-record.js）が見せる summary を作る。画面を開いたときに一度だけ呼ぶ。
// 保存データ全体・名前・写真・入力した言葉・日記の本文は summary に入れない（数と日付と種類だけ）

import { appDate, addDays, daysBetween, timeSlot, toLocalIso } from './date.js';
import { diaryId, extraId } from './journal.js';
import { ROLES } from './profile.js';
import { isoSec } from './usage.js';

// 裏にいた時間がこれ以上なら、戻ってきたときを新しい「開いた回数」にする
export const NEW_OPEN_MS = 10 * 60 * 1000;
// 開いた回のうち、コテージ以外を開いたとみなす画面
const TOUCH_SCREENS = new Set(['diary', 'reread', 'record', 'register', 'trial']);
const DEVICE_LABEL = { iphone: 'iPhone', android: 'Android', other: 'その他・不明' };
// 日記の種類（台本の kind → 集計の種類）。並びは trial-record.js の KINDS
const KIND_OF = {
  habit: 'ordinary', role: 'ordinary', common: 'ordinary', seasonal: 'ordinary',
  likes: 'likes', event: 'event', progress: 'progress', sequel: 'sequel',
  festival: 'festival', anniversary: 'festival', island: 'festival', welcome: 'welcome',
};
export const SUMMARY_KINDS = ['ordinary', 'likes', 'event', 'progress', 'sequel', 'festival', 'welcome'];

const ms = (iso) => new Date(iso).getTime();
// 日記が届いた時刻：日記に書かれた日の翌日の 5:00（端末の現地時刻）
export const deliveredAt = (date) => `${addDays(date, 1)}T05:00:00`;

// 日記のページ（{ id, date, kind }）。ふだんの日記と、おうちに来た日の別の1件（extras）は、同じ日でも別のページ
export function pagesOf(cottage) {
  const r = cottage?.diaryRecord;
  if (!r) return [];
  return [
    ...(r.extras ?? []).map((d) => ({ id: extraId(d.date, d.writer), date: d.date, kind: d.kind ?? 'welcome' })),
    ...(r.days ?? []).map((d) => ({ id: diaryId(d.date), date: d.date, kind: d.kind })),
  ];
}

// 中央値（偶数件は中央の2件の平均）。0件は null
export function median(list) {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 出来事の並びから「開いた回」を作る。
// 起動と、10分以上裏にいたあとに戻ったときが新しい回。10分未満で戻れば同じ回。
// 回の終わり：裏へ移って10分以上たった（その裏へ移った時刻が終わり）。次の起動まで裏へ移った記録がなければ、終わりを確認できない
export function visitsOf(events, nowIso) {
  const visits = [];
  let cur = null;
  const close = (endAt) => {
    if (!cur) return;
    cur.end = endAt; // null は終わりを確認できない
    visits.push(cur);
    cur = null;
  };
  const open = (at) => { cur = { start: at, end: undefined, touched: false, hiddenAt: null }; };
  for (const e of events) {
    if (e.type === 'launch') {
      if (cur) close(cur.hiddenAt);
      open(e.at);
    } else if (e.type === 'show') {
      if (!cur) open(e.at);
      else if (cur.hiddenAt && ms(e.at) - ms(cur.hiddenAt) >= NEW_OPEN_MS) {
        close(cur.hiddenAt);
        open(e.at);
      } else {
        cur.hiddenAt = null;
      }
    } else if (e.type === 'hide') {
      if (cur) cur.hiddenAt = e.at;
    } else if (e.type === 'screen' && TOUCH_SCREENS.has(e.s)) {
      if (cur) cur.touched = true;
    } else if (e.type === 'nui') {
      if (cur) cur.touched = true;
    }
  }
  // 今の回：裏へ移って10分以上たっていれば終わった回。そうでなければ続いている（コテージだけには数えない）
  if (cur) {
    if (cur.hiddenAt && ms(nowIso) - ms(cur.hiddenAt) >= NEW_OPEN_MS) close(cur.hiddenAt);
    else { cur.ongoing = true; visits.push(cur); }
  }
  return visits.map(({ hiddenAt, ...v }) => v);
}

// state：保存データ。now：まとめる時刻（Date）
export function summarize(state, now) {
  const usage = state.usage;
  const cottage = state.cottage;
  const nowIso = isoSec(now);
  const today = appDate(now);
  const from = usage.keptFrom && usage.keptFrom > usage.startedOn ? usage.keptFrom : usage.startedOn;
  const fromIso = `${from}T05:00:00`;
  const events = usage.events.filter((e) => e.at >= fromIso && e.at <= nowIso);

  // 日記のページ：対象期間に届いたもの
  const read = new Set(state.read);
  const pages = pagesOf(cottage)
    .map((p) => ({ ...p, at: deliveredAt(p.date), first: usage.firstRead[p.id] ?? null }))
    .filter((p) => p.at >= fromIso && p.at <= nowIso);
  // その時刻に未読だったページがあるか（届いていて、まだ初めて表示していない。初読時刻の分からない既読は、前に読んだとみなす）
  const unreadAt = (iso) => pages.some((p) => p.at <= iso && (p.first ? p.first > iso : !read.has(p.id)));

  const visits = visitsOf(events, nowIso);
  const islandOnly = visits.filter((v) => v.end && !v.touched && !v.ongoing);
  const islandOnlyNoUnread = islandOnly.filter((v) => !unreadAt(v.start));
  const bySlot = { morning: 0, day: 0, evening: 0, night: 0, late: 0 };
  for (const v of islandOnlyNoUnread) bySlot[timeSlot(new Date(v.start))]++;

  // 開いた日と、1日に訪れた時間帯の数（起動と、裏から表に出たとき。短い復帰も時間帯の有無には入れる）
  const slotsByDay = new Map();
  for (const e of events) {
    if (e.type !== 'launch' && e.type !== 'show') continue;
    const d = new Date(e.at);
    const day = appDate(d);
    if (!slotsByDay.has(day)) slotsByDay.set(day, new Set());
    slotsByDay.get(day).add(timeSlot(d));
  }
  const opened = slotsByDay.size;
  const slotsPerDay = opened ? [...slotsByDay.values()].reduce((n, s) => n + s.size, 0) / opened : 0;

  // 日記の種類ごと
  const diaries = SUMMARY_KINDS.map((kind) => {
    const list = pages.filter((p) => KIND_OF[p.kind] === kind);
    const firstReadPages = list.filter((p) => p.first || read.has(p.id));
    const minutes = list.filter((p) => p.first).map((p) => Math.max(0, (ms(p.first) - ms(p.at)) / 60000)).sort((a, b) => a - b);
    const med = median(minutes);
    return {
      kind,
      delivered: list.length,
      firstRead: firstReadPages.length,
      unread: list.length - firstReadPages.length,
      unknownTime: firstReadPages.length - minutes.length,
      median: med === null ? null : Math.floor(med),
      minutes: minutes.map(Math.floor),
    };
  });

  const nuis = cottage?.nuis ?? [];
  const edits = { add: 0, edit: 0, remove: 0 };
  for (const e of events) {
    if (e.type !== 'nui') continue;
    if (e.op === 'add') edits.add++;
    else if (e.op === 'edit') edits.edit++;
    else if (e.op === 'delete') edits.remove++;
  }
  const favorites = new Set(state.favorites);

  return {
    version: usage.version,
    from,
    to: today,
    keptFrom: usage.keptFrom,
    madeAt: toLocalIso(now),
    device: DEVICE_LABEL[usage.device] ?? DEVICE_LABEL.other,
    days: { total: daysBetween(from, today) + 1, opened },
    opens: {
      count: visits.length,
      islandOnly: islandOnly.length,
      islandOnlyNoUnread: islandOnlyNoUnread.length,
      unknownEnd: visits.filter((v) => v.end === null).length,
      bySlot,
      slotsPerDay,
    },
    profile: {
      installedOn: state.installedOn,
      startedOn: cottage?.startedOn ?? null,
      preset: Boolean(cottage?.preset),
      nuis: nuis.length,
      roles: ROLES.map(({ role }) => ({ role, count: nuis.filter((n) => n.role === role).length })).filter((r) => r.count),
    },
    diaries,
    favorites: pages.filter((p) => favorites.has(p.id)).length,
    edits,
  };
}
