// ハンコ（5種類）と、選んで押す画面。

export const STAMPS = [
  { id: 'niko', label: 'にこにこ' },
  { id: 'nemui', label: 'ねむい' },
  { id: 'moyamoya', label: 'もやもや' },
  { id: 'odekake', label: 'おでかけ' },
  { id: 'ouchi', label: 'おうち' },
];

export function stampLabel(id) {
  return STAMPS.find((s) => s.id === id)?.label ?? '';
}

// 押したハンコの見た目。傾きは日付から決めて、開き直しても変わらないようにする
export function stampMarkHtml(id, ymd, extraClass = '') {
  const day = Number(ymd.slice(-2));
  const r = ((day * 29) % 25) - 12;
  return `<span class="stamp-mark ${extraClass}" style="--r:${r}deg">${stampLabel(id)}</span>`;
}

// 下から出るシートで5種類から選ぶ。背景をタップすると閉じる
export function openStampPicker(current, onPick) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-label="ハンコをえらぶ">
      <div class="sheet-title">ハンコをえらぶ</div>
      <div class="sheet-stamps">
        ${STAMPS.map((s) => `
          <button class="sheet-stamp ${s.id === current ? 'is-current' : ''}" data-id="${s.id}">
            <span class="stamp-mark" style="--r:0deg">${s.label}</span>
          </button>`).join('')}
      </div>
    </div>
  `;
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    const btn = e.target.closest('.sheet-stamp');
    if (btn) {
      close();
      onPick(btn.dataset.id);
    } else if (!e.target.closest('.sheet')) {
      close();
    }
  });
  document.body.append(backdrop);
}
