// 日記の写真（どの日記に付けるかと、写真の中身の指定）。写真そのものは、アプリが届いたときに1回だけ作る（js/snapshot.js）。
//
// 付ける日記（docs/topics/2026-11-04-photo-ordinary.md の決定。11/5 から）
//   おうちに来た日（記念写真）、島の記念日、行事、季節のイベント、島のイベント。ふだんの日記と続きもの（事件型・進行型。
//   台本の写真の指定 photo も）には付けない
// 写真の中身（日記の snapshot）：{ type: 'arrival'｜'anniversary'｜'group'｜'scene', scene, year, cast: [写る子の id], caption }
//   arrival：記念写真（公園の木の下に寄って、みんなを並べる。右下に年月日）。その日にいるみんなを、始めた日は島に来た順、
//     あとから来た日は新しい子を先に（まん中の場所）、ほかの子は島に来た順に。行事の当日は full（木の全体を入れる）
//   anniversary：島の記念日の集合写真（周年ごとの台紙と数字。docs/anniversary-letters.md 1-3）。その日にいるみんなを、登録順の固定の並びで
//   group：季節のイベント・島のイベントのみんなの写真。scene は台本の photo（js/places.js の SNAP_GROUP。焼き芋大会は imo、紅葉狩りは momiji）。
//     その日にいるみんなを島に来た順に。一言は日記のタイトル
//   scene：行事の場面写真（その日の季節と天気のコテージの絵の一部に、子を重ねる）。場面の名前は js/places.js の SNAP_SCENES
//     場面：日記の場所（ベンチ → bench、芝生 → tree）→ 雨の日は家の中（sofa か window）→ 木の下（tree）
//     写る子：本文に相手が出てくれば書き手と相手、出てこなければ書き手だけ。一言は日記のタイトル
//     （行事の写真をみんなの集合写真にするのは、イベントの日のコテージの topic のあと）

import { makeRng, pick } from './rng.js';
import { byArrival } from './writers.js';
import { isFestivalDay } from './festivals.js';

const PLACE_SCENE = { ベンチ: 'bench', 芝生: 'tree' };
const INDOOR = ['sofa', 'window'];

// 日記に付ける写真の中身。付けない日記は null。nuis：その日に島にいる子
export function photoFor(diary, { scripts, nuis, seed }) {
  const joined = [...nuis].sort(byArrival).map((n) => n.id);
  if (diary.kind === 'welcome') {
    return {
      type: 'arrival',
      ...(isFestivalDay(scripts, diary.date) ? { full: true } : {}),
      cast: diary.case === 'start' ? joined : [diary.writer, ...joined.filter((id) => id !== diary.writer)],
      caption: diary.case === 'start' ? 'おうちに来た日' : `${diary.writerName}が来た日`,
    };
  }
  if (diary.kind === 'anniversary') {
    return { type: 'anniversary', year: diary.anniversaryYear, cast: joined, caption: diary.title };
  }
  if (diary.kind !== 'festival' && diary.kind !== 'island') return null;
  const script = [...(scripts.festivals ?? []), ...(scripts.island_events ?? [])].find((s) => s.id === diary.scriptId);
  if (script?.photo) return { type: 'group', scene: script.photo, cast: joined, caption: diary.title };

  const scene = PLACE_SCENE[diary.place] ?? (diary.weather === 'rain' ? pick(makeRng(seed, diary.date, 'photo-scene'), INDOOR) : 'tree');
  const partner = nuis.find((n) => n.id === diary.partner);
  const partnerInText = Boolean(partner && diary.text.includes(partner.call_name));
  const cast = partnerInText ? [diary.writer, diary.partner] : [diary.writer];
  return { type: 'scene', scene, cast, caption: diary.title };
}
