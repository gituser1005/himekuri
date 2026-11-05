// 季節のイベント（期間から島ごとに日を選ぶ行事）と、島のイベント（月に1回、島ごと）の日（5.2・5.7）。
// docs/topics/2026-11-04-photo-ordinary.md の決定。日は、島の種（seed）・始めた日（start）・台本データだけで決まる
// （子を足しても消しても選び直さない。何度計算しても同じ日になる）。
//
// 季節のイベント：行事の台本のうち period（「MM-DD」の期間）があるもの。その年の期間から1日。
//   日の決まった行事・島の記念日と同じ日はよける。始めた年は、期間のうち始めた日のあとの日から（残っていなければ、その年はなし）
// 島のイベント：台本データの island_events（month の月に1回）。始めた月から月の順に決める。その月の中から1日で、
//   前の月・その月・次の月の、日の決まった行事・島の記念日・季節のイベントと、前の月の島のイベントから、日付の差が5日以上。
//   始めた月は、始めた日の3日あとから。条件に合う日がなければ、その月はなし。台本のない月もなし
// どちらも、木のオブジェ（tree）がある季節のイベントは、3日前から当日まで公園の木がそれになる

import { addDays, daysBetween } from '../js/date.js';
import { makeRng, pick } from './rng.js';
import { festivalDate } from './festivals.js';
import { yearlyDate } from './anniversary.js';

export const ISLAND_EVENT_GAP = 5;      // 島のイベントは、ほかのイベントの日・前の月の島のイベントから、日付の差がこれ以上
export const ISLAND_EVENT_FIRST = 3;    // 始めた月の島のイベントは、始めた日のこの日数あとから
export const OBJECT_DAYS_BEFORE = 3;    // 木のオブジェは、イベントの日のこの日数前から出す

const ymOf = (date) => [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthDays = (y, m) => Array.from({ length: daysIn(y, m) }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
const shift = ([y, m], n) => {
  const k = y * 12 + (m - 1) + n;
  return [Math.floor(k / 12), (k % 12) + 1];
};

// 島の記念日（始めた日の「MM-DD」の、次の年から）
function anniversaryDate(start, year) {
  return year > Number(start.slice(0, 4)) ? yearlyDate(start.slice(5), year) : null;
}

// 日の決まった行事（period のないもの）の、その年の日付
function fixedFestivalDates(scripts, year) {
  return (scripts.festivals ?? []).filter((f) => !f.period).map((f) => festivalDate(f, year, scripts)).filter(Boolean);
}

// 季節のイベントの、その年の日付（その年はなしなら null）
export function seasonalEventDate(f, year, scripts, seed, start) {
  const [from, to] = f.period;
  const avoid = new Set([...fixedFestivalDates(scripts, year), anniversaryDate(start, year)]);
  const days = [];
  for (let d = `${year}-${from}`; d <= `${year}-${to}`; d = addDays(d, 1)) if (d > start && !avoid.has(d)) days.push(d);
  return days.length ? pick(makeRng(seed, String(year), `seasonal-event-${f.id}`), days) : null;
}

const seasonalEvents = (scripts) => (scripts.festivals ?? []).filter((f) => f.period);

// その年・月の、島のイベント以外のイベントの日（日の決まった行事・島の記念日・季節のイベント）
function otherEventDates(scripts, seed, start, y, m) {
  const out = [];
  for (const year of [y - 1, y, y + 1]) {
    out.push(...fixedFestivalDates(scripts, year), anniversaryDate(start, year));
    for (const f of seasonalEvents(scripts)) out.push(seasonalEventDate(f, year, scripts, seed, start));
  }
  const lo = `${shift([y, m], -1).map(pad).join('-')}`;
  const hi = `${shift([y, m], 2).map(pad).join('-')}`;
  return out.filter((d) => d && d.slice(0, 7) >= lo && d.slice(0, 7) < hi);
}

// 島のイベントの日は、始めた月から月の順に決める（前の月の島のイベントから5日以上あけるため）。島ごとに覚えておく
const cache = new Map();
function islandEventMonths(scripts, seed, start, until) {
  const key = `${seed}|${start}|${scripts.version ?? ''}`;
  let memo = cache.get(key);
  if (!memo) {
    memo = { done: shift(ymOf(start), -1), prev: null, dates: new Map() };
    cache.set(key, memo);
  }
  while (memo.done[0] * 12 + memo.done[1] < until[0] * 12 + until[1]) {
    const [y, m] = shift(memo.done, 1);
    memo.done = [y, m];
    const list = (scripts.island_events ?? []).filter((e) => e.month === m);
    if (!list.length) continue;
    const others = otherEventDates(scripts, seed, start, y, m);
    const first = addDays(start, ISLAND_EVENT_FIRST);
    const far = (d, b) => Math.abs(daysBetween(d, b)) >= ISLAND_EVENT_GAP;
    const days = monthDays(y, m).filter((d) => d >= first && others.every((b) => far(d, b)) && (!memo.prev || far(d, memo.prev)));
    if (!days.length) continue;
    const date = pick(makeRng(seed, `${y}-${pad(m)}`, 'island-event'), days);
    memo.dates.set(date, list);
    memo.prev = date;
  }
  return memo.dates;
}

// その日の島のイベントの台本（なければ空）
export function islandEventsOn(scripts, seed, start, date) {
  if (!start || date < start) return [];
  return islandEventMonths(scripts, seed, start, ymOf(date)).get(date) ?? [];
}

// その日の季節のイベントの台本（なければ空）
export function seasonalEventsOn(scripts, seed, start, date) {
  if (!start || date < start) return [];
  const year = Number(date.slice(0, 4));
  return seasonalEvents(scripts).filter((f) => seasonalEventDate(f, year, scripts, seed, start) === date);
}

// その日の公園の木のオブジェ（季節のイベントの3日前から当日まで。なければ null）
export function eventTreeOn(scripts, seed, start, date) {
  if (!start) return null;
  for (const f of seasonalEvents(scripts).filter((x) => x.tree)) {
    for (const year of [Number(date.slice(0, 4)), Number(date.slice(0, 4)) + 1]) {
      const d = seasonalEventDate(f, year, scripts, seed, start);
      if (d && date <= d && daysBetween(date, d) <= OBJECT_DAYS_BEFORE) return f.tree;
    }
  }
  return null;
}

// 同じ題材の季節の台本を出さない日（季節のイベント・島のイベントの日の前後 days 日）か。avoid_seasonal に季節の台本の ID
export function seasonalBlocked(scripts, seed, start, date, seasonalId, days) {
  if (!start) return false;
  for (let i = -days; i <= days; i++) {
    const d = addDays(date, i);
    const list = [...seasonalEventsOn(scripts, seed, start, d), ...islandEventsOn(scripts, seed, start, d)];
    if (list.some((s) => (s.avoid_seasonal ?? []).includes(seasonalId))) return true;
  }
  return false;
}
