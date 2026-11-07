// 日付まわりはすべてここに集約する。
// アプリ上の日付は午前5時で切り替わる（4:59 までは前日扱い）。

const DAY_START_HOUR = 5;

// 現在時刻。URL パラメータ ?now=2026-10-25T06:00 があればそれを使う（デバッグ用）
export function getNow() {
  const param = new URLSearchParams(location.search).get('now');
  if (param) {
    const d = new Date(param);
    if (!Number.isNaN(d.getTime())) return d;
    console.warn('?now の形式が読めません:', param);
  }
  return new Date();
}

export function isNowOverridden() {
  return new URLSearchParams(location.search).has('now');
}

// Date → アプリ上の日付 'YYYY-MM-DD'
export function appDate(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return toYmd(d);
}

// 季節（コテージの絵の公園の木の姿）。月ではなく日付で決め、台本の季節の出来事とそろえる（docs/cottage-scene.md）
//   春（桜）3/25〜4/20（台本の「満開」3/25〜4/10・「花びらの道」3/28〜4/20） / 夏（緑がしげる）4/21〜9/30
//   秋（紅葉）10/1〜11/30（「いちばん赤い葉っぱ」11月） / 冬（もみの木）12/1〜3/24（「こたつ」12月、「小さな芽」2月）
export const SEASON_STARTS = [['03-25', 'spring'], ['04-21', 'summer'], ['10-01', 'autumn'], ['12-01', 'winter']];
export function seasonOf(ymd) {
  const md = ymd.slice(5);
  let season = 'winter'; // 1/1〜3/24 は、前の年の 12/1 からの冬
  for (const [start, name] of SEASON_STARTS) if (md >= start) season = name;
  return season;
}

// 公園の木の姿（コテージの絵と、木だけの絵のファイルを選ぶ）。ふだんは季節と同じで、冬（もみの木）のうち
// クリスマスの 12/20〜12/25 だけ、飾りの付いた xmas になる。12/26 の 5:00 に、ふつうの冬の木にもどる。
// event：島ごとの季節のイベントのオブジェ（selection/events.js の eventTreeOn。焼き芋大会の imo、クリスマスの飾りつけの日から 12/25 までの xmas）があれば、それにする。
//   11/7 から、飾りつけの日（島ごとに 12/1〜12/10）があれば木はその日から飾られ、XMAS は、その年の飾りつけの日がない島（12/10 かそのあとに始めた島）の期間
export const XMAS = ['12-20', '12-25'];
export function treeOf(ymd, event = null) {
  if (event) return event;
  const md = ymd.slice(5);
  return md >= XMAS[0] && md <= XMAS[1] ? 'xmas' : seasonOf(ymd);
}

// 時間帯: 朝 6:00〜10:00 / 昼 10:00〜16:00 / 夕方 16:00〜19:00 / 夜 19:00〜22:00 / 深夜 22:00〜6:00
// （日付の切り替えの5:00とは別。5:00〜6:00 は日付はもう次の日だが、まだ深夜）
export function timeSlot(now) {
  const h = now.getHours();
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'evening';
  if (h >= 19 && h < 22) return 'night';
  return 'late';
}

// Date → 'YYYY-MM-DDTHH:MM'（端末の時刻のまま）
export function toLocalIso(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toYmd(d)}T${hh}:${mm}`;
}

export function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(ymd, n) {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

// a から b までの日数（b が後なら正）
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

const WEEKDAYS =['日', '月', '火', '水', '木', '金', '土'];

// 'YYYY-MM-DD' → { year, month, day, weekday: '月', weekdayIndex: 1 }
export function dateParts(ymd) {
  const d = parseYmd(ymd);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: WEEKDAYS[d.getDay()],
    weekdayIndex: d.getDay(),
  };
}
