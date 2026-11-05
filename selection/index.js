// 日記の自動選択の入口。docs/diary-selection.md が正本。
// 画面にも保存にも触らない。入力は「ぬいの設定・日付・これまでの記録・台本データ・乱数の種」、
// 出力は「その日の天気と日記（誕生日なら手紙も）、更新した記録」。試用期間が終わったら、このままアプリに組み込む。

import { addDays } from '../js/date.js';
import { DEFAULT_CONFIG } from './config.js';
import { makeRng, chance } from './rng.js';
import { rollWeather, forcedWeather } from './weather.js';
import { pickWriter, pickPartner, pairKey, castOf } from './writers.js';
import { storyCandidates, storyPool, chooseStory, storyDiary } from './stories.js';
import { chooseHabit, habitDiary } from './habits.js';
import { newRecord } from './record.js';
import { festivalsOn, isFestivalDay, chooseFestival, chooseIslandEvent, eventWeather, festivalDiary } from './festivals.js';
import { anniversaryOn, anniversaryDiary } from './anniversary.js';
import { makeLetter } from './letter.js';
import { startWelcome } from './welcome.js';
import { photoFor } from './snapshots.js';
import {
  dueStep, startableProgress, startableEvent, startArc, stepDiary, advanceArc,
  reserveSequels, dueSequel, sequelDiary, removeSequel, recastArcs,
} from './arcs.js';

export { newRecord };

// その日の天気と日記（と、誕生日なら手紙）を決める。
// 記録にもうその日があれば、選び直さずにそれを返す（早送りや読み込み直しで内容が変わらないように）。
// 日付は、記録の最後の日の次の日（記録が空なら島の始まりの日）でなければならない。
// birthday：管理人さんの誕生日「MM-DD」（なければ null）。手紙は日記とは別に作り、日記の選び方には影響させない
export function decideDay({ nuis: all, date, record, scripts, seed, config = DEFAULT_CONFIG, birthday = null }) {
  // その日に島にいる子だけで選ぶ（島に来た日 joined がその日より後の子は、まだいない）
  const nuis = all.filter((n) => !n.joined || n.joined <= date);
  const decided = record.days.find((d) => d.date === date);
  if (decided) return { weather: decided.weather, diary: decided, letter: record.letters.find((l) => l.date === date) ?? null, record };

  const last = record.days.at(-1);
  const expected = last ? addDays(last.date, 1) : record.start;
  if (date !== expected) throw new Error(`${expected} の次に ${date} は決められない`);

  const next = structuredClone(record);
  const { weather, diary } = chooseDiary({ nuis, date, record: next, scripts, seed, config, last });
  // 写真を付ける日記なら、写真の中身（snapshot）を残す。写真そのものはアプリが作る
  const snapshot = photoFor({ ...diary, date }, { record: next, scripts, nuis, seed, config });
  if (snapshot) {
    diary.snapshot = snapshot;
    next.days.at(-1).snapshot = snapshot;
    next.lastPhoto = date;
  }
  const letter = makeLetter({ scripts, nuis, record: next, date, seed, birthday });
  return { weather, diary, letter, record: next };
}

