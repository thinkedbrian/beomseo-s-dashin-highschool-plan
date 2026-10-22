// 날짜·문자열 공용 도구

export const pad = (n) => String(n).padStart(2, '0');

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  return toKey(new Date());
}

export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key || ''));
}

export function weekdayKo(key) {
  return WD[parseKey(key).getDay()];
}

export function longDate(key) {
  const d = parseKey(key);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`;
}

export function midDate(key) {
  const d = parseKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

export function shortDate(key) {
  const d = parseKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysBetween(fromKey, toKeyStr) {
  const a = parseKey(fromKey);
  const b = parseKey(toKeyStr);
  return Math.round((b - a) / 86400000);
}

// 오늘 / 내일 / D-n / n일 전
export function dday(key, base) {
  const n = daysBetween(base || todayKey(), key);
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  if (n > 1) return `D-${n}`;
  return `${-n}일 전`;
}

export const TYPES = {
  perf: { label: '수행평가', color: 'var(--perf)' },
  read: { label: '독서 수행', color: 'var(--read)' },
  exam: { label: '시험', color: 'var(--exam)' },
  school: { label: '학사일정', color: 'var(--school)' },
  todo: { label: '할 일', color: 'var(--todo)' },
};

export const TYPE_KEYS = ['perf', 'read', 'exam', 'school', 'todo'];

export function typeLabel(t) {
  return (TYPES[t] || {}).label || '기타';
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// javascript: 같은 주소를 막고, 스킴이 없으면 https 를 붙인다
export function safeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  return `https://${s}`;
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// { id: {order, ...} } 를 order 순 배열로
export function byOrder(map) {
  return Object.entries(map || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.id).localeCompare(String(b.id)));
}

// 일정 목록: 날짜 → 제목 순
export function sortEvents(list) {
  return list.slice().sort((a, b) => (
    String(a.date).localeCompare(String(b.date))
    || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
  ));
}
