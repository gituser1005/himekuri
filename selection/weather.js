// その日の天気（1章）。アプリと同じく sunny / cloudy / rain で持つ。
// 台本の天気の条件（晴れ・雨・雨のあと・null）では、くもりは晴れとして扱う。

// 決まった天気がない日に、確率で決める
export function rollWeather(rng, config) {
  const r = rng();
  if (r < config.rainRate) return 'rain';
  if (r < config.rainRate + config.cloudyRate) return 'cloudy';
  return 'sunny';
}

// 続きものの段階が天気を決める日。「晴れ」の指定なら、晴れかくもりを、ふだんと同じ割合で選ぶ
export function forcedWeather(rng, condition, config) {
  if (condition === '雨') return 'rain';
  if (condition === '晴れ') return rng() < config.cloudyRate / (1 - config.rainRate) ? 'cloudy' : 'sunny';
  return rollWeather(rng, config);
}

// 台本の天気の条件に合うか。yesterday は前の日の天気（島の最初の日は null）
// 「雨のあと」は晴れの日の特別な状態なので、「晴れ」の台本もその日に出せる
export function weatherMatches(condition, today, yesterday) {
  if (condition == null) return true;
  if (condition === '雨') return today === 'rain';
  if (condition === '晴れ') return today !== 'rain';
  if (condition === '雨のあと') return today !== 'rain' && yesterday === 'rain';
  throw new Error(`知らない天気の条件: ${condition}`);
}
