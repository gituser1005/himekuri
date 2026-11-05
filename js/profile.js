// ぬいの登録（docs/nui-register.md）：選択肢、入力のチェック、保存する形への変換。画面と写真には触らない。
//
// 保存する形は、日記の選び方の部品（selection/）が読むぬいの設定（diary-selection ブランチの nuis.json）と同じ項目に、
// id・first_person_choice・photo・created を足したもの。
//
// cottage（保存データ cottage.v1 の中）
// {
//   startedOn: '2026-11-10',        始まりの日（「始める」を押した日）。始める前は null。削除しても変えない
//   preset: false,                  登録済みのキャラクター（ふうか・ポテサラ・こまち）で始めたか。true なら編集・削除・追加はできない
//   managerName: '管理人さん',       ぬいぐるみたちからの、管理人さんの呼ばれ方
//   nuis: [nui, ...],               今いるぬいぐるみ（下の nui の形）
//   startMembers: [nui, ...],       始まりの日の顔ぶれの控え（表示はしない。写真を変えても、削除しても残す）
//   edits: [{ at, day, nui, field, from, to }],  始めたあとに変えた項目（日記への反映は、組み込むときに作る）
//   diaryRecord: {...},             日記の記録（日記の選び方の部品 selection/ の記録の形。journal.js）。始めた日から作る
//   nextOrder: 3,                   次に登録するぬいの order（削除しても番号は使い回さない）
// }
//
// nui
// {
//   id: 'n1',                       変わらない内部の番号
//   name, call_name, first_person, role, favorite_food, dislike, likes, likes_te, likes_quiet, joined, order,   ← nuis.json と同じ
//   first_person_choice: 'ぼく',     一人称の選び方（FIRST_PERSONS のどれか／'name'／'other'）。'name' なら名前を変えると一人称も変わる
//   photo: 'photo-n1-1',            写真のキー（写真は IndexedDB）
//   created: '2026-11-10T21:04',    登録した時刻
// }

import { toLocalIso, appDate } from './date.js';

export const MIN_NUIS = 2;
export const MAX_NUIS = 4;
export const SECRET = 'ないしょ';
export const DEFAULT_MANAGER_NAME = '管理人さん';

export const ROLES = [
  { role: '元気', note: '体を動かすのが大好き。時々早とちりするけど、元気いっぱい。' },
  { role: 'やさしい', note: '世話を焼いてあげる。自分のことは、ついうっかり。' },
  { role: 'マイペース', note: '食べて、寝て、のんびり。急がないけど、ちゃんと楽しんでる。' },
  { role: '好奇心旺盛', note: '見つけて、確かめに行く。気になると止まらない。' },
  { role: 'おとなしい', note: 'よく気がついて、そっと手伝う。少し心配性。' },
];

// 一人称の選択肢。このほかに「名前」（'name'）と「ほかの言い方」（'other'）がある
export const FIRST_PERSONS = ['ぼく', 'わたし', 'あたし', 'おれ', 'うち'];

export const FOODS = [
  'いちご', 'りんご', 'オレンジ', 'バナナ', 'プリン', 'クッキー', 'ドーナツ', 'はちみつ',
  'おにぎり', 'パン', 'たまごやき', 'オムライス', 'カレー', 'お肉', 'お魚', 'ポテトチップス', 'おせんべい',
  SECRET,
];

// 好きなこと。te は台本の {好きなことをして} に入る形、quiet は静かに座ってできるか（台本の条件「好きなこと=座って」）
export const LIKES = [
  { likes: '本を読む', te: '本を読んで', quiet: true },
  { likes: 'かけっこ', te: 'かけっこをして', quiet: false },
  { likes: 'ダンス', te: 'ダンスをして', quiet: false },
  { likes: 'お昼寝', te: 'お昼寝をして', quiet: true },
  { likes: 'お絵かき', te: 'お絵かきをして', quiet: true },
  { likes: '歌う', te: '歌って', quiet: true },
  { likes: '料理', te: '料理をして', quiet: false },
  { likes: '探検', te: '探検をして', quiet: false },
];

export const DISLIKES = ['野菜', 'からいもの', '雷', '暑いところ', '寒いところ', '大きな音', '高いところ', SECRET];

// 自由入力の文字数
export const LENGTHS = { name: 8, call_name: 10, first_person_other: 6, managerName: 10 };

// 入力欄の値をそろえる：全角の英字は半角に、半角のカナは全角に（NFKC）してから、前後の空白を取る
export function cleanText(text) {
  return String(text ?? '').normalize('NFKC').trim();
}

// 使えるのは、ひらがな・カタカナ・アルファベットと長音（ー）だけ
const ALLOWED = /^[ぁ-ゖァ-ヺーa-zA-Z]+$/u;

