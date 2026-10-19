// localStorage の読み書き。キーは himekuri.v1 の1つだけ。

const KEY = 'himekuri.v1';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('保存データを読めませんでした', e);
    return null;
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存できませんでした', e);
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('保存データを消せませんでした', e);
  }
}
