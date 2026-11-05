// 続きもの（5章：事件型・進行型）と後日談（5.1）。
// 記録には、進行中の続きもの（record.arcs）と、予約した後日談（record.sequels）を持つ。
// 段階の日は「始まった日＋offset」。ふさがっていたら、空いた日まで1日ずつ後ろへずれる。

import { addDays, daysBetween } from '../js/date.js';
import { makeRng, chance, intBetween, pick } from './rng.js';
import { weatherMatches } from './weather.js';
import { pickArcWriters, pickWriter, pickPartner, castOf, byFewestWritten } from './writers.js';
import { styleFor, pickText, canFill, fillHoles } from './text.js';
import { isSpecialDay, specialWithin } from './anniversary.js';

const month = (date) => Number(date.slice(5, 7));

export function newArcState() {
  return {
    event: null,          // 進行中の事件型 { id, A, B, start, next: 次の段階の番号, lastStepDate }
    progress: null,       // 進行中の進行型（同じ形）
    lastEventStart: null, // 前の事件型が始まった日
    lastProgressEnd: null, // 前の進行型が終わった日
  };
}

const arcList = (scripts, kind) => scripts.arcs[kind];
const arcById = (scripts, kind, id) => arcList(scripts, kind).find((a) => a.id === id);

// 段階の予定日（ずれる前）
const plannedDate = (active, step) => addDays(active.start, step.offset);

// その日に出す段階。予定日を過ぎていて、前の段階より後の日なら出す
export function dueStep(record, scripts, kind, date) {
  const active = record.arcs[kind];
  if (!active) return null;
  const arc = arcById(scripts, kind, active.id);
  const step = arc.steps[active.next];
  if (plannedDate(active, step) > date) return null;
  if (active.lastStepDate && active.lastStepDate >= date) return null;
  return { kind, arc, step, active };
}

// 進行型の次の始まりの日（前の進行型の終わり、なければ島の始まりから7〜14日あける）
export function progressStartFrom(record, seed, config) {
  const ref = record.arcs.lastProgressEnd ?? record.start;
  const [min, max] = config.progressArcGap;
  return addDays(ref, intBetween(makeRng(seed, ref, 'progress-gap'), min, max));
}

// 今日始めたときの書き手A・Bで、すべての段階の文の穴を埋められるか（字数は見ない。7章）。
// 書き手A・Bは始まった日に決まるので、始める日に確かめ、埋められなければその日は始めない
function arcFits(arc, record, nuis) {
  return stepsFit(arc, 0, pickArcWriters(nuis, record), nuis);
}

// 書き手A・B（ab）で、from 番目からあとの段階の文の穴を埋められるか（字数は見ない。7章）
function stepsFit(arc, from, ab, nuis) {
  const nui = (key) => nuis.find((n) => n.id === ab[key]);
  return arc.steps.slice(from).every((st) => {
    const writer = nui(st.writer);
    return canFill(pickText(st.text, styleFor(writer.role)), writer, nui(st.writer === 'A' ? 'B' : 'A'));
  });
}

// 進行中の続きものの書き手A・Bが島にいなくなっていたら（ぬいを削除したとき）、今いる子に替える（record を書き換える）。
// 替わる子は、もう一方の書き手を除いて、書いた回数が少ない順（同じなら島に来た順）。
// 残りの段階の文の穴を埋められる子を先にし、埋められる子がいなければ、いちばん先の子にする
export function recastArcs(record, scripts, nuis) {
  for (const kind of ['event', 'progress']) {
    const active = record.arcs[kind];
    if (!active) continue;
    const arc = arcById(scripts, kind, active.id);
    for (const key of ['A', 'B']) {
      if (nuis.some((n) => n.id === active[key])) continue;
      const other = active[key === 'A' ? 'B' : 'A'];
      const candidates = byFewestWritten(nuis, record).filter((n) => n.id !== other);
      // 2体とも削除されていたら、1体目はもう一方が決まっていないので穴埋めを確かめない
      const otherHere = nuis.some((n) => n.id === other);
      const fits = otherHere && candidates.find((n) => stepsFit(arc, active.next, { ...active, [key]: n.id }, nuis));
      active[key] = (fits || candidates[0]).id;
    }
  }
}

// 最初の週の続きもの（first_week: true）を始める日：始めた日の 1〜2 日後（使い始めて2〜3日目。config.firstWeekArcDays）
export function firstWeekStart(record, seed, config) {
  const [min, max] = config.firstWeekArcDays;
  return addDays(record.start, intBetween(makeRng(seed, record.start, 'first-week'), min, max));
}

