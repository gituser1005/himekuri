// 記録（テスト用。docs/SPEC.md「4. 記録（テスト用）」）。数字はここには出さず、入り口だけを並べる：
// 試用の記録を見る（集計画面。trial-record.js）・ぬいぐるみ（登録したぬいぐるみの一覧）・初期化する（最初からやり直す）

// onNuis があれば「ぬいぐるみ」を、onReset があれば、その下に線で区切って「初期化する」を出す
// （「コテージにもどる」の近くで押しまちがえないよう、画面の下のはしには置かない）
export function renderRecord(root, { onClose, onTrial, onNuis, onReset }) {
  root.innerHTML = `
    <section class="screen record">
      <div class="screen-body">
      <header class="screen-head">
        <h1 class="screen-title">記録</h1>
      </header>
      <p class="record-lead">使った回数や、日記を読むまでの時間は「試用の記録」にまとめています。記録はこの端末の中だけにあり、自動では送られません。</p>
      <div class="record-more"><button class="go-trial">試用の記録を見る</button></div>
      ${onNuis ? '<div class="record-more"><button class="go-nuis">ぬいぐるみ</button></div>' : ''}
      ${onReset ? '<div class="record-reset"><button class="go-reset">初期化する（最初からやり直す）</button><p class="record-reset-note">写真・日記・お気に入りがすべて消えます</p></div>' : ''}
      </div>
      <nav class="bottom-bar"><button class="home-btn back-btn">コテージにもどる</button></nav>
    </section>
  `;
  root.querySelector('.back-btn').addEventListener('click', onClose);
  root.querySelector('.go-trial').addEventListener('click', onTrial);
  root.querySelector('.go-nuis')?.addEventListener('click', onNuis);
  root.querySelector('.go-reset')?.addEventListener('click', onReset);
}
