// 앱 본체 — 상태, 라우팅, 이벤트 처리

import {
  todayKey, parseKey, longDate, isKey, debounce, byOrder, newId, esc,
  normHex, bookStats, rangeText,
} from './util.js';
import {
  store, subscribe, init, one, put, patch, add, remove, putMany,
  exportObject, importObject, resetToSeed, signIn, signOutNow, canEdit,
} from './store.js';
import {
  renderCalendar, renderToday, renderSubject, renderLinks, renderSettings,
  renderNotes, renderSummary, renderGate, NEW_TYPE,
} from './views.js';

const $ = (sel) => document.querySelector(sel);

const elTodayLine = $('#todayLine');
const elConn = $('#connBtn');
const elConnText = $('#connText');
const elSummary = $('#summary');
const elTabbar = $('#tabbar');
const elView = $('#view');
const elGate = $('#gate');
const elToast = $('#toast');
const elImport = $('#importFile');

const FIXED_BEFORE = [
  { id: 'calendar', label: '캘린더' },
  { id: 'today', label: '오늘' },
];
const FIXED_AFTER = [
  { id: 'links', label: '바로가기' },
  { id: 'notes', label: '메모' },
  { id: 'settings', label: '⚙ 설정' },
];

const today0 = todayKey();
const d0 = parseKey(today0);

const ui = {
  tab: 'calendar',
  today: today0,
  calY: d0.getFullYear(),
  calM: d0.getMonth(),
  selDate: today0,
  chipLimit: 3,
  form: null,
  draft: {},
  formError: '',
  pendingDelete: null,
  pendingImport: null,
  memoState: {},
  noteId: null,
  noteQuery: '',
  noteFilter: { kind: 'all', value: '' },
};

/* ===================== 토스트 ===================== */

let toastTimer = 0;

function toast(msg, isErr) {
  elToast.textContent = msg;
  elToast.className = isErr ? 'toast err' : 'toast';
  elToast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elToast.hidden = true; }, isErr ? 5000 : 1600);
}

function errMsg(e) {
  if (!e) return '알 수 없는 오류';
  if (e.code === 'permission-denied') return '권한이 없습니다 (보안 규칙 확인)';
  if (e.code === 'unavailable') return '네트워크가 끊겼습니다';
  if (e.code === 'auth/popup-blocked') return '팝업이 막혔습니다. 팝업을 허용해 주세요';
  if (e.code === 'auth/popup-closed-by-user') return '로그인 창이 닫혔습니다';
  if (e.code === 'auth/unauthorized-domain') return '이 주소가 Firebase 승인된 도메인에 없습니다';
  if (e.code === 'auth/operation-not-allowed') return 'Google 로그인이 꺼져 있습니다 (Authentication → Sign-in method)';
  if (e.code === 'auth/network-request-failed') return '네트워크 연결을 확인해 주세요';
  return e.message || String(e);
}

/* ===================== 탭 ===================== */

function tabs() {
  const subs = byOrder(store.data.subjects).map((s) => ({ id: s.id, label: s.name }));
  return [...FIXED_BEFORE, ...subs, ...FIXED_AFTER];
}

function validTab(id) {
  return tabs().some((t) => t.id === id) ? id : 'calendar';
}

function tabFromHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  return raw ? validTab(raw) : 'calendar';
}

function setTab(id) {
  const next = validTab(id);
  closeForm();
  ui.pendingDelete = null;
  if (next !== 'notes') closeNote();
  if (next === ui.tab && tabFromHash() === next) { render(); return; }
  ui.tab = next;
  const want = `#${next}`;
  if (location.hash !== want) location.hash = want;
  else render();
}

window.addEventListener('hashchange', () => {
  const next = tabFromHash();
  if (next !== ui.tab) { closeForm(); ui.pendingDelete = null; }
  if (next !== 'notes') closeNote();
  ui.tab = next;
  render();
  window.scrollTo({ top: 0 });
});

/* ===================== 폼 ===================== */

