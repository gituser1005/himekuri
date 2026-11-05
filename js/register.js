// ぬいの登録の画面（docs/nui-register.md 1章）。見本は incoming/screens/ の7枚。
// はじめ方・1体の登録・一覧・登録が終わったとき。保存と画面の行き来は main.js が受け持ち、ここは描いて知らせるだけ。

import {
  ROLES, FIRST_PERSONS, FOODS, LIKES, DISLIKES, SECRET, MAX_NUIS, LENGTHS,
  checkForm, diaryPreview, isStarted, canAdd, canStart, canRemove, checkText,
} from './profile.js';
import { processPhoto, putPhoto, getPhoto, photoUrl, newPhotoKey } from './photos.js';
import { nuiSize } from './island-life.js';
import { PLACES, PICTURE, pictureFile } from './places.js';
import { getNow, appDate, treeOf } from './date.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>';
const PLUS_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
const PHOTO_ICON = '<svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="#B5A48A" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="18" cy="14" r="7"></circle><circle cx="38" cy="14" r="7"></circle><circle cx="28" cy="30" r="15"></circle><path d="M20 48 h16"></path></svg>';

// 一覧に出す1行の説明（性格・一人称・好きなこと）
export const nuiSummary = (n) => [n.role, n.first_person, n.likes ?? SECRET].join('・');

// ---- 1. はじめ方 ----

export function renderStart(root, { onRegister, onPreset }) {
  root.innerHTML = `
    <section class="reg-page reg-start">
      <div class="reg-hero">
        <svg width="168" height="120" viewBox="0 0 168 120" aria-hidden="true">
          <path d="M0 104 Q84 92 168 104 V120 H0Z" fill="#B9D59A"></path>
          <path d="M40 58 L84 22 L128 58 Z" fill="#C8734E"></path>
          <rect x="48" y="56" width="72" height="50" rx="3" fill="#FFFDF8" stroke="#D8CBB5" stroke-width="2"></rect>
          <rect x="58" y="68" width="18" height="16" rx="2" fill="#F3D58A"></rect>
          <rect x="92" y="76" width="16" height="30" rx="2" fill="#8B6A55"></rect>
          <rect x="104" y="30" width="8" height="16" fill="#8B6A55"></rect>
          <circle cx="146" cy="84" r="12" fill="#7DBE5E"></circle>
          <rect x="144" y="92" width="4" height="14" fill="#8B6A55"></rect>
        </svg>
        <h1 class="reg-app-name">ぬいコテージ</h1>
        <p class="reg-lead">ぬいぐるみたちが暮らす、小さなおうち。<br>毎朝、きのうの日記が1ページ届きます。</p>
      </div>
      <div class="reg-choices">
        <span class="reg-label-soft">どちらで始めますか？</span>
        <button type="button" class="reg-choice is-main go-register">
          <span class="reg-choice-title">自分のぬいぐるみを登録する</span>
          <span class="reg-choice-note">2〜4体のぬいぐるみの写真とプロフィールを登録します。友達のぬいぐるみや、ほかのおうちのぬいぐるみでもだいじょうぶです。</span>
        </button>
        <button type="button" class="reg-choice go-preset">
          <span class="reg-choice-title">登録済みのキャラクターではじめる</span>
          <span class="reg-choice-note">ふうか・ポテサラ・こまちの3体が暮らすコテージです。ぬいぐるみが手もとにないときは、こちらから。</span>
        </button>
        <p class="reg-error" role="alert"></p>
      </div>
      <p class="reg-foot-note">あとから初期化して、自分のぬいぐるみで始め直すこともできます。</p>
    </section>
  `;
  root.querySelector('.go-register').addEventListener('click', onRegister);
  const preset = root.querySelector('.go-preset');
  preset.addEventListener('click', async () => {
    preset.disabled = true;
    root.querySelector('.reg-error').textContent = '';
    try {
      await onPreset();
    } catch (e) {
      console.warn(e);
      preset.disabled = false;
      root.querySelector('.reg-error').textContent = '準備できませんでした。もう一度押してください';
    }
  });
}

// ---- 2. 1体の登録 ----