// 日記を決めて記録に足す（record を書き換える）
function chooseDiary({ nuis, date, record: next, scripts, seed, config, last }) {
  const yesterday = last?.weather ?? null;
  const weatherRng = makeRng(seed, date, 'weather');

  // 3章の順番：0. 始めた日のおうちに来た日の日記 → 1. 島の記念日・行事（季節のイベントも）・島のイベント → 2. 事件型の段階 → 3. 進行型の段階 → 4. 後日談 → 5. 普段の日
  // 季節のイベント・島のイベントの日は島ごと（selection/events.js）。新しく足す外のイベントは、天気を台本の天気（晴れ）に決める
  const island = { seed, start: next.start };
  let weather;
  let body;
  // 日付表にない年の行事の警告は、記録の中でその年の最初の日にだけ付ける
  const firstOfYear = !last || last.date.slice(0, 4) !== date.slice(0, 4);
  const warnings = firstOfYear ? festivalsOn(scripts, date).warnings : [];
  const withWarnings = (d) => ({ ...d, ...(warnings.length ? { warnings } : {}) });

  // 0. 始めた日は、その日の日記そのものを、おうちに来た日の日記にする（翌朝に届くのはこの1ページだけ）。天気はふだんどおり
  if (date === next.start) {
    next.welcomed = [...new Set([...(next.welcomed ?? []), ...nuis.map((n) => n.id)])];
    const welcome = startWelcome({ nuis, record: next, scripts, seed, date });
    if (welcome) {
      weather = rollWeather(weatherRng, config);
      const diary = withWarnings({ date, weather, ...welcome });
      apply(next, diary, config);
      return { weather, diary };
    }
  }

  // 1. 記念日（行事と同じ日なら記念日が先）。天気はふだんどおり決めるが、台本は天気によらない
  const anniversary = anniversaryOn(scripts, nuis, date);
  if (anniversary) {
    weather = rollWeather(weatherRng, config);
    const diary = withWarnings({ date, weather, ...anniversaryDiary(anniversary, nuis, next) });
    apply(next, diary, config);
    return { weather, diary };
  }
  // 1. 行事：天気はふだんどおり決め、その天気に合う台本を出す。続きものの段階と後日談は次の日にずれる
  if (isFestivalDay(scripts, date, island)) {
    const set = eventWeather(scripts, date, island);
    weather = set ? forcedWeather(weatherRng, set, config) : rollWeather(weatherRng, config);
    const found = chooseFestival({ scripts, nuis, record: next, date, weather, yesterday, island })
      ?? chooseIslandEvent({ scripts, nuis, record: next, date, weather, yesterday, island });
    if (found) {
      const diary = withWarnings({ date, weather, ...festivalDiary(found) });
      apply(next, diary, config);
      return { weather, diary };
    }
  }

  // 続きものの書き手が削除されていたら、今いる子に替えてから段階を出す
  recastArcs(next, scripts, nuis);
  const sequel = dueSequel(next, scripts, nuis, date);
  let step = dueStep(next, scripts, 'event', date) ?? dueStep(next, scripts, 'progress', date);
  // 期限の日を迎えた後日談は、進行型の段階より先に出す（進行型の段階は次の日にずれる）
  if (step?.kind === 'progress' && sequel?.deadline === date) step = null;
  if (!step && !sequel) {
    const arc = startableProgress(next, scripts, seed, date, config, nuis);
    if (arc) {
      startArc(next, 'progress', arc, nuis, date);
      step = dueStep(next, scripts, 'progress', date);
    }
  }

  if (step) {
    weather = forcedWeather(weatherRng, step.step.weather, config);
    body = stepDiary(step, nuis).diary;
  } else if (sequel) {
    weather ??= rollWeather(weatherRng, config);
    body = sequelDiary(sequel, scripts, sequel.writerNui, sequel.partnerNui);
  } else {
    // 行事の日でその天気に合う台本がなかったときは、決めた天気のまま
    weather ??= rollWeather(weatherRng, config);
    const arc = startableEvent(next, scripts, seed, date, weather, yesterday, config, nuis);
    if (arc) {
      startArc(next, 'event', arc, nuis, date);
      step = dueStep(next, scripts, 'event', date);
      body = stepDiary(step, nuis).diary;
    } else {
      body = ordinaryDay({ nuis, date, record: next, scripts, seed, config, weather, yesterday });
    }
  }

  // warnings：日付表にない年の行事（確認ページに出す）
  const diary = withWarnings({ date, weather, ...body });
  apply(next, diary, config);
  if (step) advanceArc(next, scripts, step.kind, date);
  if (diary.kind === 'sequel') removeSequel(next, diary.scriptId);
  reserveSequels(next, scripts, diary, seed, nuis);
  return { weather, diary };
}