function openForm(ds) {
  ui.form = {
    type: ds.type,
    id: ds.id || null,
    date: ds.date || null,
    subject: ds.subject === undefined ? null : ds.subject,
    index: ds.index === undefined ? null : Number(ds.index),
    book: ds.book || null,
    lockSubject: ds.lock === '1',
  };
  ui.draft = {};
  ui.formError = '';
  ui.pendingDelete = null;
  render();
  const first = elView.querySelector('.form [data-k]:not([type="hidden"])');
  if (first) first.focus();
}

function closeForm() {
  ui.form = null;
  ui.draft = {};
  ui.formError = '';
}

function readForm() {
  const out = {};
  elView.querySelectorAll('.form [data-k]').forEach((el) => { out[el.dataset.k] = el.value; });
  return out;
}

function formFail(msg, values) {
  ui.draft = { ...ui.draft, ...(values || {}) };
  ui.formError = msg;
  render();
}

function nextOrder(coll) {
  const list = byOrder(store.data[coll]);
  return list.length ? (Number(list[list.length - 1].order) || list.length) + 1 : 1;
}

// 일정 폼에서 "직접 입력"으로 고른 새 종류를 만든다
async function createType(label, color) {
  const id = newId('type');
  await put('types', id, {
    order: nextOrder('types'),
    label,
    color: normHex(color, '#2f5bd7'),
  });
  return id;
}

