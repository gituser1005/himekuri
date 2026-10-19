// 紙を上スワイプでめくる動き。
// canFlip が false の紙（今日の紙）は、少し持ち上がるだけで元に戻る。

const FLIP_DISTANCE_RATIO = 0.25; // 紙の高さに対してこれ以上持ち上げたらめくる
const FLIP_VELOCITY = -0.6;       // px/ms。これより速く上に払ったらめくる
const LOCKED_RESISTANCE = 0.15;   // めくれない紙を引っ張ったときの動きの割合

export function attachSwipe(el, { canFlip, onFlip }) {
  let startY = null;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dy = 0;
  let busy = false;

  el.addEventListener('pointerdown', (e) => {
    if (busy) return;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    dy = 0;
    el.setPointerCapture(e.pointerId);
    el.style.transition = 'none';
    el.classList.add('is-dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;

    dy = Math.min(0, e.clientY - startY);
    if (!canFlip) dy *= LOCKED_RESISTANCE;
    lift(el, dy);
  });

  const end = () => {
    if (startY === null) return;
    startY = null;
    el.classList.remove('is-dragging');

    const farEnough = -dy > el.offsetHeight * FLIP_DISTANCE_RATIO;
    const fastEnough = velocity < FLIP_VELOCITY && dy < -10;
    if (canFlip && (farEnough || fastEnough)) {
      busy = true;
      flyAway(el, onFlip);
    } else {
      el.style.transition = 'transform 0.35s cubic-bezier(.2,.9,.3,1.15)';
      el.style.transform = '';
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function lift(el, dy) {
  const p = Math.min(1, -dy / el.offsetHeight);
  el.style.transform = `translateY(${dy}px) rotate(${-p * 5}deg)`;
}

function flyAway(el, done) {
  el.style.transition = 'transform 0.32s ease-in, opacity 0.32s ease-in';
  el.style.transform = `translateY(${-window.innerHeight * 1.1}px) rotate(-12deg)`;
  el.style.opacity = '0.6';

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  el.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 450); // transitionend が来ない場合の保険
}
