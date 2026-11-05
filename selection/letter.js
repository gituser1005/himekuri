// 誕生日の手紙（5.4）：管理人さんの誕生日に、日記とは別に1通作る。日記の選び方には影響させない。
// 形は、あいさつ（その島で最初の手紙なら first、2通目から later）＋島にいるぬい全員の一言（登録順、名前を署名に）。

import { makeRng, pick } from './rng.js';
import { byArrival } from './writers.js';
import { yearlyDate } from './anniversary.js';

// その日が誕生日（「MM-DD」）か。2月29日は、うるう年でない年は2月28日
export function isBirthday(birthday, date) {
  return Boolean(birthday) && yearlyDate(birthday, Number(date.slice(0, 4))) === date;
}

// 一言を選ぶ。候補は上から順に見て、最初に残ったものから乱数で選ぶ
//   1. 島の誰もまだ使っていない一言
//   2. その子がまだ使っていない一言（20本を使い切ったら全部を候補に戻す）
//   どちらも、同じ手紙のほかの子の一言と、その子の前の手紙の一言は避ける
function chooseLine(pool, { islandUsed, mine, last, taken }, rng) {
  const free = (l) => !taken.has(l) && l !== last;
  const unusedByAll = pool.filter((l) => !islandUsed.has(l) && free(l));
  if (unusedByAll.length) return pick(rng, unusedByAll);
  const cycle = pool.every((l) => mine.has(l)) ? new Set() : mine; // 使い切ったら戻す
  const unusedByMe = pool.filter((l) => !cycle.has(l) && free(l));
  if (unusedByMe.length) return pick(rng, unusedByMe);
  return pick(rng, pool.filter((l) => !taken.has(l)).length ? pool.filter((l) => !taken.has(l)) : pool);
}

// その日の手紙を作り、記録（record.letters と record.letterLines）を更新する。誕生日でなければ null
export function makeLetter({ scripts, nuis, record, date, seed, birthday }) {
  if (!isBirthday(birthday, date)) return null;
  const data = scripts.birthday_letter;
  if (!data?.lines) return null;
  const members = nuis.filter((n) => n.joined <= date).sort(byArrival);
  const islandUsed = new Set(record.letters.flatMap((l) => l.lines.map((x) => x.line)));
  const taken = new Set();
  const lines = members.map((n) => {
    const pool = data.lines[n.role] ?? [];
    const mine = new Set(record.letterLines[n.id] ?? []);
    const last = record.letters.at(-1)?.lines.find((x) => x.id === n.id)?.line ?? null;
    const line = chooseLine(pool, { islandUsed, mine, last, taken }, makeRng(seed, date, `letter-${n.id}`));
    taken.add(line);
    // その子の使った一言（20本を使い切ったら、そこから数え直す）
    const used = pool.every((l) => mine.has(l)) ? [] : [...mine];
    record.letterLines[n.id] = [...used, line];
    return { id: n.id, name: n.name, role: n.role, line };
  });
  const letter = {
    date,
    greeting: record.letters.length === 0 ? data.greeting.first : data.greeting.later,
    lines,
  };
  record.letters.push(letter);
  return letter;
}
