// コテージの絵の場所の表。座標と大きさはここにだけ書く（くじと描き方のコードには書かない）。
// 絵を描き直したら、この表を測り直す。新しい絵に要る場所の種類と数は docs/cottage-scene.md。
//
// 座標は絵（PICTURE）の画素。枠はぬいの足もとの点（写真の下の辺のまん中）。

export const PICTURE = { w: 780, h: 1688 };

// 絵のファイル。kind：sunny（晴れ・くもり）/ rain / night（夜。起きている）/ late（寝る時間）、season：js/date.js の treeOf（公園の木の姿。
// 季節4つと、クリスマスの飾りの付いた冬の木 xmas。絵は木だけが違う）。
// 絵は tools/make-cottage-svg.mjs で書き出す
const PICTURE_FILES = { sunny: 'island_day_sunny_bg', rain: 'island_day_rain_bg', night: 'island_night_bg', late: 'island_late_bg' };
export const pictureFile = (kind, season) => `assets/${PICTURE_FILES[kind]}_${season}.svg`;
// 公園の木だけの絵（晴れ・くもりの昼に、奥の段の子の上に重ねて、木を子より手前に見せる。背景の絵の木と同じ）
export const treeFile = (season) => `assets/island_tree_${season}.svg`;

// 絵は、下のはしを画面の下にそろえて出す（style.css の .island-stage）。390×797 の画面（iPhone 13 をホーム画面から開き、時計の帯を除いた高さ）で、
//   y 1370 から下は、帯とボタンに隠れる（ホームバーの上に出すぶん）。どの枠もそれより上に置く
//   y 94 から上は画面の外、y 200 までは日付・天気の表示にかかる。屋根と家の中はそれより下に描く
export const BAND_TOP = 1370;
export const TOP_UI = 200;

// ぬいの大きさ。高さ h をもとにして、横長の写真は幅が maxW を超えないように小さくする。
// maxW は、別の場所の枠どうしでぬいが重ならない幅（重なると一緒にいるように見えるため。tests/island-life.test.mjs）
export const SIZES = {
  out: { h: 170, maxW: 150 },   // 外
  house: { h: 140, maxW: 120 }, // 家の中
};

// 置き場所（晴れ・雨・夜と季節の絵で家具の位置は同じなので、表は1つ）
//   kind  wide：広い場所。枠が離れていて、何体いても「一緒」には見えない（今の絵にはない）
//         pair：2体で並べる場所（ベンチなど）。1体のときは1つ目の枠
//         solo：1体用
//   area  out：外 / house：家の中（大きさが変わる）
//   floor 家の中の階（up：2階 / down：1階）。ぬいはその階からはみ出さない（FLOORS）
//   behindTree 奥の段の場所。ここにいる子は、公園の木より奥に描く（木の葉が子の手前に来る。treeFile の絵を重ねる）
// 外は奥の段（鉢・道）と手前の段（ベンチ・木の下）に分ける（外のぬいは背が高く、1段では横に並びきらないため）。木は公園のまん中
export const PLACES = {
  road: { kind: 'solo', area: 'out', behindTree: true, slots: [[640, 1035]] }, // 玄関からの小道（奥）
  pot: { kind: 'solo', area: 'out', behindTree: true, slots: [[80, 1000]] },   // 鉢のとなり（奥。鉢は公園の左上、家のすぐ下）
  bench: { kind: 'solo', area: 'out', slots: [[124, 1335]] },  // ベンチ（手前の左。一人掛け：2体だと重なり、左の子が画面の端で切れるため。11/5）
  tree: { kind: 'pair', area: 'out', slots: [[310, 1345], [490, 1345]] },  // 木の下（手前のまん中。幹の根もとが見えるよう左右に離れる）
  window: { kind: 'pair', area: 'house', floor: 'up', slots: [[466, 488], [626, 488]] }, // 2階の窓辺。床に置いた大きなクッション2つ
  kitchen: { kind: 'solo', area: 'house', floor: 'down', slots: [[140, 752]] },  // 1階のキッチン
  table: { kind: 'pair', area: 'house', floor: 'down', slots: [[262, 752], [352, 752]] },
  shelf: { kind: 'solo', area: 'house', floor: 'down', slots: [[482, 752]] },    // 床に置いた本棚
  sofa: { kind: 'solo', area: 'house', floor: 'down', slots: [[636, 736]] },     // ソファ（座面）
};

// 家の中の階（壁の内側）。家の中の場所のぬいは、自分の階からはみ出さない（tests/island-life.test.mjs）
export const FLOORS = {
  up: { left: 75, right: 705, top: 270, floor: 500 },
  down: { left: 75, right: 705, top: 522, floor: 752 },
};

// 雨の朝・昼・夕方と、夜（19〜22時）に家の中で過ごす場所。体数 → 使う場所（それぞれ1つ目の枠）。
// 2階と1階に分けて、詰まって見えないようにする。だれがどこにいるかは日ごとのくじ（island-life.js の homeLayout）
export const HOME_USE = {
  1: ['sofa'],
  2: ['window', 'sofa'],
  3: ['window', 'table', 'sofa'],
  4: ['window', 'kitchen', 'table', 'sofa'],
};

