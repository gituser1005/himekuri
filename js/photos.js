// ぬいの写真（docs/nui-register.md 3章）：読み込み・透明の判定・縮め方と、IndexedDB への読み書き。
// 写真は localStorage（cottage.v1）に入らないので、IndexedDB のデータベース cottage.v1 に置く。保存データには写真のキーだけを持つ。
//
// 1枚の形（キー → 値）
// 'photo-k3x9q2ab' → { blob: PNG, w: 512, h: 430, cutout: true, at: '2026-11-10T21:04' }
//   cutout は背景が透明（切り抜き写真）か。透明でない写真も登録できる

import { toLocalIso } from './date.js';
import { newSeed } from './rng.js';

export const DB_NAME = 'cottage.v1';
const STORE = 'photos';

export const ANALYZE_MAX = 2048; // 調べるときの長い辺（大きな写真をそのまま描くと、iPhone では描けないことがある）
export const SAVE_MAX = 512;     // 保存するときの長い辺
const CLEAR = 16;                // この透明度より小さい画素を「透明」と数える（0〜255）
const BORDER = 0.03;             // 縁として見る幅（短い辺に対する割合）
const CUTOUT_EDGE = 0.5;         // 縁の半分以上が透明なら、背景が透明とみなす

// ---- 画素から調べる（画面と保存に触らないので、テストできる）----

// RGBA の並び → 透明な画素の割合（全体と縁）、透明でないところを囲む四角（全部透明なら null）、背景が透明か
export function analyzeAlpha(data, w, h) {
  const band = Math.max(1, Math.round(Math.min(w, h) * BORDER));
  let clear = 0;
  let edge = 0;
  let edgeClear = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isEdge = x < band || y < band || x >= w - band || y >= h - band;
      if (isEdge) edge++;
      if (data[(y * w + x) * 4 + 3] < CLEAR) {
        clear++;
        if (isEdge) edgeClear++;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box = maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const edgeClearRate = edgeClear / edge;
  return { clearRate: clear / (w * h), edgeClearRate, box, cutout: edgeClearRate >= CUTOUT_EDGE };
}

// 長い辺を max に収める大きさ（小さい写真は大きくしない）
export function fitSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export const newPhotoKey = () => `photo-${newSeed()}`;

// ---- 写真を読み込んで、保存する形にする（ブラウザの中だけで動く）----

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('この写真は読み込めませんでした'));
    };
    img.src = url;
  });
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const toPng = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('写真を書き出せませんでした'))), 'image/png');
});

// 写真（File や Blob）→ 保存する形 { blob, w, h, cutout, at }
// 透明な余白を切り取り、長い辺を SAVE_MAX に縮めて、透明さを残したまま PNG にする
export async function processPhoto(file, now = new Date()) {
  const img = await loadImage(file);
  const a1 = fitSize(img.naturalWidth, img.naturalHeight, ANALYZE_MAX);
  const c1 = canvasOf(a1.w, a1.h);
  const ctx1 = c1.getContext('2d', { willReadFrequently: true });
  ctx1.drawImage(img, 0, 0, a1.w, a1.h);
  const { box, cutout } = analyzeAlpha(ctx1.getImageData(0, 0, a1.w, a1.h).data, a1.w, a1.h);
  if (!box) throw new Error('写真が全部透明でした');
  const out = fitSize(box.w, box.h, SAVE_MAX);
  const c2 = canvasOf(out.w, out.h);
  const ctx2 = c2.getContext('2d');
  ctx2.imageSmoothingQuality = 'high';
  ctx2.drawImage(c1, box.x, box.y, box.w, box.h, 0, 0, out.w, out.h);
  return { blob: await toPng(c2), w: out.w, h: out.h, cutout, at: toLocalIso(now) };
}

// アプリの中の画像（用意されたぬいぐるみの assets/*.webp）→ 保存する形
export async function processAsset(url, now = new Date()) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} を読めませんでした`);
  return processPhoto(await res.blob(), now);
}

// ---- IndexedDB ----

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putPhoto = (key, photo) => run('readwrite', (s) => s.put(photo, key));
export const getPhoto = (key) => run('readonly', (s) => s.get(key));
export const photoKeys = () => run('readonly', (s) => s.getAllKeys());

export async function deletePhoto(key) {
  forgetUrl(key);
  await run('readwrite', (s) => s.delete(key));
}

// 保存データから使われていない写真を消す（登録の途中でやめた写真など）。消したキーを返す
export async function prunePhotos(usedKeys) {
  const used = new Set(usedKeys);
  const unused = (await photoKeys()).filter((k) => !used.has(k));
  for (const key of unused) await deletePhoto(key);
  return unused;
}

// 写真をすべて消す（初期化）
export async function clearPhotos() {
  for (const key of [...urls.keys()]) forgetUrl(key);
  await run('readwrite', (s) => s.clear());
}

// 消えにくい保存を頼む（iPhone のホーム画面のアプリでは認められることが多い）。頼めなければ false
export async function requestPersist() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// ---- 表示に使う URL（同じ写真を何度も読まないよう、開いているあいだ覚えておく）----

const urls = new Map(); // キー → { url, w, h, cutout }

function forgetUrl(key) {
  const info = urls.get(key);
  if (info) URL.revokeObjectURL(info.url);
  urls.delete(key);
}

// 写真のキー → <img src> に使える URL と、大きさ・背景が透明か。写真がなければ null
export async function photoInfo(key) {
  if (!key) return null;
  if (urls.has(key)) return urls.get(key);
  const photo = await getPhoto(key);
  if (!photo) return null;
  const info = { url: URL.createObjectURL(photo.blob), w: photo.w, h: photo.h, cutout: photo.cutout };
  urls.set(key, info);
  return info;
}

// 写真のキー → <img src> に使える URL。写真がなければ null
export async function photoUrl(key) {
  return (await photoInfo(key))?.url ?? null;
}

// コテージの絵に出すぬい：nuis（cottage.nuis）→ [{ id, role, aspect, url, cutout }]。
// 写真が見つからない子（端末が保存データを消したときなど）は出さない
export async function sceneNuis(nuis) {
  const infos = await Promise.all(nuis.map((n) => photoInfo(n.photo).catch(() => null)));
  return nuis
    .map((n, i) => infos[i] && { id: n.id, role: n.role, aspect: infos[i].w / infos[i].h, url: infos[i].url, cutout: infos[i].cutout })
    .filter(Boolean);
}

// 保存データの cottage が使っている写真のキー（今の顔ぶれと、始まりの日の控えと、日記の写真。日記の写真のキーは journal.js の snapshotKeys）
export function usedPhotoKeys(cottage, diaryKeys = []) {
  if (!cottage) return [];
  return [...new Set([...[...cottage.nuis, ...cottage.startMembers].map((n) => n.photo), ...diaryKeys].filter(Boolean))];
}
