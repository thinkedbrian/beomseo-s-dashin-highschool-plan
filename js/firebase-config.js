// ============================================================
//  Firebase 설정 — 여기를 채우면 "실시간 동기화 모드"로 바뀝니다.
//  비어 있으면 이 기기에만 저장되는 "로컬 모드"로 동작합니다.
//  채우는 방법은 README.md 의 "Firebase 설정" 부분을 보세요.
// ============================================================

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// 내 계정만 쓰게 하고 싶으면 내 Google 계정의 UID 를 적어 주세요.
// (Firebase 콘솔 → Authentication → Users 의 "사용자 UID")
// 비워 두면 로그인한 사람은 각자 자기 데이터만 보게 됩니다.
export const OWNER_UID = '';
