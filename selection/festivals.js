// 行事（3章の1番目、5.2）：その日付の行事の台本を、天気と版で選ぶ。
// 行事は毎年出す。一度きりの決まりにも、同じ文の決まりにも入れない。
// 季節のイベント（行事の台本のうち period のあるもの。焼き芋大会など）と島のイベント（island_events）の日は、島ごとに決まる
// （selection/events.js。island＝{ seed, start }）。どちらも行事と同じく、その日の日記を優先する

import { weatherMatches } from './weather.js';
import { pickWriter, partnerOrder, castOf } from './writers.js';
import { styleFor, pickText, canFill, fillHoles } from './text.js';
import { seasonalEventsOn, islandEventsOn } from './events.js';

const FIRST = 'はじめて';
const AGAIN = '今年も';

// 行事の、その年の日付。date が「MM-DD」ならその年のその日、名前なら日付表（festival_dates）から引く。
// 表にない年は null
export function festivalDate(f, year, scripts) {
  if (f.period) return null; // 季節のイベントは島ごと（events.js）
  if (/^\d{2}-\d{2}$/.test(f.date)) return `${year}-${f.date}`;
  return scripts.festival_dates?.[f.date]?.[String(year)] ?? null;
}

// その日の行事の台本（天気と版で選ぶ前の、その日付のものすべて）と、日付表にない行事の警告
export function festivalsOn(scripts, date, island = null) {
  const year = Number(date.slice(0, 4));
  const list = island ? seasonalEventsOn(scripts, island.seed, island.start, date) : [];
  const warnings = [];
  for (const f of (scripts.festivals ?? []).filter((x) => !x.period)) {
    const d = festivalDate(f, year, scripts);
    if (d === date) list.push(f);
    else if (d === null && !warnings.some((w) => w.festival === f.festival)) {
      warnings.push({ festival: f.festival, message: `${year}年の${f.festival}の日付が日付表にない` });
    }
  }
  return { list, warnings };
}

// その日が行事の日（季節のイベント・島のイベントの日も）か
export function isFestivalDay(scripts, date, island = null) {
  return festivalsOn(scripts, date, island).list.length > 0
    || (island ? islandEventsOn(scripts, island.seed, island.start, date).length > 0 : false);
}

// 書き手が、去年の同じ行事の日に島にいたか（島の始まりの日と、書き手が島に来た日が、どちらも去年の行事の日以前）
function wasHereLastYear(f, date, writer, record, scripts) {
  const last = festivalDate(f, Number(date.slice(0, 4)) - 1, scripts);
  return Boolean(last) && record.start <= last && writer.joined <= last;
}

// その日の行事の日記の材料（台本・書き手・相手）。行事がなければ null
//   天気：その日の天気に合う台本（くもりは晴れ）
//   版：書き手が去年の同じ行事の日に島にいたら「今年も」、いなければ「はじめて」（「今年も」がなければ「はじめて」）
//   相手：ふだんの日と同じ順で、穴を埋められる子を先にする。どの子でも埋められなければ最初の相手（字数では替えない。7章）
export function chooseFestival({ scripts, nuis, record, date, weather, yesterday, island = null }) {
  const { list } = festivalsOn(scripts, date, island);
  return chooseFrom({ list, scripts, nuis, record, date, weather, yesterday });
}

// その日の島のイベントの日記の材料（行事と同じ選び方）。なければ null
export function chooseIslandEvent({ scripts, nuis, record, date, weather, yesterday, island }) {
  const list = islandEventsOn(scripts, island.seed, island.start, date);
  const found = chooseFrom({ list, scripts, nuis, record, date, weather, yesterday });
  return found && { ...found, island: true };
}

// 新しく足す外のイベント（季節のイベント・島のイベント）は、その日の天気を台本の天気に決める（雨の版は作らない）
export function eventWeather(scripts, date, island) {
  const list = [...festivalsOn(scripts, date, island).list.filter((f) => f.period), ...islandEventsOn(scripts, island.seed, island.start, date)];
  return list.find((f) => f.weather)?.weather ?? null;
}

function chooseFrom({ list, scripts, nuis, record, date, weather, yesterday }) {
  const matched = list.filter((f) => weatherMatches(f.weather, weather, yesterday));
  if (!matched.length) return null;
  const writer = pickWriter(nuis, record);
  const again = matched.filter((f) => f.version === AGAIN);
  const first = matched.filter((f) => (f.version ?? FIRST) === FIRST);
  const wantAgain = again.length && wasHereLastYear(again[0], date, writer, record, scripts);
  const script = (wantAgain ? again : first.length ? first : matched)[0];
  const text = pickText(script.text, styleFor(writer.role));
  const partners = partnerOrder(nuis, writer, record);
  const partner = partners.find((p) => canFill(text, writer, p)) ?? partners[0] ?? null;
  return { script, writer, partner };
}

export function festivalDiary({ script, writer, partner, island = false }) {
  const style = styleFor(writer.role);
  return {
    kind: island ? 'island' : 'festival',
    scriptId: script.id,
    festival: script.festival ?? script.event,
    version: script.version ?? FIRST,
    title: script.title,
    text: fillHoles(pickText(script.text, style), writer, partner),
    style,
    ...castOf(writer, partner),
    feel: null,
    time: null,
    item: script.item ?? null,
    once: false,
  };
}
