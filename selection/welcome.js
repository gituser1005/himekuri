// おうちに来た日の日記（5.5）。台本は scripts.welcome。本文は役ごとの書き方で1つ（書き分けはない）。
//   start：始めた日の日記そのもの。書き手は最初に登録した子（島に来た順の1番目）。相手はふだんの決まり
//   new_member：あとから子を足した日に、その日のふだんの日記とは別の1件（record.extras）。書き手は新しく来た子
// 台本の条件：role（書き手の役）と members（その日に島にいる子の数。max＝以下、min＝以上、なし＝何体でも）

import { makeRng, pick } from './rng.js';
import { byArrival, pickPartner, pairKey, castOf } from './writers.js';
import { fillHoles, styleFor } from './text.js';
import { photoFor } from './snapshots.js';

// 条件に合う台本
export function welcomeScripts(scripts, kase, role, count) {
  return (scripts.welcome ?? []).filter((w) => w.case === kase && w.role === role
    && (w.members?.max == null || count <= w.members.max)
    && (w.members?.min == null || count >= w.members.min));
}

function welcomeDiary(script, writer, partner) {
  return {
    kind: 'welcome',
    case: script.case,
    scriptId: script.id,
    title: script.title,
    text: fillHoles(script.text, writer, partner),
    style: styleFor(writer.role), // 本文は書き手の役の書き方で書いてある（書き分けの版はない）
    ...castOf(writer, partner),
    time: null,
  };
}

// 始めた日の日記（合う台本がなければ null。そのときはふだんの日記にする）
export function startWelcome({ nuis, record, scripts, seed, date }) {
  const writer = [...nuis].sort(byArrival)[0];
  const list = welcomeScripts(scripts, 'start', writer.role, nuis.length);
  if (!list.length) return null;
  const partner = pickPartner(nuis, writer, record);
  return welcomeDiary(pick(makeRng(seed, date, 'welcome'), list), writer, partner);
}

// あとから足した子のおうちに来た日の日記を、まだ作っていなければ作って record.extras に足す（record を書き換える）。
// 日付はその子が島に来た日（joined）。翌朝に届き、その日のふだんの日記より先に読む。
// 足した日のふだんの日記がもう決まっていても、別の1件なので選び直さない。作った子は record.welcomed に残す
export function addMemberWelcomes(record, { nuis, scripts, seed, config }) {
  record.extras ??= [];
  record.welcomed ??= [];
  const added = nuis.filter((n) => n.joined && n.joined > record.start && !record.welcomed.includes(n.id))
    .sort(byArrival);
  for (const nui of added) {
    record.welcomed.push(nui.id);
    const present = nuis.filter((n) => n.joined <= nui.joined);
    const list = welcomeScripts(scripts, 'new_member', nui.role, present.length);
    if (!list.length) continue;
    const partner = pickPartner(present, nui, record);
    const diary = { date: nui.joined, ...welcomeDiary(pick(makeRng(seed, nui.joined, `welcome-${nui.id}`), list), nui, partner) };
    // 記念写真（新しく来た子だけ）
    diary.snapshot = photoFor(diary, { record, scripts, nuis: present, seed, config });
    record.lastPhoto = nui.joined > (record.lastPhoto ?? '') ? nui.joined : record.lastPhoto;
    record.extras.push(diary);
    record.writeCount[nui.id] = (record.writeCount[nui.id] ?? 0) + 1;
    if (partner) record.pairedOn[pairKey(nui.id, partner.id)] = nui.joined;
  }
  return record;
}
