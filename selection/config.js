// 日記の選び方の設定。docs/diary-selection.md の数字をここにまとめる。
// 「まだ決まっていないこと」（11章）の仮の値も、ここで変えられる。

export const DEFAULT_CONFIG = {
  // 天気（1章）。仮の値
  rainRate: 0.25,
  cloudyRate: 0.2,

  // 普段の日（4章）。新しい話の日にする確率（仮）と、習慣が何日続いたら新しい話にするか
  newStoryRate: 0.5,
  habitStreakLimit: 3,

  // 新しい話の日に、役ごとの台本から選ぶ確率（残りは共通の台本と季節の出来事。仮）と、
  // 出せる期間の残りが何日以内の季節の出来事を、その割合より先に選ぶか（仮）
  roleStoryRate: 0.7,
  seasonalUrgentDays: 7,
  // 新しい話の日に、好きなことの台本から選ぶ確率（4.1.1。急ぎの季節の出来事の次、役ごと・共通より先。仮）と、
  // 好きなことが出た子を、その子の好きなことを指定する台本から外す日数（仮）
  likesStoryRate: 0.3,
  likesGap: 5,
  // 季節の出来事どうしの間（前の季節の出来事から何日あけるか。仮）
  seasonalGap: 7,
  // 季節の出来事を「出してよい最初の日」は、期間の初日から、期間の終わりのこの日数前までのあいだで乱数で決める（仮）
  seasonalOpenMargin: 10,

  // 習慣で間をあける日数（4.2）と、緩めたときの同じ出来事の間（4.3）
  gaps: {
    habit: 3,
    event: 30,
    sleep: 7,
    motif: 21,
    text: 180,
  },
  relaxedEventGap: 14,

  // 続きもの（5章）
  eventArcRate: 0.15,
  eventArcGap: 14,
  festivalNoEventDays: 3, // 事件型は行事・記念日の3日前から当日までは始めない
  eventSeasonalDays: 7,   // 同じ題材の季節の出来事は、季節のイベント・島のイベントの前後この日数は出さない（台本の avoid_seasonal）
  progressArcGap: [7, 14],
  firstWeekArcDays: [1, 2],

 // 最初の週の続きもの（first_week）は、始めた日の1〜2日後（使い始めて2〜3日目）に始める

  // 確かめのためだけの項目（textKey など）を記録に残すか（確認ページだけ true。アプリの記録には残さない）
  keepDebug: false,
};

// 一部だけ変えた設定を作る（gaps のような入れ子も、指定した項目だけ上書きする）
export function makeConfig(overrides = {}) {
  const config = structuredClone(DEFAULT_CONFIG);
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(config[key], value);
    else config[key] = value;
  }
  return config;
}
