// 二十四節気・七十二候の固定データ（2026年秋〜2027年1月）
// from はその候が始まるアプリ上の日付。日付は手入力のため ±1日ずれている可能性あり（後のステップで要確認）。

const KOU = [
  { from: '2026-09-23', sekki: '秋分', sekkiYomi: 'しゅうぶん', kou: '雷乃収声', kouYomi: 'かみなりすなわちこえをおさむ' },
  { from: '2026-09-28', sekki: '秋分', sekkiYomi: 'しゅうぶん', kou: '蟄虫坏戸', kouYomi: 'むしかくれてとをふさぐ' },
  { from: '2026-10-03', sekki: '秋分', sekkiYomi: 'しゅうぶん', kou: '水始涸', kouYomi: 'みずはじめてかるる' },
  { from: '2026-10-08', sekki: '寒露', sekkiYomi: 'かんろ', kou: '鴻雁来', kouYomi: 'こうがんきたる' },
  { from: '2026-10-13', sekki: '寒露', sekkiYomi: 'かんろ', kou: '菊花開', kouYomi: 'きくのはなひらく' },
  { from: '2026-10-18', sekki: '寒露', sekkiYomi: 'かんろ', kou: '蟋蟀在戸', kouYomi: 'きりぎりすとにあり' },
  { from: '2026-10-23', sekki: '霜降', sekkiYomi: 'そうこう', kou: '霜始降', kouYomi: 'しもはじめてふる' },
  { from: '2026-10-28', sekki: '霜降', sekkiYomi: 'そうこう', kou: '霎時施', kouYomi: 'こさめときどきふる' },
  { from: '2026-11-02', sekki: '霜降', sekkiYomi: 'そうこう', kou: '楓蔦黄', kouYomi: 'もみじつたきばむ' },
  { from: '2026-11-07', sekki: '立冬', sekkiYomi: 'りっとう', kou: '山茶始開', kouYomi: 'つばきはじめてひらく' },
  { from: '2026-11-12', sekki: '立冬', sekkiYomi: 'りっとう', kou: '地始凍', kouYomi: 'ちはじめてこおる' },
  { from: '2026-11-17', sekki: '立冬', sekkiYomi: 'りっとう', kou: '金盞香', kouYomi: 'きんせんかさく' },
  { from: '2026-11-22', sekki: '小雪', sekkiYomi: 'しょうせつ', kou: '虹蔵不見', kouYomi: 'にじかくれてみえず' },
  { from: '2026-11-27', sekki: '小雪', sekkiYomi: 'しょうせつ', kou: '朔風払葉', kouYomi: 'きたかぜこのはをはらう' },
  { from: '2026-12-02', sekki: '小雪', sekkiYomi: 'しょうせつ', kou: '橘始黄', kouYomi: 'たちばなはじめてきばむ' },
  { from: '2026-12-07', sekki: '大雪', sekkiYomi: 'たいせつ', kou: '閉塞成冬', kouYomi: 'そらさむくふゆとなる' },
  { from: '2026-12-12', sekki: '大雪', sekkiYomi: 'たいせつ', kou: '熊蟄穴', kouYomi: 'くまあなにこもる' },
  { from: '2026-12-17', sekki: '大雪', sekkiYomi: 'たいせつ', kou: '鱖魚群', kouYomi: 'さけのうおむらがる' },
  { from: '2026-12-22', sekki: '冬至', sekkiYomi: 'とうじ', kou: '乃東生', kouYomi: 'なつかれくさしょうず' },
  { from: '2026-12-27', sekki: '冬至', sekkiYomi: 'とうじ', kou: '麋角解', kouYomi: 'さわしかのつのおつる' },
  { from: '2027-01-01', sekki: '冬至', sekkiYomi: 'とうじ', kou: '雪下出麦', kouYomi: 'ゆきわたりてむぎのびる' },
  { from: '2027-01-05', sekki: '小寒', sekkiYomi: 'しょうかん', kou: '芹乃栄', kouYomi: 'せりすなわちさかう' },
  { from: '2027-01-10', sekki: '小寒', sekkiYomi: 'しょうかん', kou: '水泉動', kouYomi: 'しみずあたたかをふくむ' },
  { from: '2027-01-15', sekki: '小寒', sekkiYomi: 'しょうかん', kou: '雉始雊', kouYomi: 'きじはじめてなく' },
  { from: '2027-01-20', sekki: '大寒', sekkiYomi: 'だいかん', kou: '款冬華', kouYomi: 'ふきのはなさく' },
  { from: '2027-01-25', sekki: '大寒', sekkiYomi: 'だいかん', kou: '水沢腹堅', kouYomi: 'さわみずこおりつめる' },
  { from: '2027-01-30', sekki: '大寒', sekkiYomi: 'だいかん', kou: '鶏始乳', kouYomi: 'にわとりはじめてとやにつく' },
  { from: '2027-02-04', sekki: '立春', sekkiYomi: 'りっしゅん', kou: '東風解凍', kouYomi: 'はるかぜこおりをとく' },
];

// 'YYYY-MM-DD' → その日の節気と候。データ範囲外なら null
export function koyomiFor(ymd) {
  if (ymd < KOU[0].from) return null;
  let found = null;
  for (const k of KOU) {
    if (k.from <= ymd) found = k;
    else break;
  }
  return found;
}
