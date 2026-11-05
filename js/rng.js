// 乱数。「乱数の種・日付・用途」から毎回同じ並びを作る。
// 同じ種・日付・用途なら、何度開いても同じ結果になる。用途ごとに分けるので、ほかのくじに影響しない。
// （日記の選び方の部品 selection/rng.js と同じもの。アプリに組み込むときに1つにまとめる）

// 文字列 → 32bit の数（FNV-1a）
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 0 以上 1 未満の数を返す関数（mulberry32）
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed, date, purpose) {
  return mulberry32(hash(`${seed}|${date}|${purpose}`));
}

export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// { 名前: 重み } から1つ選ぶ（重みが0のものは選ばない）
export function weighted(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries.at(-1)[0];
}

// 家庭ごとの乱数の種（保存データに1つ持つ）
export function newSeed() {
  return Math.random().toString(36).slice(2, 10);
}
