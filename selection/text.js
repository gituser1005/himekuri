// 書き分けと穴埋め（6章）、台本の needs（4.1）、字数（7章）。
// 台本の文は人が確認したものなので、ここでは穴を埋めるだけで、文そのものは変えない。

// 書き手の役 → 使う書き分け
export function styleFor(role) {
  if (role === '元気') return 'genki';
  if (role === 'やさしい') return 'polite';
  return 'plain';
}

// 台本の text から、その書き分けの文を取る。genki・polite がない（null）ときは plain
export function pickText(text, style) {
  return text[style] ?? text.plain;
}

// 穴 → 入れる値。値がない（好物を持たない子など）穴は undefined
function holeValues(writer, partner) {
  return {
    '{相手}': partner?.call_name,
    '{わたし}': writer.first_person,
    '{好物}': writer.favorite_food,
    '{相手の好物}': partner?.favorite_food,
    '{好きなことをして}': writer.likes_te,
  };
}

const HOLE = /\{[^{}]+\}/g;

// 穴を埋められるか（知らない穴や、値のない穴があれば false）
export function canFill(text, writer, partner) {
  const values = holeValues(writer, partner);
  return [...text.matchAll(HOLE)].every(([hole]) => values[hole]);
}

export function fillHoles(text, writer, partner) {
  const values = holeValues(writer, partner);
  return text.replace(HOLE, (hole) => {
    if (!values[hole]) throw new Error(`埋められない穴: ${hole}`);
    return values[hole];
  });
}

// 字数。空白（「！」のあとの全角・半角の空白など）は数えない
export function charCount(text) {
  return [...text.replace(/\s/g, '')].length;
}

// needs を満たすか（4.1）
//   好物 / 好きなこと：書き手がそれを持っている
//   好きなこと=座って：書き手の好きなことが静かに座ってできる（likes_quiet）
//   苦手=○○ / 好きなこと=○○：書き手のその項目が○○と完全に同じ
//   相手の好物：相手に好物がある
//   相手の好きなこと=○○：相手の好きなこと（likes_te）が○○と完全に同じ
//   好物ちがい：書き手と相手の両方に好物があり、ちがう
export function needsMet(needs, writer, partner) {
  return needs.every((need) => {
    const [kind, value] = need.split('=');
    const own = { 好物: writer.favorite_food, 苦手: writer.dislike, 好きなこと: writer.likes_te };
    if (kind === '相手の好物') return Boolean(partner?.favorite_food);
    if (kind === '相手の好きなこと') return value === undefined ? Boolean(partner?.likes_te) : Boolean(partner) && partner.likes_te === value;
    if (kind === '好物ちがい') return Boolean(writer.favorite_food && partner?.favorite_food && writer.favorite_food !== partner.favorite_food);
    if (kind === '好きなこと' && value === '座って') return writer.likes_quiet === true;
    if (!(kind in own)) throw new Error(`知らない needs: ${need}`);
    return value === undefined ? Boolean(own[kind]) : own[kind] === value;
  });
}

// 台本の文が相手を必要とするか（{相手} などの穴がある）
export function needsPartner(text) {
  return /\{相手/.test(text);
}
