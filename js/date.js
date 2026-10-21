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

// 時間帯: 朝 5:00〜10:00 / 昼 10:00〜16:00 / 夕方 16:00〜19:00 / 夜 19:00〜5:00
export function timeSlot(now) {
  const h = now.getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'evening';
  return 'night';
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
