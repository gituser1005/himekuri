// 書き手と相手の決め方（2章）。
// ぬいは id で見分ける（名前はあとから変えられるため）。
// record.writeCount: { ぬいの id: 書いた回数 }、record.pairedOn: { 'A|B'（id）: 最後に組んだ日 }

// 島に来た順（同じ日なら order の小さい順）
export function byArrival(a, b) {
  return a.joined.localeCompare(b.joined) || a.order - b.order;
}

// 書いた回数が少ない順。同じなら島に来た順
export function byFewestWritten(nuis, record) {
  const count = (n) => record.writeCount[n.id] ?? 0;
  return [...nuis].sort((a, b) => count(a) - count(b) || byArrival(a, b));
}

// その日の当番の書き手
export function pickWriter(nuis, record) {
  return byFewestWritten(nuis, record)[0];
}

export function pairKey(a, b) {
  return [a, b].sort().join('|');
}

// 相手の候補を、書き手といちばん長く組んでいない順に（一度も組んでいない子が先。同じなら島に来た順）
export function partnerOrder(nuis, writer, record) {
  const last = (n) => record.pairedOn[pairKey(writer.id, n.id)] ?? '';
  return nuis
    .filter((n) => n.id !== writer.id)
    .sort((a, b) => last(a).localeCompare(last(b)) || byArrival(a, b));
}

// 相手：書き手以外で、書き手といちばん長く組んでいない子
export function pickPartner(nuis, writer, record) {
  return partnerOrder(nuis, writer, record)[0] ?? null;
}

// 続きものの書き手 A・B（A＝書いた回数がいちばん少ない子、B＝次に少ない子。id）
export function pickArcWriters(nuis, record) {
  const [a, b] = byFewestWritten(nuis, record);
  return { A: a.id, B: b.id };
}

// 日記に残す書き手と相手：id と、その日の名前（あとで名前を変えても、その日の日記はその日の名前のまま）
export function castOf(writer, partner) {
  return { writer: writer.id, writerName: writer.name, partner: partner?.id ?? null, partnerName: partner?.name ?? null };
}
