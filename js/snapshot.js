// 日記の写真を作る（600×450 の JPEG）。どの日記に付けるかと写真の中身（snapshot）は selection/snapshots.js が決める。
// 作った写真は、アプリが IndexedDB に保存する（main.js）。保存した写真を使うので、あとで子の写真を変えても、前の日記の写真は変わらない。
//   arrival（記念写真）：公園の木の下（その日の季節と天気の昼の絵）に寄って、みんなを並べる。右下に年月日。行事の当日（spec.full）は木の全体を入れる
//   group（季節のイベント・島のイベントのみんなの写真）：イベントごとの背景（js/places.js の SNAP_GROUP）に、みんなを並べる
//   anniversary（島の記念日の集合写真）：周年ごとの色の台紙に、みんなが並んだ写真と周年の数字（5・10周年は金のふちで数字を大きく）
//   scene（場面写真）：その日の木の姿（季節。クリスマスは飾りの付いた木）と天気の昼の絵から場面を切り出し、島と同じ大きさで子を重ねる（夜の日記も昼の絵）
//     クリスマスの木の下は、星まで入るよう木の全体を切り出す（SNAP_TREE_XMAS_CROP）
// 背景が透明でない写真の子は、島と同じく白いふちとうすい影を付ける。
// 場面と記念写真の数字は js/places.js の SNAP・SNAP_SCENES・SNAP_ARRIVAL・SNAP_ANNIVERSARY。確認ページは dev/snapshots.html

import { SNAP, SNAP_SCENES, SNAP_ARRIVAL, SNAP_GROUP, SNAP_ANNIVERSARY, SNAP_TREE_XMAS_CROP, pictureFile } from './places.js';
import { nuiSize } from './island-life.js';
import { treeOf } from './date.js';

export const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`画像を読めませんでした: ${src}`));
  img.src = src;
});

// 切り抜き写真に輪郭に沿った白いふちを付けた絵（まわりに r だけ広い）。写真の形を白く塗った影絵を、まわりにずらして重ねてから写真を描く
function outlined(img, w, h, r) {
  const sil = document.createElement('canvas');
  sil.width = Math.ceil(w);
  sil.height = Math.ceil(h);
  const s = sil.getContext('2d');
  s.drawImage(img, 0, 0, w, h);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff';
  s.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement('canvas');
  out.width = Math.ceil(w + r * 2);
  out.height = Math.ceil(h + r * 2);
  const o = out.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    o.drawImage(sil, r + Math.cos(t) * r, r + Math.sin(t) * r);
  }
  o.drawImage(img, r, r, w, h);
  return out;
}

// 子を1体描く。島と同じく白いふちとうすい影を付ける：切り抜き写真は輪郭に沿って、
// 背景が透明でない写真は四角く（写真の枠の内側に5px ぶん）
export function drawNui(ctx, img, cutout, x, y, w, h, scale) {
  if (cutout) {
    const r = 4 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(59, 50, 48, 0.28)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.drawImage(outlined(img, w, h, r), x - r, y - r);
    ctx.restore();
    return;
  }
  const border = 5 * scale;
  ctx.save();
  ctx.shadowColor = 'rgba(59, 50, 48, 0.28)';
  ctx.shadowBlur = 6 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.drawImage(img, x + border, y + border, w - border * 2, h - border * 2);
}

