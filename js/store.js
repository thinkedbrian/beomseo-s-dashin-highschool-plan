// 저장 어댑터
//  - firebase-config.js 가 비어 있으면: localStorage (로컬 모드)
//  - 채워져 있으면: Google 로그인 + Firestore 실시간 구독 (동기화 모드)
// 바깥에서 쓰는 API 는 두 모드에서 똑같습니다.

import { SEED } from './seed.js';
import { firebaseConfig, OWNER_UID } from './firebase-config.js';
import { newId, DEFAULT_TYPES } from './util.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LS_KEY = 'pjs-planner-v1';

export const COLLS = ['events', 'todos', 'subjects', 'links', 'settings', 'types', 'books', 'notes', 'folders'];

const listeners = new Set();
let fb = null;      // { auth, db, A, F }
let unsubs = [];
let pendingFirst = 0;
let seeding = false;

function blank() {
  const out = {};
  COLLS.forEach((c) => { out[c] = {}; });
  return out;
}

export const store = {
  mode: 'local',          // 'local' | 'cloud'
  status: 'local',        // local | connecting | online | offline | signin | blocked
  statusText: '로컬 저장',
  user: null,
  lastError: '',
  data: blank(),
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error(e); }
  });
}

function setStatus(status, text) {
  store.status = status;
  store.statusText = text;
}

function configured() {
  const c = firebaseConfig || {};
  return Boolean(c.apiKey && c.projectId && c.appId && !/^(여기에|YOUR)/i.test(c.apiKey));
}

/* ---------- 로컬 모드 ---------- */

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { store.data = blank(); return; }
    const parsed = JSON.parse(raw);
    const next = blank();
    COLLS.forEach((c) => {
      if (parsed && parsed[c] && typeof parsed[c] === 'object') next[c] = parsed[c];
    });
    store.data = next;
  } catch (e) {
    store.data = blank();
    store.lastError = '저장된 데이터를 읽지 못했습니다.';
  }
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(store.data));
}

/* ---------- 초기화 ---------- */

export async function init() {
  if (!configured()) {
    store.mode = 'local';
    setStatus('local', '이 기기에만 저장');
    loadLocal();
    await prepare();
    // 같은 브라우저의 다른 창/탭에서 고친 내용도 바로 반영
    window.addEventListener('storage', (e) => {
      if (e.key !== LS_KEY) return;
      loadLocal();
      emit();
    });
    emit();
    return;
  }

  store.mode = 'cloud';
  setStatus('connecting', '연결 중…');
  emit();

  try {
    await initCloud();
  } catch (err) {
    console.error(err);
    store.mode = 'local';
    store.lastError = `Firebase 연결 실패: ${err.message || err}`;
    setStatus('local', '로컬 저장 (연결 실패)');
    loadLocal();
    await prepare();
    emit();
  }
}

async function initCloud() {
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);

  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = fsMod.getFirestore(app);
  fb = { auth, db, A: authMod, F: fsMod };

  authMod.onAuthStateChanged(auth, (user) => {
    detach();
    store.data = blank();

    if (!user) {
      store.user = null;
      setStatus('signin', '로그인 필요');
      emit();
      return;
    }

    store.user = { uid: user.uid, name: user.displayName || '', email: user.email || '' };

    if (OWNER_UID && user.uid !== OWNER_UID) {
      setStatus('blocked', '허용되지 않은 계정');
      store.lastError = '이 수첩은 소유자 계정만 쓸 수 있습니다.';
      emit();
      return;
    }

    setStatus('connecting', '연결 중…');
    emit();
    attach();
  });

  window.addEventListener('offline', () => {
    if (store.mode === 'cloud' && store.user) { setStatus('offline', '끊김'); emit(); }
  });
}

function attach() {
  const { F, db } = fb;
  const uid = store.user.uid;
  pendingFirst = COLLS.length;

  unsubs = COLLS.map((coll) => F.onSnapshot(
    F.collection(db, 'users', uid, coll),
    (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      store.data[coll] = map;
      setStatus('online', '연결됨');
      if (pendingFirst > 0) {
        pendingFirst -= 1;
        if (pendingFirst === 0) prepare().catch(console.error);
      }
      emit();
    },
    (err) => {
      console.error(err);
      store.lastError = err.code === 'permission-denied'
        ? '권한이 없습니다. Firestore 보안 규칙을 확인하세요.'
        : (err.message || String(err));
      setStatus('offline', err.code === 'permission-denied' ? '권한 없음' : '끊김');
      emit();
    },
  ));
}

function detach() {
  unsubs.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
  unsubs = [];
  pendingFirst = 0;
}

function totalDocs() {
  return COLLS.reduce((n, c) => n + Object.keys(store.data[c] || {}).length, 0);
}

async function seedIfEmpty() {
  if (seeding || totalDocs() > 0) return;
  seeding = true;
  try {
    await replaceAll(SEED);
  } finally {
    seeding = false;
  }
}

// 이미 쓰던 수첩에 나중에 생긴 컬렉션을 채워 준다.
// (전체가 비어 있을 때만 도는 seedIfEmpty 로는 안 들어가기 때문)
async function ensureDefaults() {
  if (seeding) return;
  if (Object.keys(store.data.types || {}).length > 0) return;
  const writes = DEFAULT_TYPES.map(([id, label, color], i) => (
    ['types', id, { order: i + 1, label, color }]
  ));
  try {
    await putMany(writes);
  } catch (err) {
    console.error('기본 종류를 넣지 못했습니다', err);
  }
}

