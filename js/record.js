// 記録（テスト用）。保存データから集計して表示するだけ。テスト終了時にスクリーンショットを撮って共有する。

import { dateParts } from './date.js';

export function recordStats(state, diaries) {
  return {
    installedOn: state.installedOn,
    openedDays: new Set(state.opens.map((o) => o.day)).size,
    opens: state.opens.length,
    islandOnly: state.opens.filter((o) => !o.mekuri && !o.reread).length, // 日記も読み返しも開かなかった回
    read: state.read.length,
    total: diaries.length,
  };
}

const jpDate = (ymd) => {
  const { year, month, day } = dateParts(ymd);
  return `${year}年${month}月${day}日`;
};

export function renderRecord(root, { data, state, today, onClose }) {
  const s = recordStats(state, data.diaries);
  root.innerHTML = `
    <section class="screen record">
      <div class="screen-body">
      <header class="screen-head">
        <h1 class="screen-title">記録</h1>
      </header>
      <dl class="record-stats">
        <div class="is-wide"><dt>初回起動日</dt><dd>${jpDate(s.installedOn)}</dd></div>
        <div><dt>開いた日数</dt><dd>${s.openedDays}<small>日</small></dd></div>
        <div><dt>読んだ日記</dt><dd>${s.read}<small> / ${s.total}</small></dd></div>
        <div class="is-wide">
          <dt>開いた回数</dt>
          <dd>${s.opens}<small>回</small></dd>
          <dd class="record-sub">そのうち島だけ見て閉じた回数 ${s.islandOnly}回</dd>
          <dd class="record-note">起動したときと、10分以上たってから戻ってきたときに1回と数えます</dd>
        </div>
      </dl>
      <footer class="record-foot">${jpDate(today)} 時点</footer>
      </div>
      <nav class="bottom-bar"><button class="home-btn back-btn">島にもどる</button></nav>
    </section>
  `;
  root.querySelector('.back-btn').addEventListener('click', onClose);
}
