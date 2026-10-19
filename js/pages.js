// 紙を足す・代わりにめくるロジック。画面にも localStorage にも依存しない。

import { addDays, daysBetween } from './date.js';
import { pickContent } from './content.js';

export const INITIAL_BACK_DAYS = 3; // 初回起動時、今日の何日前から紙があるか
export const AUTO_FLIP_DAYS = 7;    // 最後に開いた日からこの日数以上空いたら、代わりにめくる

// 一行・書き手・写真は紙を作るときに決めて保存する（開き直しても変わらない）
function newPage(content) {
  return {
    flipped: false,
    lineId: content.lineId,
    writer: content.writer,
    photoId: content.photoId,
    stamp: null,
    autoFlipped: false,
  };
}

// 起動時（とアプリに戻ってきたとき）に呼ぶ。
// state は保存データ（なければ null）、today はアプリ上の今日 'YYYY-MM-DD'。
// 渡された state は変更せず、新しい state を返す。
// autoFlipped: 今回ぬいぐるみが代わりにめくったか（一言を出すかどうか）
export function syncPages(state, today, rng = Math.random) {
  if (!state) {
    const pages = {};
    for (let i = -INITIAL_BACK_DAYS; i <= 0; i++) {
      const d = addDays(today, i);
      // 初回の3日分は、初日からめくって読めるよう必ず一行を書く
      pages[d] = newPage(pickContent(d, pages, { forceLine: i < 0 }, rng));
    }
    return {
      state: { installedOn: today, openedDays: [today], autoFlipNoticeShown: [], pages },
      autoFlipped: false,
    };
  }

  const s = structuredClone(state);
  const lastOpened = s.openedDays.at(-1);

  // 最後の紙の翌日から今日までを足す。時計が戻されていたら何も足さない
  const lastPage = Object.keys(s.pages).sort().at(-1);
  const start = lastPage ? addDays(lastPage, 1) : today;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    s.pages[d] = newPage(pickContent(d, s.pages, {}, rng));
  }

  // 7日以上ぶりなら、今日より前のめくっていない紙を全部代わりにめくる
  let autoFlipped = false;
  if (lastOpened && daysBetween(lastOpened, today) >= AUTO_FLIP_DAYS) {
    for (const [d, page] of Object.entries(s.pages)) {
      if (d < today && !page.flipped) {
        page.flipped = true;
        page.autoFlipped = true;
        autoFlipped = true;
      }
    }
  }
  if (autoFlipped && !s.autoFlipNoticeShown.includes(today)) {
    s.autoFlipNoticeShown.push(today);
  }

  if (!s.openedDays.includes(today)) {
    s.openedDays.push(today);
    s.openedDays.sort();
  }

  return { state: s, autoFlipped };
}

// 画面に出す紙（今日より後の紙は、時計を戻されたときにしか存在しないので出さない）
export function visibleDates(state, today) {
  return Object.keys(state.pages).sort().filter((d) => d <= today);
}
