// 화면 그리기 — 순수 함수로 HTML 문자열을 만든다 (상태 변경은 app.js)

import {
  esc, safeUrl, todayKey, addDays, pad, dday, daysBetween,
  longDate, midDate, shortDate, byOrder, sortEvents, TYPE_KEYS, TYPES, typeLabel,
} from './util.js';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/* ===================== 작은 조각들 ===================== */

function val(ui, key, fallback) {
  const v = ui.draft[key];
  return v === undefined ? (fallback == null ? '' : fallback) : v;
}

function confirmRow(msg, key, okLabel) {
  return `<div class="confirm">
    <span class="c-msg">${esc(msg)}</span>
    <div class="btn-row">
      <button type="button" class="btn danger tiny" data-act="del-ok" data-key="${esc(key)}">${esc(okLabel || '삭제')}</button>
      <button type="button" class="btn tiny" data-act="del-cancel">취소</button>
    </div>
  </div>`;
}

function errLine(ui) {
  return ui.formError ? `<p class="f-err">${esc(ui.formError)}</p>` : '';
}

function subjectOptions(data, selected) {
  const opts = byOrder(data.subjects).map((s) => (
    `<option value="${esc(s.id)}"${s.id === selected ? ' selected' : ''}>${esc(s.name)}</option>`
  ));
  return `<option value=""${!selected ? ' selected' : ''}>과목 없음</option>${opts.join('')}`;
}

function typeOptions(selected) {
  return TYPE_KEYS.map((t) => (
    `<option value="${t}"${t === selected ? ' selected' : ''}>${esc(TYPES[t].label)}</option>`
  )).join('');
}

function subjectName(data, id) {
  if (!id) return '';
  const s = data.subjects[id];
  return s ? s.name : '과목 없음';
}

function ddayBadge(key, base) {
  const n = daysBetween(base, key);
  const cls = n < 0 ? 'b-late' : (n <= 1 ? 'b-soon' : '');
  return `<span class="badge ${cls}">${esc(dday(key, base))}</span>`;
}

/* ===================== 일정 카드 / 폼 ===================== */

