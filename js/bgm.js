// BGM（docs/SPEC.md「BGM」。docs/topics/2026-11-07-bgm.md）
//   昼の曲（6〜19時）と夜の曲（19〜6時）。どの画面でも鳴らし、画面を移っても止めない
//   曲の終わりは FADE_OUT 秒で小さくし、GAP 秒の無音のあと、そのときの時間帯の曲を頭から流す（聞いている途中では変えない）
//   スマホのブラウザは操作があるまで音を出せないので、音ありでも、開いて最初に画面をさわったときから鳴る（案内は出さない）
//   裏へ移ったら止め（AudioContext を止めると、曲の位置もそのまま止まる）、戻ったら続きから
//   iPhone は消音スイッチに従わせる（audioSession を ambient に。ほかのアプリの音楽も止めない）
//   音源は本体のキャッシュに入れず、音ありで鳴らすときにその曲だけ取って CACHE に置く。取れなければ鳴らないだけ
//   音源は tools/make-bgm.py が作る。作り直したら CACHE の番号を上げる（sw.js は cottage-bgm- のキャッシュを消さない）

import { getNow, timeSlot } from './date.js';

export const TRACKS = { day: 'assets/bgm/day.m4a', night: 'assets/bgm/night.m4a' };
export const CACHE_PREFIX = 'cottage-bgm-';
export const CACHE = `${CACHE_PREFIX}v1`;

const VOLUME = 0.5; // 控えめな固定の音量（アプリの中に音量の調整は置かない）
const FADE_IN = 2; // 鳴り始めに大きくする秒数
const FADE_OUT = 4; // 曲の終わりで小さくする秒数
const GAP = 2; // 曲の終わりから、次に頭から流すまでの無音
const STOP_FADE = 0.3; // 音なしにしたときに小さくする秒数

// その時刻に流す曲：島の夜（19〜22時）と寝る時間（22〜6時）は夜の曲、ほかは昼の曲
export function trackOf(now) {
  const slot = timeSlot(now);
  return slot === 'night' || slot === 'late' ? 'night' : 'day';
}

let isOn = () => false;
let ctx = null;
let phase = 'idle'; // idle（鳴っていない）／loading（曲を取っている）／playing（鳴っている。曲のあとの無音も含む）
let ticket = 0; // 読み込みの途中で音なしにしたときなどに、読み終わっても鳴らさないための番号
let source = null;
let gain = null;
let current = null; // 鳴らしている曲（day / night）
const buffers = {};

// isOn：音ありかどうか（保存データの state.bgm）を返す関数
export function initBgm(opts) {
  isOn = opts.isOn;
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(type, onGesture, true);
  document.addEventListener('visibilitychange', onVisibility);
}

// 島の画面のボタンで音あり・音なしを切り替えたとき（押したこと自体が操作なので、その場で鳴らせる）
export function setBgm(on) {
  if (!on) {
    ticket++;
    fadeStop();
    phase = 'idle';
    return;
  }
  if (!ensureContext()) return;
  ctx.resume().catch(() => {});
  if (phase === 'idle') start(trackOf(getNow()));
}

function ensureContext() {
  if (ctx) return ctx;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch (e) {
    console.warn('audioSession を変えられませんでした', e);
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

// 画面をさわった・押したとき：音ありなら、止まっていれば動かし、鳴っていなければ鳴らし始める
function onGesture() {
  if (!isOn() || document.hidden || !ensureContext()) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (phase === 'idle') start(trackOf(getNow()));
}

function onVisibility() {
  if (!ctx) return;
  if (document.hidden) {
    ctx.suspend().catch(() => {});
    return;
  }
  if (!isOn()) return;
  ctx.resume().catch(() => {}); // ブラウザが許さなければ、次の操作（onGesture）で動かす
  if (phase === 'idle') start(trackOf(getNow()));
}

// 曲を取ってきて鳴らす。at は鳴らし始める AudioContext の時刻（曲のあとの無音のぶん先）。
// 取れなかったときは fallback の曲（いま流していた曲）をもう一度流す
async function start(name, at = 0, fallback = null) {
  const my = ++ticket;
  phase = 'loading';
  let buf = await load(name);
  if (!buf && fallback && buffers[fallback]) {
    name = fallback;
    buf = buffers[fallback];
  }
  if (my !== ticket) return;
  if (!buf || !isOn() || document.hidden) {
    phase = 'idle';
    return;
  }
  play(name, buf, at);
}

function play(name, buf, at) {
  const t = Math.max(ctx.currentTime, at);
  const end = t + buf.duration;
  const g = ctx.createGain();
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(VOLUME, t + FADE_IN);
  g.gain.setValueAtTime(VOLUME, Math.max(t + FADE_IN, end - FADE_OUT));
  g.gain.linearRampToValueAtTime(0, end);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(g);
  src.onended = () => {
    g.disconnect();
    if (source !== src) return;
    source = null;
    gain = null;
    start(trackOf(getNow()), ctx.currentTime + GAP, name);
  };
  src.start(t);
  source = src;
  gain = g;
  current = name;
  phase = 'playing';
  // 流していない曲はメモリーから外す（1曲で 30MB ほどになるため）
  for (const k of Object.keys(buffers)) if (k !== current) delete buffers[k];
}

function fadeStop() {
  if (!source) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + STOP_FADE);
  source.stop(t + STOP_FADE);
  source = null;
  gain = null;
}

// 曲を CACHE から、なければ取ってきて CACHE に置く（Cache API がない http の LAN などでは取るだけ）
async function load(name) {
  if (buffers[name]) return buffers[name];
  try {
    const url = new URL(TRACKS[name], document.baseURI).href;
    const cache = await openCache();
    let res = cache ? await cache.match(url) : null;
    if (!res) {
      res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      if (cache) await cache.put(url, res.clone()).catch((e) => console.warn('BGM をキャッシュできませんでした', e));
    }
    buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    return buffers[name];
  } catch (e) {
    console.warn('BGM を読み込めませんでした', e);
    return null;
  }
}

let cleaned = false;
async function openCache() {
  if (!self.caches) return null;
  try {
    // 音源を作り直して CACHE の番号を上げたら、前の番号のキャッシュを消す
    if (!cleaned) {
      cleaned = true;
      const old = (await caches.keys()).filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE);
      await Promise.all(old.map((k) => caches.delete(k)));
    }
    return await caches.open(CACHE);
  } catch (e) {
    console.warn('BGM のキャッシュを開けませんでした', e);
    return null;
  }
}
