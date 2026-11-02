// 달력에서 일정·할 일을 끌어서 다른 날짜로 옮기기
//
// 포인터 이벤트 하나로 마우스·터치·펜을 모두 받습니다.
// 칩에는 CSS 로 touch-action: none 을 줘서, 칩에서 시작한 터치는
// 화면이 스크롤되지 않고 끌기로 이어집니다.

const THRESHOLD = 6; // 이만큼 움직여야 끌기로 본다 (그냥 누른 건 탭으로)

export function initCalendarDrag({ onDrop, isEnabled }) {
  let st = null;
  let blockNextClick = false;

  function clearHighlight() {
    document.querySelectorAll('.day.is-drop').forEach((el) => el.classList.remove('is-drop'));
  }

  function cleanup() {
    if (st && st.ghost) st.ghost.remove();
    clearHighlight();
    document.body.classList.remove('is-dragging');
    st = null;
  }

  function makeGhost(label, color, textColor) {
    const g = document.createElement('div');
    g.className = 'drag-ghost';
    g.textContent = label;
    if (color) g.style.background = color;
    if (textColor) g.style.color = textColor;
    document.body.appendChild(g);
    return g;
  }

  function moveGhost(x, y) {
    if (!st || !st.ghost) return;
    st.ghost.style.left = `${x}px`;
    st.ghost.style.top = `${y}px`;
  }

  function dayUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const day = el.closest('.day[data-date]');
    return day && !day.classList.contains('blank') ? day : null;
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const chip = e.target.closest('[data-drag-id]');
    if (!chip) return;
    if (isEnabled && !isEnabled()) return;

    const cs = getComputedStyle(chip);
    st = {
      kind: chip.dataset.dragKind,
      id: chip.dataset.dragId,
      from: chip.dataset.dragFrom,
      label: chip.textContent.trim(),
      color: cs.backgroundColor,
      textColor: cs.color,
      x0: e.clientX,
      y0: e.clientY,
      active: false,
      chip,
    };
  }

  function onPointerMove(e) {
    if (!st) return;

    if (!st.active) {
      const dx = Math.abs(e.clientX - st.x0);
      const dy = Math.abs(e.clientY - st.y0);
      if (dx < THRESHOLD && dy < THRESHOLD) return;
      st.active = true;
      st.ghost = makeGhost(st.label, st.color, st.textColor);
      document.body.classList.add('is-dragging');
      st.chip.classList.add('is-dragging-src');
    }

    e.preventDefault();
    moveGhost(e.clientX, e.clientY);

    clearHighlight();
    const day = dayUnder(e.clientX, e.clientY);
    if (day && day.dataset.date !== st.from) day.classList.add('is-drop');
  }

  function onPointerUp(e) {
    if (!st) return;
    if (!st.active) { st = null; return; }

    const day = dayUnder(e.clientX, e.clientY);
    const to = day ? day.dataset.date : null;
    const payload = { kind: st.kind, id: st.id, from: st.from, to };

    blockNextClick = true;
    setTimeout(() => { blockNextClick = false; }, 60);
    cleanup();

    if (to && to !== payload.from) onDrop(payload);
  }

  function onPointerCancel() {
    if (!st) return;
    blockNextClick = st.active;
    setTimeout(() => { blockNextClick = false; }, 60);
    cleanup();
  }

  // 끌고 난 뒤의 클릭이 날짜 선택으로 새지 않게 막는다
  function onClickCapture(e) {
    if (!blockNextClick) return;
    e.stopPropagation();
    e.preventDefault();
    blockNextClick = false;
  }

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
  document.addEventListener('click', onClickCapture, true);
}
