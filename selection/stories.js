// 普段の日の新しい話（4.1）：役ごとの台本・共通の台本・季節の出来事・好きなことの台本（4.1.1）。
// 役ごと・共通・好きなことは一度きり。季節の出来事は毎年、出せる期間のひとまとまりに1回まで（once_ever は一度きり）。

import { addDays, daysBetween } from '../js/date.js';
import { DEFAULT_CONFIG } from './config.js';
import { makeRng, pick, chance, intBetween } from './rng.js';
import { weatherMatches } from './weather.js';
import { gapOk } from './record.js';
import { seasonalBlocked } from './events.js';
import { styleFor, pickText, canFill, fillHoles, needsMet } from './text.js';

const month = (date) => Number(date.slice(5, 7));

// 好きなことの台本（台本データにまだなければ空）
export const likesScripts = (scripts) => scripts.likes_scripts ?? [];

// 台本の種類：役ごと（role）・好きなこと（likes）・季節の出来事（seasonal）・共通（common）
export function storyKind(s, scripts) {
  if (s.role) return 'role';
  if (likesScripts(scripts).includes(s)) return 'likes';
  return scripts.seasonal.includes(s) ? 'seasonal' : 'common';
}

// 好きなことの台本で、好きなことが出る子（4.1.1）：needs が指定する側。
// 「好きなこと」なら書き手、「相手の好きなこと」なら相手、両方なら2体とも
export function likesShown(s, writer, partner) {
  const kinds = (s.needs ?? []).map((need) => need.split('=')[0]);
  return [
    ...(kinds.includes('好きなこと') ? [writer] : []),
    ...(kinds.includes('相手の好きなこと') && partner ? [partner] : []),
  ];
}

// 好きなことが出る子が、どの子も前に出た日から likesGap 日以上たっているか（needs が指定しない側は見ない）
function likesGapOk(s, writer, partner, record, date, config) {
  return likesShown(s, writer, partner).every((n) => gapOk(record.lastUsed.likes?.[n.id], date, config.likesGap));
}

// その日が台本の出せる期間に入っているか。period（start・end、MM-DD）があればその日付のあいだ、
// なければ months。どちらもなければいつでも
export function inSeason(s, date) {
  if (s.period) {
    const md = date.slice(5);
    const { start, end } = s.period;
    return start <= end ? md >= start && md <= end : md >= start || md <= end;
  }
  return !s.months?.length || s.months.includes(month(date));
}

// 出せる期間の残りの日数。その日が期間の最後の日なら0。期間の決まりがなければ Infinity
export function seasonDaysLeft(s, date) {
  if (!s.period && !s.months?.length) return Infinity;
  let n = 0;
  while (n < 366 && inSeason(s, addDays(date, n + 1))) n++;
  return n;
}

// date 以前でいちばん近い「出せる期間のひとまとまり」の始まりの日（12月〜1月のように年をまたいでも1つ）。
// 1年さかのぼっても期間に入る日がなければ null
export function seasonStart(s, date) {
  let d = date;
  let n = 0;
  while (!inSeason(s, d)) {
    if (++n > 366) return null;
    d = addDays(d, -1);
  }
  while (n++ < 732 && inSeason(s, addDays(d, -1))) d = addDays(d, -1);
  return d;
}

// 期間のひとまとまり（start から始まる）で、その季節の出来事を出してよい最初の日。
// 期間の初日から「期間の終わりの seasonalOpenMargin 日前」までのあいだで、種・期間の初日・用途から乱数で決める
// （同じ条件なら同じ日）。期間が短くてその日数を引けないときと、雨の日だけの話（weather が「雨」）は初日
export function seasonOpenDate(s, start, seed, config) {
  if (s.weather === '雨') return start;
  const last = seasonDaysLeft(s, start) - config.seasonalOpenMargin;
  if (last <= 0) return start;
  return addDays(start, intBetween(makeRng(seed, start, `season-open-${s.id}`), 0, last));
}

// 季節の出来事を、その日に出せるか（期間・出してよい最初の日・一生に一度・その期間にまだ出ていない・after・季節の出来事どうしの間・
// 同じ題材の季節のイベント・島のイベントの前後 eventSeasonalDays 日でない）
function seasonalOk(s, scripts, date, record, seed, config) {
  if (!inSeason(s, date)) return false;
  if (seasonalBlocked(scripts, seed, record.start, date, s.id, config.eventSeasonalDays)) return false;
  if (s.once_ever && record.once.includes(s.id)) return false;
  const start = seasonStart(s, date);
  if (date < seasonOpenDate(s, start, seed, config)) return false;
  const last = record.lastUsed.seasonal[s.id];
  if (last && last >= start) return false;
  if (record.lastSeasonal && daysBetween(record.lastSeasonal, date) < config.seasonalGap) return false;
  if (s.after) {
    // after.id が同じ期間のひとまとまり（after.id の期間の、いちばん近い始まりの日から）に出ていて、min_days 日以上たっている
    const before = scripts.seasonal.find((x) => x.id === s.after.id);
    const shown = record.lastUsed.seasonal[s.after.id];
    const beforeStart = before && seasonStart(before, date);
    if (!shown || !beforeStart || shown < beforeStart) return false;
    if (daysBetween(shown, date) < (s.after.min_days ?? 0)) return false;
  }
  return true;
}