// 子を横1列に並べる（記念写真と記念日の集合写真）。box：並べる場所 { x, y, w, h }、height：体数 → 子の高さの割合
function drawRow(ctx, imgs, cast, box, height, floor) {
  const n = imgs.length;
  let h = box.h * (height[n] ?? height[n >= 4 ? 4 : n === 1 ? 1 : 3]);
  const widths = () => imgs.map((img) => h * (img.naturalWidth / img.naturalHeight));
  const gap = box.w * 0.03;
  // 横に入りきらないときは、そろって小さくする
  const total = widths().reduce((a, b) => a + b, 0) + gap * (n - 1);
  if (total > box.w * 0.92) h *= (box.w * 0.92) / total;
  const ws = widths();
  let x = box.x + (box.w - (ws.reduce((a, b) => a + b, 0) + gap * (n - 1))) / 2;
  const footY = box.y + box.h * floor;
  imgs.forEach((img, i) => {
    ctx.fillStyle = 'rgba(59, 50, 48, 0.08)';
    ctx.beginPath();
    ctx.ellipse(x + ws[i] / 2, footY, ws[i] * 0.42, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    drawNui(ctx, img, cast[i].cutout, x, footY - h, ws[i], h, h / 170);
    x += ws[i] + gap;
  });
}

// 記念写真の子の場所 [{ x, y, w, h }]。はじめは体数ごとの高さで、並ぶ場所（crop.slots があればそれ、なければ SNAP_ARRIVAL.slots）に置く。となりの子と重なりすぎるときは左右へ押し広げ、
// 写真の端で体や白いふちが切れる子は内側へずらす。それでも収まらないときは、みんなをそろって小さくする
export function arrivalLayout(imgs, cast, crop) {
  const A = SNAP_ARRIVAL;
  const n = imgs.length;
  const slots = (crop.slots ?? A.slots)[Math.min(n, 4)];
  const footY = SNAP.h * crop.floor;
  const clamp = (it) => { it.x = Math.min(Math.max(it.x, A.margin + it.pad), Math.max(SNAP.w - A.margin - it.pad - it.w, A.margin + it.pad)); };
  const excess = (a, b) => a.x + a.w - b.x - A.overlap * Math.min(a.w, b.w); // 0 より大きければ重なりすぎ
  let base = SNAP.h * crop.height[Math.min(n, 4)];
  for (let tries = 0; ; tries++) {
    const items = imgs.map((img, i) => {
      const s = slots[i % slots.length];
      const h = base * (s.back ? A.back.scale : 1);
      const w = h * (img.naturalWidth / img.naturalHeight);
      const pad = cast[i].cutout ? 4 * (h / 170) : 0; // 輪郭の白いふち
      return { x: SNAP.w * s.x - w / 2, y: footY - (s.back ? SNAP.h * A.back.lift : 0) - h, w, h, pad, back: Boolean(s.back) };
    });
    const sorted = [...items].sort((p, q) => p.x + p.w / 2 - (q.x + q.w / 2));
    for (let k = 0; k < 20; k++) {
      for (let i = 1; i < sorted.length; i++) {
        const e = excess(sorted[i - 1], sorted[i]);
        if (e > 0) { sorted[i - 1].x -= e / 2; sorted[i].x += e / 2; }
      }
      sorted.forEach(clamp);
    }
    const inside = items.every((it) => it.x - it.pad >= A.margin - 0.5 && it.x + it.w + it.pad <= SNAP.w - A.margin + 0.5 && it.y - it.pad >= A.margin);
    const apart = sorted.every((it, i) => i === 0 || excess(sorted[i - 1], it) <= 0.5);
    if ((inside && apart) || tries >= 30) return items;
    base *= 0.96;
  }
}

const ymd = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
};

