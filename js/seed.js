// 처음 실행할 때 한 번만 들어가는 초기 데이터

import { DEFAULT_TYPES } from './util.js';

const SUBJECTS = [
  ['kor', '국어', ['3, 4단원 + 10월 모의고사 독서 부분']],
  ['eng', '영어', [
    '① 교과서 p.69, p.97 : Understanding Deeply and Think Critically Listening Script',
    '② 교과서 3과 p.72~86, 4과 p.100~114',
    '③ 10월 모의고사 18번~45번',
    '④ Word Master Day 26~50',
  ]],
  ['calc2', '미적분2', ['도함수의 활용 + 적분법 + 수특 파일']],
  ['geo', '기하', [
    '① 1, 3단원 (이차곡선 + 벡터)',
    '② 이차곡선 학습지 40번~70번',
    '③ 벡터 학습지 70제',
  ]],
  ['prob', '확률과 통계', [
    '① 2단원 확률 + 3단원 통계',
    '② 올림포스 고난도 2, 3단원',
  ]],
  ['matter', '물질과 에너지', ['3, 4단원']],
  ['chem', '화학반응의 세계', ['2단원']],
  ['em', '전자기와 양자', ['전범위']],
  ['mech', '역학과 에너지', ['2, 3단원']],
  ['ai', '인공지능 수학', ['전범위']],
];

// [날짜, 종류, 과목, 제목, 메모]
const EVENTS = [
  ['2026-10-22', 'read', 'kor', '독작 독서 수행평가 3회차', '매주 목요일'],
  ['2026-10-23', 'perf', 'calc2', '미적분2 심화탐구 수행평가', ''],
  ['2026-10-23', 'perf', 'matter', '물질과 에너지 Q&A 수행평가', ''],
  ['2026-10-28', 'perf', 'geo', '기하 교구 만들기 수행평가', ''],
  ['2026-10-29', 'read', 'kor', '독작 독서 수행평가', '매주 목요일'],
  ['2026-10-30', 'perf', 'calc2', '미적분2 심화탐구 수행평가 2회차', ''],
  ['2026-10-30', 'perf', 'chem', '화학반응의 세계 포트폴리오 수행 2회차', ''],
  ['2026-11-02', 'perf', 'em', '전자기와 양자 수행평가', ''],
  ['2026-11-05', 'read', 'kor', '독작 독서 수행평가', '매주 목요일'],
  ['2026-11-06', 'perf', 'calc2', '미적분2 심화탐구 수행평가', ''],
  ['2026-11-09', 'perf', 'mech', '역학과 에너지 수행평가 1회차', ''],
  ['2026-11-11', 'perf', 'mech', '역학과 에너지 수행평가 2회차', ''],
  ['2026-11-12', 'read', 'kor', '독작 독서 수행평가', '매주 목요일'],
  ['2026-11-13', 'perf', 'mech', '역학과 에너지 수행평가 3회차', ''],
  ['2026-11-19', 'read', 'kor', '독작 독서 수행평가', '매주 목요일'],
  ['2026-11-20', 'perf', 'matter', '물질과 에너지 융합탐구 수행평가', ''],
  ['2026-11-26', 'read', 'kor', '독작 독서 수행평가', '매주 목요일'],
  ['2026-11-30', 'perf', 'em', '전자기와 양자 자율선택과제', ''],
  ['2026-12-07', 'exam', '', '2학기 기말고사 1일차', ''],
  ['2026-12-08', 'exam', '', '2학기 기말고사 2일차', ''],
  ['2026-12-09', 'exam', '', '2학기 기말고사 3일차', ''],
  ['2026-12-10', 'exam', '', '2학기 기말고사 4일차', ''],
  ['2026-12-11', 'school', '', '재량휴업일', ''],
  ['2027-01-08', 'school', '', '방학식', '미정 · 이날이 유력'],
  ['2027-02-01', 'school', '', '등교일', ''],
  ['2027-02-02', 'school', '', '등교일', ''],
  ['2027-02-03', 'school', '', '등교일', ''],
  ['2027-02-18', 'school', '', '등교일', ''],
  ['2027-02-19', 'school', '', '등교일', ''],
];

const LINKS = [
  ['시간표 검색', 'https://lka09.github.io/DaeshinXFile2/'],
];

function buildSeed() {
  const subjects = {};
  SUBJECTS.forEach(([id, name, scope], i) => {
    subjects[id] = { order: i + 1, name, scope, memo: '' };
  });

  const events = {};
  EVENTS.forEach(([date, type, subject, title, note], i) => {
    events[`seed-${String(i + 1).padStart(3, '0')}`] = {
      date, type, title, note: note || '', subject: subject || '', done: false,
    };
  });

  const links = {};
  LINKS.forEach(([title, url], i) => {
    links[`seed-link-${i + 1}`] = { order: i + 1, title, url };
  });

  const types = {};
  DEFAULT_TYPES.forEach(([id, label, color], i) => {
    types[id] = { order: i + 1, label, color };
  });

  return {
    events,
    todos: {},
    subjects,
    links,
    types,
    books: {},
    settings: { main: { examStart: '2026-12-07', examEnd: '2026-12-10' } },
  };
}

export const SEED = buildSeed();