// 新しい話の日に、候補のどれから選ぶか（4.1）
//   1. 出せる期間の残りが seasonalUrgentDays 日以内の季節の出来事（残りがいちばん少ないもの）
//   2. 好きなことの台本（likesStoryRate。くじは likesRng で引き、候補がなければ引かない）
//   3. 役ごとの台本（roleStoryRate）か、共通の台本と季節の出来事か。選んだ側に候補がなければもう一方
//      （どちらにもなければ好きなことの台本）
export function storyPool(candidates, scripts, date, rng, config, likesRng = rng) {
  const seasonal = candidates.filter((s) => storyKind(s, scripts) === 'seasonal');
  const left = new Map(seasonal.map((s) => [s, seasonDaysLeft(s, date)]));
  const urgent = seasonal.filter((s) => left.get(s) <= config.seasonalUrgentDays);
  if (urgent.length) {
    const least = Math.min(...urgent.map((s) => left.get(s)));
    return urgent.filter((s) => left.get(s) === least);
  }
  const likes = candidates.filter((s) => storyKind(s, scripts) === 'likes');
  if (likes.length && chance(likesRng, config.likesStoryRate)) return likes;
  const rest = candidates.filter((s) => !likes.includes(s));
  const role = rest.filter((s) => s.role);
  const common = rest.filter((s) => !s.role);
  const [first, second] = chance(rng, config.roleStoryRate) ? [role, common] : [common, role];
  if (first.length) return first;
  return second.length ? second : likes;
}

// 書き手と相手で出せる新しい話の一覧（4.1 の候補の条件）
export function storyCandidates({ scripts, nuis, writer, partner, date, weather, yesterday, record, seed, config = DEFAULT_CONFIG }) {
  const used = new Set(record.once);
  const once = [...scripts.role_scripts.filter((s) => s.role === writer.role), ...scripts.commons];
  const ok = (s) => weatherMatches(s.weather, weather, yesterday) && fits(s, nuis, writer, castPartner(s, partner));
  const likesOk = (s) => likesGapOk(s, writer, castPartner(s, partner), record, date, config);
  return [
    ...once.filter((s) => !used.has(s.id) && inSeason(s, date) && ok(s)),
    ...likesScripts(scripts).filter((s) => !used.has(s.id) && inSeason(s, date) && ok(s) && likesOk(s)),
    ...scripts.seasonal.filter((s) => seasonalOk(s, scripts, date, record, seed, config) && ok(s)),
  ];
}

// 天気と日付によらない条件：顔ぶれ（cast）・needs・穴埋め。字数では外さない（7章）
function fits(s, nuis, writer, p) {
  if (s.cast === 'all' && nuis.length < 3) return false;
  if (s.cast !== 'solo' && !p) return false;
  if (!needsMet(s.needs ?? [], writer, p)) return false;
  return canFill(pickText(s.text, styleFor(writer.role)), writer, p);
}

// その島の顔ぶれで、いつか出せる新しい話か（確認ページの「出せる残り」用）。
// 天気と月は、待てばいつか合うので見ない。相手は、書き手以外の誰かと組めればよい
export function writableOnIsland(s, nuis) {
  return nuis.some((w) => (!s.role || s.role === w.role)
    && (s.cast === 'solo' ? [null] : nuis.filter((n) => n !== w)).some((p) => fits(s, nuis, w, p)));
}

// ひとりの話（solo）には相手がいない
const castPartner = (s, partner) => (s.cast === 'solo' ? null : partner);

// 候補から1本選ぶ。前の日と同じ type を避け、同じ feel が3日続かないようにする（ほかに候補がなければ可）
export function chooseStory(candidates, recentDays, rng) {
  const prev = recentDays.at(-1);
  const prev2 = recentDays.at(-2);
  let list = candidates;
  const avoidType = list.filter((s) => !prev?.type || s.type !== prev.type);
  if (avoidType.length) list = avoidType;
  if (prev?.feel && prev2?.feel === prev.feel) {
    const avoidFeel = list.filter((s) => s.feel !== prev.feel);
    if (avoidFeel.length) list = avoidFeel;
  }
  return pick(rng, list);
}

// 選んだ台本を日記にする
export function storyDiary(s, scripts, writer, partner) {
  const style = styleFor(writer.role);
  const p = castPartner(s, partner);
  const kind = storyKind(s, scripts);
  return {
    kind,
    // 好きなことが出た子の id（好きなことの台本だけ。記録の lastUsed.likes に入れる）
    likesOf: kind === 'likes' ? likesShown(s, writer, p).map((n) => n.id) : null,
    scriptId: s.id,
    title: s.title,
    text: fillHoles(pickText(s.text, style), writer, p),
    style,
    partner: p,
    type: s.type,
    feel: s.feel,
    time: s.time ?? null,
    item: s.item ?? null,
    // 季節の出来事は毎年出るので一度きりにしない（once_ever だけ一度きり）
    once: kind !== 'seasonal' || Boolean(s.once_ever),
  };
}