// 寝る時間（22:00〜6:00）は、2階の2段ベッドで寝る。写真は回さず、正面向きのまま段の奥に置き、
// 手前に掛け布団を重ねて下側を隠す（顔と上半身が布団から出ているように見せる）。
// 1段に2体まで。同じ段の2体は、段の横のまん中に左右に並べる（触れるだけで重ねない。顔を隠さないように）
//   left・right：段の内側（はみ出さない） / top：頭の上の限り（上の段は「zzz」の下、下の段は上の段の板と「zzz」の下）
//   cover：掛け布団の上のふち（y）と下のはし（bottom）。布団は段の幅いっぱい / zzz：段の「zzz」の上の辺
// 写真の大きさは、BED_SHOW と段の寸法から決める（island-life.js の sleepScene）。2体が横に入りきらないときは、そろって小さくする
export const BED = {
  upper: { left: 104, right: 294, top: 284, cover: { y: 334, bottom: 368 }, zzz: 272 },
  lower: { left: 104, right: 294, top: 398, cover: { y: 448, bottom: 488 }, zzz: 386 },
};
// 体数 → 寝る段（寝る場所の番号の順）。1体は下の段、2体は上と下に1体ずつ、3体は上1・下2、4体は2体ずつ。
// だれがどこで寝るかは日ごとのくじ（island-life.js の sleepLayout）
export const BED_USE = {
  1: ['lower'],
  2: ['upper', 'lower'],
  3: ['upper', 'lower', 'lower'],
  4: ['upper', 'upper', 'lower', 'lower'],
};
// 写真のうち、掛け布団の上に見える割合（下の残りを布団で隠す）。どの子にも同じ値を使う。
// 顔が布団に隠れる子が多いようなら、ここを上げる（写真の倍率と位置は、この値から計算し直される）
export const BED_SHOW = 0.6;
// 寝ている子の頭の近くの「zzz」（段ごとに1つ。小さく）
export const ZZZ = { src: 'assets/zzz.png', w: 40, h: 10 };