async function saveForm() {
  if (!ui.form) return;
  if (!canEdit()) { toast('로그인한 뒤에 고칠 수 있습니다.', true); return; }

  const f = readForm();
  const type = ui.form.type;

  try {
    if (type === 'event') {
      const title = (f.title || '').trim();
      if (!title) return formFail('제목을 적어 주세요.', f);
      if (!isKey(f.date)) return formFail('날짜를 골라 주세요.', f);

      let typeId = f.type || 'perf';
      if (typeId === NEW_TYPE) {
        const label = (f.newTypeLabel || '').trim();
        if (!label) return formFail('새 종류의 이름을 적어 주세요.', f);
        typeId = await createType(label, f.newTypeColor);
      }

      const base = ui.form.id ? one('events', ui.form.id) : null;
      const obj = {
        date: f.date,
        type: typeId,
        title,
        note: (f.note || '').trim(),
        subject: f.subject || '',
        done: base ? Boolean(base.done) : false,
      };
      if (ui.form.id) await patch('events', ui.form.id, obj);
      else await add('events', obj, 'ev');
      ui.selDate = obj.date;
    } else if (type === 'todo') {
      const title = (f.title || '').trim();
      if (!title) return formFail('할 일을 적어 주세요.', f);
      if (!isKey(f.date)) return formFail('날짜를 골라 주세요.', f);
      const base = ui.form.id ? one('todos', ui.form.id) : null;
      const obj = {
        date: f.date,
        title,
        subject: f.subject || '',
        done: base ? Boolean(base.done) : false,
        createdAt: base && base.createdAt ? base.createdAt : new Date().toISOString(),
      };
      if (ui.form.id) await patch('todos', ui.form.id, obj);
      else await add('todos', obj, 'todo');
      ui.selDate = obj.date;
    } else if (type === 'book') {
      const title = (f.title || '').trim();
      if (!title) return formFail('문제집 이름을 적어 주세요.', f);
      const startNo = Math.max(0, Math.round(Number(f.startNo) || 0));
      const endNo = Math.max(0, Math.round(Number(f.endNo) || 0));
      if (endNo < startNo) return formFail('끝 번호가 시작 번호보다 작습니다.', f);
      if (endNo <= 0) return formFail('끝 번호를 적어 주세요. (예: 320)', f);
      const base = ui.form.id ? one('books', ui.form.id) : null;
      const obj = {
        subject: f.subject || (base ? base.subject : ''),
        order: base ? base.order : nextOrder('books'),
        title,
        publisher: (f.publisher || '').trim(),
        unit: (f.unit || '').trim() || '쪽',
        startNo,
        endNo,
        ranges: base && Array.isArray(base.ranges) ? base.ranges : [],
        links: base && Array.isArray(base.links) ? base.links : [],
        note: (f.note || '').trim(),
      };
      if (ui.form.id) await patch('books', ui.form.id, obj);
      else await add('books', obj, 'book');
    } else if (type === 'range') {
      const b = one('books', ui.form.book);
      if (!b) return formFail('문제집을 찾을 수 없습니다.', f);
      const from = Math.round(Number(f.from));
      const to = Math.round(Number(f.to));
      if (!Number.isFinite(from) || !Number.isFinite(to)) return formFail('숫자를 적어 주세요.', f);
      if (to < from) return formFail('"어디까지"가 "어디부터"보다 작습니다.', f);
      const ranges = (Array.isArray(b.ranges) ? b.ranges : []).concat([{
        from, to, date: isKey(f.date) ? f.date : ui.today,
      }]);
      await patch('books', ui.form.book, { ranges });
    } else if (type === 'plan') {
      const b = one('books', ui.form.book);
      if (!b) return formFail('문제집을 찾을 수 없습니다.', f);
      if (!isKey(f.date)) return formFail('날짜를 골라 주세요.', f);
      const from = Math.round(Number(f.from));
      const to = Math.round(Number(f.to));
      if (!Number.isFinite(from) || !Number.isFinite(to)) return formFail('숫자를 적어 주세요.', f);
      if (to < from) return formFail('"어디까지"가 "어디부터"보다 작습니다.', f);

      let typeId = f.type || 'todo';
      if (typeId === NEW_TYPE) {
        const label = (f.newTypeLabel || '').trim();
        if (!label) return formFail('새 종류의 이름을 적어 주세요.', f);
        typeId = await createType(label, f.newTypeColor);
      }

      const base = ui.form.id ? one('events', ui.form.id) : null;
      const obj = {
        date: f.date,
        type: typeId,
        title: `${b.title} ${rangeText({ from, to }, b.unit || '쪽')}`,
        note: base ? (base.note || '') : '',
        subject: b.subject || '',
        done: base ? Boolean(base.done) : false,
        book: ui.form.book,
        from,
        to,
      };
      if (ui.form.id) await patch('events', ui.form.id, obj);
      else await add('events', obj, 'ev');
    } else if (type === 'booklink') {
      const b = one('books', ui.form.book);
      if (!b) return formFail('문제집을 찾을 수 없습니다.', f);
      const title = (f.title || '').trim();
      const url = (f.url || '').trim();
      if (!title) return formFail('자료 이름을 적어 주세요.', f);
      if (!url) return formFail('주소를 적어 주세요.', f);
      const links = (Array.isArray(b.links) ? b.links : []).concat([{ title, url }]);
      await patch('books', ui.form.book, { links });
    } else if (type === 'scope') {
      const line = (f.line || '').trim();
      if (!line) return formFail('내용을 적어 주세요.', f);
      const sid = ui.form.subject;
      const s = one('subjects', sid);
      if (!s) return formFail('과목을 찾을 수 없습니다.', f);
      const scope = Array.isArray(s.scope) ? s.scope.slice() : [];
      if (ui.form.index != null && ui.form.index >= 0) scope[ui.form.index] = line;
      else scope.push(line);
      await patch('subjects', sid, { scope });
    } else if (type === 'subject-name') {
      const name = (f.name || '').trim();
      if (!name) return formFail('과목 이름을 적어 주세요.', f);
      await patch('subjects', ui.form.id, { name });
    } else if (type === 'subject-new') {
      const name = (f.name || '').trim();
      if (!name) return formFail('과목 이름을 적어 주세요.', f);
      await put('subjects', newId('sub'), {
        order: nextOrder('subjects'), name, scope: [], memo: '',
      });
    } else if (type === 'type') {
      const label = (f.label || '').trim();
      if (!label) return formFail('종류 이름을 적어 주세요.', f);
      const color = normHex(f.color, '#2f5bd7');
      if (ui.form.id) await patch('types', ui.form.id, { label, color });
      else await put('types', newId('type'), { order: nextOrder('types'), label, color });
    } else if (type === 'folder') {
      const name = (f.name || '').trim();
      if (!name) return formFail('폴더 이름을 적어 주세요.', f);
      if (ui.form.id) await patch('folders', ui.form.id, { name });
      else await put('folders', newId('folder'), { order: nextOrder('folders'), name });
    } else if (type === 'link') {
      const title = (f.title || '').trim();
      const url = (f.url || '').trim();
      if (!title) return formFail('이름을 적어 주세요.', f);
      if (!url) return formFail('주소를 적어 주세요.', f);
      const base = ui.form.id ? one('links', ui.form.id) : null;
      const obj = { order: base ? base.order : nextOrder('links'), title, url };
      if (ui.form.id) await patch('links', ui.form.id, obj);
      else await add('links', obj, 'link');
    }
  } catch (e) {
    console.error(e);
    formFail(`저장 실패: ${errMsg(e)}`, f);
    toast(`저장 실패: ${errMsg(e)}`, true);
    return;
  }

  closeForm();
  render();
  toast('저장됨');
}