// 自由入力のチェック。そろえた値と、だめなときの理由（よければ null）を返す
export function checkText(field, text) {
  const value = cleanText(text);
  const max = LENGTHS[field];
  if (!value) return { value, error: '入力してください' };
  // 管理人さんの呼び方は、初めの「管理人さん」だけは漢字のままでよい
  if (field === 'managerName' && value === DEFAULT_MANAGER_NAME) return { value, error: null };
  if (!ALLOWED.test(value)) return { value, error: '使えるのは、ひらがな・カタカナ・アルファベットと「ー」です' };
  if ([...value].length > max) return { value, error: `${max}文字までです` };
  return { value, error: null };
}

// 登録画面の入力（form）
// { name, call_name, first_person_choice, first_person_other, role, favorite_food, likes, dislike, photo }
// favorite_food・likes・dislike は画面の選択肢の文字のまま（「ないしょ」を含む）
export function emptyForm() {
  return {
    name: '', call_name: '', first_person_choice: null, first_person_other: '', role: null,
    favorite_food: SECRET, likes: SECRET, dislike: SECRET, photo: null,
  };
}

// 入力をチェックする。others はほかのぬい（名前の重なりを見る。編集中のぬい自身は入れない）
// errors は項目 → 理由。だめな項目がなければ空
export function checkForm(form, others = []) {
  const errors = {};
  const name = checkText('name', form.name);
  if (name.error) errors.name = name.error;
  else if (others.some((n) => n.name === name.value)) errors.name = '同じ名前のぬいぐるみがいます';
  const call = checkText('call_name', form.call_name);
  if (call.error) errors.call_name = call.error;
  if (!form.first_person_choice) errors.first_person = '選んでください';
  else if (form.first_person_choice === 'other') {
    const other = checkText('first_person_other', form.first_person_other);
    if (other.error) errors.first_person = other.error;
  } else if (form.first_person_choice !== 'name' && !FIRST_PERSONS.includes(form.first_person_choice)) {
    errors.first_person = '選んでください';
  }
  if (!ROLES.some((r) => r.role === form.role)) errors.role = '選んでください';
  if (!FOODS.includes(form.favorite_food)) errors.favorite_food = '選んでください';
  if (form.likes !== SECRET && !LIKES.some((l) => l.likes === form.likes)) errors.likes = '選んでください';
  if (!DISLIKES.includes(form.dislike)) errors.dislike = '選んでください';
  if (!form.photo) errors.photo = '写真を選んでください';
  return errors;
}

export function firstPersonOf(choice, name, other) {
  if (choice === 'name') return cleanText(name);
  if (choice === 'other') return cleanText(other);
  return choice;
}

// 「日記ではこう出ます」の見本
export function diaryPreview(callName) {
  return `${cleanText(callName) || '〇〇'}と、かけっこした！`;
}

// 入力 → nui の形の項目（id・joined・order・created は含めない）
export function profileOf(form) {
  const like = LIKES.find((l) => l.likes === form.likes);
  const orNull = (v) => (v === SECRET ? null : v);
  return {
    name: cleanText(form.name),
    call_name: cleanText(form.call_name),
    first_person: firstPersonOf(form.first_person_choice, form.name, form.first_person_other),
    first_person_choice: form.first_person_choice,
    role: form.role,
    favorite_food: orNull(form.favorite_food),
    dislike: orNull(form.dislike),
    likes: like?.likes ?? null,
    likes_te: like?.te ?? null,
    likes_quiet: like?.quiet ?? false,
    photo: form.photo,
  };
}

// nui → 入力（編集の画面に入れる）
export function formOf(nui) {
  return {
    name: nui.name,
    call_name: nui.call_name,
    first_person_choice: nui.first_person_choice,
    first_person_other: nui.first_person_choice === 'other' ? nui.first_person : '',
    role: nui.role,
    favorite_food: nui.favorite_food ?? SECRET,
    likes: nui.likes ?? SECRET,
    dislike: nui.dislike ?? SECRET,
    photo: nui.photo,
  };
}

// ---- コテージの操作（cottage を書き換える）----

export function newCottage() {
  return { startedOn: null, preset: false, managerName: DEFAULT_MANAGER_NAME, nuis: [], startMembers: [], edits: [], nextOrder: 1 };
}

export const isStarted = (cottage) => Boolean(cottage?.startedOn);
export const canAdd = (cottage) => !cottage.preset && cottage.nuis.length < MAX_NUIS;
export const canStart = (cottage) => !isStarted(cottage) && cottage.nuis.length >= MIN_NUIS;
export const canEdit = (cottage) => !cottage.preset;
// 「2体のときは削除できない」は始めたあとだけ。始める前は何体でも削除できる
export const canRemove = (cottage) => !cottage.preset && (!isStarted(cottage) || cottage.nuis.length > MIN_NUIS);