// ---- 日記の写真（js/snapshot.js が作る。どの日記に付けるかは selection/snapshots.js）----
// 写真の大きさ（v1 の写真と同じ。日記の紙の写真の欄に入る）
export const SNAP = { w: 600, h: 450 };
// 場面写真：その日の季節と天気の昼の絵から crop（左上 x・y と幅。高さは幅の 3/4）を切り出し、写る子を spots（足もとの点。
// 写る子の数だけ前から使う）に、島と同じ大きさ（area。out：外、house：家の中）で置く
export const SNAP_SCENES = {
  frame: { crop: [150, 500, 340], area: 'house', spots: [[262, 752], [352, 752], [200, 752], [430, 752]] },   // 1階の額縁とテーブル
  sofa: { crop: [420, 530, 300], area: 'house', spots: [[636, 736], [540, 752], [700, 752], [470, 752]] },    // 1階のソファ
  window: { crop: [380, 268, 330], area: 'house', spots: [[466, 488], [626, 488], [546, 500], [410, 500]] },  // 2階の窓辺
  bench: { crop: [0, 1045, 400], area: 'out', spots: [[78, 1335], [158, 1335], [250, 1340], [330, 1340]] },  // 公園のベンチ
  tree: { crop: [160, 1000, 460], area: 'out', spots: [[310, 1345], [490, 1345], [400, 1345], [230, 1345]] }, // 公園の木の下
  house: { crop: [40, 600, 700], area: 'out', spots: [[130, 1045], [640, 1050], [215, 1045], [560, 1050]] },   // 家の前（木の両わき。鉢の前と小道）
};
// クリスマス（js/date.js の treeOf が xmas）の木の下の写真は、てっぺんの星まで入るよう木の全体を切り出す（子は小さく写る。子の位置は tree と同じ）
//   星の先は絵の y 803。上に少し余白を残すよう、絵の幅いっぱい（780）で y 789 から（11/7。前の [40, 830, 700] は星の先が切れていた）
export const SNAP_TREE_XMAS_CROP = [0, 789, 780];
// 記念写真（おうちに来た日）：公園の木の下（その日の季節と天気の昼の絵）で、その日にいるみんなを写す（docs/topics/2026-11-04-photo-event.md）
//   crop：絵（780×1688）の切り出し（左の x と幅。高さは幅の 3/4）。足もとの線 foot が、写真の高さの floor の位置に来るよう上下を決める
//     close：アップ（葉の下のほうと幹、足もとの芝生）。full：木の全体（行事の当日）
//     公園の木がオブジェの日（さつまいもなど）も、絵だけその日の島の木にして、切り出しと並びは同じ（子が主役。docs/topics/2026-11-07-event-art.md）
//   height：体数 → 子の高さ（写真の高さに対する割合）
//   slots：並ぶ場所（写真の幅に対する x。back は奥＝少し上・少し小さく）。先に書いた場所ほど、まん中・手前で、写る子の順に埋める
//   margin：写真の端との間（白いふちの外側）。overlap：となりの子と重なってよい幅（細いほうの子の幅に対する割合）
//   date：右下の年月日
export const SNAP_ARRIVAL = {
  foot: 1345,
  crop: {
    close: { x: 200, w: 400, floor: 0.9, height: { 1: 0.6, 2: 0.55, 3: 0.5, 4: 0.44 } },
    full: { x: 0, w: 780, floor: 0.95, height: { 1: 0.34, 2: 0.32, 3: 0.3, 4: 0.28 } }, // 上は y 789（星の先 y 803 まで入る。SNAP_TREE_XMAS_CROP）
  },
  slots: {
    1: [{ x: 0.5 }],
    2: [{ x: 0.34 }, { x: 0.66 }],
    3: [{ x: 0.5 }, { x: 0.21, back: true }, { x: 0.79, back: true }],
    4: [{ x: 0.375 }, { x: 0.625 }, { x: 0.13, back: true }, { x: 0.87, back: true }],
  },
  back: { scale: 0.92, lift: 0.035 },
  margin: 8,
  overlap: 0.3,
  date: { size: 17, right: 14, bottom: 12 },
};
// 季節のイベント・島のイベントのみんなの写真（snapshot.type が group。scene は台本の photo）。docs/topics/2026-11-04-photo-ordinary.md
//   tree：背景にするコテージの絵の木の姿（pictureFile。その日の天気の絵）。image：専用の背景の絵（あれば tree より先。4:3）
//   crop：絵（780×1688）の切り出し [左の x, 上の y, 幅]（高さは幅の 3/4）。y がなければ、足もとの線 SNAP_ARRIVAL.foot が floor の位置に来るよう決める
//   floor・height・slots：子の足もとの高さ・体数ごとの高さ・並ぶ場所（js/snapshot.js の arrivalLayout。slots がなければ SNAP_ARRIVAL.slots）
const H = (a, b, c, d) => ({ 1: a, 2: b, 3: c, 4: d });
export const SNAP_GROUP = {
  // 焼き芋大会：さつまいもの全体と、手前の落ち葉の山。子は落ち葉の山（写真の x 0.32〜0.71）の左右に立つ（dev/event-art.html の P4）
  imo: {
    tree: 'imo', crop: [0, 790, 780], floor: 0.985, height: H(0.36, 0.34, 0.32, 0.3),
    slots: {
      1: [{ x: 0.85 }], 2: [{ x: 0.16 }, { x: 0.85 }],
      3: [{ x: 0.12 }, { x: 0.86 }, { x: 0.25, back: true }],
      4: [{ x: 0.11 }, { x: 0.89 }, { x: 0.24, back: true }, { x: 0.77, back: true }],
    },
  },
  // クリスマスの飾りつけ：飾りの付いた木の全体。切り出しと子の並びは、おうちに来た日の写真の行事の当日（SNAP_ARRIVAL.crop.full）と同じ
  xmas: { tree: 'xmas', crop: [0, null, 780], floor: 0.95, height: H(0.34, 0.32, 0.3, 0.28) },
  // 紅葉狩り：専用の背景（紅葉の並木道。ユーザーが用意した絵 tools/art/momiji-src.png）。子はまん中の小道に、おうちに来た日と同じ並び
  momiji: { image: 'assets/photo_bg_momiji.webp', floor: 0.9, height: H(0.56, 0.52, 0.48, 0.43) },
};
// 島の記念日の集合写真：周年ごとの台紙の色（台本データの island_anniversary の photo.mount）。並びと置き方は毎年同じ
//   台紙の内側に写真（photo：左・上・右・下の余白）。数字はふつうの年は右下に小さく、5・10周年は上の真ん中に大きく
//   5・10周年は金のふち（10周年は四すみに小さな飾りも）。過去の写真を並べるコラージュと、年ごとの小物はまだ作らない
export const SNAP_ANNIVERSARY = {
  mounts: {
    1: '#FFFFFF', 2: '#F5ECD6', 3: '#DCEAF4', 4: '#F7DDE4', 5: '#FBF3E2',
    6: '#DDEBCB', 7: '#F8EFC6', 8: '#E5DDF1', 9: '#D8B88E', 10: '#FBF3E2',
  },
  grain: '#C9A678',                   // 9周年（木目）の線
  special: [5, 10],                   // 金のふちで、数字を上の真ん中に大きく出す年
  gold: '#C29A45',
  wall: '#FAF6EE',                    // 写真の中の背景（並んで写る壁）
  floor: '#EFE6D6',                   // 写真の中の床
  edge: '#D8CDBB',                    // 写真の細いふち
  photo: { normal: [34, 30, 34, 70], special: [44, 92, 44, 40] },
  number: { normal: 44, special: 64 }, // 数字の大きさ（画素）
  height: { 1: 0.7, 3: 0.6, 4: 0.5 },  // 体数 → 子の高さ（写真の内側の高さに対する割合。2体は3体と同じ）
  ink: '#6B5545',
};