const chip = (label, value, on, cls = '') =>
  `<button type="button" class="reg-chip ${cls}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;

// コテージに置いたときの見え方（今の季節の晴れの絵のベンチの1つ目の枠に、島と同じ大きさで置く。透明でない写真は島と同じ白いふち）
const STAGE_TOP = 800; // 絵（780×1688）のうち、y 800〜1440 を切り出す（style.css の .reg-stage と合わせる）
const STAGE_H = 640;
function stageHtml(url, photo) {
  const [fx, fy] = PLACES.bench.slots[0];
  const { w, h } = nuiSize(PLACES.bench.area, photo.w / photo.h);
  const style = `left:${((fx - w / 2) / PICTURE.w) * 100}%;top:${((fy - h - STAGE_TOP) / STAGE_H) * 100}%;width:${(w / PICTURE.w) * 100}%;height:${(h / STAGE_H) * 100}%`;
  return `<div class="reg-stage"><img class="reg-stage-bg" src="${pictureFile('sunny', treeOf(appDate(getNow())))}" alt=""><img class="reg-stage-nui ${photo.cutout ? 'is-cutout' : 'is-print'}" src="${url}" alt="" style="${style}"></div>`;
}

// form は呼ぶ側が持つ入力（profile.js の emptyForm の形）。ここで書き換える
// topLabel：右上の文字（「1体目（2体以上で始めます）」など）。others：ほかのぬい（名前の重なりを見る）
// focus：開いたときに移る項目（編集の「変える」から開いたとき）
export function renderForm(root, { form, topLabel, others, submitLabel, focus, onSubmit, onBack }) {
  root.innerHTML = `
    <section class="reg-page reg-form">
      <div class="reg-top">
        <button type="button" class="reg-back">${BACK_ICON}もどる</button>
        <span class="reg-count">${esc(topLabel)}</span>
      </div>

      <h1 class="reg-title">どんなぬいぐるみですか？</h1>

      <div class="reg-field" data-field="photo">
        <span class="reg-label">写真</span>
        <div class="reg-photo-row">
          <div class="reg-photo-box">${PHOTO_ICON}</div>
          <div class="reg-photo-side">
            <label class="reg-pill">写真を選ぶ<input type="file" accept="image/*" class="reg-file"></label>
            <span class="reg-help">背景を消した写真を選んでください。スマホの切り抜き機能で作れます。</span>
            <button type="button" class="reg-link go-how" aria-expanded="false">切り抜き写真の作り方</button>
          </div>
        </div>
        <div class="reg-how" hidden>
          <p><b>iPhone</b>：写真アプリでぬいぐるみの写真を開き、ぬいぐるみを長押しします。ふちが光ったら指を離し、「共有」から「画像を保存」を選ぶと、背景を消した写真が保存されます。</p>
          <p><b>Android</b>：機種によって方法がちがいます。ギャラリーや写真のアプリにある「切り抜き」「背景を消す」などの機能を使ってください。</p>
        </div>
        <div class="reg-photo-view"></div>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="name">
        <label for="reg-name" class="reg-label">名前</label>
        <input id="reg-name" class="reg-input" type="text" autocomplete="off" value="${esc(form.name)}">
        <span class="reg-help">1〜${LENGTHS.name}文字。ひらがな・カタカナ・アルファベットのみ</span>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="call_name">
        <label for="reg-call" class="reg-label">ほかのぬいぐるみからの呼ばれ方</label>
        <input id="reg-call" class="reg-input" type="text" autocomplete="off" value="${esc(form.call_name)}">
        <span class="reg-help">「ちゃん」「くん」まで入れて書いてください（1〜${LENGTHS.call_name}文字）</span>
        <div class="reg-preview">
          <span class="reg-preview-label">日記ではこう出ます</span>
          <span class="reg-preview-text"></span>
        </div>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="first_person">
        <span class="reg-label">自分のことを、なんて言う？</span>
        <div class="reg-chips fp-chips">
          ${FIRST_PERSONS.map((p) => chip(p, p, form.first_person_choice === p)).join('')}
          ${chip('名前', 'name', form.first_person_choice === 'name', 'fp-name')}
          ${chip('ほかの言い方', 'other', form.first_person_choice === 'other', 'is-other')}
        </div>
        <input class="reg-input fp-other" type="text" autocomplete="off" aria-label="ほかの言い方" placeholder="1〜${LENGTHS.first_person_other}文字" value="${esc(form.first_person_other)}" hidden>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="role">
        <span class="reg-label">どんな性格？</span>
        <span class="reg-help">日記の書き方と、コテージでの過ごし方が変わります</span>
        <div class="reg-roles">
          ${ROLES.map((r) => `
          <button type="button" class="reg-role" data-value="${r.role}" aria-pressed="${form.role === r.role}">
            <span class="reg-role-name">${r.role}</span><span class="reg-role-note">${r.note}</span>
          </button>`).join('')}
        </div>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="likes">
        <span class="reg-label">好きなこと</span>
        <span class="reg-help">おすすめ：選んでおくと、その子の好きなことの日記が届きます</span>
        <div class="reg-chips likes-chips">
          ${[...LIKES.map((l) => l.likes), SECRET].map((l) => chip(l, l, form.likes === l)).join('')}
        </div>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="favorite_food">
        <label for="reg-food" class="reg-label">好きな食べ物</label>
        <select id="reg-food" class="reg-input reg-select">
          ${FOODS.map((f) => `<option${form.favorite_food === f ? ' selected' : ''}>${f}</option>`).join('')}
        </select>
        <span class="reg-error"></span>
      </div>

      <div class="reg-field" data-field="dislike">
        <span class="reg-label">苦手なもの</span>
        <div class="reg-chips dislike-chips">
          ${DISLIKES.map((d) => chip(d, d, form.dislike === d)).join('')}
        </div>
        <span class="reg-error"></span>
      </div>

      <div class="reg-actions">
        <button type="button" class="reg-primary go-submit">${submitLabel}</button>
        <span class="reg-help is-center">あとから変えられます。変更した内容は、次の朝5時から日記に反映されます。</span>
      </div>
    </section>
  `;

  const $ = (sel) => root.querySelector(sel);
  const nameInput = $('#reg-name');
  const callInput = $('#reg-call');
  const otherInput = $('.fp-other');

  const updateName = () => {
    const name = checkText('name', nameInput.value);
    $('.fp-name').textContent = name.value && !name.error ? `名前（${name.value}）` : '名前';
  };
  const updatePreview = () => {
    $('.reg-preview-text').textContent = diaryPreview(callInput.value);
  };
  updateName();
  updatePreview();
  otherInput.hidden = form.first_person_choice !== 'other';

  nameInput.addEventListener('input', () => {
    form.name = nameInput.value;
    updateName();
  });
  callInput.addEventListener('input', () => {
    form.call_name = callInput.value;
    updatePreview();
  });
  otherInput.addEventListener('input', () => {
    form.first_person_other = otherInput.value;
  });
  $('#reg-food').addEventListener('change', (e) => {
    form.favorite_food = e.target.value;
  });

  // ボタンの並びから1つ選ぶ
  const choose = (container, key, after) => {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-value]');
      if (!btn) return;
      form[key] = btn.dataset.value;
      for (const b of container.querySelectorAll('[data-value]')) b.setAttribute('aria-pressed', String(b === btn));
      after?.();
    });
  };
  choose($('.fp-chips'), 'first_person_choice', () => {
    otherInput.hidden = form.first_person_choice !== 'other';
    if (!otherInput.hidden) otherInput.focus();
  });
  choose($('.reg-roles'), 'role');
  choose($('.likes-chips'), 'likes');
  choose($('.dislike-chips'), 'dislike');

  // 切り抜き写真の作り方
  const how = $('.go-how');
  how.addEventListener('click', () => {
    const open = how.getAttribute('aria-expanded') !== 'true';
    how.setAttribute('aria-expanded', String(open));
    $('.reg-how').hidden = !open;
  });

  // 写真：選んだら縮めて保存し、写真と、コテージに置いたときの見え方を出す
  const showPhoto = async () => {
    const photo = form.photo && (await getPhoto(form.photo));
    if (!photo) return;
    const url = await photoUrl(form.photo);
    $('.reg-photo-box').innerHTML = `<img src="${url}" alt="">`;
    $('.reg-photo-box').classList.add('has-photo');
    $('.reg-photo-view').innerHTML = `
      <span class="reg-help">コテージではこう見えます${photo.cutout ? '' : '（背景が透明ではない写真です。このままでも登録できます）'}</span>
      ${stageHtml(url, photo)}`;
  };
  showPhoto();
  $('.reg-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const error = root.querySelector('[data-field="photo"] .reg-error');
    error.textContent = '写真を読み込んでいます…';
    try {
      const photo = await processPhoto(file);
      const key = newPhotoKey();
      await putPhoto(key, photo);
      form.photo = key;
      error.textContent = '';
      error.closest('.reg-field').classList.remove('has-error');
      await showPhoto();
    } catch (err) {
      console.warn(err);
      error.textContent = err.message.startsWith('この写真') ? err.message : '写真を保存できませんでした。もう一度選んでください';
    }
  });

  // 直した項目からは、前に出した理由を消す
  const clearError = (e) => {
    const field = e.target.closest('.reg-field');
    if (!field || field.dataset.field === 'photo') return;
    field.classList.remove('has-error');
    field.querySelector('.reg-error').textContent = '';
  };
  root.addEventListener('input', clearError);
  root.addEventListener('change', clearError);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-value]')) clearError(e);
  });

  if (focus) root.querySelector(`.reg-field[data-field="${focus}"]`)?.scrollIntoView({ block: 'start' });

  $('.reg-back').addEventListener('click', onBack);
  $('.go-submit').addEventListener('click', () => {
    form.name = nameInput.value;
    form.call_name = callInput.value;
    form.first_person_other = otherInput.value;
    const errors = checkForm(form, others);
    for (const field of root.querySelectorAll('.reg-field')) {
      field.querySelector('.reg-error').textContent = errors[field.dataset.field] ?? '';
      field.classList.toggle('has-error', Boolean(errors[field.dataset.field]));
    }
    const first = root.querySelector('.reg-field.has-error');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit(form);
  });
}

// ---- 3. 一覧と、あなたの呼ばれ方 ----

// onEdit がなければ「直す」を出さない。始めたあとは、始めるボタンの代わりに「コテージにもどる」
export async function renderList(root, { cottage, onAdd, onEdit, onManagerName, onStart, onClose }) {
  const started = isStarted(cottage);
  const n = cottage.nuis.length;
  const urls = await Promise.all(cottage.nuis.map((x) => photoUrl(x.photo)));
  root.innerHTML = `
    <section class="reg-page reg-list">
      <div class="reg-top">
        <span class="reg-top-label">${started ? 'ぬいぐるみ' : '登録'}</span>
        <span class="reg-count">${n}体${n < MAX_NUIS && !cottage.preset ? `（あと${MAX_NUIS - n}体まで）` : ''}</span>
      </div>

      <div class="reg-heading">
        <h1 class="reg-title">コテージに住むぬいぐるみ</h1>
        <span class="reg-help">${cottage.preset ? '登録済みのキャラクターは、変えられません' : `${MAX_NUIS}体まで登録できます`}</span>
      </div>

      <div class="reg-nuis">
        ${cottage.nuis.map((x, i) => `
        <div class="reg-nui">
          <span class="reg-nui-photo">${urls[i] ? `<img src="${urls[i]}" alt="">` : '写真'}</span>
          <div class="reg-nui-text">
            <span class="reg-nui-name">${esc(x.name)}</span>
            <span class="reg-nui-sub">${esc(nuiSummary(x))}</span>
          </div>
          ${onEdit && !cottage.preset ? `<button type="button" class="reg-link go-edit" data-id="${x.id}">直す</button>` : ''}
        </div>`).join('')}
        ${canAdd(cottage) ? `<button type="button" class="reg-add go-add">${PLUS_ICON}もう1体登録する</button>` : ''}
      </div>

      <div class="reg-field" data-field="managerName">
        <label for="reg-mgr" class="reg-label">ぬいぐるみたちからの、あなたの呼ばれ方</label>
        <input id="reg-mgr" class="reg-input" type="text" autocomplete="off" value="${esc(cottage.managerName)}">
        <span class="reg-help">日記の中で、ぬいぐるみたちがあなたのことをこう呼びます（1〜${LENGTHS.managerName}文字。例：マスター、ゆうちゃん）</span>
        <span class="reg-error"></span>
      </div>

      <div class="reg-actions">
        ${started
          ? '<button type="button" class="reg-primary go-close">コテージにもどる</button>'
          : `<button type="button" class="reg-primary go-start"${canStart(cottage) ? '' : ' disabled'}>このぬいぐるみたちと始める</button>
        ${n < 2 ? '<span class="reg-help is-center">1体だけのときは、まだ始められません</span>' : ''}`}
      </div>
    </section>
  `;

  const $ = (sel) => root.querySelector(sel);
  const mgr = $('#reg-mgr');
  const mgrError = $('[data-field="managerName"] .reg-error');
  // あなたの呼ばれ方：決まりに合えば、そのたびに保存する
  const checkMgr = () => {
    const r = checkText('managerName', mgr.value);
    mgrError.textContent = r.error ?? '';
    return r;
  };
  mgr.addEventListener('change', () => {
    const r = checkMgr();
    if (!r.error) onManagerName(r.value);
  });

  $('.go-add')?.addEventListener('click', onAdd);
  for (const b of root.querySelectorAll('.go-edit')) b.addEventListener('click', () => onEdit(b.dataset.id));
  $('.go-close')?.addEventListener('click', onClose);
  $('.go-start')?.addEventListener('click', () => {
    const r = checkMgr();
    if (r.error) {
      mgr.focus();
      return;
    }
    onStart(r.value);
  });
}

// ---- 5. プロフィールの編集 ----

// 編集の画面の行（項目 → 見出し）。「変える」で、1体の登録と同じ画面のその項目へ移る
const EDIT_ROWS = [
  ['photo', '写真'], ['name', '名前'], ['call_name', '呼ばれ方'], ['first_person', '自分の言い方'],
  ['role', '性格'], ['likes', '好きなこと'], ['favorite_food', '好きな食べ物'], ['dislike', '苦手なもの'],
];

export async function renderEdit(root, { cottage, nui, onBack, onChange, onDelete }) {
  const url = await photoUrl(nui.photo);
  const photo = await getPhoto(nui.photo);
  const value = {
    photo: photo && !photo.cutout ? '写真（背景が透明ではない）' : '切り抜き写真',
    name: nui.name,
    call_name: nui.call_name,
    first_person: nui.first_person,
    role: nui.role,
    favorite_food: nui.favorite_food ?? SECRET,
    likes: nui.likes ?? SECRET,
    dislike: nui.dislike ?? SECRET,
  };
  const removable = canRemove(cottage);
  root.innerHTML = `
    <section class="reg-page reg-edit">
      <div class="reg-top">
        <button type="button" class="reg-back">${BACK_ICON}もどる</button>
      </div>
      <div class="reg-edit-head">
        <span class="reg-nui-photo is-lg">${url ? `<img src="${url}" alt="">` : '写真'}</span>
        <h1 class="reg-title">${esc(nui.name)}のプロフィール</h1>
      </div>
      <div class="reg-notice">変更した内容は、次の朝5時から日記に反映されます。続いている話は、そのまま続きます。</div>
      <div class="reg-rows">
        ${EDIT_ROWS.map(([field, label]) => `
        <div class="reg-row">
          <span class="reg-row-label">${label}</span>
          <span class="reg-row-value">${esc(value[field])}</span>
          <button type="button" class="reg-row-go" data-field="${field}">変える</button>
        </div>`).join('')}
      </div>
      <div class="reg-actions is-center">
        <button type="button" class="reg-danger go-delete"${removable ? '' : ' disabled'}>このぬいぐるみのデータを削除する</button>
        ${removable ? '' : '<span class="reg-help">2体のときは、削除できません</span>'}
      </div>
    </section>
  `;
  root.querySelector('.reg-back').addEventListener('click', onBack);
  for (const b of root.querySelectorAll('.reg-row-go')) b.addEventListener('click', () => onChange(b.dataset.field));
  root.querySelector('.go-delete').addEventListener('click', onDelete);
}

// ---- 6・7. 削除の確認（1回目・2回目）。編集の画面の上に重ねる ----

// step 1：消えるもの・残るものの説明と「削除に進む」。step 2：「本当に削除してよろしいですか？」と「削除する」
// 始める前は、まだ日記がないので、日記についての説明は出さない
export function renderDeleteConfirm(root, { step, nui, started, onNext, onCancel }) {
  const name = esc(nui.call_name);
  if (step === 1) {
    renderConfirm(root, {
      step,
      title: `${name}のデータを、削除します`,
      items: [
        '写真とプロフィールが削除されます。削除すると、元には戻せません。',
        ...(started ? ['これまでの日記は、そのまま読めます。', `明日の朝の日記には、まだ${name}が出てくることがあります。`] : []),
      ],
      nextLabel: '削除に進む',
      onNext, onCancel,
    });
  } else {
    renderConfirm(root, {
      step,
      title: '本当に削除してよろしいですか？',
      text: `${name}の写真とプロフィールは、元に戻せません。`,
      nextLabel: '削除する',
      onNext, onCancel,
    });
  }
}

// 初期化の確認（1回目・2回目）。記録の画面の上に重ねる
export function renderResetConfirm(root, { step, onNext, onCancel }) {
  if (step === 1) {
    renderConfirm(root, {
      step,
      title: '最初からやり直します',
      items: [
        'ぬいぐるみの写真とプロフィール、読んだ日記とお気に入りが、すべて消えます。元には戻せません。',
        'はじめ方の画面から、もう一度始めます。',
      ],
      nextLabel: '初期化に進む',
      onNext, onCancel,
    });
  } else {
    renderConfirm(root, {
      step,
      title: '本当に初期化してよろしいですか？',
      text: 'このアプリの記録は、すべて元に戻せません。',
      nextLabel: '初期化する',
      onNext, onCancel,
    });
  }
}

// 確認の窓を、今の画面の上に重ねる。title・items・text はエスケープ済みの文字で渡す
// step 1 は説明の並び（items）、step 2 は最後の確認（text）
function renderConfirm(root, { step, title, items, text, nextLabel, onNext, onCancel }) {
  root.querySelector('.reg-dlg-back')?.remove();
  root.insertAdjacentHTML('beforeend', `
    <div class="reg-dlg-back">
      <div class="reg-dlg" role="${step === 1 ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="reg-dlg-title"${text ? ' aria-describedby="reg-dlg-desc"' : ''}>
        <h1 id="reg-dlg-title" class="reg-dlg-title">${title}</h1>
        ${items ? `<ul class="reg-dlg-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}
        ${text ? `<p id="reg-dlg-desc" class="reg-dlg-text">${text}</p>` : ''}
        <div class="reg-dlg-actions">
          <button type="button" class="reg-dlg-danger go-next">${nextLabel}</button>
          <button type="button" class="reg-dlg-cancel go-cancel">やめる</button>
        </div>
      </div>
    </div>
  `);
  root.querySelector('.go-next').addEventListener('click', onNext);
  root.querySelector('.go-cancel').addEventListener('click', onCancel);
}