/* ===================== 삭제 / 되돌리기 ===================== */

async function runDelete(key) {
  const parts = String(key).split(':');
  const kind = parts[0];
  try {
    if (kind === 'ev') await remove('events', parts[1]);
    else if (kind === 'todo') await remove('todos', parts[1]);
    else if (kind === 'link') await remove('links', parts[1]);
    else if (kind === 'type') await remove('types', parts[1]);
    else if (kind === 'note') {
      await remove('notes', parts[1]);
      if (ui.noteId === parts[1]) ui.noteId = null;
    } else if (kind === 'folder') {
      // 폴더만 없애고 안에 있던 메모는 남긴다
      const inside = Object.entries(store.data.notes)
        .filter(([, n]) => n.folder === parts[1])
        .map(([nid, n]) => ['notes', nid, { ...n, folder: '' }]);
      if (inside.length) await putMany(inside);
      await remove('folders', parts[1]);
      closeForm();
      if (ui.noteFilter && ui.noteFilter.kind === 'folder' && ui.noteFilter.value === parts[1]) {
        ui.noteFilter = { kind: 'all', value: '' };
      }
    } else if (kind === 'trash-empty') {
      const ids = Object.entries(store.data.notes)
        .filter(([, n]) => n.deletedAt)
        .map(([nid]) => nid);
      for (const nid of ids) await remove('notes', nid);
      ui.noteId = null;
      toast(`${ids.length}개를 완전히 지웠습니다.`);
    }
    else if (kind === 'book') {
      // 이 문제집에 걸린 계획 일정도 같이 치운다
      const linked = Object.entries(store.data.events)
        .filter(([, ev]) => ev.book === parts[1])
        .map(([eid]) => eid);
      for (const eid of linked) await remove('events', eid);
      await remove('books', parts[1]);
    } else if (kind === 'range' || kind === 'booklink') {
      const field = kind === 'range' ? 'ranges' : 'links';
      const b = one('books', parts[1]);
      if (b) {
        const list = (Array.isArray(b[field]) ? b[field] : []).slice();
        list.splice(Number(parts[2]), 1);
        await patch('books', parts[1], { [field]: list });
      }
    }
    else if (kind === 'subject') {
      await remove('subjects', parts[1]);
      if (ui.tab === parts[1]) { ui.pendingDelete = null; setTab('calendar'); return; }
    } else if (kind === 'scope') {
      const sid = parts[1];
      const idx = Number(parts[2]);
      const s = one('subjects', sid);
      if (s) {
        const scope = (Array.isArray(s.scope) ? s.scope : []).slice();
        scope.splice(idx, 1);
        await patch('subjects', sid, { scope });
      }
    } else if (kind === 'reset') {
      await resetToSeed();
      toast('초기 데이터로 되돌렸습니다.');
    } else if (kind === 'import') {
      const file = ui.pendingImport;
      ui.pendingImport = null;
      await importObject(file.data);
      toast('가져왔습니다.');
    }
  } catch (e) {
    console.error(e);
    toast(`실패: ${errMsg(e)}`, true);
  }
  ui.pendingDelete = null;
  render();
}

/* ===================== 순서 바꾸기 ===================== */

