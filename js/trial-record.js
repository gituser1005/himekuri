// 試用の記録（docs/SPEC.md「4. 記録（テスト用）」）。利用ログを集計した数字（summary）を、スクリーンショット用のページに分けて見せる。
// 本人が画面を見て、送ってよければスクリーンショットを撮って LINE で送る。アプリからは何も送らない。
// 数字は画面を開いたときに一度だけ作り（呼ぶ側）、ページを送っても裏から戻っても作り直さない。
// ページ分けは、画面に入るかを実際に測って決める（文字を大きくした端末では、ページが増える）。
// 見本は dev/trial-record.html（架空の数字）
//
// summary の形（数字を作るのは別の部品。ここは見せるだけ）
// {
//   version: 1,                                  記録の形式の版
//   from: '2026-11-09', to: '2026-11-22',        対象の開始日と終了日（アプリ上の日付。終了日はその日の途中）
//   keptFrom: null,                              保存期間の上限で前の記録を消したときの、欠けずに残っている期間の開始日
//   madeAt: '2026-11-22T21:05',                  まとめた日時
//   device: 'iPhone',                            iPhone / Android / その他・不明
//   days: { total: 14, opened: 12 },             対象の日数と、開いた日数
//   opens: {
//     count: 31,                                 開いた回数（起動と、10分以上裏にいて戻ったとき）
//     islandOnly: 9, islandOnlyNoUnread: 4,      コテージだけを見て閉じた回数と、うち開いたときに未読がなかった回数
//     unknownEnd: 1,                             終わりを確認できない回数
//     bySlot: { morning, day, evening, night, late },  未読なしでコテージだけだった回の、時間帯ごとの回数
//     slotsPerDay: 1.8,                          1日に訪れた時間帯の数の平均（開いた日が分母）
//   },
//   profile: { installedOn, startedOn, preset, nuis: 3, roles: [{ role: '元気', count: 1 }] },
//   diaries: [{ kind, delivered, firstRead, unread, unknownTime, median, minutes }],
//     kind は KINDS のキー。median：時間が分かる初読の中央値（分。なければ null）、minutes：時間が分かる初読の所要時間（分。短い順）
//   favorites: 4,                                対象期間に届いた日記のうち、今お気に入りのページ数
//   edits: { add: 1, edit: 2, remove: 0 },       始めたあとの追加・編集・削除の回数
// }

import { dateParts } from './date.js';

export const APP_NAME = 'ぬいコテージ';

// 日記の種類（表示の順）。対応は docs/SPEC.md「日記の分類と初読時間」
export const KINDS = {
  ordinary: '普段の話',
  likes: '好きなことの話',
  event: '続きもの（事件型）',
  progress: '続きもの（進行型）',
  sequel: '後日談',
  festival: '行事・記念日',
  welcome: 'おうちに来た日',
};
const SLOTS = { morning: '朝', day: '昼', evening: '夕方', night: '夜', late: '寝る時間' };
// 初読がこの件数以下の種類は、所要時間をすべて補足のページに並べる
export const LIST_ALL_MAX = 5;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 分 → 「○時間○分」（分未満は切り捨て）
export function formatMinutes(min) {
  const m = Math.floor(min);
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}

const jpDate = (ymd, withYear = true) => {
  const { year, month, day } = dateParts(ymd);
  return withYear ? `${year}年${month}月${day}日` : `${month}月${day}日`;
};
const jpDateTime = (iso) => `${jpDate(iso.slice(0, 10))} ${Number(iso.slice(11, 13))}:${iso.slice(14, 16)}`;
const percent = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ---- ページに入れるかたまり（上から順にページへ詰める）----

function intro() {
  return `
    <div class="tr-block tr-intro">
      <p>このアプリを使った回数や、日記を読むまでの時間をまとめています。記録はこの端末の中に保存され、自動では送られません。</p>
      <p>送ってよければ各ページのスクリーンショットを撮り、LINEで開発者に送ってください。送らなくてもかまいません。</p>
      <p>ぬいぐるみの名前・写真・入力した言葉・日記の本文は、この画面には載せません。</p>
    </div>`;
}

