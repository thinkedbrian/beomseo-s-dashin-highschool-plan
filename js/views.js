// 화면 그리기 — 순수 함수로 HTML 문자열을 만든다 (상태 변경은 app.js)

import {
  esc, safeUrl, todayKey, toKey, addDays, pad, dday, daysBetween,
  longDate, midDate, shortDate, byOrder, sortEvents,
  typeOf, rgba, lighten, textOn, pct, normHex,
  bookStats, missingRanges, rangeLength, rangeText, extractTags,
} from './util.js';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export const NEW_TYPE = '__new__';

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

function typeOptions(data, selected) {
  const list = byOrder(data.types);
  const opts = list.map((t) => (
    `<option value="${esc(t.id)}"${t.id === selected ? ' selected' : ''}>${esc(t.label)}</option>`
  ));
  // 지워진 종류를 쓰고 있던 일정도 값을 잃지 않게
  if (selected && selected !== NEW_TYPE && !list.some((t) => t.id === selected)) {
    opts.unshift(`<option value="${esc(selected)}" selected>기타</option>`);
  }
  opts.push(`<option value="${NEW_TYPE}"${selected === NEW_TYPE ? ' selected' : ''}>＋ 직접 입력…</option>`);
  return opts.join('');
}

function subjectName(data, id) {
  if (!id) return '';
  const s = data.subjects[id];
  return s ? s.name : '과목 없음';
}

function typeBadge(t) {
  return `<span class="badge" style="--bg:${rgba(t.color, 0.16)};--fg:${t.color};--fg-dark:${lighten(t.color, 0.45)}">${esc(t.label)}</span>`;
}

function ddayBadge(key, base) {
  const n = daysBetween(base, key);
  const cls = n < 0 ? 'b-late' : (n <= 1 ? 'b-soon' : '');
  return `<span class="badge ${cls}">${esc(dday(key, base))}</span>`;
}

function progressBar(done, total) {
  const p = pct(done, total);
  const full = total > 0 && Number(done) >= Number(total);
  return `<div class="bar${full ? ' is-full' : ''}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="진행률 ${p}퍼센트">
    <span style="width:${p}%"></span>
  </div>`;
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
  const custom = d.type === NEW_TYPE;
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>날짜<input type="date" data-k="date" value="${esc(d.date)}"></label>
      <label>종류<select data-k="type">${typeOptions(data, d.type)}</select></label>
    </div>
    ${custom ? `<div class="f-row sub-row">
      <label>새 종류 이름<input type="text" data-k="newTypeLabel" value="${esc(val(ui, 'newTypeLabel', ''))}" placeholder="예: 발표, 과제, 학원"></label>
      <label class="narrow">색<input type="color" data-k="newTypeColor" value="${esc(val(ui, 'newTypeColor', '#2f5bd7'))}"></label>
    </div>` : ''}
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

  const t = typeOf(data, ev.type);
  const meta = [typeBadge(t)];
  if (o.showDday) meta.push(ddayBadge(ev.date, ui.today));
  if (o.showDate) meta.push(`<span>${esc(shortDate(ev.date))}</span>`);
  if (o.showSubject && ev.subject) meta.push(`<span>${esc(subjectName(data, ev.subject))}</span>`);

  return `<div class="item${ev.done ? ' is-done' : ''}" style="border-left-color:${t.color}">
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
    subject: val(ui, 'subject', todo ? (todo.subject || '') : (ctx.subject || '')),
  };
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>날짜<input type="date" data-k="date" value="${esc(d.date)}"></label>
      <label>할 일<input type="text" data-k="title" value="${esc(d.title)}" placeholder="예: 기하 학습지 40~50번"></label>
    </div>
    ${ctx.lockSubject ? `<input type="hidden" data-k="subject" value="${esc(d.subject)}">` : `<div class="f-row">
      <label>과목<select data-k="subject">${subjectOptions(data, d.subject)}</select></label>
    </div>`}
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

function todoItem(data, ui, t, opts) {
  const o = opts || {};
  const key = `todo:${t.id}`;
  if (ui.form && ui.form.type === 'todo' && ui.form.id === t.id) {
    return todoForm(data, ui, t, { lockSubject: o.lockSubject });
  }
  if (ui.pendingDelete === key) return confirmRow(`"${t.title}" 할 일을 정말 삭제할까요?`, key);

  const late = daysBetween(ui.today, t.date) < 0;
  const meta = [];
  if (late) meta.push(`<span class="badge b-late">${esc(shortDate(t.date))} · 밀림</span>`);
  else if (t.date !== ui.today) meta.push(`<span class="badge">${esc(shortDate(t.date))} · ${esc(dday(t.date, ui.today))}</span>`);
  else if (o.showToday) meta.push('<span class="badge b-soon">오늘</span>');
  if (o.showSubject && t.subject) meta.push(`<span>${esc(subjectName(data, t.subject))}</span>`);

  const todoColor = typeOf(data, 'todo').color;
  return `<div class="item${t.done ? ' is-done' : ''}" style="border-left-color:${todoColor}">
    <button type="button" class="check" data-act="todo-toggle" data-id="${esc(t.id)}"
      aria-pressed="${t.done ? 'true' : 'false'}" aria-label="완료 표시">${t.done ? '✓' : ''}</button>
    <div class="item-main">
      <div class="item-title">${esc(t.title)}</div>
      ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
    </div>
    <div class="item-acts">
      <button type="button" class="btn icon" data-act="form-open" data-type="todo" data-id="${esc(t.id)}"${o.lockSubject ? ' data-lock="1"' : ''} aria-label="수정" title="수정">✏️</button>
      <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
    </div>
  </div>`;
}

/* ===================== 문제집 ===================== */

function bookForm(ui, book, subjectId) {
  const d = {
    title: val(ui, 'title', book ? book.title : ''),
    publisher: val(ui, 'publisher', book ? (book.publisher || '') : ''),
    unit: val(ui, 'unit', book ? (book.unit || '쪽') : '쪽'),
    startNo: val(ui, 'startNo', book ? book.startNo : 1),
    endNo: val(ui, 'endNo', book ? book.endNo : ''),
    note: val(ui, 'note', book ? (book.note || '') : ''),
  };
  return `<div class="form">
    ${errLine(ui)}
    <input type="hidden" data-k="subject" value="${esc(subjectId || '')}">
    <div class="f-row">
      <label>문제집 이름<input type="text" data-k="title" value="${esc(d.title)}" placeholder="예: 쎈 미적분"></label>
      <label>출판사<input type="text" data-k="publisher" value="${esc(d.publisher)}" placeholder="비워도 됩니다"></label>
    </div>
    <div class="f-row">
      <label class="narrow">단위<input type="text" data-k="unit" value="${esc(d.unit)}" placeholder="쪽"></label>
      <label class="narrow">시작<input type="number" data-k="startNo" value="${esc(d.startNo)}" min="0" placeholder="1"></label>
      <label class="narrow">끝<input type="number" data-k="endNo" value="${esc(d.endNo)}" min="0" placeholder="320"></label>
    </div>
    <p class="muted" style="margin:-2px 0 8px">예) 1쪽부터 320쪽까지면 시작 1, 끝 320. 문항으로 세고 싶으면 단위를 "문항"으로.</p>
    <div class="f-row">
      <label>메모<textarea data-k="note" rows="2" placeholder="2회독 여부, 오답 정리 방법 등">${esc(d.note)}</textarea></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