// start から days 日分を続けて決めた記録（確認ページとテスト用）
export function simulate({ nuis, scripts, seed, start, days, config = DEFAULT_CONFIG, record = newRecord(start), birthday = null }) {
  let date = record.days.length ? addDays(record.days.at(-1).date, 1) : record.start;
  for (let i = 0; i < days; i++) {
    record = decideDay({ nuis, date, record, scripts, seed, config, birthday }).record;
    date = addDays(date, 1);
  }
  return record;
}

// 最後から数えて、習慣の日が何日続いているか
function habitStreak(days) {
  let n = 0;
  for (let i = days.length - 1; i >= 0 && days[i].kind === 'habit'; i--) n++;
  return n;
}

// 普段の日（4章）：新しい話か習慣か
function ordinaryDay(ctx) {
  const { nuis, record, seed, date, config } = ctx;
  const writer = pickWriter(nuis, record);
  const partner = pickPartner(nuis, writer, record);
  const c = { ...ctx, writer, partner };

  const stories = storyCandidates(c);
  // 出せる新しい話があるのに、習慣の日が habitStreakLimit 日続いてしまうときは新しい話にする
  const forced = habitStreak(record.days) >= config.habitStreakLimit - 1;
  const wantStory = stories.length > 0 && (forced || chance(makeRng(seed, date, 'kind'), config.newStoryRate));

  // storiesAvailable：その日に出せた新しい話の数（確認用。記録には残さない）
  const named = (diary) => ({ ...diary, ...castOf(writer, diary.partner), storiesAvailable: stories.length });
  if (!wantStory) {
    const found = chooseHabit({ ...c, rng: makeRng(seed, date, 'habit') });
    if (found) return named(habitDiary(found, partner));
  }
  if (stories.length) {
    const pool = storyPool(stories, ctx.scripts, date, makeRng(seed, date, 'story-side'), config, makeRng(seed, date, 'story-likes'));
    return named(storyDiary(chooseStory(pool, record.days, makeRng(seed, date, 'story')), ctx.scripts, writer, partner));
  }
  throw new Error(`${date}: 出せる日記がない（${writer.name}）`);
}

// 確かめのためだけの項目（確認ページで見る）。アプリの記録には残さない（config.keepDebug が true のときだけ残す）
const DEBUG_FIELDS = ['textKey', 'introId', 'eventId', 'storiesAvailable'];
// 記録に残す形：確かめのための項目と、値のない項目（null・false・0）を外して小さくする
function forRecord(diary, config) {
  if (config.keepDebug) return diary;
  return Object.fromEntries(Object.entries(diary).filter(([k, v]) => !DEBUG_FIELDS.includes(k) && v !== null && v !== false && v !== 0));
}

// 決めた日記を記録に足す（9章）
function apply(record, diary, config) {
  const { date } = diary;
  record.days.push(forRecord(diary, config));
  record.writeCount[diary.writer] = (record.writeCount[diary.writer] ?? 0) + 1;
  if (diary.partner) record.pairedOn[pairKey(diary.writer, diary.partner)] = date;
  if (diary.once) record.once.push(diary.onceId ?? (diary.kind === 'habit' ? diary.eventId : diary.scriptId));
  if (diary.kind === 'seasonal') {
    record.lastUsed.seasonal[diary.scriptId] = date;
    record.lastSeasonal = date;
  }
  // 好きなことの台本で好きなことが出た子（4.1.1。後日談では入れない）
  if (diary.likesOf) {
    record.lastUsed.likes ??= {};
    for (const id of diary.likesOf) record.lastUsed.likes[id] = date;
  }
  if (diary.kind === 'habit') {
    const used = record.lastUsed;
    used.habit[diary.habit] = date;
    used.event[diary.eventId] = date;
    used.intro[diary.introId] = date;
    used.text[diary.textKey] = date;
    if (diary.motif) used.motif[diary.motif] = date;
    if (diary.sleep) record.lastSleep = date;
  }
  // 棚には同じ種類のアイテムを1つだけ置く（8章）
  if (diary.item && !record.shelf.some((s) => s.item === diary.item)) {
    record.shelf.push({ item: diary.item, from: diary.scriptId, date });
  }
}