// 今日、進行型を始められるなら、その進行型。
// まだ1本も進行型が終わっていない島で、最初の週用の台本（first_week）があれば、まずそれを最初の週に始める。
// 最初の週用の台本は、ふだんの進行型には使わない
export function startableProgress(record, scripts, seed, date, config, nuis) {
  if (record.arcs.progress) return null;
  const usable = (a) => !record.once.includes(a.id) && (!a.months || a.months.includes(month(date))) && arcFits(a, record, nuis);
  const firstWeek = arcList(scripts, 'progress').filter((a) => a.first_week && usable(a));
  if (!record.arcs.lastProgressEnd && firstWeek.length) {
    return date >= firstWeekStart(record, seed, config) ? pick(makeRng(seed, date, 'progress'), firstWeek) : null;
  }
  if (date < progressStartFrom(record, seed, config)) return null;
  const candidates = arcList(scripts, 'progress').filter((a) => !a.first_week && usable(a));
  return candidates.length ? pick(makeRng(seed, date, 'progress'), candidates) : null;
}

// 今日、事件型を始めるなら、その事件型（その日の天気が1段階目の天気に合う日に、15%で始める）
export function startableEvent(record, scripts, seed, date, weather, yesterday, config, nuis) {
  if (record.arcs.event) return null;
  const last = record.arcs.lastEventStart;
  if (last && daysBetween(last, date) < config.eventArcGap) return null;
  const candidates = arcList(scripts, 'event').filter((a) => !record.once.includes(a.id)
    && (!a.months || a.months.includes(month(date)))
    && weatherMatches(a.steps[0].weather, weather, yesterday)
    && !specialWithin(scripts, nuis, date, config.festivalNoEventDays, { seed, start: record.start })
    && !blocksSequel(record, date, a)
    && arcFits(a, record, nuis));
  if (!candidates.length) return null;
  if (!chance(makeRng(seed, date, 'event-start'), config.eventArcRate)) return null;
  return pick(makeRng(seed, date, 'event'), candidates);
}

// 事件型の段階の日が、後日談を期限に間に合わなくさせるか（期限までの日が全部ふさがる）
function blocksSequel(record, date, arc) {
  const lastStep = addDays(date, arc.steps.at(-1).offset);
  return record.sequels.some((s) => s.deadline <= lastStep);
}

export function startArc(record, kind, arc, nuis, date) {
  const { A, B } = pickArcWriters(nuis, record);
  record.arcs[kind] = { id: arc.id, A, B, start: date, next: 0, lastStepDate: null };
  if (kind === 'event') record.arcs.lastEventStart = date;
}

// 段階の日記。書き手は段階の A・B の指定どおり、相手はもう一方
export function stepDiary({ kind, arc, step, active }, nuis) {
  const writer = nuis.find((n) => n.id === active[step.writer]);
  const partner = nuis.find((n) => n.id === active[step.writer === 'A' ? 'B' : 'A']);
  const style = styleFor(writer.role);
  return {
    diary: {
      kind,
      arcId: arc.id,
      arcTitle: arc.title,
      stepId: step.id,
      step: active.next + 1,
      steps: arc.steps.length,
      scriptId: `${arc.id}/${step.id}`,
      title: step.title,
      text: fillHoles(pickText(step.text, style), writer, partner),
      style,
      ...castOf(writer, partner),
      feel: step.feel ?? null,
      time: null,
      item: step.item ?? null,
      once: active.next === 0,
      onceId: arc.id,
    },
    writer,
  };
}

// 段階を出したあと、記録を進める
export function advanceArc(record, scripts, kind, date) {
  const active = record.arcs[kind];
  const arc = arcById(scripts, kind, active.id);
  setProps(record, kind, arc.steps[active.next], date, active.next === arc.steps.length - 1);
  active.next++;
  active.lastStepDate = date;
  if (active.next >= arc.steps.length) {
    record.arcs[kind] = null;
    if (kind === 'progress') record.arcs.lastProgressEnd = date;
  }
}

// ---- コテージの絵の小物（続きものの段階ごと） ----
// 台本の段階に props（その段階のあいだ出す小物）と props_keep（その段階の日から、ずっと出す小物）を書く。
//   どちらも { 置き場所: 小物の名前 }。置き場所は絵の決まった場所（table：1階のテーブルの上、frame：1階の額縁の中 など）
//   props は、その段階の日から次の段階の前の日まで（最後の段階なら、その日だけ）。同じ続きものの次の段階で入れかわる
//   props_keep は、ほかの続きものが同じ置き場所に置くまで残る
// 記録：record.props = { keep: { 置き場所: 小物 }, temp: { 事件型か進行型: { props, from, until } } }
function setProps(record, kind, step, date, last) {
  record.props ??= { keep: {}, temp: {} };
  record.props.temp[kind] = step.props ? { props: step.props, from: date, until: last ? date : null } : null;
  if (step.props_keep) Object.assign(record.props.keep, step.props_keep);
}

