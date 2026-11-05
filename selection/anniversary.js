// 島の記念日（5.3）：島で最初のぬいを登録した日（いちばん早い joined）から毎年。1周年から、台本のある年まで。
// 行事と同じく選ぶ順番の1番目で、行事と同じ日なら記念日が先。

import { addDays } from '../js/date.js';
import { isFestivalDay } from './festivals.js';
import { pickWriter, pickPartner, castOf } from './writers.js';
import { styleFor, pickText, fillHoles } from './text.js';

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// 毎年の「MM-DD」の日を、その年の日付にする。2月29日は、うるう年でない年は2月28日
export function yearlyDate(mmdd, year) {
  if (mmdd === '02-29' && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${mmdd}`;
}

// 島の暮らしが始まった日（いちばん早い joined）
export function islandBirth(nuis) {
  return nuis.map((n) => n.joined).sort()[0] ?? null;
}

// その日が記念日なら、その年数の台本。台本のない年（11周年から）や記念日でない日は null
export function anniversaryOn(scripts, nuis, date) {
  const birth = islandBirth(nuis);
  if (!birth) return null;
  const year = Number(date.slice(0, 4));
  const n = year - Number(birth.slice(0, 4));
  if (n < 1 || yearlyDate(birth.slice(5), year) !== date) return null;
  return (scripts.island_anniversary ?? []).find((a) => a.year === n) ?? null;
}

// 行事か記念日の日（続きものの段階と後日談はよけ、事件型は3日前から始めない）。
// island（{ seed, start }）があれば、島ごとの季節のイベント・島のイベントの日も入れる（selection/events.js）
export function isSpecialDay(scripts, nuis, date, island = null) {
  return isFestivalDay(scripts, date, island) || Boolean(anniversaryOn(scripts, nuis, date));
}

// date から n 日後までに行事か記念日の日があるか（事件型は行事・記念日の3日前から当日までは始めない）
export function specialWithin(scripts, nuis, date, n, island = null) {
  for (let i = 0; i <= n; i++) if (isSpecialDay(scripts, nuis, addDays(date, i), island)) return true;
  return false;
}

// 記念日の日記。書き手と相手はふだんと同じ決まり。相手は付け替えない。天気によらず同じ台本
export function anniversaryDiary(script, nuis, record) {
  const writer = pickWriter(nuis, record);
  const partner = pickPartner(nuis, writer, record);
  const style = styleFor(writer.role);
  return {
    kind: 'anniversary',
    scriptId: script.id,
    anniversaryYear: script.year,
    title: script.title,
    text: fillHoles(pickText(script.text, style), writer, partner),
    style,
    ...castOf(writer, partner),
    feel: null,
    time: null,
    item: null,
    once: false,
  };
}