// ぬいを1体足して、その nui を返す。始める前なら joined は「始める」を押したときに決める
export function addNui(cottage, form, now) {
  if (!canAdd(cottage)) throw new Error('これ以上登録できません');
  const order = cottage.nextOrder++;
  const nui = {
    id: `n${order}`,
    ...profileOf(form),
    joined: isStarted(cottage) ? appDate(now) : null,
    order,
    created: toLocalIso(now),
  };
  cottage.nuis.push(nui);
  return nui;
}

// 保存する項目の順（変更の記録もこの順に並ぶ）
const FIELDS = ['photo', 'name', 'call_name', 'first_person', 'first_person_choice', 'role', 'favorite_food', 'likes', 'likes_te', 'likes_quiet', 'dislike'];

// ぬいの項目を変える。始めたあとなら、変わった項目を edits に残す。変わった項目の名前を返す
export function editNui(cottage, id, form, now) {
  if (!canEdit(cottage)) throw new Error('登録済みのキャラクターは変えられません');
  const nui = cottage.nuis.find((n) => n.id === id);
  if (!nui) throw new Error(`いないぬい: ${id}`);
  const next = profileOf(form);
  const changed = FIELDS.filter((f) => next[f] !== nui[f]);
  for (const field of changed) {
    if (isStarted(cottage)) cottage.edits.push({ at: toLocalIso(now), day: appDate(now), nui: id, field, from: nui[field], to: next[field] });
    nui[field] = next[field];
  }
  return changed;
}

// ぬいを削除する（写真を消すのは呼ぶ側）。始まりの日の控え（startMembers）は残す
export function removeNui(cottage, id) {
  if (!canRemove(cottage)) throw new Error('2体のときは削除できません');
  cottage.nuis = cottage.nuis.filter((n) => n.id !== id);
}

// あなたの呼ばれ方を変える。始めたあとなら edits に残す（nui は null）
export function setManagerName(cottage, value, now) {
  const next = cleanText(value);
  if (next === cottage.managerName) return;
  if (isStarted(cottage)) cottage.edits.push({ at: toLocalIso(now), day: appDate(now), nui: null, field: 'managerName', from: cottage.managerName, to: next });
  cottage.managerName = next;
}

// 「このぬいぐるみたちと始める」：始まりの日を決め、その日の顔ぶれを控えておく
export function startCottage(cottage, managerName, now) {
  if (!canStart(cottage)) throw new Error('2体以上で始めます');
  const today = appDate(now);
  cottage.startedOn = today;
  cottage.managerName = cleanText(managerName);
  for (const n of cottage.nuis) n.joined = today;
  cottage.startMembers = structuredClone(cottage.nuis);
}

// ---- 登録済みのキャラクター（ふうか・ポテサラ・こまち）----

export const PRESET_FORMS = [
  { id: 'fuuka', name: 'ふうか', call_name: 'ふうかちゃん', first_person_choice: 'ぼく', role: 'やさしい', favorite_food: 'クッキー', likes: '本を読む', dislike: '暑いところ', avatar: 'assets/fuuka.webp' },
  { id: 'potesara', name: 'ポテサラ', call_name: 'ポテサラちゃん', first_person_choice: 'name', role: '元気', favorite_food: 'オレンジ', likes: 'かけっこ', dislike: '野菜', avatar: 'assets/potesara.webp' },
  { id: 'komachi', name: 'こまち', call_name: 'こまちちゃん', first_person_choice: 'わたし', role: '好奇心旺盛', favorite_food: 'お肉', likes: '探検', dislike: '大きな音', avatar: 'assets/komachi.webp' },
];

export const presetPhotoKey = (id) => `photo-${id}-1`;

// 登録済みのキャラクターで、すぐに始める（写真は呼ぶ側が avatar から写真の保存場所に入れる）
export function startPreset(now) {
  const cottage = newCottage();
  cottage.preset = true;
  const today = appDate(now);
  cottage.nuis = PRESET_FORMS.map(({ id, avatar, ...form }, i) => ({
    id,
    ...profileOf({ ...form, first_person_other: '', photo: presetPhotoKey(id) }),
    joined: today,
    order: i + 1,
    created: toLocalIso(now),
  }));
  cottage.nextOrder = PRESET_FORMS.length + 1;
  cottage.startedOn = today;
  cottage.startMembers = structuredClone(cottage.nuis);
  return cottage;
}