function eventForm(data, ui, ev, ctx) {
  const d = {
    date: val(ui, 'date', ev ? ev.date : ctx.date || todayKey()),
    type: val(ui, 'type', ev ? ev.type : ctx.type || 'perf'),
    title: val(ui, 'title', ev ? ev.title : ''),
    subject: val(ui, 'subject', ev ? (ev.subject || '') : (ctx.subject || '')),
    note: val(ui, 'note', ev ? (ev.note || '') : ''),
  };
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>날짜<input type="date" data-k="date" value="${esc(d.date)}"></label>
      <label>종류<select data-k="type">${typeOptions(d.type)}</select></label>
    </div>
    <div class="f-row">
      <label>제목<input type="text" data-k="title" value="${esc(d.title)}" placeholder="예: 미적분2 심화탐구 수행평가"></label>
    </div>
    <div class="f-row">
      <label>과목<select data-k="subject">${subjectOptions(data, d.subject)}</select></label>
    </div>
    <div class="f-row">
      <label>메모<textarea data-k="note" rows="2" placeholder="없으면 비워 두세요">${esc(d.note)}</textarea></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

function eventItem(data, ui, ev, opts) {
  const o = opts || {};
  const key = `ev:${ev.id}`;
  if (ui.form && ui.form.type === 'event' && ui.form.id === ev.id) {
    return eventForm(data, ui, ev, {});
  }
  if (ui.pendingDelete === key) {
    return confirmRow(`"${ev.title}" 일정을 정말 삭제할까요?`, key);
  }

  const meta = [`<span class="badge b-${esc(ev.type)}">${esc(typeLabel(ev.type))}</span>`];
  if (o.showDday) meta.push(ddayBadge(ev.date, ui.today));
  if (o.showDate) meta.push(`<span>${esc(shortDate(ev.date))}</span>`);
  if (o.showSubject && ev.subject) meta.push(`<span>${esc(subjectName(data, ev.subject))}</span>`);

  return `<div class="item t-${esc(ev.type)}${ev.done ? ' is-done' : ''}">
    <button type="button" class="check" data-act="ev-toggle" data-id="${esc(ev.id)}"
      aria-pressed="${ev.done ? 'true' : 'false'}" aria-label="완료 표시">${ev.done ? '✓' : ''}</button>
    <div class="item-main">
      <div class="item-title">${esc(ev.title)}</div>
      <div class="item-meta">${meta.join('')}</div>
      ${ev.note ? `<div class="item-note">${esc(ev.note)}</div>` : ''}
    </div>
    <div class="item-acts">
      <button type="button" class="btn icon" data-act="form-open" data-type="event" data-id="${esc(ev.id)}" aria-label="수정" title="수정">✏️</button>
      <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
    </div>
  </div>`;
}

function eventList(data, ui, list, opts) {
  if (!list.length) return `<p class="empty">${esc((opts && opts.empty) || '없습니다.')}</p>`;
  return list.map((ev) => eventItem(data, ui, ev, opts)).join('');
}

/* ===================== 할 일 ===================== */

function todoForm(data, ui, todo, ctx) {
  const d = {
    date: val(ui, 'date', todo ? todo.date : (ctx.date || ui.today)),
    title: val(ui, 'title', todo ? todo.title : ''),
  };
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>날짜<input type="date" data-k="date" value="${esc(d.date)}"></label>
      <label>할 일<input type="text" data-k="title" value="${esc(d.title)}" placeholder="예: 기하 학습지 40~50번"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

function todoItem(ui, t) {
  const key = `todo:${t.id}`;
  if (ui.form && ui.form.type === 'todo' && ui.form.id === t.id) return todoForm(null, ui, t, {});
  if (ui.pendingDelete === key) return confirmRow(`"${t.title}" 할 일을 정말 삭제할까요?`, key);

  const late = daysBetween(ui.today, t.date) < 0;
  const meta = [];
  if (late) meta.push(`<span class="badge b-late">${esc(shortDate(t.date))} · 밀림</span>`);
  else if (t.date !== ui.today) meta.push(`<span class="badge">${esc(shortDate(t.date))} · ${esc(dday(t.date, ui.today))}</span>`);

  return `<div class="item t-todo${t.done ? ' is-done' : ''}">
    <button type="button" class="check" data-act="todo-toggle" data-id="${esc(t.id)}"
      aria-pressed="${t.done ? 'true' : 'false'}" aria-label="완료 표시">${t.done ? '✓' : ''}</button>
    <div class="item-main">
      <div class="item-title">${esc(t.title)}</div>
      ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
    </div>
    <div class="item-acts">
      <button type="button" class="btn icon" data-act="form-open" data-type="todo" data-id="${esc(t.id)}" aria-label="수정" title="수정">✏️</button>
      <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
    </div>
  </div>`;
}

/* ===================== 캘린더 탭 ===================== */

export function renderCalendar(data, ui) {
  const y = ui.calY;
  const m = ui.calM; // 0-based
  const first = new Date(y, m, 1);
  const lead = first.getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((lead + dim) / 7) * 7;

  const byDate = {};
  Object.entries(data.events).forEach(([id, ev]) => {
    if (!ev || !ev.date) return;
    (byDate[ev.date] = byDate[ev.date] || []).push({ id, ...ev });
  });
  Object.values(byDate).forEach((l) => l.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko')));

  let grid = WD.map((w, i) => (
    `<div class="cal-wd${i === 0 ? ' sun' : ''}${i === 6 ? ' sat' : ''}">${w}</div>`
  )).join('');

  for (let i = 0; i < cells; i += 1) {
    const dnum = i - lead + 1;
    if (dnum < 1 || dnum > dim) {
      grid += '<div class="day blank"></div>';
      continue;
    }
    const key = `${y}-${pad(m + 1)}-${pad(dnum)}`;
    const dow = (lead + dnum - 1) % 7;
    const list = byDate[key] || [];
    const shown = list.slice(0, ui.chipLimit);
    const rest = list.length - shown.length;

    const chips = shown.map((ev) => (
      `<span class="chip c-${esc(ev.type)}${ev.done ? ' is-done' : ''}">${esc(ev.title)}</span>`
    )).join('');

    const cls = [
      'day',
      dow === 0 ? 'sun' : '',
      dow === 6 ? 'sat' : '',
      key === ui.today ? 'is-today' : '',
      key === ui.selDate ? 'is-sel' : '',
    ].filter(Boolean).join(' ');

    grid += `<button type="button" class="${cls}" data-act="day" data-date="${key}" aria-label="${esc(midDate(key))}">
      <span class="dnum">${dnum}</span>
      ${chips}
      ${rest > 0 ? `<span class="chip-more">+${rest}</span>` : ''}
    </button>`;
  }

  const legend = TYPE_KEYS.map((t) => (
    `<span><i style="background:${TYPES[t].color}"></i>${esc(TYPES[t].label)}</span>`
  )).join('');

  const sel = ui.selDate;
  const selList = sortEvents(byDate[sel] || []);
  const adding = ui.form && ui.form.type === 'event' && !ui.form.id;

  return `<section class="panel">
    <div class="cal-head">
      <h2 class="cal-month">${y}년 ${m + 1}월</h2>
      <div class="cal-nav">
        <button type="button" class="btn" data-act="cal-prev" aria-label="이전 달">‹</button>
        <button type="button" class="btn" data-act="cal-today">오늘</button>
        <button type="button" class="btn" data-act="cal-next" aria-label="다음 달">›</button>
      </div>
    </div>
    <div class="cal-grid">${grid}</div>
    <div class="legend">${legend}</div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">${esc(midDate(sel))}<span class="count">${selList.length}개</span></h2>
      ${adding ? '' : `<button type="button" class="btn primary" data-act="form-open" data-type="event" data-date="${esc(sel)}">+ 이 날짜에 일정 추가</button>`}
    </div>
    ${adding ? eventForm(data, ui, null, { date: ui.form.date }) : ''}
    ${eventList(data, ui, selList, { showSubject: true, empty: '이 날은 일정이 없습니다.' })}
  </section>`;
}

/* ===================== 오늘 탭 ===================== */

export function renderToday(data, ui) {
  const today = ui.today;
  const tomorrow = addDays(today, 1);

  const events = Object.entries(data.events).map(([id, ev]) => ({ id, ...ev }));
  const todayList = sortEvents(events.filter((e) => e.date === today));
  const tomorrowList = sortEvents(events.filter((e) => e.date === tomorrow));
  const weekList = sortEvents(events.filter((e) => {
    const n = daysBetween(today, e.date);
    return n >= 2 && n <= 7;
  }));

  const todos = Object.entries(data.todos).map(([id, t]) => ({ id, ...t }));
  // 오늘 것 + 지난 날짜인데 아직 안 끝낸 것 (+ 오늘 끝낸 것은 되돌릴 수 있게 남겨 둠)
  const open = todos
    .filter((t) => t.date === today || (t.date < today && (!t.done || t.doneAt === today)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const later = todos
    .filter((t) => t.date > today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const addingTodo = ui.form && ui.form.type === 'todo' && !ui.form.id;

  return `<section class="panel hl">
    <div class="panel-head">
      <h2 class="panel-title">오늘 있는 일<span class="count">${esc(longDate(today))}</span></h2>
    </div>
    ${eventList(data, ui, todayList, { showSubject: true, empty: '오늘은 예정된 일정이 없습니다.' })}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">오늘 할 일<span class="count">남은 것 ${open.filter((t) => !t.done).length}개</span></h2>
      ${addingTodo ? '' : '<button type="button" class="btn primary" data-act="form-open" data-type="todo">+ 할 일 추가</button>'}
    </div>
    ${addingTodo ? todoForm(data, ui, null, { date: today }) : ''}
    ${open.length ? open.map((t) => todoItem(ui, t)).join('') : '<p class="empty">할 일이 없습니다.</p>'}
    ${later.length ? `<h3 class="subhead">예정된 할 일</h3>${later.map((t) => todoItem(ui, t)).join('')}` : ''}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">내일 있는 일 · 오늘 준비하기<span class="count">${esc(shortDate(tomorrow))}</span></h2>
    </div>
    ${eventList(data, ui, tomorrowList, { showSubject: true, empty: '내일은 예정된 일정이 없습니다.' })}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">이번 주 다가오는 일정<span class="count">2~7일 뒤</span></h2>
    </div>
    ${eventList(data, ui, weekList, { showSubject: true, showDate: true, showDday: true, empty: '일주일 안에는 더 없습니다.' })}
  </section>`;
}

/* ===================== 과목 탭 ===================== */

export function renderSubject(data, ui, id) {
  const s = data.subjects[id];
  if (!s) return '<section class="panel"><p class="empty">없는 과목입니다.</p></section>';

  const editingName = ui.form && ui.form.type === 'subject-name' && ui.form.id === id;
  const scope = Array.isArray(s.scope) ? s.scope : [];

  /* --- 과목 이름 --- */
  const nameBlock = editingName
    ? `<div class="form">
        ${errLine(ui)}
        <div class="f-row">
          <label>과목 이름<input type="text" data-k="name" value="${esc(val(ui, 'name', s.name))}"></label>
        </div>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="form-save">저장</button>
          <button type="button" class="btn" data-act="form-cancel">취소</button>
        </div>
      </div>`
    : `<div class="panel-head">
        <h2 class="panel-title">${esc(s.name)}</h2>
        <button type="button" class="btn icon" data-act="form-open" data-type="subject-name" data-id="${esc(id)}" aria-label="과목 이름 수정" title="과목 이름 수정">✏️</button>
      </div>`;

  /* --- 시험범위 --- */
  const addingScope = ui.form && ui.form.type === 'scope' && ui.form.subject === id && ui.form.index === -1;

  const scopeItems = scope.map((line, i) => {
    const key = `scope:${id}:${i}`;
    if (ui.form && ui.form.type === 'scope' && ui.form.subject === id && ui.form.index === i) {
      return `<li style="display:block"><div class="form" style="margin:0">
        ${errLine(ui)}
        <div class="f-row"><label>내용<input type="text" data-k="line" value="${esc(val(ui, 'line', line))}"></label></div>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="form-save">저장</button>
          <button type="button" class="btn" data-act="form-cancel">취소</button>
        </div>
      </div></li>`;
    }
    if (ui.pendingDelete === key) return `<li style="display:block">${confirmRow('이 줄을 정말 삭제할까요?', key)}</li>`;
    return `<li>
      <span class="s-no">${i + 1}</span>
      <span class="s-text">${esc(line)}</span>
      <span class="item-acts">
        <button type="button" class="btn icon" data-act="scope-move" data-subject="${esc(id)}" data-index="${i}" data-dir="-1" aria-label="위로" title="위로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn icon" data-act="scope-move" data-subject="${esc(id)}" data-index="${i}" data-dir="1" aria-label="아래로" title="아래로"${i === scope.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn icon" data-act="form-open" data-type="scope" data-subject="${esc(id)}" data-index="${i}" aria-label="수정" title="수정">✏️</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </li>`;
  }).join('');

  /* --- 수행평가 --- */
  const mine = Object.entries(data.events)
    .map(([eid, ev]) => ({ id: eid, ...ev }))
    .filter((ev) => ev.subject === id);
  const upcoming = sortEvents(mine.filter((ev) => daysBetween(ui.today, ev.date) >= 0));
  const past = sortEvents(mine.filter((ev) => daysBetween(ui.today, ev.date) < 0)).reverse();
  const addingEvent = ui.form && ui.form.type === 'event' && !ui.form.id && ui.form.subject === id;

  /* --- 메모 --- */
  const memoState = ui.memoState[id] || '';

  return `<section class="panel">${nameBlock}</section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">기말고사 시험범위<span class="count">${scope.length}줄</span></h2>
      ${addingScope ? '' : `<button type="button" class="btn" data-act="form-open" data-type="scope" data-subject="${esc(id)}" data-index="-1">+ 줄 추가</button>`}
    </div>
    ${addingScope ? `<div class="form">
      ${errLine(ui)}
      <div class="f-row"><label>내용<input type="text" data-k="line" value="${esc(val(ui, 'line', ''))}" placeholder="예: 3, 4단원"></label></div>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="form-save">저장</button>
        <button type="button" class="btn" data-act="form-cancel">취소</button>
      </div>
    </div>` : ''}
    ${scope.length ? `<ul class="scope-list">${scopeItems}</ul>` : '<p class="empty">아직 시험범위가 없습니다.</p>'}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">수행평가 일정<span class="count">남은 것 ${upcoming.length}개</span></h2>
      ${addingEvent ? '' : `<button type="button" class="btn primary" data-act="form-open" data-type="event" data-subject="${esc(id)}">+ 수행평가 추가</button>`}
    </div>
    ${addingEvent ? eventForm(data, ui, null, { subject: id, date: ui.today }) : ''}
    ${eventList(data, ui, upcoming, { showDate: true, showDday: true, empty: '남은 수행평가가 없습니다.' })}
    ${past.length ? `<h3 class="subhead">지난 수행평가</h3>${eventList(data, ui, past, { showDate: true })}` : ''}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">메모</h2>
      <span class="save-state ${memoState === '저장됨' ? 'ok' : (memoState && memoState !== '저장 중…' ? 'err' : '')}">${esc(memoState)}</span>
    </div>
    <textarea class="memo" data-memo="${esc(id)}" placeholder="수업 중에 들은 것, 준비물, 질문할 것…">${esc(val(ui, `memo:${id}`, s.memo || ''))}</textarea>
    <p class="muted" style="margin:6px 0 0">입력을 멈추면 자동으로 저장됩니다.</p>
  </section>

  <section class="panel">
    <div class="panel-head"><h2 class="panel-title">과목 관리</h2></div>
    <div class="btn-row">
      <button type="button" class="btn" data-act="subject-move" data-id="${esc(id)}" data-dir="-1">← 앞으로 옮기기</button>
      <button type="button" class="btn" data-act="subject-move" data-id="${esc(id)}" data-dir="1">뒤로 옮기기 →</button>
      <button type="button" class="btn" data-act="tab" data-tab="settings">＋ 과목 추가 · 전체 순서</button>
      ${ui.pendingDelete === `subject:${id}` ? '' : `<button type="button" class="btn danger" data-act="del-ask" data-key="subject:${esc(id)}">이 과목 삭제</button>`}
    </div>
    ${ui.pendingDelete === `subject:${id}`
    ? `<div style="margin-top:8px">${confirmRow(`"${s.name}" 과목을 정말 삭제할까요? 연결된 일정은 지워지지 않고 "과목 없음"으로 남습니다.`, `subject:${id}`)}</div>`
    : ''}
  </section>`;
}

/* ===================== 바로가기 탭 ===================== */

export function renderLinks(data, ui) {
  const list = byOrder(data.links);
  const adding = ui.form && ui.form.type === 'link' && !ui.form.id;

  const rows = list.map((l, i) => {
    const key = `link:${l.id}`;
    if (ui.form && ui.form.type === 'link' && ui.form.id === l.id) return linkForm(ui, l);
    if (ui.pendingDelete === key) return confirmRow(`"${l.title}"을(를) 정말 삭제할까요?`, key);
    const href = safeUrl(l.url);
    return `<div class="link-row">
      <a class="link-go" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
        <span class="l-name">${esc(l.title)}</span>
        <span class="l-url">${esc(l.url)}</span>
      </a>
      <span class="item-acts">
        <button type="button" class="btn icon" data-act="link-move" data-id="${esc(l.id)}" data-dir="-1" aria-label="위로" title="위로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn icon" data-act="link-move" data-id="${esc(l.id)}" data-dir="1" aria-label="아래로" title="아래로"${i === list.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn icon" data-act="form-open" data-type="link" data-id="${esc(l.id)}" aria-label="수정" title="수정">✏️</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </div>`;
  }).join('');

  return `<section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">바로가기<span class="count">${list.length}개</span></h2>
      ${adding ? '' : '<button type="button" class="btn primary" data-act="form-open" data-type="link">+ 사이트 추가</button>'}
    </div>
    ${adding ? linkForm(ui, null) : ''}
    ${list.length ? rows : '<p class="empty">아직 등록한 사이트가 없습니다.</p>'}
    <p class="muted" style="margin:10px 0 0">누르면 새 탭에서 열립니다.</p>
  </section>`;
}

function linkForm(ui, l) {
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>이름<input type="text" data-k="title" value="${esc(val(ui, 'title', l ? l.title : ''))}" placeholder="예: 시간표 검색"></label>
    </div>
    <div class="f-row">
      <label>주소<input type="url" data-k="url" value="${esc(val(ui, 'url', l ? l.url : ''))}" placeholder="https://…"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

/* ===================== 설정 탭 ===================== */

export function renderSettings(data, ui, store) {
  const st = (data.settings || {}).main || {};
  const subjects = byOrder(data.subjects);
  const addingSubject = ui.form && ui.form.type === 'subject-new';

  const subjectRows = subjects.map((s, i) => {
    const key = `subject:${s.id}`;
    if (ui.pendingDelete === key) {
      return confirmRow(`"${s.name}" 과목을 정말 삭제할까요? 연결된 일정은 "과목 없음"으로 남습니다.`, key);
    }
    return `<div class="rowline">
      <span class="r-name">${esc(s.name)}</span>
      <span class="muted" style="flex:0 0 auto">${esc(s.id)}</span>
      <span class="item-acts">
        <button type="button" class="btn icon" data-act="subject-move" data-id="${esc(s.id)}" data-dir="-1" aria-label="위로" title="위로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn icon" data-act="subject-move" data-id="${esc(s.id)}" data-dir="1" aria-label="아래로" title="아래로"${i === subjects.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </div>`;
  }).join('');

  const account = store.mode === 'cloud'
    ? (store.user
      ? `<p class="help">${esc(store.user.email || store.user.name || '')} 으로 로그인했습니다. 폰과 컴퓨터가 실시간으로 같은 내용을 봅니다.</p>
         <div class="btn-row"><button type="button" class="btn" data-act="logout">로그아웃</button></div>`
      : `<p class="help">로그인하면 내용을 볼 수 있습니다.</p>
         <div class="btn-row"><button type="button" class="btn primary" data-act="login">Google 로그인</button></div>`)
    : `<p class="help">지금은 <strong>이 기기에만 저장</strong>되는 로컬 모드입니다. 폰과 컴퓨터를 실시간으로 맞추려면 <code>js/firebase-config.js</code> 를 채우세요. (방법은 <code>README.md</code>)</p>`;

  return `<section class="panel">
    <div class="panel-head"><h2 class="panel-title">기말고사 날짜</h2></div>
    <div class="kv">
      <label>시작<input type="date" data-set="examStart" value="${esc(st.examStart || '')}"></label>
      <label>끝<input type="date" data-set="examEnd" value="${esc(st.examEnd || '')}"></label>
    </div>
    <p class="muted" style="margin:8px 0 0">위쪽 요약 카드의 기말고사 D-day 가 이 날짜를 기준으로 계산됩니다.</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">과목<span class="count">${subjects.length}개</span></h2>
      ${addingSubject ? '' : '<button type="button" class="btn primary" data-act="form-open" data-type="subject-new">+ 과목 추가</button>'}
    </div>
    ${addingSubject ? `<div class="form">
      ${errLine(ui)}
      <div class="f-row">
        <label>과목 이름<input type="text" data-k="name" value="${esc(val(ui, 'name', ''))}" placeholder="예: 한국사"></label>
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="form-save">저장</button>
        <button type="button" class="btn" data-act="form-cancel">취소</button>
      </div>
    </div>` : ''}
    ${subjects.length ? subjectRows : '<p class="empty">과목이 없습니다.</p>'}
    <p class="muted" style="margin:8px 0 0">순서를 바꾸면 위쪽 탭 바 순서도 바로 바뀝니다.</p>
  </section>

  <section class="panel">
    <div class="panel-head"><h2 class="panel-title">백업</h2></div>
    <div class="btn-row">
      <button type="button" class="btn" data-act="export">JSON 내보내기</button>
      <button type="button" class="btn" data-act="import">JSON 가져오기</button>
    </div>
    ${ui.pendingImport
    ? `<div style="margin-top:8px">${confirmRow(`"${ui.pendingImport.name}" 파일로 전체 데이터를 교체할까요? 지금 내용은 사라집니다.`, 'import', '가져오기')}</div>`
    : ''}
    <p class="muted" style="margin:8px 0 0">내보낸 파일 하나에 일정·할 일·과목·바로가기·설정이 모두 들어 있습니다.</p>
  </section>

  <section class="panel">
    <div class="panel-head"><h2 class="panel-title">저장 방식</h2></div>
    ${account}
    <p class="help" style="margin-top:8px">상태: <strong>${esc(store.statusText)}</strong>${store.lastError ? ` · ${esc(store.lastError)}` : ''}</p>
  </section>

  <section class="panel">
    <div class="panel-head"><h2 class="panel-title">초기화</h2></div>
    ${ui.pendingDelete === 'reset'
    ? confirmRow('모든 내용을 처음 초기 데이터로 되돌릴까요? 지금 내용은 사라집니다.', 'reset', '되돌리기')
    : '<div class="btn-row"><button type="button" class="btn danger" data-act="del-ask" data-key="reset">초기 데이터로 되돌리기</button></div>'}
  </section>`;
}

/* ===================== 헤더 요약 ===================== */

export function renderSummary(data, ui) {
  const today = ui.today;
  const events = Object.entries(data.events).map(([id, ev]) => ({ id, ...ev }));

  const future = sortEvents(events.filter((e) => e.date >= today && !e.done));
  let nextCard;
  if (!future.length) {
    nextCard = `<div class="sumcard">
      <div class="cap">다음 일정</div>
      <div class="big">없음</div>
      <div class="sub">남은 일정이 없습니다.</div>
    </div>`;
  } else {
    const d = future[0].date;
    const sameDay = future.filter((e) => e.date === d);
    const extra = sameDay.length - 1;
    const hot = daysBetween(today, d) <= 1;
    nextCard = `<div class="sumcard${hot ? ' hot' : ''}">
      <div class="cap">다음 일정 · ${esc(shortDate(d))}</div>
      <div class="big">${esc(dday(d, today))}</div>
      <div class="sub">${esc(sameDay[0].title)}${extra > 0 ? ` 외 ${extra}개` : ''}</div>
    </div>`;
  }

  const st = (data.settings || {}).main || {};
  const start = st.examStart;
  const end = st.examEnd || st.examStart;
  let examCard;
  if (!start) {
    examCard = `<div class="sumcard exam">
      <div class="cap">기말고사</div>
      <div class="big">날짜 미정</div>
      <div class="sub">설정 탭에서 날짜를 넣어 주세요.</div>
    </div>`;
  } else if (today >= start && today <= end) {
    examCard = `<div class="sumcard exam hot">
      <div class="cap">기말고사</div>
      <div class="big">시험 중</div>
      <div class="sub">${esc(shortDate(start))} ~ ${esc(shortDate(end))}</div>
    </div>`;
  } else if (today > end) {
    examCard = `<div class="sumcard exam">
      <div class="cap">기말고사</div>
      <div class="big">끝</div>
      <div class="sub">${esc(shortDate(start))} ~ ${esc(shortDate(end))} · 수고했어요</div>
    </div>`;
  } else {
    examCard = `<div class="sumcard exam">
      <div class="cap">기말고사 · ${esc(shortDate(start))}</div>
      <div class="big">${esc(dday(start, today))}</div>
      <div class="sub">${esc(midDate(start))} 시작</div>
    </div>`;
  }

  return nextCard + examCard;
}

export function renderGate(store) {
  if (store.status === 'blocked') {
    return `<div class="gbox">
      <h2>사용할 수 없는 계정</h2>
      <p>${esc(store.lastError || '소유자 계정으로 로그인해 주세요.')}</p>
      <button type="button" class="btn" data-act="logout">다른 계정으로 로그인</button>
    </div>`;
  }
  return `<div class="gbox">
    <h2>2학기 일정 수첩</h2>
    <p>내 수첩이라 로그인이 필요합니다.</p>
    <button type="button" class="btn primary" data-act="login">Google 로그인</button>
  </div>`;
}
