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

// 이 UID 의 계정만 쓸 수 있습니다. 다른 Google 계정으로 로그인하면
// "허용되지 않은 계정" 화면이 뜹니다.
// (Firebase 콘솔 → Authentication → Users 의 "사용자 UID")
//
// 이건 화면을 막는 용도고, 진짜 자물쇠는 firestore.rules 쪽입니다.
// 둘 중 하나만 바꾸면 반쪽짜리가 되니 항상 같이 고치세요.
export const OWNER_UID = 'TXh4nG6qenUwEwlWrVJlshzbBqG3';
