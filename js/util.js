// 날짜·색·문자열 공용 도구

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

/* ===================== 일정 종류 ===================== */
// 종류는 types 컬렉션에 들어 있고 사이트 안에서 추가·수정할 수 있습니다.
// 아래는 처음 한 번 넣어 주는 기본값입니다.

export const DEFAULT_TYPES = [
  ['perf', '수행평가', '#2f6fd0'],
  ['read', '독서 수행', '#7c4dbd'],
  ['exam', '시험', '#d8384a'],
  ['school', '학사일정', '#2e9e62'],
  ['todo', '할 일', '#bd7a14'],
];

const FALLBACK = { label: '기타', color: '#7b8595' };

// 삭제된 종류를 가진 일정도 "기타"로 안전하게 보여 줍니다.
export function typeOf(data, id) {
  const t = ((data && data.types) || {})[id];
  if (t) return { id, label: t.label || FALLBACK.label, color: normHex(t.color, FALLBACK.color) };
  return { id: id || '', label: FALLBACK.label, color: FALLBACK.color };
}

/* ===================== 색 ===================== */

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '7b8595';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function normHex(value, fallback) {
  const h = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
  }
  return fallback || FALLBACK.color;
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// 그 색 위에 올릴 글자색 (밝으면 검정, 어두우면 흰색)
// 0.18 은 검정과 흰색의 대비가 뒤집히는 지점이라, 주황·초록처럼
// 중간 밝기 색에서도 읽히는 쪽이 골라집니다.
export function textOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return lum > 0.18 ? '#14161b' : '#ffffff';
}

// 다크 모드에서 글자색으로 쓰려고 밝게 만든 색
export function lighten(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const up = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${up(r)}, ${up(g)}, ${up(b)})`;
}

/* ===================== 진행률 ===================== */

export function pct(done, total) {
  const d = Number(done) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((d / t) * 100)));
}

export function clampCount(value, total) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const t = Number(total) || 0;
  return t > 0 ? Math.min(n, t) : n;
}

/* ===================== 기타 ===================== */

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
