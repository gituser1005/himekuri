// 島のぬいたちの「今」の過ごし方（晴れ・くもりの朝・昼・夕方）と、夜に家で過ごす並び。
// 画面には触らない。ぬいごとに、性格に合った行動をくじで引き、行動に合う場所に置く。
// ときどき2匹が同じ場所で過ごす。島の行動は日記と一致させない（島は「今」、日記は「きのう」）。
// 場所の座標と大きさは js/places.js の表にだけ書く。
//
// くじは「家庭の種 × 日付 × 時間帯 × ぬいのID」で、ぬいごとに引く（ぬいを足しても消しても、ほかの子の行動は変わらない）。
// 「同じ場所で過ごす」は「家庭の種 × 日付 × 時間帯 × 2匹のID」で、組ごとに引く。

import { makeRng, pick, weighted } from './rng.js';
import { PLACES, SIZES, HOME_USE, BED, BED_USE, BED_SHOW, ZZZ } from './places.js';

// 行動 → 場所と、その場所を選ぶ重み
export const ACTIONS = {
  run: { road: 1 },
  sit: { bench: 70, tree: 30 },
  watch: { pot: 1 },
  home: { window: 20, kitchen: 20, table: 20, shelf: 20, sofa: 20 },
  rest: { tree: 1 },   // のんびりする（木の下）
  look: { window: 1 }, // 窓辺から外を見る
};

// 引いた場所がふさがっているときに移る順。どの行動でも、道へ移すのは走る子だけ
// （4体までなら、道のほかの8か所で必ず足りる。tests/island-life.test.mjs で確かめる）
export const FALLBACK = {
  run: ['road', 'pot', 'bench', 'tree'],
  sit: ['bench', 'tree', 'pot', 'sofa', 'table', 'shelf', 'kitchen', 'window'],
  watch: ['pot', 'tree', 'bench', 'window', 'shelf', 'table', 'kitchen', 'sofa'],
  home: ['window', 'sofa', 'kitchen', 'shelf', 'table', 'tree', 'bench'],
  rest: ['tree', 'bench', 'sofa', 'table', 'shelf', 'pot'],
  look: ['window', 'sofa', 'shelf', 'table', 'tree', 'bench'],
};

// 性格 → 行動の重み（昼・夕方）。朝は家で過ごすを＋10し、いちばん重い行動を−10する
export const ROLE_ACTIONS = {
  元気: { run: 70, sit: 10, watch: 10, home: 10 },
  やさしい: { sit: 70, watch: 10, home: 20 },
  好奇心旺盛: { sit: 15, watch: 70, home: 15 },
  マイペース: { rest: 60, sit: 15, watch: 5, home: 20 },
  おとなしい: { look: 55, sit: 15, watch: 15, home: 15 },
};

// 組ごとに「同じ場所で過ごす」確率（3匹＝3組で時間帯ごとに約17%、4匹＝6組で約31%）
export const PAIR_RATE = 0.06;

export function actionWeights(role, slot) {
  const base = { ...ROLE_ACTIONS[role] };
  if (slot !== 'morning') return base;
  const main = Object.keys(base).reduce((a, b) => (base[a] >= base[b] ? a : b));
  base[main] -= 10;
  base.home = (base.home ?? 0) + 10;
  return base;
}

// 場所 → その場所でしている行動（移ってきた子の行動。木の下は「座る」、窓辺は「家」とする）
const actionOf = (place) => Object.keys(ACTIONS).find((act) => ACTIONS[act][place]);

