// 日記の選び方の部品（selection/）とアプリをつなぐ。
//
// 記録：選び方の部品の記録（selection/record.js の形）を、保存データ cottage.v1 の cottage.diaryRecord に置く。
//   写真は IndexedDB（photos.js）で、記録には写真のキーだけを持つ（バックアップは「保存データの JSON ＋ IndexedDB の写真」で足りる）。
// ぬい：記録の中では id で見分ける。日記の文と、記録の writerName・partnerName は、決めた日の名前のまま。
// 天気：その日の天気は記録の天気（コテージの画面と日記の天気は必ずそろう）。
// 届き方：日記は、書かれた日の翌朝 5:00 に届く。開いたときに、まだ決めていない日から今日までを1日ずつ順に決める
//   （何日も開かなかったときは、空いた日のぶんがまとめて届く。今日の日記は明日の朝に届く）。
// おうちに来た日の日記：始めた日の日記そのもの（翌朝はこの1ページだけ）。あとから子を足した日は、その日のふだんの日記とは
//   別の1件（record.extras）として翌朝に届き、その日のふだんの日記より先に読む。

import { decideDay, newRecord } from '../selection/index.js';
import { DEFAULT_CONFIG } from '../selection/config.js';
import { addMemberWelcomes } from '../selection/welcome.js';
import { eventTreeOn } from '../selection/events.js';
import { addDays } from './date.js';
import { deliveredOn } from './diaries.js';

export async function loadScripts(url = 'data/nui_scripts.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`日記の台本を読み込めませんでした（${res.status}）`);
  return res.json();
}

// その日に島にいるぬい（始まりの日の顔ぶれと、その日までに足した子）
export function nuisOn(cottage, date) {
  return cottage.nuis.filter((n) => n.joined && n.joined <= date);
}

// まだ決めていない日から今日までの日記と天気を、1日ずつ順に決めて記録に足す。
// あとから足した子のおうちに来た日の日記も、まだなければ作る。記録が変わったら true
// seed は家庭の種（state.islandSeed）
export function catchUp(cottage, scripts, seed, today) {
  if (!cottage?.startedOn) return false;
  let record = cottage.diaryRecord ?? newRecord(cottage.startedOn);
  let changed = !cottage.diaryRecord;
  for (let date = nextDate(record); date <= today; date = addDays(date, 1)) {
    record = decideDay({ nuis: nuisOn(cottage, date), date, record, scripts, seed }).record;
    changed = true;
  }
  const extras = record.extras?.length ?? 0;
  addMemberWelcomes(record, { nuis: nuisOn(cottage, today), scripts, seed, config: DEFAULT_CONFIG });
  if (record.extras.length !== extras) changed = true;
  cottage.diaryRecord = record;
  return changed;
}

const nextDate = (record) => (record.days.length ? addDays(record.days.at(-1).date, 1) : record.start);

// その日の公園の木のオブジェ（季節のイベントの3日前から当日まで。島ごとに決まる。なければ null。始める前・台本を読む前も null）
export function eventTreeToday(cottage, scripts, seed, today) {
  return scripts && cottage?.startedOn ? eventTreeOn(scripts, seed, cottage.startedOn, today) : null;
}

// その日の天気（記録の天気。まだ決めていない日は晴れ）
export function weatherOf(cottage, date) {
  return cottage?.diaryRecord?.days.find((d) => d.date === date)?.weather ?? 'sunny';
}

// 書き手の写真がないとき（削除した子など）の丸（写真の代わり）
const NO_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#E3D8C6"/></svg>')}`;

// 日記の id（v1 の日記と同じ形。ふだんの日記は1日1件）。おうちに来た日の別の1件は、書き手の id を付ける
export const diaryId = (date) => `d${date.replaceAll('-', '')}`;
export const extraId = (date, writer) => `w${date.replaceAll('-', '')}-${writer}`;

