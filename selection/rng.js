// 乱数。「乱数の種・日付・用途」から毎回同じ並びを作る。
// 日付ごとに作り直すので、早送りしても読み込み直しても、同じ日には同じ結果になる。
// 用途（天気、話を選ぶ、など）ごとに分けるので、選び方の決まりを直しても天気の並びは変わらない。

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

export const chance = (rng, p) => rng() < p;

// a 以上 b 以下の整数
export const intBetween = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