async function moveOrdered(coll, id, dir) {
  const list = byOrder(store.data[coll]);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const reordered = list.slice();
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  const writes = reordered.map((item, idx) => {
    const { id: itemId, ...rest } = item;
    return [coll, itemId, { ...rest, order: idx + 1 }];
  });
  try {
    await putMany(writes);
  } catch (e) {
    toast(`순서 저장 실패: ${errMsg(e)}`, true);
  }
}

// 문제집은 같은 과목 안에서만 순서를 바꾼다
async function moveBook(id, dir) {
  const book = one('books', id);
  if (!book) return;
  const list = byOrder(store.data.books).filter((b) => b.subject === book.subject);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const reordered = list.slice();
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  const writes = reordered.map((item, idx) => {
    const { id: itemId, ...rest } = item;
    return ['books', itemId, { ...rest, order: idx + 1 }];
  });
  try {
    await putMany(writes);
  } catch (e) {
    toast(`순서 저장 실패: ${errMsg(e)}`, true);
  }
}

async function moveScope(sid, index, dir) {
  const s = one('subjects', sid);
  if (!s) return;
  const scope = (Array.isArray(s.scope) ? s.scope : []).slice();
  const j = index + dir;
  if (j < 0 || j >= scope.length) return;
  [scope[index], scope[j]] = [scope[j], scope[index]];
  try {
    await patch('subjects', sid, { scope });
  } catch (e) {
    toast(`순서 저장 실패: ${errMsg(e)}`, true);
  }
}

/* ===================== 체크 / 진행률 ===================== */

async function toggleDoc(coll, id) {
  const cur = one(coll, id);
  if (!cur) return;
  const done = !cur.done;
  const changes = { done };
  // 지난 할 일을 오늘 체크했다면 오늘 안에는 목록에 남겨 둔다 (잘못 눌러도 되돌릴 수 있게)
  if (coll === 'todos') changes.doneAt = done ? ui.today : '';
  try {
    await patch(coll, id, changes);
    // 문제집 계획을 체크하면 그 범위가 "푼 범위"에 들어간다 (풀면 다시 빠진다)
    if (coll === 'events' && cur.book) await syncPlanRange({ id, ...cur }, done);
  } catch (e) {
    toast(`저장 실패: ${errMsg(e)}`, true);
  }
}

async function syncPlanRange(ev, done) {
  const b = one('books', ev.book);
  if (!b) return;
  const list = Array.isArray(b.ranges) ? b.ranges : [];
  const ranges = done
    ? list.concat([{ from: ev.from, to: ev.to, date: ui.today, plan: ev.id }])
    : list.filter((r) => r.plan !== ev.id);
  if (done && list.some((r) => r.plan === ev.id)) return;
  await patch('books', ev.book, { ranges });
}

/* ===================== 백업 ===================== */