// 푼 범위 입력
function rangeForm(ui, b, stats) {
  const gap = missingRanges(b)[0];
  const d = {
    from: val(ui, 'from', gap ? gap.from : stats.start),
    to: val(ui, 'to', ''),
    date: val(ui, 'date', ui.today),
  };
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label class="narrow">어디부터<input type="number" data-k="from" value="${esc(d.from)}" min="0"></label>
      <label class="narrow">어디까지<input type="number" data-k="to" value="${esc(d.to)}" min="0"></label>
      <label>푼 날짜<input type="date" data-k="date" value="${esc(d.date)}"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

// 계획(언제까지 어디부터 어디까지) — 저장하면 일정표에도 올라갑니다
function planForm(data, ui, b, ev, stats) {
  const gap = missingRanges(b)[0];
  const d = {
    date: val(ui, 'date', ev ? ev.date : addDays(ui.today, 1)),
    from: val(ui, 'from', ev ? ev.from : (gap ? gap.from : stats.start)),
    to: val(ui, 'to', ev ? ev.to : ''),
    type: val(ui, 'type', ev ? ev.type : 'todo'),
  };
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>언제까지<input type="date" data-k="date" value="${esc(d.date)}"></label>
      <label class="narrow">어디부터<input type="number" data-k="from" value="${esc(d.from)}" min="0"></label>
      <label class="narrow">어디까지<input type="number" data-k="to" value="${esc(d.to)}" min="0"></label>
    </div>
    <div class="f-row">
      <label>일정표에 표시할 종류<select data-k="type">${typeOptions(data, d.type)}</select></label>
    </div>
    ${d.type === NEW_TYPE ? `<div class="f-row sub-row">
      <label>새 종류 이름<input type="text" data-k="newTypeLabel" value="${esc(val(ui, 'newTypeLabel', ''))}" placeholder="예: 문제집"></label>
      <label class="narrow">색<input type="color" data-k="newTypeColor" value="${esc(val(ui, 'newTypeColor', '#2f5bd7'))}"></label>
    </div>` : ''}
    <p class="muted" style="margin:-2px 0 8px">저장하면 달력과 오늘 탭에 나옵니다. 체크하면 그 범위가 "푼 범위"에 자동으로 들어갑니다.</p>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

// 문제집 자료 링크 (PDF·스캔본을 드라이브에 올려 두고 주소를 붙입니다)
function bookLinkForm(ui, b) {
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>자료 이름<input type="text" data-k="title" value="${esc(val(ui, 'title', ''))}" placeholder="예: 해설지 PDF"></label>
      <label>주소<input type="url" data-k="url" value="${esc(val(ui, 'url', ''))}" placeholder="https://drive.google.com/…"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

function bookCard(data, ui, b, index, count) {
  const key = `book:${b.id}`;
  if (ui.form && ui.form.type === 'book' && ui.form.id === b.id) return bookForm(ui, b, b.subject);
  if (ui.pendingDelete === key) return confirmRow(`"${b.title}" 문제집을 정말 삭제할까요? 연결된 계획 일정도 같이 지워집니다.`, key);

  const unit = b.unit || '쪽';
  const st = bookStats(b);
  const raw = Array.isArray(b.ranges) ? b.ranges : [];
  const links = Array.isArray(b.links) ? b.links : [];

  const addingRange = ui.form && ui.form.type === 'range' && ui.form.book === b.id;
  const addingPlan = ui.form && ui.form.type === 'plan' && ui.form.book === b.id && !ui.form.id;
  const addingLink = ui.form && ui.form.type === 'booklink' && ui.form.book === b.id;

  /* 푼 범위 목록 (적은 그대로, 지울 수 있게) */
  const rangeRows = raw.map((r, i) => {
    const rk = `range:${b.id}:${i}`;
    if (ui.pendingDelete === rk) return `<li class="block">${confirmRow(`${rangeText(r, unit)} 기록을 지울까요?`, rk)}</li>`;
    return `<li>
      <span class="rg-main">${esc(rangeText(r, unit))}</span>
      <span class="rg-sub">${rangeLength(r)}${esc(unit)}${r.date ? ` · ${esc(shortDate(r.date))}` : ''}</span>
      <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(rk)}" aria-label="삭제" title="삭제">🗑</button>
    </li>`;
  }).join('');

  /* 계획 = 이 문제집에 연결된 일정 */
  const plans = Object.entries(data.events)
    .map(([eid, ev]) => ({ id: eid, ...ev }))
    .filter((ev) => ev.book === b.id)
    .sort((a, b2) => String(a.date).localeCompare(String(b2.date)));

  const planRows = plans.map((ev) => {
    const ek = `ev:${ev.id}`;
    if (ui.form && ui.form.type === 'plan' && ui.form.id === ev.id) return planForm(data, ui, b, ev, st);
    if (ui.pendingDelete === ek) return confirmRow(`"${ev.title}" 계획을 정말 삭제할까요?`, ek);
    const t = typeOf(data, ev.type);
    return `<div class="item${ev.done ? ' is-done' : ''}" style="border-left-color:${t.color}">
      <button type="button" class="check" data-act="ev-toggle" data-id="${esc(ev.id)}"
        aria-pressed="${ev.done ? 'true' : 'false'}" aria-label="완료 표시">${ev.done ? '✓' : ''}</button>
      <div class="item-main">
        <div class="item-title">${esc(rangeText({ from: ev.from, to: ev.to }, unit))} <span class="muted">(${rangeLength({ from: ev.from, to: ev.to })}${esc(unit)})</span></div>
        <div class="item-meta">${typeBadge(t)}${ddayBadge(ev.date, ui.today)}<span>${esc(shortDate(ev.date))}까지</span></div>
      </div>
      <div class="item-acts">
        <button type="button" class="btn icon" data-act="form-open" data-type="plan" data-id="${esc(ev.id)}" data-book="${esc(b.id)}" aria-label="수정" title="수정">✏️</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(ek)}" aria-label="삭제" title="삭제">🗑</button>
      </div>
    </div>`;
  }).join('');

  const linkChips = links.map((l, i) => {
    const lk = `booklink:${b.id}:${i}`;
    if (ui.pendingDelete === lk) return confirmRow(`"${l.title}" 자료를 지울까요?`, lk);
    return `<span class="file-chip">
      <a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">📄 ${esc(l.title)}</a>
      <button type="button" class="chip-x" data-act="del-ask" data-key="${esc(lk)}" aria-label="삭제" title="삭제">✕</button>
    </span>`;
  }).join('');

  return `<div class="book${st.full ? ' is-full' : ''}">
    <div class="book-head">
      <div class="book-main">
        <div class="book-title">${esc(b.title)}</div>
        <div class="book-sub">${b.publisher ? `${esc(b.publisher)} · ` : ''}${st.total > 0 ? `${st.start}~${st.end}${esc(unit)}` : '전체 분량 미정'}</div>
      </div>
      <span class="item-acts">
        <button type="button" class="btn icon" data-act="book-move" data-id="${esc(b.id)}" data-dir="-1" aria-label="위로" title="위로"${index === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn icon" data-act="book-move" data-id="${esc(b.id)}" data-dir="1" aria-label="아래로" title="아래로"${index === count - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn icon" data-act="form-open" data-type="book" data-id="${esc(b.id)}" aria-label="수정" title="수정">✏️</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </div>

    ${progressBar(st.done, st.total)}

    <div class="book-row">
      <span class="book-pct">${st.percent}%</span>
      <span class="book-of">${st.done} / ${st.total || '—'}${esc(unit)}${st.total ? ` · 남은 ${st.left}${esc(unit)}` : ''}</span>
    </div>

    ${st.full ? '<div class="book-full">다 풀었습니다 🎉</div>' : ''}

    <div class="book-sec">
      <div class="book-sec-head">
        <h4>푼 범위<span class="count">${raw.length}건</span></h4>
        ${addingRange ? '' : `<button type="button" class="btn tiny" data-act="form-open" data-type="range" data-book="${esc(b.id)}">+ 범위 추가</button>`}
      </div>
      ${addingRange ? rangeForm(ui, b, st) : ''}
      ${raw.length ? `<ul class="range-list">${rangeRows}</ul>` : '<p class="empty tiny">아직 기록이 없습니다.</p>'}
      ${raw.length > 1 ? '<p class="muted tiny">겹치는 부분은 한 번만 셉니다.</p>' : ''}
    </div>

    <div class="book-sec">
      <div class="book-sec-head">
        <h4>계획<span class="count">${plans.filter((p) => !p.done).length}개 남음</span></h4>
        ${addingPlan ? '' : `<button type="button" class="btn tiny" data-act="form-open" data-type="plan" data-book="${esc(b.id)}">+ 계획 추가</button>`}
      </div>
      ${addingPlan ? planForm(data, ui, b, null, st) : ''}
      ${plans.length ? planRows : '<p class="empty tiny">세운 계획이 없습니다. 추가하면 달력에도 나옵니다.</p>'}
    </div>

    <div class="book-sec">
      <div class="book-sec-head">
        <h4>자료<span class="count">${links.length}개</span></h4>
        ${addingLink ? '' : `<button type="button" class="btn tiny" data-act="form-open" data-type="booklink" data-book="${esc(b.id)}">+ 자료 링크</button>`}
      </div>
      ${addingLink ? bookLinkForm(ui, b) : ''}
      ${links.length ? `<div class="file-chips">${linkChips}</div>` : '<p class="empty tiny">PDF·스캔본을 드라이브에 올리고 주소를 붙여 두세요.</p>'}
    </div>

    ${b.note ? `<div class="item-note">${esc(b.note)}</div>` : ''}
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

  // 일정과 할 일을 같은 날짜 칸에 모아서 보여 준다
  const byDate = {};
  Object.entries(data.events).forEach(([id, ev]) => {
    if (!ev || !ev.date) return;
    (byDate[ev.date] = byDate[ev.date] || []).push({ kind: 'event', id, ...ev });
  });
  Object.entries(data.todos).forEach(([id, t]) => {
    if (!t || !t.date) return;
    (byDate[t.date] = byDate[t.date] || []).push({ kind: 'todo', id, ...t });
  });
  Object.values(byDate).forEach((l) => l.sort((a, b) => (
    (a.kind === b.kind ? 0 : (a.kind === 'event' ? -1 : 1))
    || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
  )));

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

    const chips = shown.map((it) => {
      const t = typeOf(data, it.kind === 'todo' ? 'todo' : it.type);
      const cls = `chip${it.done ? ' is-done' : ''}${it.kind === 'todo' ? ' is-task' : ''}`;
      return `<span class="${cls}" style="background:${t.color};color:${textOn(t.color)}">${esc(it.title)}</span>`;
    }).join('');

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

  const legend = byOrder(data.types).map((t) => (
    `<span><i style="background:${normHex(t.color)}"></i>${esc(t.label)}</span>`
  )).join('');

  const sel = ui.selDate;
  const dayAll = byDate[sel] || [];
  const dayEvents = sortEvents(dayAll.filter((x) => x.kind === 'event'));
  const dayTodos = dayAll.filter((x) => x.kind === 'todo');
  const adding = ui.form && ui.form.type === 'event' && !ui.form.id;
  const addingDayTodo = ui.form && ui.form.type === 'todo' && !ui.form.id && !ui.form.subject;

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
      <h2 class="panel-title">${esc(midDate(sel))}<span class="count">일정 ${dayEvents.length} · 할 일 ${dayTodos.length}</span></h2>
      <div class="btn-row">
        ${adding ? '' : `<button type="button" class="btn primary" data-act="form-open" data-type="event" data-date="${esc(sel)}">+ 일정 추가</button>`}
        ${addingDayTodo ? '' : `<button type="button" class="btn" data-act="form-open" data-type="todo" data-date="${esc(sel)}">+ 할 일 추가</button>`}
      </div>
    </div>
    ${adding ? eventForm(data, ui, null, { date: ui.form.date }) : ''}
    ${eventList(data, ui, dayEvents, { showSubject: true, empty: '이 날은 일정이 없습니다.' })}

    ${(dayTodos.length || addingDayTodo) ? '<h3 class="subhead">할 일</h3>' : ''}
    ${addingDayTodo ? todoForm(data, ui, null, { date: ui.form.date || sel }) : ''}
    ${dayTodos.map((t) => todoItem(data, ui, t, { showSubject: true })).join('')}
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
    ${open.length ? open.map((t) => todoItem(data, ui, t, { showSubject: true })).join('') : '<p class="empty">할 일이 없습니다.</p>'}
    ${later.length ? `<h3 class="subhead">예정된 할 일</h3>${later.map((t) => todoItem(data, ui, t, { showSubject: true })).join('')}` : ''}
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
      return `<li class="block"><div class="form" style="margin:0">
        ${errLine(ui)}
        <div class="f-row"><label>내용<input type="text" data-k="line" value="${esc(val(ui, 'line', line))}"></label></div>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="form-save">저장</button>
          <button type="button" class="btn" data-act="form-cancel">취소</button>
        </div>
      </div></li>`;
    }
    if (ui.pendingDelete === key) return `<li class="block">${confirmRow('이 줄을 정말 삭제할까요?', key)}</li>`;
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

  /* --- 할 일 --- */
  const myTodos = Object.entries(data.todos)
    .map(([tid, t]) => ({ id: tid, ...t }))
    .filter((t) => t.subject === id);
  const openTodos = myTodos.filter((t) => !t.done)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const doneTodos = myTodos.filter((t) => t.done)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const addingTodo = ui.form && ui.form.type === 'todo' && !ui.form.id && ui.form.subject === id;

  /* --- 문제집 --- */
  const myBooks = byOrder(data.books).filter((b) => b.subject === id);
  const addingBook = ui.form && ui.form.type === 'book' && !ui.form.id && ui.form.subject === id;
  const sums = myBooks.map((b) => bookStats(b));
  const sumTotal = sums.reduce((n, s) => n + s.total, 0);
  const sumDone = sums.reduce((n, s) => n + s.done, 0);
  const booksCount = myBooks.length > 1 && sumTotal > 0
    ? `전체 ${sumDone} / ${sumTotal} (${pct(sumDone, sumTotal)}%)`
    : `${myBooks.length}권`;

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
      <h2 class="panel-title">할 일<span class="count">남은 것 ${openTodos.length}개</span></h2>
      ${addingTodo ? '' : `<button type="button" class="btn primary" data-act="form-open" data-type="todo" data-subject="${esc(id)}" data-lock="1">+ 할 일 추가</button>`}
    </div>
    ${addingTodo ? todoForm(data, ui, null, { subject: id, date: ui.today, lockSubject: true }) : ''}
    ${openTodos.length ? openTodos.map((t) => todoItem(data, ui, t, { lockSubject: true, showToday: true })).join('') : '<p class="empty">할 일이 없습니다.</p>'}
    ${doneTodos.length ? `<h3 class="subhead">끝낸 할 일</h3>${doneTodos.map((t) => todoItem(data, ui, t, { lockSubject: true })).join('')}` : ''}
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">문제집<span class="count">${esc(booksCount)}</span></h2>
      ${addingBook ? '' : `<button type="button" class="btn primary" data-act="form-open" data-type="book" data-subject="${esc(id)}">+ 문제집 추가</button>`}
    </div>
    ${addingBook ? bookForm(ui, null, id) : ''}
    ${myBooks.length
    ? myBooks.map((b, i) => bookCard(data, ui, b, i, myBooks.length)).join('')
    : '<p class="empty">등록한 문제집이 없습니다. 추가하면 진행률 바가 생깁니다.</p>'}
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
    ? `<div style="margin-top:8px">${confirmRow(`"${s.name}" 과목을 정말 삭제할까요? 연결된 일정·할 일·문제집은 지워지지 않고 "과목 없음"으로 남습니다.`, `subject:${id}`)}</div>`
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

/* ===================== 메모 탭 ===================== */
// iOS 메모장처럼 — 첫 줄이 제목이 되고, 목록에는 제목·시각·미리보기가 보입니다.

export function noteTitle(body) {
  const line = String(body || '').split('\n').find((l) => l.trim());
  return line ? line.trim().slice(0, 60) : '새 메모';
}

function notePreview(body) {
  const lines = String(body || '').split('\n');
  const i = lines.findIndex((l) => l.trim());
  if (i < 0) return '추가 텍스트 없음';
  const rest = lines.slice(i + 1).join(' ').replace(/\s+/g, ' ').trim();
  return rest ? rest.slice(0, 90) : '추가 텍스트 없음';
}

function noteStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (toKey(d) === todayKey()) {
    const h = d.getHours();
    return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function liveNotes(data) {
  return Object.entries(data.notes || {})
    .map(([id, n]) => ({ id, ...n }))
    .filter((n) => !n.deletedAt);
}

function trashNotes(data) {
  return Object.entries(data.notes || {})
    .map(([id, n]) => ({ id, ...n }))
    .filter((n) => n.deletedAt);
}

function folderNameOf(data, id) {
  const f = (data.folders || {})[id];
  return f ? f.name : '';
}

function allTags(data) {
  const counts = new Map();
  liveNotes(data).forEach((n) => {
    extractTags(n.body).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
}

function currentFilter(ui) {
  return ui.noteFilter && ui.noteFilter.kind ? ui.noteFilter : { kind: 'all', value: '' };
}

function filteredNotes(data, ui) {
  const f = currentFilter(ui);
  let list = f.kind === 'trash' ? trashNotes(data) : liveNotes(data);
  if (f.kind === 'folder') list = list.filter((n) => (n.folder || '') === f.value);
  if (f.kind === 'tag') list = list.filter((n) => extractTags(n.body).includes(f.value));
  const q = (ui.noteQuery || '').trim().toLowerCase();
  if (q) list = list.filter((n) => String(n.body || '').toLowerCase().includes(q));
  return list.sort((a, b) => (
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  ));
}

function filterTitle(data, ui) {
  const f = currentFilter(ui);
  if (f.kind === 'trash') return '최근 삭제된 항목';
  if (f.kind === 'tag') return `#${f.value}`;
  if (f.kind === 'folder') return folderNameOf(data, f.value) || '폴더 없음';
  return '모든 메모';
}

/* --- 왼쪽: 폴더 · 태그 --- */

function noteRail(data, ui) {
  const f = currentFilter(ui);
  const live = liveNotes(data);
  const folders = byOrder(data.folders);
  const noFolder = live.filter((n) => !n.folder).length;
  const trash = trashNotes(data).length;
  const tags = allTags(data);

  const row = (kind, value, icon, name, n, extra) => {
    const on = f.kind === kind && (kind !== 'folder' || f.value === value);
    return `<div class="rail-item">
      <button type="button" class="rail-row${on ? ' is-on' : ''}" data-act="note-filter" data-kind="${kind}" data-value="${esc(value)}">
        <span class="rail-ico">${icon}</span>
        <span class="rail-name">${esc(name)}</span>
        <span class="rail-n">${n}</span>
      </button>
      ${extra || ''}
    </div>`;
  };

  const folderRows = folders.map((fo) => row('folder', fo.id, '📁', fo.name,
    live.filter((n) => n.folder === fo.id).length,
    `<button type="button" class="btn icon" data-act="form-open" data-type="folder" data-id="${esc(fo.id)}" aria-label="폴더 수정" title="폴더 수정">✏️</button>`)).join('');

  return `<aside class="notes-rail">
    <h3 class="rail-head">폴더</h3>
    ${row('all', '', '🗒️', '모든 메모', live.length)}
    ${folderRows}
    ${noFolder && folders.length ? row('folder', '', '📁', '폴더 없음', noFolder) : ''}
    <button type="button" class="rail-add" data-act="form-open" data-type="folder">＋ 폴더 추가</button>
    ${row('trash', '', '🗑', '최근 삭제된 항목', trash)}

    <h3 class="rail-head">태그</h3>
    ${tags.length
    ? `<div class="tag-chips">${tags.map(([t, n]) => `
        <button type="button" class="tag-chip${f.kind === 'tag' && f.value === t ? ' is-on' : ''}" data-act="note-filter" data-kind="tag" data-value="${esc(t)}">#${esc(t)} <span class="rail-n">${n}</span></button>`).join('')}</div>`
    : '<p class="muted tiny">메모 안에 <code>#숙제</code> 처럼 쓰면 태그가 생깁니다.</p>'}
  </aside>`;
}

/* --- 가운데: 목록 --- */

function noteRow(data, ui, n) {
  const f = currentFilter(ui);
  const tags = extractTags(n.body).slice(0, 3);
  const fname = folderNameOf(data, n.folder);
  return `<div class="note-item${ui.noteId === n.id ? ' is-sel' : ''}">
    <button type="button" class="note-row" data-act="note-open" data-id="${esc(n.id)}">
      <span class="note-title">${n.pinned ? '<span class="note-pin-mark" aria-label="고정됨">📌</span> ' : ''}${esc(noteTitle(n.body))}</span>
      <span class="note-meta">
        <span class="note-when">${esc(noteStamp(n.deletedAt || n.updatedAt))}</span>
        <span class="note-prev">${esc(notePreview(n.body))}</span>
      </span>
      <span class="note-tagline">
        ${f.kind === 'trash' ? '<span class="note-folder">🗑 삭제됨</span>' : `<span class="note-folder">📁 ${esc(fname || '메모')}</span>`}
        ${tags.map((t) => `<span class="note-tag">#${esc(t)}</span>`).join('')}
      </span>
    </button>
  </div>`;
}

function noteListPane(data, ui) {
  const f = currentFilter(ui);
  const list = filteredNotes(data, ui);
  const editingFolder = ui.form && ui.form.type === 'folder';

  let body;
  if (editingFolder) body = '';
  if (!list.length) {
    const q = (ui.noteQuery || '').trim();
    if (q) body = `<p class="empty">"${esc(q)}" 와(과) 맞는 메모가 없습니다.</p>`;
    else if (f.kind === 'trash') body = '<p class="empty">삭제된 메모가 없습니다.</p>';
    else body = '<p class="empty">메모가 없습니다. ✏️ 로 하나 만들어 보세요.</p>';
  } else {
    body = list.map((n) => noteRow(data, ui, n)).join('');
  }

  return `<div class="notes-list">
    <div class="notes-list-head">
      <h3 class="notes-list-title">${esc(filterTitle(data, ui))}</h3>
      <div class="btn-row">
        ${f.kind === 'trash'
    ? (trashNotes(data).length ? '<button type="button" class="btn tiny danger" data-act="del-ask" data-key="trash-empty">비우기</button>' : '')
    : '<button type="button" class="btn primary tiny" data-act="note-new">✏️ 새 메모</button>'}
      </div>
    </div>
    <input type="search" class="note-search" data-note-q value="${esc(ui.noteQuery || '')}" placeholder="검색" aria-label="메모 검색">
    ${ui.pendingDelete === 'trash-empty' ? confirmRow('삭제된 메모를 모두 완전히 지울까요? 되돌릴 수 없습니다.', 'trash-empty', '비우기') : ''}
    ${String(ui.pendingDelete || '').startsWith('folder:')
    ? confirmRow(`"${folderNameOf(data, String(ui.pendingDelete).slice(7))}" 폴더를 삭제할까요? 안에 있던 메모는 지워지지 않고 폴더에서만 빠집니다.`, ui.pendingDelete)
    : ''}
    ${editingFolder ? folderForm(data, ui) : ''}
    ${body}
    <p class="notes-count">${list.length}개의 메모</p>
  </div>`;
}

function folderForm(data, ui) {
  const fo = ui.form.id ? (data.folders || {})[ui.form.id] : null;
  const key = `folder:${ui.form.id}`;
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>폴더 이름<input type="text" data-k="name" value="${esc(val(ui, 'name', fo ? fo.name : ''))}" placeholder="예: 수행평가"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
      ${fo ? `<button type="button" class="btn danger" data-act="del-ask" data-key="${esc(key)}">폴더 삭제</button>` : ''}
    </div>
  </div>`;
}

/* --- 오른쪽: 본문 --- */

function noteEditorPane(data, ui) {
  const all = Object.entries(data.notes || {}).map(([id, n]) => ({ id, ...n }));
  const n = ui.noteId && all.find((x) => x.id === ui.noteId);
  if (!n) {
    return `<div class="notes-editor">
      <p class="empty note-blank">메모를 고르거나 ✏️ 로 새로 만드세요.</p>
    </div>`;
  }

  const key = `note:${n.id}`;
  const state = ui.memoState[key] || '';
  const folders = byOrder(data.folders);

  if (n.deletedAt) {
    return `<div class="notes-editor">
      <div class="notes-editor-head">
        <button type="button" class="btn tiny only-narrow" data-act="note-back">‹ 목록</button>
        <span class="muted tiny">${esc(noteStamp(n.deletedAt))} 삭제됨</span>
        <span class="btn-row">
          <button type="button" class="btn tiny" data-act="note-restore" data-id="${esc(n.id)}">복원</button>
          <button type="button" class="btn tiny danger" data-act="del-ask" data-key="${esc(key)}">완전 삭제</button>
        </span>
      </div>
      ${ui.pendingDelete === key ? confirmRow('이 메모를 완전히 지울까요? 되돌릴 수 없습니다.', key) : ''}
      <textarea class="note-editor" readonly>${esc(n.body || '')}</textarea>
      <p class="muted tiny" style="margin:6px 0 0">삭제된 메모는 고칠 수 없습니다. 복원하면 다시 쓸 수 있습니다.</p>
    </div>`;
  }

  return `<div class="notes-editor">
    <div class="notes-editor-head">
      <button type="button" class="btn tiny only-narrow" data-act="note-back">‹ 목록</button>
      <span class="save-state ${state === '저장됨' ? 'ok' : (state && state !== '저장 중…' ? 'err' : '')}">${esc(state)}</span>
      <span class="btn-row">
        <select class="note-folder-sel" data-note-folder="${esc(n.id)}" aria-label="폴더 옮기기">
          <option value=""${!n.folder ? ' selected' : ''}>📁 폴더 없음</option>
          ${folders.map((fo) => `<option value="${esc(fo.id)}"${n.folder === fo.id ? ' selected' : ''}>📁 ${esc(fo.name)}</option>`).join('')}
        </select>
        <button type="button" class="btn icon" data-act="note-pin" data-id="${esc(n.id)}" aria-label="${n.pinned ? '고정 해제' : '위에 고정'}" title="${n.pinned ? '고정 해제' : '위에 고정'}">${n.pinned ? '📌' : '📍'}</button>
        <button type="button" class="btn icon danger" data-act="note-trash" data-id="${esc(n.id)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </div>
    <p class="note-stamp">${esc(noteStamp(n.updatedAt))}</p>
    <textarea class="note-editor" data-note="${esc(n.id)}" placeholder="첫 줄이 제목이 됩니다. #태그 도 쓸 수 있습니다.">${esc(val(ui, `note:${n.id}`, n.body || ''))}</textarea>
    <p class="muted tiny" style="margin:6px 0 0">입력을 멈추면 자동 저장됩니다. 비워 두고 나가면 메모가 사라집니다.</p>
  </div>`;
}

export function renderNotes(data, ui) {
  return `<section class="panel notes-panel">
    <div class="notes-grid${ui.noteId ? ' is-editing' : ''}">
      ${noteRail(data, ui)}
      ${noteListPane(data, ui)}
      ${noteEditorPane(data, ui)}
    </div>
  </section>`;
}

/* ===================== 설정 탭 ===================== */

function typeForm(ui, t) {
  return `<div class="form">
    ${errLine(ui)}
    <div class="f-row">
      <label>이름<input type="text" data-k="label" value="${esc(val(ui, 'label', t ? t.label : ''))}" placeholder="예: 발표"></label>
      <label class="narrow">색<input type="color" data-k="color" value="${esc(val(ui, 'color', t ? normHex(t.color) : '#2f5bd7'))}"></label>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="form-save">저장</button>
      <button type="button" class="btn" data-act="form-cancel">취소</button>
    </div>
  </div>`;
}

export function renderSettings(data, ui, store) {
  const st = (data.settings || {}).main || {};
  const subjects = byOrder(data.subjects);
  const types = byOrder(data.types);
  const addingSubject = ui.form && ui.form.type === 'subject-new';
  const addingType = ui.form && ui.form.type === 'type' && !ui.form.id;

  const usedCount = (typeId) => Object.values(data.events).filter((e) => e.type === typeId).length;

  const typeRows = types.map((t, i) => {
    const key = `type:${t.id}`;
    if (ui.form && ui.form.type === 'type' && ui.form.id === t.id) return typeForm(ui, t);
    const n = usedCount(t.id);
    if (ui.pendingDelete === key) {
      return confirmRow(
        `"${t.label}" 종류를 정말 삭제할까요?${n ? ` 이 종류를 쓰는 일정 ${n}개는 지워지지 않고 "기타"로 남습니다.` : ''}`,
        key,
      );
    }
    return `<div class="rowline">
      <i class="swatch" style="background:${normHex(t.color)}"></i>
      <span class="r-name">${esc(t.label)}</span>
      <span class="muted" style="flex:0 0 auto">${n}개</span>
      <span class="item-acts">
        <button type="button" class="btn icon" data-act="type-move" data-id="${esc(t.id)}" data-dir="-1" aria-label="위로" title="위로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn icon" data-act="type-move" data-id="${esc(t.id)}" data-dir="1" aria-label="아래로" title="아래로"${i === types.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn icon" data-act="form-open" data-type="type" data-id="${esc(t.id)}" aria-label="수정" title="수정">✏️</button>
        <button type="button" class="btn icon danger" data-act="del-ask" data-key="${esc(key)}" aria-label="삭제" title="삭제">🗑</button>
      </span>
    </div>`;
  }).join('');

  const subjectRows = subjects.map((s, i) => {
    const key = `subject:${s.id}`;
    if (ui.pendingDelete === key) {
      return confirmRow(`"${s.name}" 과목을 정말 삭제할까요? 연결된 일정·할 일·문제집은 "과목 없음"으로 남습니다.`, key);
    }
    return `<div class="rowline">
      <span class="r-name">${esc(s.name)}</span>
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
      <h2 class="panel-title">일정 종류<span class="count">${types.length}개</span></h2>
      ${addingType ? '' : '<button type="button" class="btn primary" data-act="form-open" data-type="type">+ 종류 추가</button>'}
    </div>
    ${addingType ? typeForm(ui, null) : ''}
    ${types.length ? typeRows : '<p class="empty">종류가 없습니다.</p>'}
    <p class="muted" style="margin:8px 0 0">일정을 추가할 때 종류 칸에서 "＋ 직접 입력"을 골라도 새 종류가 만들어집니다.</p>
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
    <p class="muted" style="margin:8px 0 0">내보낸 파일 하나에 일정·할 일·과목·문제집·종류·바로가기·설정이 모두 들어 있습니다.</p>
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