// その時間帯の配置。nuis は登録したぬい [{ id, role }]（2〜4匹。用意されたぬいぐるみも同じ）。戻り値は [{ id, action, place, slot }]（slot は枠の番号）
//   1. ぬいごとに行動と場所を引く
//   2. 組ごとに「同じ場所で過ごす」を引く。当たった組が複数なら、くじの値がいちばん小さい組だけ
//      その組は、2匹が引いた場所のうち2匹で並べる場所（なければ2匹で並べる場所から乱数）に並べる
//   3. 残りの子を、引いた場所に置く。ほかの子がいる場所（広い場所を除く）には重ねず、
//      行動ごとの移る順（FALLBACK）で、空いている場所に移す
export function lifeLayout({ nuis, seed, date, slot }) {
  const order = [...nuis].sort((a, b) => a.id.localeCompare(b.id));
  const drawn = new Map();
  for (const n of order) {
    const rng = makeRng(seed, date, `life-${slot}-${n.id}`);
    const action = weighted(rng, actionWeights(n.role, slot));
    drawn.set(n.id, { action, place: weighted(rng, ACTIONS[action]), rng });
  }

  // その場所での行動：引いた行動の場所ならそのまま、移ってきたなら場所に合う行動
  const actionAt = (id, place) => (ACTIONS[drawn.get(id).action][place] ? drawn.get(id).action : actionOf(place));

  const placed = [];
  const used = new Map(); // 場所 → 使った枠の番号
  const take = (id, action, place, slotIndex) => {
    placed.push({ id, action, place, slot: slotIndex });
    used.set(place, [...(used.get(place) ?? []), slotIndex]);
  };

  // 2. 同じ場所で過ごす組
  let pair = null;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const [a, b] = [order[i].id, order[j].id];
      const rng = makeRng(seed, date, `life-${slot}-pair-${a}-${b}`);
      const r = rng();
      if (r < PAIR_RATE && (!pair || r < pair.r)) pair = { a, b, r, rng };
    }
  }
  if (pair) {
    const own = [pair.a, pair.b].filter((id) => PLACES[drawn.get(id).place].kind === 'pair');
    const pairPlaces = Object.keys(PLACES).filter((p) => PLACES[p].kind === 'pair');
    const first = own.length ? pick(pair.rng, own) : null;
    const place = first ? drawn.get(first).place : pick(pair.rng, pairPlaces);
    // その場所を引いた子が1つ目の枠、もう1匹が2つ目の枠
    const [x, y] = first === pair.b ? [pair.b, pair.a] : [pair.a, pair.b];
    take(x, actionAt(x, place), place, 0);
    take(y, actionAt(y, place), place, 1);
  }

  // 3. 残りの子
  const free = (place) => {
    const slots = PLACES[place].slots.map((_, i) => i).filter((i) => !(used.get(place) ?? []).includes(i));
    if (PLACES[place].kind === 'wide') return slots;
    return used.has(place) ? [] : slots; // 一緒に見える場所には、ほかの子がいたら置かない
  };
  for (const n of order) {
    if (placed.some((p) => p.id === n.id)) continue;
    const { action, place, rng } = drawn.get(n.id);
    const candidates = [place, ...FALLBACK[action], ...Object.keys(PLACES)];
    const to = candidates.find((p) => free(p).length);
    take(n.id, actionAt(n.id, to), to, pick(rng, free(to)));
  }
  return placed;
}

