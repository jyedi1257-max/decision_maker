/**
 * Firebase 설정. 동기화를 켠 사용자에게만 쓰인다.
 *
 * 여기 적힌 값은 **공개돼도 되는 클라이언트 식별자**다. 비밀이 아니고, 웹에 배포하면
 * 어차피 번들에 그대로 실린다. 실제 접근 통제는 두 겹으로 한다.
 *   1. firestore.rules — 자기 UID 하위 문서만 읽고 쓴다. 그 밖은 전부 거부
 *   2. Firebase Auth의 승인된 도메인 — 등록한 도메인에서만 로그인이 된다
 *
 * 환경변수로 덮어쓸 수 있게 열어둔 건 다른 프로젝트(스테이징 등)를 붙일 때를 위해서다.
 * .env가 없어도 그대로 돌아간다.
 *
 * Analytics(measurementId)는 일부러 넣지 않았다. 추적을 넣지 않는 건 기획안 9.3의
 * 명시적 비목표이고, 홈 화면의 "고민은 이 기기에만 저장됩니다"와도 어긋난다.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBWL7d7fEh3XGBiwdd2PHv8rpE62EAPNu0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'decision-maker-48224.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'decision-maker-48224',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'decision-maker-48224.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '951765568335',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:951765568335:web:7d91862f667313dc6b133a',
}

/** 설정이 채워져 있는가. 비어 있으면 보관함의 동기화 토글을 잠근다. */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== ''
}
