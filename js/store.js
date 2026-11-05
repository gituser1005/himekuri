// localStorage の読み書き。キーは cottage.v1 の1つだけ。
// 試用版 v1（ぬいアイランド）は同じドメインで island.v1 を使っているので、別の名前にして、v1 の保存データは読まず書き換えもしない

export const KEY = 'cottage.v1';

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