// ---- 日記の写真 ----
// 写真は、日記を決めたときに写真の中身（snapshot）だけを記録に残し、そのあとアプリが1回だけ作って IndexedDB に保存する
// （snapshot.key＝保存した写真のキー）。用意されたぬいぐるみのハロウィンは、v1 の写真をそのまま使う（snapshot.image）

// 記録の日記（ふだんの日記と、別の1件）と、その id
function recordDiaries(record) {
  return [
    ...(record?.extras ?? []).map((d) => ({ d, id: extraId(d.date, d.writer) })),
    ...(record?.days ?? []).map((d) => ({ d, id: diaryId(d.date) })),
  ];
}

export const snapshotKey = (id) => `snap-${id}`;

// 用意されたぬいぐるみ（ふうかたち）で始めた人に使う v1 の写真（始めた日は、自分の子で始めた人と同じ木の下の記念写真にした。11/5）
const PRESET_SNAPSHOTS = { 'FE-halloween': 'assets/snap_1031_halloween.png' };
function presetImage(cottage, d) {
  if (!cottage.preset) return null;
  return PRESET_SNAPSHOTS[d.scriptId] ?? null;
}

// まだ作っていない写真 [{ diary, id, key, date, weather }]（作る順＝日付順）。用意されたぬいぐるみの v1 の写真は、ここで決めてしまう
export function pendingSnapshots(cottage) {
  const record = cottage?.diaryRecord;
  const out = [];
  for (const { d, id } of recordDiaries(record)) {
    const s = d.snapshot;
    if (!s || s.key || s.image) continue;
    const image = presetImage(cottage, d);
    if (image) {
      s.image = image;
      continue;
    }
    out.push({ diary: d, id, key: snapshotKey(id), date: d.date, weather: weatherOf(cottage, d.date) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// 保存した写真のキー（写真を片付けるときに消さないもの。photos.js の usedPhotoKeys）
export function snapshotKeys(cottage) {
  return recordDiaries(cottage?.diaryRecord).map(({ d }) => d.snapshot?.key).filter(Boolean);
}

// 記録の日記 → 画面が読む形 { writers, diaries }（v1 の data/diaries.json と同じ形。画面の側はそのまま読める）
//   diaries：届いた日記（today までに届いたもの。日付順。同じ日なら、おうちに来た日の別の1件が先）{ id, date, kind, title, body, weather, writer }
//     写真のある日記は snapshot: { image, caption }（v1 の日記と同じ形。image は保存した写真の URL か、v1 の写真）
//   writers：書き手の id → { name, avatar }。いる子は今の名前と写真、削除した子は日記を書いた日の名前と、写真の代わりの丸
// photos は photos.js の sceneNuis の結果（[{ id, url }]）、snapUrls は保存した写真のキー → URL
export function appDiaries(cottage, photos, today, snapUrls = {}) {
  const record = cottage?.diaryRecord;
  const weather = (date) => record.days.find((x) => x.date === date)?.weather ?? 'sunny';
  const extras = (record?.extras ?? []).map((d) => ({ ...d, id: extraId(d.date, d.writer), weather: weather(d.date), first: true }));
  const days = [...extras, ...(record?.days ?? []).map((d) => ({ ...d, id: diaryId(d.date) }))]
    .filter((d) => deliveredOn(d) <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (b.first ? 1 : 0) - (a.first ? 1 : 0));
  const writers = {};
  for (const d of days) writers[d.writer] = { name: d.writerName, avatar: NO_PHOTO };
  for (const n of cottage?.nuis ?? []) {
    writers[n.id] = { name: n.name, avatar: photos.find((p) => p.id === n.id)?.url ?? NO_PHOTO };
  }
  const diaries = days.map((d) => {
    const image = d.snapshot?.image ?? snapUrls[d.snapshot?.key];
    return {
      id: d.id,
      date: d.date,
      kind: d.kind,
      title: d.title,
      body: d.text,
      weather: d.weather,
      writer: d.writer,
      ...(image ? { snapshot: { image, caption: d.snapshot.caption } } : {}),
    };
  });
  return { writers, diaries };
}