// その日のコテージの絵に出す小物 { 置き場所: 小物の名前 }（ずっと出す小物の上に、進行中の段階の小物を重ねる）
export function propsOn(record, date) {
  const { keep = {}, temp = {} } = record.props ?? {};
  const out = { ...keep };
  for (const t of Object.values(temp)) {
    if (t && t.from <= date && (!t.until || date <= t.until)) Object.assign(out, t.props);
  }
  return out;
}

// ---- 後日談（5.1） ----

// 予定が入っている日（続きものの段階の予定日、ほかの後日談の予約）
function busyDates(record, scripts) {
  const busy = new Set(record.sequels.map((s) => s.date));
  for (const kind of ['event', 'progress']) {
    const active = record.arcs[kind];
    if (!active) continue;
    const arc = arcById(scripts, kind, active.id);
    arc.steps.slice(active.next).forEach((st) => busy.add(plannedDate(active, st)));
  }
  return busy;
}

// もとの話が出た日に、その後日談を予約する。行事と記念日の日・続きものの段階の日・ほかの後日談の予約はよける。
// 期限の日が行事か記念日の日にあたったら、期限をその次の日まで延ばす
export function reserveSequels(record, scripts, diary, seed, nuis) {
  for (const sq of scripts.sequels.filter((s) => s.after === diary.scriptId && !record.once.includes(s.id))) {
    const busy = busyDates(record, scripts);
    const days = [];
    for (let n = sq.min_days; n <= sq.max_days; n++) days.push(addDays(diary.date, n));
    const island = { seed, start: record.start };
    const free = days.filter((d) => !busy.has(d) && !isSpecialDay(scripts, nuis, d, island));
    let deadline = days.at(-1);
    while (isSpecialDay(scripts, nuis, deadline, island)) deadline = addDays(deadline, 1);
    record.sequels.push({
      id: sq.id,
      after: sq.after,
      from: diary.date,
      date: free.length ? pick(makeRng(seed, diary.date, `sequel-${sq.id}`), free) : days[0],
      deadline,
      writer: sq.same_writer ? diary.writer : null,
      // same_partner の後日談は、もとの話を出したときの相手を残しておく
      partner: sq.same_partner ? diary.partner : null,
    });
  }
}

// その日に出す後日談と、その書き手・相手（予約日を過ぎたもののうち、期限が近いものから）。
// 書き手は same_writer ならもとの話を書いた子、そうでなければ当番。
// 相手は same_partner ならもとの話の相手（選び直さない）、そうでなければふだんの決まり。
// 決めてある書き手か相手が島にいなくなっていたら、その予約は取り消す（ぬいを削除したときと同じ）。
// 書き手と相手で穴を埋められないものは、その日は出さない（次の日にまた見る）。字数では延ばさない（7章）。
// 期限の日になっても出せなかった予約は取り消す（record を書き換える）
export function dueSequel(record, scripts, nuis, date) {
  const due = record.sequels
    .filter((s) => s.date <= date)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  for (const s of due) {
    const writer = s.writer ? nuis.find((n) => n.id === s.writer) : pickWriter(nuis, record);
    const partner = s.partner ? nuis.find((n) => n.id === s.partner) : writer && pickPartner(nuis, writer, record);
    if (!writer || (s.partner && !partner)) {
      removeSequel(record, s.id);
      continue;
    }
    const sq = scripts.sequels.find((x) => x.id === s.id);
    if (canFill(pickText(sq.text, styleFor(writer.role)), writer, partner)) return { ...s, writerNui: writer, partnerNui: partner };
    if (s.deadline <= date) removeSequel(record, s.id);
  }
  return null;
}

export function sequelDiary(reserved, scripts, writer, partner) {
  const sq = scripts.sequels.find((s) => s.id === reserved.id);
  const style = styleFor(writer.role);
  return {
    kind: 'sequel',
    scriptId: sq.id,
    after: sq.after,
    title: sq.title,
    text: fillHoles(pickText(sq.text, style), writer, partner),
    style,
    ...castOf(writer, partner),
    feel: sq.feel ?? null,
    time: null,
    item: sq.item ?? null,
    once: true,
    onceId: sq.id,
  };
}

export function removeSequel(record, id) {
  record.sequels = record.sequels.filter((s) => s.id !== id);
}