// 문제집을 "푼 개수"에서 "푼 범위"로 한 번만 옮긴다.
// 예전 기록(done 45 / total 300)은 1~45 을 푼 것으로 본다.
async function migrateBooks() {
  const writes = [];
  Object.entries(store.data.books || {}).forEach(([id, b]) => {
    if (!b || b.startNo !== undefined) return;
    const total = Math.round(Number(b.total)) || 0;
    const done = Math.round(Number(b.done)) || 0;
    const next = { ...b };
    delete next.total;
    delete next.done;
    next.startNo = 1;
    next.endNo = total;
    next.ranges = (done > 0 && total > 0) ? [{ from: 1, to: Math.min(done, total), date: '' }] : [];
    next.links = Array.isArray(b.links) ? b.links : [];
    writes.push(['books', id, next]);
  });
  if (!writes.length) return;
  try {
    await putMany(writes);
  } catch (err) {
    console.error('문제집 기록을 옮기지 못했습니다', err);
  }
}

async function prepare() {
  await seedIfEmpty();
  await ensureDefaults();
  await migrateBooks();
}

/* ---------- 읽기 ---------- */

export function all(coll) {
  return store.data[coll] || {};
}

export function one(coll, id) {
  return (store.data[coll] || {})[id];
}

export function settings() {
  return (store.data.settings || {}).main || {};
}

export function isReady() {
  if (store.mode === 'local') return true;
  return store.status === 'online' || store.status === 'offline';
}

export function canEdit() {
  return store.mode === 'local' || (Boolean(store.user) && store.status !== 'blocked');
}

/* ---------- 쓰기 (낙관적 업데이트 + 실패 시 되돌리기) ---------- */

function docRef(coll, id) {
  return fb.F.doc(fb.db, 'users', store.user.uid, coll, id);
}

export async function put(coll, id, obj) {
  const prev = store.data[coll][id];
  store.data[coll][id] = obj;
  emit();
  try {
    if (store.mode === 'cloud') await fb.F.setDoc(docRef(coll, id), obj);
    else saveLocal();
  } catch (err) {
    if (prev === undefined) delete store.data[coll][id];
    else store.data[coll][id] = prev;
    emit();
    throw err;
  }
  return id;
}

export async function patch(coll, id, changes) {
  const cur = store.data[coll][id] || {};
  return put(coll, id, { ...cur, ...changes });
}

export async function add(coll, obj, prefix) {
  return put(coll, newId(prefix || coll), obj);
}

export async function remove(coll, id) {
  const prev = store.data[coll][id];
  if (prev === undefined) return;
  delete store.data[coll][id];
  emit();
  try {
    if (store.mode === 'cloud') await fb.F.deleteDoc(docRef(coll, id));
    else saveLocal();
  } catch (err) {
    store.data[coll][id] = prev;
    emit();
    throw err;
  }
}

// 여러 문서를 한 번에 (순서 변경처럼 2건 이상 바뀔 때)
export async function putMany(writes) {
  const prev = writes.map(([coll, id]) => [coll, id, store.data[coll][id]]);
  writes.forEach(([coll, id, obj]) => { store.data[coll][id] = obj; });
  emit();
  try {
    if (store.mode === 'cloud') {
      const batch = fb.F.writeBatch(fb.db);
      writes.forEach(([coll, id, obj]) => batch.set(docRef(coll, id), obj));
      await batch.commit();
    } else {
      saveLocal();
    }
  } catch (err) {
    prev.forEach(([coll, id, old]) => {
      if (old === undefined) delete store.data[coll][id];
      else store.data[coll][id] = old;
    });
    emit();
    throw err;
  }
}

/* ---------- 전체 교체 (초기 데이터 / 가져오기) ---------- */

export async function replaceAll(incoming) {
  const next = blank();
  COLLS.forEach((c) => {
    const src = incoming && incoming[c];
    if (src && typeof src === 'object') {
      Object.entries(src).forEach(([id, v]) => {
        if (v && typeof v === 'object') next[c][String(id)] = v;
      });
    }
  });

  const prev = store.data;
  store.data = next;
  emit();

  try {
    if (store.mode === 'cloud') {
      const { F, db } = fb;
      const uid = store.user.uid;
      let batch = F.writeBatch(db);
      let n = 0;
      const flush = async () => { await batch.commit(); batch = F.writeBatch(db); n = 0; };

      for (const coll of COLLS) {
        const olds = Object.keys(prev[coll] || {});
        for (const id of olds) {
          if (!next[coll][id]) {
            batch.delete(F.doc(db, 'users', uid, coll, id));
            if (++n >= 400) await flush();
          }
        }
        for (const [id, v] of Object.entries(next[coll])) {
          batch.set(F.doc(db, 'users', uid, coll, id), v);
          if (++n >= 400) await flush();
        }
      }
      if (n > 0) await batch.commit();
    } else {
      saveLocal();
    }
  } catch (err) {
    store.data = prev;
    emit();
    throw err;
  }
}

/* ---------- JSON 내보내기 / 가져오기 ---------- */

export function exportObject() {
  const out = { app: '2학기 일정 수첩', version: 1, exportedAt: new Date().toISOString() };
  COLLS.forEach((c) => { out[c] = store.data[c]; });
  return out;
}

export async function importObject(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('JSON 형식이 아닙니다.');
  const hasAny = COLLS.some((c) => obj[c] && typeof obj[c] === 'object');
  if (!hasAny) throw new Error('이 수첩의 백업 파일이 아닙니다.');
  await replaceAll(obj);
}

export async function resetToSeed() {
  await replaceAll(SEED);
}

/* ---------- 로그인 ---------- */

export async function signIn() {
  if (store.mode !== 'cloud') return;
  const provider = new fb.A.GoogleAuthProvider();
  await fb.A.signInWithPopup(fb.auth, provider);
}

export async function signOutNow() {
  if (store.mode !== 'cloud') return;
  await fb.A.signOut(fb.auth);
}