async function drawArrival(ctx, imgs, cast, spec, date, weather, base, tree) {
  const A = SNAP_ARRIVAL;
  const crop = spec.full ? A.crop.full : A.crop.close;
  const ch = crop.w * (SNAP.h / SNAP.w);
  const cy = A.foot - ch * crop.floor;
  const bg = await loadImage(base + pictureFile(weather === 'rain' ? 'rain' : 'sunny', tree));
  ctx.drawImage(bg, crop.x * (bg.naturalWidth / 780), cy * (bg.naturalHeight / 1688), crop.w * (bg.naturalWidth / 780), ch * (bg.naturalHeight / 1688), 0, 0, SNAP.w, SNAP.h);
  const items = arrivalLayout(imgs, cast, crop);
  // 奥の子を先に描く（手前の子が上になる）
  const order = items.map((it, i) => i).sort((i, j) => Number(items[j].back) - Number(items[i].back));
  for (const i of order) {
    const it = items[i];
    ctx.fillStyle = 'rgba(59, 50, 48, 0.12)';
    ctx.beginPath();
    ctx.ellipse(it.x + it.w / 2, it.y + it.h, it.w * 0.4, it.h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    drawNui(ctx, imgs[i], cast[i].cutout, it.x, it.y, it.w, it.h, it.h / 170);
  }
  // 右下の年月日（その日記の日付＝おうちに来た日）
  const font = `600 ${A.date.size}px "Klee One", "Hiragino Mincho ProN", serif`;
  try { await document.fonts.load(font, ymd(date)); } catch { /* 読めなければ代わりの字で */ }
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(40, 32, 30, 0.55)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#fff';
  ctx.fillText(ymd(date), SNAP.w - A.date.right, SNAP.h - A.date.bottom);
  ctx.restore();
}

// 島の記念日の集合写真：周年の色の台紙に写真を貼り、周年の数字を入れる（アルバム風）
async function drawAnniversary(ctx, imgs, cast, year) {
  const A = SNAP_ANNIVERSARY;
  const special = A.special.includes(year);
  ctx.fillStyle = A.mounts[year] ?? A.mounts[1];
  ctx.fillRect(0, 0, SNAP.w, SNAP.h);
  if (year === 9) {
    // 木目：横に流れるゆるい線
    ctx.strokeStyle = A.grain;
    ctx.lineWidth = 1.5;
    for (let y = 12; y < SNAP.h; y += 17) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(SNAP.w * 0.3, y + ((y * 7) % 9) - 4, SNAP.w * 0.6, y - ((y * 5) % 7) + 3, SNAP.w, y + 2);
      ctx.stroke();
    }
  }
  if (special) {
    ctx.strokeStyle = A.gold;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, SNAP.w - 20, SNAP.h - 20);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, SNAP.w - 40, SNAP.h - 40);
    if (year === 10) {
      ctx.fillStyle = A.gold;
      for (const [x, y] of [[20, 20], [SNAP.w - 20, 20], [20, SNAP.h - 20], [SNAP.w - 20, SNAP.h - 20]]) {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 写真（壁と床に、みんなが並ぶ）
  const [l, t, r, b] = special ? A.photo.special : A.photo.normal;
  const box = { x: l, y: t, w: SNAP.w - l - r, h: SNAP.h - t - b };
  ctx.save();
  ctx.shadowColor = 'rgba(59, 50, 48, 0.22)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = A.wall;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  ctx.fillStyle = A.floor;
  ctx.fillRect(box.x, box.y + box.h * 0.78, box.w, box.h * 0.22);
  drawRow(ctx, imgs, cast, box, A.height, 0.9);
  ctx.strokeStyle = A.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  // 周年の数字（手書き風の字で、少しななめに）
  const size = special ? A.number.special : A.number.normal;
  const font = `600 ${size}px "Klee One", "Hiragino Mincho ProN", serif`;
  try { await document.fonts.load(font, String(year)); } catch { /* 読めなければ代わりの字で */ }
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = special ? A.gold : A.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (special) ctx.translate(SNAP.w / 2, t / 2 + 6);
  else ctx.translate(SNAP.w - r - size * 0.6, SNAP.h - b / 2);
  ctx.rotate(special ? 0 : -0.1);
  ctx.fillText(String(year), 0, 0);
  ctx.restore();
}

// 季節のイベント・島のイベントのみんなの写真
async function drawGroup(ctx, imgs, cast, spec, weather, base) {
  const g = SNAP_GROUP[spec.scene] ?? SNAP_GROUP.momiji;
  const bg = await loadImage(base + (g.image ?? pictureFile(weather === 'rain' && !g.sunny ? 'rain' : 'sunny', g.tree)));
  if (g.image) ctx.drawImage(bg, 0, 0, SNAP.w, SNAP.h);
  else {
    const [x, y, w] = g.crop;
    const h = w * (SNAP.h / SNAP.w);
    const top = y ?? SNAP_ARRIVAL.foot - h * g.floor;
    ctx.drawImage(bg, x * (bg.naturalWidth / 780), top * (bg.naturalHeight / 1688), w * (bg.naturalWidth / 780), h * (bg.naturalHeight / 1688), 0, 0, SNAP.w, SNAP.h);
  }
  const items = arrivalLayout(imgs, cast, g);
  const order = items.map((it, i) => i).sort((i, j) => Number(items[j].back) - Number(items[i].back));
  for (const i of order) {
    const it = items[i];
    ctx.fillStyle = 'rgba(59, 50, 48, 0.12)';
    ctx.beginPath();
    ctx.ellipse(it.x + it.w / 2, it.y + it.h, it.w * 0.4, it.h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    drawNui(ctx, imgs[i], cast[i].cutout, it.x, it.y, it.w, it.h, it.h / 170);
  }
}

async function drawScene(ctx, imgs, cast, spec, date, weather, base, tree) {
  const scene = SNAP_SCENES[spec.scene] ?? SNAP_SCENES.tree;
  const [cx, cy, cw] = scene === SNAP_SCENES.tree && tree === 'xmas' ? SNAP_TREE_XMAS_CROP : scene.crop;
  const ch = cw * (SNAP.h / SNAP.w);
  const scale = SNAP.w / cw;
  const bg = await loadImage(base + pictureFile(weather === 'rain' ? 'rain' : 'sunny', tree));
  // 絵（780×1688）の座標で切り出す
  ctx.drawImage(bg, cx * (bg.naturalWidth / 780), cy * (bg.naturalHeight / 1688), cw * (bg.naturalWidth / 780), ch * (bg.naturalHeight / 1688), 0, 0, SNAP.w, SNAP.h);
  imgs.forEach((img, i) => {
    const [fx, fy] = scene.spots[i % scene.spots.length];
    const { w, h } = nuiSize(scene.area, img.naturalWidth / img.naturalHeight);
    drawNui(ctx, img, cast[i].cutout, (fx - w / 2 - cx) * scale, (fy - h - cy) * scale, w * scale, h * scale, scale);
  });
}

// 写真を作る。cast：写る子 [{ url, cutout }]（snapshot.cast の順。写真がない子は呼ぶ側で外す）。JPEG の Blob を返す
// base：絵のファイルの場所の前に付ける道（アプリは ''、dev/ の確認ページは '../'）
// eventTree：その日の島の木のオブジェ（journal.js の eventTreeToday）。おうちに来た日・行事の写真の木も、島の絵にそろえる
//   （クリスマスの飾りつけの日からの木、焼き芋大会の3日前から当日のさつまいも。docs/topics/2026-11-07-event-art.md）
//   おうちに来た日の写真は、オブジェの日も切り出しと並びはいつもどおり（子が主役。オブジェが主役のイベントの写真とは分ける）
export async function renderSnapshot(spec, { date, weather, cast, base = '', eventTree = null }) {
  const tree = treeOf(date, eventTree);
  const canvas = document.createElement('canvas');
  canvas.width = SNAP.w;
  canvas.height = SNAP.h;
  const ctx = canvas.getContext('2d');
  const imgs = await Promise.all(cast.map((n) => loadImage(n.url)));
  if (spec.type === 'arrival') await drawArrival(ctx, imgs, cast, spec, date, weather, base, tree);
  else if (spec.type === 'group') await drawGroup(ctx, imgs, cast, spec, weather, base);
  else if (spec.type === 'anniversary') await drawAnniversary(ctx, imgs, cast, spec.year);
  else await drawScene(ctx, imgs, cast, spec, date, weather, base, tree);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('写真を作れませんでした'))), 'image/jpeg', 0.86));
}