// ぬいの並びを「家庭の種 × 日付 × 用途」のくじで入れ替える（渡した順に関係なく、同じ日なら同じ並び）。max 匹まで
function shuffled(nuis, seed, date, purpose, max) {
  const order = [...nuis].sort((a, b) => a.id.localeCompare(b.id)).slice(0, max);
  const rng = makeRng(seed, date, purpose);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const maxOf = (table) => Math.max(...Object.keys(table).map(Number));

// 雨の朝・昼・夕方と、夜（19〜22時）は家の中で過ごす。体数で使う場所が決まり（HOME_USE）、
// だれがどこにいるかは「家庭の種 × 日付」のくじで日ごとに入れ替える（同じ日の雨と夜は同じ並び）。
export function homeLayout({ nuis, seed, date }) {
  const order = shuffled(nuis, seed, date, 'home', maxOf(HOME_USE));
  const spots = HOME_USE[order.length] ?? [];
  return order.map((n, i) => ({ id: n.id, action: 'home', place: spots[i], slot: 0 }));
}

// 寝る時間（22:00〜6:00）は2段ベッドで寝る。体数で寝る段が決まり（BED_USE）、だれがどこで寝るかは日ごとのくじ。
// 戻り値は [{ id, spot }]（spot は BED_USE[体数] の寝る場所の番号）
export function sleepLayout({ nuis, seed, date }) {
  return shuffled(nuis, seed, date, 'sleep', maxOf(BED_USE)).map((n, i) => ({ id: n.id, spot: i }));
}

// 寝ている姿（絵の座標）。写真は回さず正面向きのまま、段（BED）の奥に置き、手前の掛け布団で下側を隠す。
//   写真の高さは、BED_SHOW ぶんが布団の上（段の頭の上の限りまで）に、残りが布団の中に収まる大きさ。
//   同じ段の2体は、寝る場所の順に左から、段の横のまん中に触れるように並べる。横に入りきらないときは、そろって小さくする
//   （小さくしても、写真の BED_SHOW ぶんが布団の上に出るように置く）
//   boxes：写真の左上と大きさ（layout の順） / covers：使う段の掛け布団（写真より手前に描く。bedCover）
//   zzz：使う段ごとに1つの「zzz」（並んだ子の頭の上）
export function sleepScene(layout, nuis) {
  const use = BED_USE[layout.length] ?? [];
  const placed = new Map();
  const covers = [];
  const zzz = [];
  for (const key of ['upper', 'lower']) {
    const tier = BED[key];
    const members = [...layout].sort((a, b) => a.spot - b.spot).filter((p) => use[p.spot] === key);
    if (!members.length) continue;
    const { cover } = tier;
    const full = Math.min((cover.y - tier.top) / BED_SHOW, (cover.bottom - cover.y) / (1 - BED_SHOW));
    const aspects = members.map((p) => nuis.find((n) => n.id === p.id).aspect);
    const scale = Math.min(1, (tier.right - tier.left) / aspects.reduce((sum, a) => sum + full * a, 0));
    const h = full * scale;
    const total = aspects.reduce((sum, a) => sum + h * a, 0);
    let left = (tier.left + tier.right) / 2 - total / 2;
    members.forEach((p, i) => {
      const w = h * aspects[i];
      placed.set(p.id, { id: p.id, x: left, y: cover.y - h * BED_SHOW, w, h });
      left += w;
    });
    covers.push(bedCover(tier));
    // 「zzz」は、並んだ子の頭の上の、右寄り
    const right = (tier.left + tier.right) / 2 + total / 2;
    zzz.push({ src: ZZZ.src, x: Math.min(right - ZZZ.w * 0.75, tier.right - ZZZ.w), y: tier.zzz, w: ZZZ.w, h: ZZZ.h });
  }
  return { boxes: layout.map((p) => placed.get(p.id)), covers, zzz };
}

// 段の掛け布団（段の幅いっぱい。上のふちは少し丸く、まん中がわずかに高い）。背景の絵（tools/make-cottage-svg.mjs）も同じ形を使う。
// x・y・w・h は布団の入る四角（上のふちのふくらみぶん、少し上から）。d は形、edge は上のふちの折り返し（どちらも四角の左上からの座標）
const COVER_RISE = 4; // 上のふちのまん中のふくらみ
export const COVER_COLOR = { fill: '#F2BCC6', edge: '#F9DCE3' }; // 布団と、上のふちの折り返し
export function bedCover(tier) {
  const x = tier.left - 4;
  const w = tier.right - tier.left + 8;
  const y = tier.cover.y - COVER_RISE;
  const h = tier.cover.bottom - y;
  const r = 10;
  const top = COVER_RISE;
  const edge = `M0 ${top + r} Q0 ${top} ${r} ${top} Q${w / 2} 0 ${w - r} ${top} Q${w} ${top} ${w} ${top + r}`;
  return { x, y, w, h, edge, d: `${edge} L${w} ${h} L0 ${h} Z` };
}

// 写真の縦横の比 → 絵の中の大きさ。高さをそろえ、横長の写真は幅の上限に合わせて小さくする（縦長の写真は細いまま）
export function nuiSize(area, aspect) {
  const { h, maxW } = SIZES[area];
  const w = Math.min(h * aspect, maxW);
  return { w, h: w / aspect };
}

// 配置 → 画像の左上と大きさ（絵の座標）。足もとの点が枠に来るように置く。places は配置の場所の表
export function layoutBoxes(layout, nuis, places = PLACES) {
  return layout.map((p) => {
    const nui = nuis.find((n) => n.id === p.id);
    const [fx, fy] = places[p.place].slots[p.slot];
    const { w, h } = nuiSize(places[p.place].area, nui.aspect);
    return { id: p.id, place: p.place, x: fx - w / 2, y: fy - h, w, h };
  });
}
