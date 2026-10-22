// ============================================================
//  Firebase 설정 — 여기를 채우면 "실시간 동기화 모드"로 바뀝니다.
//  비어 있으면 이 기기에만 저장되는 "로컬 모드"로 동작합니다.
//  채우는 방법은 README.md 의 "Firebase 설정" 부분을 보세요.
//
//  apiKey 는 비밀번호가 아니라 프로젝트를 가리키는 주소표라서
//  공개 저장소에 올라가도 괜찮습니다.
//  실제 보호는 firestore.rules 의 보안 규칙이 합니다.
// ============================================================

export const firebaseConfig = {
  apiKey: 'AIzaSyCSp9lsJp_CJoBWLA9ErgdSFsiNfI3fogI',
  authDomain: 'liveindashin.firebaseapp.com',
  projectId: 'liveindashin',
  storageBucket: 'liveindashin.firebasestorage.app',
  messagingSenderId: '1064964307194',
  appId: '1:1064964307194:web:5795fe7db351a2a5c4f143',
  measurementId: 'G-N0L9GPBQ3C',
};

// 내 계정만 쓰게 하고 싶으면 내 Google 계정의 UID 를 적어 주세요.
// (Firebase 콘솔 → Authentication → Users 의 "사용자 UID")
// 비워 두면 로그인한 사람은 각자 자기 데이터만 보게 됩니다.
export const OWNER_UID = '';