function daysBlock(s) {
  return `
    <dl class="tr-block tr-stat">
      <dt>開いた日</dt>
      <dd><b>${s.days.opened}</b>日 / ${s.days.total}日<span class="tr-pct">（${percent(s.days.opened, s.days.total)}%）</span></dd>
    </dl>`;
}

function islandOnlyBlock(s) {
  return `
    <dl class="tr-block tr-stat">
      <dt>コテージだけを見て閉じた回数</dt>
      <dd><b>${s.opens.islandOnly}</b>回<span class="tr-sub">うち、開いたときに未読なし ${s.opens.islandOnlyNoUnread}回</span></dd>
    </dl>`;
}

// 種類ごとの「翌朝5時から初めて読むまで」。届いた日記がある種類だけ
function firstReadBlock(s) {
  const rows = s.diaries.filter((d) => d.delivered > 0);
  const body = rows.length
    ? rows.map((d) => `
        <tr>
          <th>${KINDS[d.kind]}</th>
          <td>${d.median !== null ? formatMinutes(d.median) : d.firstRead ? '—（時間不明）' : '—（初読なし）'}</td>
          <td>${d.firstRead}ページ${d.unknownTime ? `<small>（時間不明${d.unknownTime}）</small>` : ''}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" class="tr-empty">まだ日記が届いていません</td></tr>';
  return `
    <div class="tr-block">
      <h2>翌朝5時から初めて読むまで</h2>
      <p class="tr-note">中央値。アプリを開かなかった時間も含みます</p>
      <table class="tr-table">
        <thead><tr><th>種類</th><th>中央値</th><th>読んだ数</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function profileBlock(s) {
  const p = s.profile;
  const roles = p.roles.map((r) => `${esc(r.role)} ${r.count}`).join('・');
  return `
    <dl class="tr-block tr-list">
      <div><dt>初回起動日</dt><dd>${jpDate(p.installedOn)}</dd></div>
      <div><dt>コテージを始めた日</dt><dd>${p.startedOn ? jpDate(p.startedOn) : '—'}</dd></div>
      <div><dt>始め方</dt><dd>${p.preset ? '登録済みのキャラクター' : '自分のぬいぐるみ'}</dd></div>
      <div><dt>今の体数</dt><dd>${p.nuis}体${roles ? `<small>（${roles}）</small>` : ''}</dd></div>
    </dl>`;
}

function opensBlock(s) {
  const o = s.opens;
  const slots = Object.entries(SLOTS).map(([k, label]) => `<div><dt>${label}</dt><dd>${o.bySlot[k]}回</dd></div>`).join('');
  return `
    <div class="tr-block">
      <dl class="tr-list">
        <div><dt>開いた回数</dt><dd>${o.count}回</dd></div>
        <div><dt>終わりを確認できない回数</dt><dd>${o.unknownEnd}回</dd></div>
        <div><dt>1日に訪れた時間帯の数</dt><dd>平均 ${o.slotsPerDay.toFixed(1)}</dd></div>
      </dl>
      <h2>未読なしでコテージだけだった回（時間帯ごと）</h2>
      <dl class="tr-slots">${slots}</dl>
    </div>`;
}

function deliveredBlock(s) {
  const rows = s.diaries.map((d) => `
    <tr><th>${KINDS[d.kind]}</th><td>${d.delivered}</td><td>${d.firstRead}</td><td>${d.unread}</td></tr>`).join('');
  return `
    <div class="tr-block">
      <h2>日記のページ数</h2>
      <table class="tr-table tr-count">
        <thead><tr><th>種類</th><th>届いた</th><th>読んだ</th><th>未読</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function othersBlock(s) {
  return `
    <dl class="tr-block tr-list">
      <div><dt>お気に入り</dt><dd>${s.favorites}ページ<small>（届いた日記のうち、今付いている数）</small></dd></div>
      <div><dt>ぬいぐるみの追加・編集・削除</dt><dd>追加 ${s.edits.add}・編集 ${s.edits.edit}・削除 ${s.edits.remove}</dd></div>
    </dl>`;
}

// 補足：初読が1〜5件の種類は、所要時間を短い順にすべて
function supplementBlocks(s) {
  return s.diaries
    .filter((d) => d.minutes.length >= 1 && d.minutes.length <= LIST_ALL_MAX)
    .map((d) => `
      <div class="tr-block">
        <h2>${KINDS[d.kind]}：初めて読むまでの時間（短い順）</h2>
        <p class="tr-times">${d.minutes.map(formatMinutes).join(' / ')}</p>
      </div>`);
}

// かたまりの並び。main：本体、extra：補足（ページ番号に「補足」と付ける）
export function blocksOf(s) {
  return {
    main: [intro(), daysBlock(s), islandOnlyBlock(s), firstReadBlock(s), profileBlock(s), opensBlock(s), deliveredBlock(s), othersBlock(s)],
    extra: supplementBlocks(s),
  };
}

function headOf(s) {
  const period = `${jpDate(s.from)}〜${jpDate(s.to, s.to.slice(0, 4) !== s.from.slice(0, 4))}（途中）`;
  return `
    <header class="tr-head">
      <div class="tr-title"><b>${APP_NAME}</b> 試用の記録<span class="tr-page-no"></span></div>
      <div>${period}${s.keptFrom ? `<small>　${jpDate(s.keptFrom)}より前は保存期間外</small>` : ''}</div>
      <div>${jpDateTime(s.madeAt)}にまとめました・${esc(s.device)}・記録の版 ${s.version}</div>
    </header>`;
}

// かたまりを、はみ出さないようにページへ詰める。1つで入りきらないかたまりは、そのかたまりだけで1ページにする
function paginate(body, blocks) {
  const pages = [];
  let page = [];
  for (const b of blocks) {
    body.innerHTML = [...page, b].join('');
    if (page.length && body.scrollHeight > body.clientHeight + 1) {
      pages.push(page);
      page = [b];
    } else {
      page.push(b);
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

// summary：その時点の数字（固定）。startPage：最初に見せるページ（見本の画像を書き出すときに使う）
// フォントを読んでから測る（読む前の代わりの字は高さが違い、ページの分け方がずれるため）
export async function renderTrialRecord(root, { summary, onClose, startPage = 0 }) {
  root.innerHTML = `
    <section class="screen trial">
      ${headOf(summary)}
      <div class="tr-body"></div>
      <p class="tr-send">画像を確認してから、LINEで開発者へ送れます</p>
      <nav class="tr-nav">
        <button class="tr-prev">前へ</button>
        <span class="tr-count-label"></span>
        <button class="tr-next">次へ</button>
      </nav>
      <nav class="bottom-bar"><button class="home-btn back-btn">記録にもどる</button></nav>
    </section>`;
  const body = root.querySelector('.tr-body');
  const { main, extra } = blocksOf(summary);
  const text = root.textContent + [...main, ...extra].join('');
  try {
    await Promise.all(['500', '700'].map((w) => document.fonts.load(`${w} 13px "Zen Maru Gothic"`, text)));
  } catch { /* 読めなければ代わりの字のまま測る */ }
  const pages = [...paginate(body, main).map((p) => ({ blocks: p })), ...paginate(body, extra).map((p) => ({ blocks: p, extra: true }))];
  let at = Math.min(Math.max(0, startPage), pages.length - 1);

  const show = () => {
    const page = pages[at];
    body.innerHTML = page.blocks.join('');
    const no = `${at + 1}/${pages.length}ページ${page.extra ? '（補足）' : ''}`;
    root.querySelector('.tr-page-no').textContent = no;
    root.querySelector('.tr-count-label').textContent = no;
    root.querySelector('.tr-prev').disabled = at === 0;
    root.querySelector('.tr-next').disabled = at === pages.length - 1;
  };
  root.querySelector('.tr-prev').addEventListener('click', () => { at--; show(); });
  root.querySelector('.tr-next').addEventListener('click', () => { at++; show(); });
  root.querySelector('.back-btn').addEventListener('click', onClose);
  show();
  return { pages: pages.length };
}

// `?now=` で時刻を変えているときの画面（記録も集計もしない）
export function renderTrialRecordOff(root, { onClose }) {
  root.innerHTML = `
    <section class="screen trial">
      <p class="screen-empty">時刻を変えて確認中のため、試用の記録は表示しません</p>
      <nav class="bottom-bar"><button class="home-btn back-btn">記録にもどる</button></nav>
    </section>`;
  root.querySelector('.back-btn').addEventListener('click', onClose);
}