function doExport() {
  const blob = new Blob([JSON.stringify(exportObject(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `일정수첩-백업-${ui.today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('JSON 파일을 내려받았습니다.');
}

elImport.addEventListener('change', async () => {
  const file = elImport.files && elImport.files[0];
  elImport.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    ui.pendingImport = { name: file.name, data };
    ui.pendingDelete = null;
    setTab('settings');
  } catch (e) {
    toast(`파일을 읽지 못했습니다: ${errMsg(e)}`, true);
  }
});

/* ===================== 메모장 (notes) ===================== */

const noteSavers = new Map();

function noteSaver(id) {
  if (!noteSavers.has(id)) {
    noteSavers.set(id, debounce(async (value) => {
      if (!one('notes', id)) return; // 그새 지워졌으면 되살리지 않는다
      const key = `note:${id}`;
      ui.memoState[key] = '저장 중…';
      render();
      try {
        await patch('notes', id, { body: value, updatedAt: new Date().toISOString() });
        ui.memoState[key] = '저장됨';
        render();
        setTimeout(() => {
          if (ui.memoState[key] === '저장됨') { ui.memoState[key] = ''; render(); }
        }, 2000);
      } catch (e) {
        ui.memoState[key] = '저장 실패';
        render();
        toast(`메모 저장 실패: ${errMsg(e)}`, true);
      }
    }, 600));
  }
  return noteSavers.get(id);
}

// 편집기를 닫을 때 내용이 비어 있으면 메모를 남기지 않는다 (iOS 메모장과 같게)
async function closeNote() {
  const id = ui.noteId;
  ui.noteId = null;
  if (!id) return;
  delete ui.draft[`note:${id}`];
  delete ui.memoState[`note:${id}`];
  const n = one('notes', id);
  if (n && !String(n.body || '').trim()) {
    try { await remove('notes', id); } catch (e) { /* 그냥 둔다 */ }
  }
}

async function newNote() {
  if (!canEdit()) { toast('로그인한 뒤에 쓸 수 있습니다.', true); return; }
  const now = new Date().toISOString();
  const id = newId('note');
  // 폴더를 보고 있었다면 그 폴더 안에 만든다
  const f = ui.noteFilter || {};
  const folder = f.kind === 'folder' ? (f.value || '') : '';
  try {
    await put('notes', id, {
      body: '', createdAt: now, updatedAt: now, pinned: false, folder, deletedAt: '',
    });
    ui.noteId = id;
    ui.pendingDelete = null;
    ui.noteQuery = '';
    render();
    const ta = elView.querySelector('[data-note]');
    if (ta) ta.focus();
  } catch (e) {
    toast(`메모를 만들지 못했습니다: ${errMsg(e)}`, true);
  }
}

function openNote(id) {
  ui.noteId = id;
  ui.pendingDelete = null;
  render();
  const ta = elView.querySelector('[data-note]');
  if (ta) {
    ta.focus();
    const end = ta.value.length;
    try { ta.setSelectionRange(end, end); } catch (_) { /* noop */ }
  }
}

async function toggleNotePin(id) {
  const n = one('notes', id);
  if (!n) return;
  try {
    await patch('notes', id, { pinned: !n.pinned });
  } catch (e) {
    toast(`저장 실패: ${errMsg(e)}`, true);
  }
}

// 삭제는 바로 지우지 않고 "최근 삭제된 항목"으로 옮긴다
async function trashNote(id) {
  const n = one('notes', id);
  if (!n) return;
  try {
    await patch('notes', id, { deletedAt: new Date().toISOString(), pinned: false });
    if (ui.noteId === id) ui.noteId = null;
    render();
    toast('최근 삭제된 항목으로 옮겼습니다.');
  } catch (e) {
    toast(`삭제 실패: ${errMsg(e)}`, true);
  }
}

async function restoreNote(id) {
  try {
    await patch('notes', id, { deletedAt: '', updatedAt: new Date().toISOString() });
    toast('복원했습니다.');
  } catch (e) {
    toast(`복원 실패: ${errMsg(e)}`, true);
  }
}

async function setNoteFolder(id, folder) {
  try {
    await patch('notes', id, { folder: folder || '' });
    toast('옮겼습니다.');
  } catch (e) {
    toast(`저장 실패: ${errMsg(e)}`, true);
  }
}

function setNoteFilter(kind, value) {
  ui.noteFilter = { kind, value: value || '' };
  ui.noteId = null;
  ui.pendingDelete = null;
  closeForm();
  render();
}

/* ===================== 과목 메모 자동 저장 ===================== */

const memoSavers = new Map();

function memoSaver(id) {
  if (!memoSavers.has(id)) {
    memoSavers.set(id, debounce(async (value) => {
      ui.memoState[id] = '저장 중…';
      render();
      try {
        await patch('subjects', id, { memo: value });
        ui.memoState[id] = '저장됨';
        render();
        setTimeout(() => {
          if (ui.memoState[id] === '저장됨') { ui.memoState[id] = ''; render(); }
        }, 2500);
      } catch (e) {
        ui.memoState[id] = '저장 실패';
        render();
        toast(`메모 저장 실패: ${errMsg(e)}`, true);
      }
    }, 700));
  }
  return memoSavers.get(id);
}

/* ===================== 이벤트 위임 ===================== */

const handlers = {
  tab: (el) => setTab(el.dataset.tab),
  conn: () => setTab('settings'),
  'cal-prev': () => { shiftMonth(-1); },
  'cal-next': () => { shiftMonth(1); },
  'cal-today': () => {
    const d = parseKey(ui.today);
    ui.calY = d.getFullYear();
    ui.calM = d.getMonth();
    ui.selDate = ui.today;
    closeForm();
    render();
  },
  day: (el) => { ui.selDate = el.dataset.date; closeForm(); ui.pendingDelete = null; render(); },
  'form-open': (el) => openForm(el.dataset),
  'form-cancel': () => { closeForm(); render(); },
  'form-save': () => { saveForm(); },
  'del-ask': (el) => { ui.pendingDelete = el.dataset.key; closeForm(); render(); },
  'del-cancel': () => { ui.pendingDelete = null; ui.pendingImport = null; render(); },
  'del-ok': (el) => { runDelete(el.dataset.key); },
  'ev-toggle': (el) => { toggleDoc('events', el.dataset.id); },
  'todo-toggle': (el) => { toggleDoc('todos', el.dataset.id); },
  'scope-move': (el) => { moveScope(el.dataset.subject, Number(el.dataset.index), Number(el.dataset.dir)); },
  'subject-move': (el) => { moveOrdered('subjects', el.dataset.id, Number(el.dataset.dir)); },
  'link-move': (el) => { moveOrdered('links', el.dataset.id, Number(el.dataset.dir)); },
  'type-move': (el) => { moveOrdered('types', el.dataset.id, Number(el.dataset.dir)); },
  'book-move': (el) => { moveBook(el.dataset.id, Number(el.dataset.dir)); },
  'note-new': () => { newNote(); },
  'note-open': (el) => { openNote(el.dataset.id); },
  'note-back': () => { closeNote().then(render); },
  'note-pin': (el) => { toggleNotePin(el.dataset.id); },
  'note-trash': (el) => { trashNote(el.dataset.id); },
  'note-restore': (el) => { restoreNote(el.dataset.id); },
  'note-filter': (el) => { setNoteFilter(el.dataset.kind, el.dataset.value); },
  export: () => doExport(),
  import: () => elImport.click(),
  login: async () => {
    try { await signIn(); } catch (e) { toast(`로그인 실패: ${errMsg(e)}`, true); }
  },
  logout: async () => {
    try { await signOutNow(); } catch (e) { toast(`로그아웃 실패: ${errMsg(e)}`, true); }
  },
};

function shiftMonth(n) {
  const d = new Date(ui.calY, ui.calM + n, 1);
  ui.calY = d.getFullYear();
  ui.calM = d.getMonth();
  closeForm();
  render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = handlers[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el);
});

// 폼 입력값은 다른 기기의 변경으로 다시 그려도 사라지지 않게 보관
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.k) {
    ui.draft[el.dataset.k] = el.value;
  } else if (el.dataset && el.dataset.memo) {
    const id = el.dataset.memo;
    ui.draft[`memo:${id}`] = el.value;
    memoSaver(id)(el.value);
  } else if (el.dataset && el.dataset.note) {
    const id = el.dataset.note;
    ui.draft[`note:${id}`] = el.value;
    noteSaver(id)(el.value);
  } else if (el.dataset && el.dataset.noteQ !== undefined) {
    ui.noteQuery = el.value;
    render();
  }
});

document.addEventListener('blur', (e) => {
  const el = e.target;
  if (!el.dataset) return;
  if (el.dataset.memo) delete ui.draft[`memo:${el.dataset.memo}`];
  if (el.dataset.note) delete ui.draft[`note:${el.dataset.note}`];
}, true);

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (!el.dataset) return;

  // 종류를 "직접 입력"으로 바꾸면 이름·색 칸이 나타나야 한다
  if (el.dataset.k === 'type') {
    ui.draft.type = el.value;
    render();
    return;
  }

  // 메모를 다른 폴더로 옮기기
  if (el.dataset.noteFolder) {
    setNoteFolder(el.dataset.noteFolder, el.value);
    return;
  }

  if (el.dataset.set) {
    try {
      await patch('settings', 'main', { [el.dataset.set]: el.value });
      toast('저장됨');
    } catch (err) {
      toast(`저장 실패: ${errMsg(err)}`, true);
    }
  }
});

// 엔터로 저장 (한 줄 입력칸에서)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.form) { closeForm(); render(); return; }
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (!el.dataset) return;
  if (!el.dataset.k) return;
  if (el.tagName === 'TEXTAREA') return;
  e.preventDefault();
  saveForm();
});

// 달력 칸에 보여 줄 일정 개수 (컴퓨터 3개, 폰 2개)
const mq = window.matchMedia('(max-width: 600px)');
mq.addEventListener('change', render);
window.addEventListener('resize', debounce(render, 150));

/* ===================== 그리기 ===================== */

function snapshotFocus() {
  const el = document.activeElement;
  if (!el || !elView.contains(el)) return null;
  const d = el.dataset || {};
  let sel = null;
  if (d.k) sel = `.form [data-k="${d.k}"]`;
  else if (d.memo) sel = `[data-memo="${CSS.escape(d.memo)}"]`;
  else if (d.note) sel = `[data-note="${CSS.escape(d.note)}"]`;
  else if (d.noteQ !== undefined) sel = '[data-note-q]';
  else if (d.set) sel = `[data-set="${d.set}"]`;
  if (!sel) return null;
  let s = null;
  let en = null;
  try { s = el.selectionStart; en = el.selectionEnd; } catch (_) { /* date 등은 지원 안 함 */ }
  return { sel, s, en };
}

function restoreFocus(snap) {
  if (!snap) return;
  const el = elView.querySelector(snap.sel);
  if (!el) return;
  el.focus();
  if (snap.s != null) {
    try { el.setSelectionRange(snap.s, snap.en); } catch (_) { /* noop */ }
  }
}

function paintConn() {
  elConn.className = `conn is-${store.status}`;
  elConnText.textContent = store.statusText;
}

function render() {
  ui.today = todayKey();
  ui.chipLimit = mq.matches ? 2 : 3;
  elTodayLine.textContent = longDate(ui.today);
  paintConn();

  const gated = store.mode === 'cloud' && (store.status === 'signin' || store.status === 'blocked');
  if (gated) {
    elGate.hidden = false;
    elGate.innerHTML = renderGate(store);
    elSummary.innerHTML = '';
    elTabbar.innerHTML = '';
    elView.innerHTML = '';
    return;
  }
  elGate.hidden = true;
  elGate.innerHTML = '';

  const data = store.data;
  ui.tab = validTab(ui.tab);

  elSummary.innerHTML = renderSummary(data, ui);

  const list = tabs();
  elTabbar.innerHTML = list.map((t) => (
    `<button type="button" class="tab${t.id === 'settings' ? ' gear' : ''}" data-act="tab" data-tab="${esc(t.id)}" aria-current="${t.id === ui.tab ? 'true' : 'false'}">${esc(t.label)}</button>`
  )).join('');

  const snap = snapshotFocus();

  if (store.mode === 'cloud' && store.status === 'connecting') {
    elView.innerHTML = '<section class="panel"><p class="empty">불러오는 중…</p></section>';
  } else if (ui.tab === 'calendar') {
    elView.innerHTML = renderCalendar(data, ui);
  } else if (ui.tab === 'today') {
    elView.innerHTML = renderToday(data, ui);
  } else if (ui.tab === 'links') {
    elView.innerHTML = renderLinks(data, ui);
  } else if (ui.tab === 'notes') {
    elView.innerHTML = renderNotes(data, ui);
  } else if (ui.tab === 'settings') {
    elView.innerHTML = renderSettings(data, ui, store);
  } else {
    elView.innerHTML = renderSubject(data, ui, ui.tab);
  }

  restoreFocus(snap);

  const active = elTabbar.querySelector('[aria-current="true"]');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ===================== 시작 ===================== */

subscribe(render);
ui.tab = tabFromHash();
render();
init().then(() => {
  ui.tab = validTab(tabFromHash());
  render();
}).catch((e) => {
  toast(`시작 실패: ${errMsg(e)}`, true);
});

// 날짜가 바뀌면(자정) 자동으로 다시 그린다
setInterval(() => {
  if (todayKey() !== ui.today) render();
}, 60000);
