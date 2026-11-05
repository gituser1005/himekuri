// 習慣（4.2）：習慣を選び、その習慣の出来事と導入をつないで1本の日記にする。
// 候補がなければ、4.3 の順に決まりを緩めて選び直す。

import { pick } from './rng.js';
import { weatherMatches } from './weather.js';
import { styleFor, pickText, canFill, fillHoles, needsMet } from './text.js';
import { gapOk, daysSince } from './record.js';

const month = (date) => Number(date.slice(5, 7));

// 4.3：0＝緩めない、1＝同じ習慣の間を外す、2＝眠る話と似た場面の間も外す、3＝同じ出来事の間も14日に縮める、
// 4＝同じ文の間も外し、同じ文を最後に使った日がいちばん古い組み合わせ、
// 5（止まらないための最後）＝天気の条件がない出来事から、間の決まりをすべて外して、いちばん古い組み合わせ
export const RELAX_LEVELS = [0, 1, 2, 3, 4, 5];

// 習慣の名前（データの並び順）
export function habitNames(scripts) {
  return [...new Set(scripts.habits.intros.map((i) => i.habit))];
}

// いちばん長く出ていない習慣から順に（一度も出ていない習慣が先。同じならデータの並び順）
function habitOrder(scripts, record, date) {
  return habitNames(scripts)
    .map((h, i) => ({ h, i, since: daysSince(record.lastUsed.habit[h], date) }))
    .sort((a, b) => b.since - a.since || a.i - b.i)
    .map((x) => x.h);
}

export const textKey = (intro, event, style) => `${intro.id}+${event.id}+${style}`;

function eventOk(e, { date, weather, yesterday, record, writer, partner, config, level }) {
  const gaps = config.gaps;
  if (!weatherMatches(e.weather, weather, yesterday)) return false;
  if (e.months && !e.months.includes(month(date))) return false;
  if (!e.repeat && record.once.includes(e.id)) return false;
  if (level >= 5) {
    if (e.weather != null) return false;
  } else {
    if (!gapOk(record.lastUsed.event[e.id], date, level >= 3 ? config.relaxedEventGap : gaps.event)) return false;
    if (level < 2 && e.sleep && !gapOk(record.lastSleep, date, gaps.sleep)) return false;
    if (level < 2 && e.motif && !gapOk(record.lastUsed.motif[e.motif], date, gaps.motif)) return false;
  }
  return needsMet(e.needs ?? [], writer, partner);
}

// 季節：導入にも months があれば、その月だけ
// 場所：出来事に place があれば、導入も同じ place のものだけ（place が「なし」や未指定の導入とは組まない）
// 時間帯：出来事が「夕方以降」なら朝・昼の導入とは組まない（今の導入には time がないので、実際には外れない）
function introOk(intro, e, { date, weather, yesterday }) {
  if (!weatherMatches(intro.weather, weather, yesterday)) return false;
  if (intro.months && !intro.months.includes(month(date))) return false;
  if (e.time === '夕方以降' && ['朝', '昼'].includes(intro.time)) return false;
  if (e.place) return intro.place === e.place;
  return true;
}

// 出来事と導入をつないだ文。埋められない・同じ文の間が足りない（3段目まで）ときは null。字数では外さない（7章）
function joined(intro, e, { writer, partner, date, record, config, level }) {
  const style = styleFor(writer.role);
  const raw = pickText(intro.text, style) + pickText(e.text, style);
  if (!canFill(raw, writer, partner)) return null;
  const text = fillHoles(raw, writer, partner);
  const since = daysSince(record.lastUsed.text[textKey(intro, e, style)], date);
  if (level < 4 && since < config.gaps.text) return null;
  return { text, style, since };
}

// 1つの緩め方で習慣の日記を選ぶ。見つからなければ null
function chooseAt(level, ctx) {
  const { scripts, record, date, rng } = ctx;
  const c = { ...ctx, level };
  for (const habit of habitOrder(scripts, record, date)) {
    if (level < 1 && !gapOk(record.lastUsed.habit[habit], date, ctx.config.gaps.habit)) continue;
    const intros = scripts.habits.intros.filter((i) => i.habit === habit);
    // 出来事ごとに、組める導入（いちばん長く使っていない導入）を探す
    const pairs = scripts.habits.events
      .filter((e) => e.habit === habit && eventOk(e, c))
      .map((e) => {
        const ok = intros
          .filter((i) => introOk(i, e, c))
          .map((i) => ({ i, built: joined(i, e, c), since: daysSince(record.lastUsed.intro[i.id], date) }))
          .filter((x) => x.built);
        if (!ok.length) return null;
        const longest = Math.max(...ok.map((x) => x.since));
        const best = pick(rng, ok.filter((x) => x.since === longest));
        return { event: e, intro: best.i, ...best.built };
      })
      .filter(Boolean);
    if (pairs.length) return { habit, ...pick(rng, pairs) };
  }
  return null;
}

// 4段目・5段目：習慣を問わず、その日に組める出来事と導入の組み合わせ全部から、
// 同じ文を最後に使った日がいちばん古いもの（一度も使っていないものが先。同じなら乱数）
function chooseOldest(level, ctx) {
  const { scripts, rng } = ctx;
  const c = { ...ctx, level };
  const all = [];
  for (const e of scripts.habits.events.filter((x) => eventOk(x, c))) {
    for (const i of scripts.habits.intros.filter((x) => x.habit === e.habit && introOk(x, e, c))) {
      const built = joined(i, e, c);
      if (built) all.push({ habit: e.habit, event: e, intro: i, ...built });
    }
  }
  if (!all.length) return null;
  const oldest = Math.max(...all.map((x) => x.since));
  return pick(rng, all.filter((x) => x.since === oldest));
}

// 習慣の日記を選ぶ。緩めない → 4.3 の順に緩める。どこまで緩めても見つからなければ null
export function chooseHabit(ctx) {
  for (const level of RELAX_LEVELS) {
    const found = level >= 4 ? chooseOldest(level, ctx) : chooseAt(level, ctx);
    if (found) return { ...found, relaxed: level };
  }
  return null;
}

export function habitDiary(found, partner) {
  const { event: e, intro } = found;
  return {
    kind: 'habit',
    habit: found.habit,
    scriptId: `${intro.id}+${e.id}`,
    introId: intro.id,
    eventId: e.id,
    textKey: textKey(intro, e, found.style),
    title: e.title,
    text: found.text,
    style: found.style,
    partner,
    sleep: e.sleep,
    place: e.place && e.place !== 'なし' ? e.place : null, // 写真の場面に使う（ベンチ・芝生）
    motif: e.motif ?? null,
    time: e.time ?? null,
    item: null,
    once: !e.repeat,
    relaxed: found.relaxed,
  };
}
