/**
 * Firebase 설정. 동기화를 켠 사용자에게만 쓰인다.
 *
 * 이 값들은 공개돼도 되는 클라이언트 식별자다. 실제 접근 통제는 firestore.rules가
 * 한다 — 자기 UID 하위 문서만 읽고 쓸 수 있다.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

/** 설정이 채워져 있는가. 비어 있으면 동기화 메뉴를 내보내지 않는다. */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== ''
}
