// 島ごとの記録（9章）。decideDay はこれを受け取り、書き換えずに新しい記録を返す。

import { daysBetween } from '../js/date.js';
import { newArcState } from './arcs.js';

export function newRecord(start) {
  return {
    start,                 // 島の始まりの日
    days: [],              // 出た日記（日付順。1日1件）。書き手と相手は id と、その日の名前（writerName・partnerName）
    writeCount: {},        // ぬいの id → 書いた回数
    pairedOn: {},          // 'A|B'（id）→ 最後に組んだ日
    lastUsed: {            // 最後に出た日
      habit: {},           // 習慣（お茶 など）
      event: {},           // 習慣の出来事 ID
      intro: {},           // 習慣の導入 ID
      motif: {},           // 似た場面（湯気 など）
      text: {},            // 同じ文（導入ID+出来事ID+書き分け）
      seasonal: {},        // 季節の出来事 ID（毎年、出せる期間のひとまとまりに1回まで）
      likes: {},           // ぬいの id → 好きなことの台本で好きなことが出た日（4.1.1。後日談は数えない。項目のない古い記録は「まだ出ていない」）
    },
    lastSeasonal: null,    // 最後に季節の出来事が出た日
    lastSleep: null,       // 最後に眠る話が出た日
    once: [],              // 一度きりの台本（役ごと・共通・好きなこと、repeat: false の出来事、続きもの、後日談、once_ever の季節の出来事）で出た ID
    shelf: [],             // 棚のアイテム { item, from: 台本ID, date }
    arcs: newArcState(),   // 進行中の続きもの（arcs.js）
    sequels: [],           // 予約した後日談 { id, after, from, date: 予約日, deadline, writer: 書く子の id（same_writer のとき）, partner: 相手の id（same_partner のとき） }
    letters: [],           // 誕生日の手紙 { date, greeting, lines: [{ id, name, role, line }] }（name はその日の名前）
    letterLines: {},       // ぬいの id → 手紙で使った一言（20本を使い切ったら数え直す）
    extras: [],            // ふだんの日記とは別の1件（あとから来た子のおうちに来た日の日記。welcome.js）。その日のふだんの日記より先に読む
    welcomed: [],          // おうちに来た日の日記を作った子の id（始めた日の顔ぶれも入る）
    props: { keep: {}, temp: {} }, // コテージの絵の小物（続きものの段階ごと。arcs.js の propsOn）
    lastPhoto: null,       // 最後に写真を付けた日記の日（snapshots.js）
  };
}

// 最後に出た日から何日目か。一度も出ていなければ Infinity
export function daysSince(lastDate, date) {
  return lastDate ? daysBetween(lastDate, date) : Infinity;
}

// 「N日あける」＝前に出た日から N 日以上たっている
export function gapOk(lastDate, date, gap) {
  return daysSince(lastDate, date) >= gap;
}