// ---- 4. 登録が終わったとき ----

export function renderDone(root, { cottage, onGo }) {
  root.innerHTML = `
    <section class="reg-page reg-done">
      <svg width="220" height="150" viewBox="0 0 220 150" aria-hidden="true">
        <path d="M0 128 Q110 112 220 128 V150 H0Z" fill="#B9D59A"></path>
        <path d="M56 70 L110 26 L164 70 Z" fill="#C8734E"></path>
        <rect x="66" y="68" width="88" height="62" rx="3" fill="#FFFDF8" stroke="#D8CBB5" stroke-width="2"></rect>
        <rect x="78" y="82" width="22" height="20" rx="2" fill="#F3D58A"></rect>
        <rect x="118" y="92" width="20" height="38" rx="2" fill="#8B6A55"></rect>
        <circle cx="36" cy="120" r="12" fill="#E8DCCB" stroke="#C9B99F" stroke-width="2"></circle>
        <circle cx="186" cy="120" r="12" fill="#E8DCCB" stroke="#C9B99F" stroke-width="2"></circle>
      </svg>
      <div class="reg-done-text">
        <h1 class="reg-title">${esc(cottage.nuis[0].call_name)}たちが、<br>コテージに来ました</h1>
        <p class="reg-lead">今日のことは、だれかが日記に書きます。<br>最初の日記は、明日の朝5時に届きます。</p>
      </div>
      <button type="button" class="reg-primary go-cottage">コテージを見る</button>
    </section>
  `;
  root.querySelector('.go-cottage').addEventListener('click', onGo);
}
