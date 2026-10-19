// 裏の一行（固定データ）。
// ※ いまは動作確認用の仮の下書き。本番の約60本はステップ7で差し替える。
// 書き方ルール：30字以内／寂しかった・待っていたは書かない／起きていないこと（成長や変化）は書かない
// writer を書いた一行は、その書き手に固定する。書いていなければ紙を作るときに3人から選ぶ。

export const WRITERS = {
  fuuka: 'ふうかちゃん',
  potesara: 'ポテサラ',
  komachi: 'こまち',
};
export const WRITER_IDS = Object.keys(WRITERS);

// 日常（本番30本）
export const DAILY = [
  { id: 'daily-01', text: 'まどのそばで、ひなたぼっこをしていました' },
  { id: 'daily-02', text: 'おふとんのはしっこで、ひるねをしました' },
  { id: 'daily-03', text: '今日は三人で、ならんで座っていました' },
  { id: 'daily-04', text: 'クッションの上は、あたたかかったです' },
  { id: 'daily-05', text: '雲がゆっくり動くのを、ながめていました' },
  { id: 'daily-06', text: '夕方の光が、へやの奥までとどいていました' },
  { id: 'daily-07', text: 'ポテサラは、ずっと同じ場所にいました', writer: 'fuuka' },
  { id: 'daily-08', text: '今日は、なにもしない日にしました' },
  { id: 'daily-09', text: '外から、鳥の声がきこえました' },
  { id: 'daily-10', text: 'ふうかちゃんのとなりで、じっとしていました', writer: 'potesara' },
];

// 季節（本番15本）。sekki に書いた節気の日だけ使う
export const SEASONAL = [
  { id: 'season-01', text: '朝、まどが少しつめたかったです', sekki: ['寒露', '霜降'] },
  { id: 'season-02', text: '夕方が、すこし早くなりました', sekki: ['寒露', '霜降', '立冬'] },
  { id: 'season-03', text: '落ち葉を一枚ひろいました', sekki: ['霜降', '立冬'] },
  { id: 'season-04', text: '毛布にくるまっていました', sekki: ['立冬', '小雪', '大雪'] },
  { id: 'season-05', text: '息が白くなりそうな朝でした', sekki: ['小雪', '大雪', '冬至', '小寒', '大寒'] },
];

// ハンコへの反応（5種類×2本）。キーは stamp.js の STAMPS の id
export const STAMP_REACTIONS = {
  niko: [
    { id: 'stamp-niko-1', text: 'にこにこの日でしたね' },
    { id: 'stamp-niko-2', text: 'いい日だったみたいで、よかったです' },
  ],
  nemui: [
    { id: 'stamp-nemui-1', text: 'ねむい日でしたね。こちらもです' },
    { id: 'stamp-nemui-2', text: '今日は、はやめにねましょう' },
  ],
  moyamoya: [
    { id: 'stamp-moyamoya-1', text: 'もやもやの日でしたね' },
    { id: 'stamp-moyamoya-2', text: 'そういう日も、ありますね' },
  ],
  odekake: [
    { id: 'stamp-odekake-1', text: 'おでかけの日でしたね' },
    { id: 'stamp-odekake-2', text: 'おかえりなさい' },
  ],
  ouchi: [
    { id: 'stamp-ouchi-1', text: 'おうちの日でしたね' },
    { id: 'stamp-ouchi-2', text: 'おうち、いいですよね' },
  ],
};

// 代わりにめくった（本番5本）。7日以上ぶりの起動時に1つだけ出す
export const AUTO_FLIP = [
  { id: 'auto-01', text: 'めくっておきました。だいぶ寒くなりましたね' },
  { id: 'auto-02', text: '何枚か、めくっておきました' },
  { id: 'auto-03', text: 'めくっておきました。どれも読めますよ' },
  { id: 'auto-04', text: 'かわりにめくっておきました。下にあります' },
  { id: 'auto-05', text: 'めくっておきました。季節がすこし進みました' },
];

export const LINE_BY_ID = Object.fromEntries(
  [...DAILY, ...SEASONAL, ...Object.values(STAMP_REACTIONS).flat(), ...AUTO_FLIP].map((l) => [l.id, l]),
);
