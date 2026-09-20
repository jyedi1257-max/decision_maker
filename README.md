# 결정 노트

> 더 잘 고민하게 하지 않는다. 충분히 고민한 사람이 결정할 수 있게 한다.

중요한 선택을 앞두고 생각이 너무 많아진 사람을 위한 의사결정 노트.
기준을 세우고, 결과가 왜 그렇게 나왔는지 보고, 정하고, 30일 뒤에 돌아본다.

**로그인이 없다. 계정도 없다. 고민 본문은 기본적으로 기기 밖으로 나가지 않는다.**

| | |
|---|---|
| 기획 | [`docs/product-report.md`](docs/product-report.md) |
| 디자인 | [`docs/design-system.md`](docs/design-system.md) |
| 화면 | [`docs/screenshots/`](docs/screenshots) |

---

## 시작하기

```bash
npm install
npm run dev          # http://localhost:5173
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 (`dist/`) |
| `npm test` | 결정 엔진 단위 테스트 |
| `npm run smoke` | 13화면을 실제로 클릭해 완주 + 스크린샷 (빌드 먼저) |
| `npm run font:subset` | 손글씨 폰트 서브셋 다시 만들기 |
| `npm run cap:sync` | 빌드해서 네이티브 프로젝트에 밀어넣기 |

---

## 흐름

```
홈 ─→ 1 고민 한 문장 ─→ 2 후보 적기 ─→ 3 직감 봉인 ─→ 4 기준 세 개
                                                          │
     회고 ←── 확정 ←── 왜 이런 결과인지 ←── 결과 ←─ 7 평가 ←─ 6 중요한 순서 ←─ 5 필수조건
```

직감은 3단계에서 **봉인**했다가 결과 화면에서 처음 펴본다. 분석과 갈리면 그 지점을 같이 본다 —
직감을 틀린 것으로 다루지 않는다.

---

## 결정을 어떻게 계산하나

수학은 뒤에서 돌고, 화면에는 사용자가 읽을 수 있는 것만 올린다.
전부 `src/core/`의 순수 함수이며 React도 Firebase도 모른다.

| 단계 | 하는 일 | 파일 |
|---|---|---|
| 가중치 | 순서만 받아 **ROC(SMARTER)** 로 무게를 뽑는다. 숫자를 요구하지 않는다 | `weights.ts` |
| 필터 | 필수조건은 **합산 전에** 거른다. 다른 장점으로 상쇄되지 않는다 | `evaluate.ts` |
| 집계 | Simple Additive Value Model. 빈 칸은 중립으로 세되 불확실성에 올린다 | `evaluate.ts` |
| 설명 | 1·2위의 기준별 기여도 차로 "차이를 만든 기준"을 뽑는다 | `explain.ts` |
| 민감도 | 순서를 한 칸씩 옮겨 1위가 바뀌는 최소 이동을 찾는다 | `sensitivity.ts` |
| 문장 | 그래프 전에 "박빙이에요, 이걸 한 칸만 더 무겁게 보면…"으로 옮긴다 | `narrate.ts` |

**총점 숫자는 화면에 내보내지 않는다.** 37점과 38점의 차이는 실제 심리적 비율을 뜻하지 않기 때문에,
적합도는 `낮음 / 보통 / 높음`과 막대 길이로만 보여준다.

### 왜 ROC인가

Edwards & Barron(1994)의 SMARTER는 어려운 가중치 판단을 순위 입력으로 대체하면서도
SMARTS 성능의 약 98% 수준을 낸다. 사용자는 "가격 37, 공간 24"를 맞출 필요 없이 순서만 놓는다.

```
w_i = (1/n) · Σ_{k=i..n} (1/k)        기준 3개 → [0.611, 0.278, 0.111]
```

---

## 데이터가 어디에 있나

```
입력 ──→ IndexedDB (항상, 기본) ──→ Firestore (보관함에서 켰을 때만)
```

- 켜기 전에는 **firebase 번들이 로드조차 되지 않는다** — 별도 청크 + 동적 import.
- 켜면 `signInAnonymously()`로 UID를 만든다. 이름도 이메일도 묻지 않는다.
- `firestore.rules`가 자기 UID 하위만 허용하고 나머지 경로는 전부 막는다.
- 충돌은 `updatedAt` 최신 우선.
- 보관함에서 JSON으로 내보내거나 전부 지울 수 있다.

설정값은 `src/firebase/config.ts`에 기본값으로 들어 있어서 따로 준비할 게 없다. 이 값들은
비밀이 아니다 — 웹에 배포하면 번들에 그대로 실린다. 막는 건 두 겹이다.

1. `firestore.rules` — 자기 UID 하위 문서만 읽고 쓴다. 나머지 경로는 전부 거부
2. Firebase Auth의 **승인된 도메인** — 거기 등록된 곳에서만 로그인이 된다

다른 프로젝트(스테이징 등)를 붙이려면 `.env`로 덮어쓰면 된다 (`.env.example` 참고).

---

## 배포

프로젝트는 `decision-maker-48224`에 연결돼 있다.

```bash
npx firebase login          # 브라우저가 열린다
npm run deploy              # 빌드 + 호스팅 + 규칙
```

`npm run deploy:hosting` / `npm run deploy:rules`로 나눠 올릴 수도 있고,
`npm run emulators`로 로그인 없이 로컬에서 Auth·Firestore를 흉내 내며 볼 수 있다.

사는 곳: **https://decision-maker-48224.web.app**

### 캐시 헤더

해시가 붙은 자산(`/assets/**`)과 폰트는 1년 immutable, HTML은 `no-cache`다.
HTML 쪽은 **라우터가 쓰는 주소를 `firebase.json`에 그대로 나열해** 걸어둔다 —
루트 `/`는 `/index.html`과 다른 경로라 한쪽만 적으면 다른 쪽이 새 것을 늦게 받는다.
**라우트를 추가하면 `firebase.json`의 no-cache 목록도 같이 늘려야 한다.**

### 처음 한 번만 해야 하는 것

Firebase 콘솔에서 두 가지를 켜야 동기화가 돈다.

| 할 일 | 어디서 |
|---|---|
| **Firestore 만들기** — 프로덕션 모드로. 규칙은 배포할 때 덮어쓴다 | 콘솔 → 빌드 → Firestore Database |
| **익명 로그인 켜기** | 콘솔 → 빌드 → Authentication → 로그인 방법 → 익명 |

승인된 도메인은 기본으로 `localhost`, `decision-maker-48224.web.app`,
`decision-maker-48224.firebaseapp.com`이 들어 있다. **다른 도메인에서는 동기화가 안 된다** —
미리보기용으로 어딘가에 올렸다면 그 도메인을 Authentication → 설정 → 승인된 도메인에 넣어야 한다.
기기 저장은 도메인과 무관하게 언제나 동작한다.

---

## 서버 비용이 0인 이유

| 쓰는 것 | 안 쓰는 것 | 왜 |
|---|---|---|
| Hosting · Auth(익명) · Firestore | **Cloud Functions** | Spark 무료 티어를 벗어나지 않으려고 |
| 로컬 알림 (`@capacitor/local-notifications`) | **FCM** | 30일 회고 알림에 푸시 서버가 필요 없다 |
| 기기 안 문자열 비교 | **LLM API** | 기준 중복 감지에 외부 호출이 필요 없다 |

수익모델이 없으므로 광고·결제·추적 코드도 넣지 않았다.

---

## 네이티브 앱

웹과 같은 코드를 Capacitor로 감싼다.

```bash
npm run cap:sync

npx cap open android     # Android Studio
npx cap open ios         # Xcode (맥에서, SPM이라 CocoaPods 불필요)
```

`android/`와 `ios/`는 저장소에 들어 있다. 웹 자산(`android/app/src/main/assets/public` 등)은
빌드 산출물이라 제외돼 있으니, 체크아웃 직후에는 `npm run cap:sync`를 한 번 돌려야 한다.

---

## 손글씨 폰트

손글씨(KCC김환기체)는 **딱 두 문구**에만 쓴다.

| 문구 | 어디에 |
|---|---|
| `적을수록 고민이 적어집니다` | 홈 하단 |
| `결정함` | 확정 화면의 도장 |

그래서 앱에 실린 폰트는 원본(1.9MB)이 아니라 그 14자만 담은 **3.4KB 서브셋**이다.
`src/styles/ink-phrases.ts`의 문구를 고치면 반드시 다시 만들어야 한다.

```bash
pip install 'fonttools[woff]' brotli     # pyftsubset이 필요하다
npm run font:subset
```

빠뜨려도 글자가 깨지지는 않는다 — `@font-face`에 서브셋의 실제 커버 범위를 `unicode-range`로
선언해 둬서, 없는 글자는 Gowun Batang으로 폴백된다.

원본과 라이선스(OFL)는 [`assets/fonts/source/`](assets/fonts/source)에 있다.

---

## 구조

```
src/
├─ core/       순수 TypeScript. 결정 엔진과 조언자 경계. React·Firebase 의존 없음
├─ data/       저장소 인터페이스 · IndexedDB · 선택적 Firestore 동기화
├─ store/      Zustand 상태와 결정 만들기
├─ screens/    13화면 + 보관함
├─ components/ Paper, StepBar, Scale5, FitBar, Stamp, Ink…
├─ styles/     디자인 토큰 · 모션 · 손글씨 문구
└─ platform/   네이티브와 웹이 갈리는 얇은 어댑터
```

`core/`만 테스트가 붙는다. 여기가 틀리면 결과가 틀리고, 나머지는 눈으로 확인할 수 있다.

---

## AI를 쓰지 않는다

기준 중복 감지("‘출퇴근 시간’과 ‘직장 거리’는 같은 걸 두 번 보는 것 같아요")는
자모 분해 유사도로 기기 안에서 한다. 외부 모델을 붙이고 싶다면 `src/core/advisor.ts`의
인터페이스 뒤에 꽂으면 되지만, 그 인터페이스에는 **점수 부여·최종 선택·가중치 산출이 없다.**

앞의 둘은 기획안 8.3이 금지한 것이고, 가중치는 ROC가 결정론적이어야 결과를 기준별 기여도로
분해해 "차이를 만든 기준"과 '왜 이런 결과인지' 화면을 만들 수 있기 때문이다.

---

## 안 만든 것

기획안 9.3이 명시적 비목표로 둔 것들: 토너먼트·룰렛·10-10-10·사전부검,
공동 의사결정, AI 외부 리서치, 심층 민감도 그래프.

디자인 시스템 §9가 금지한 것들: 총점 숫자 노출, 다크모드, 900ms를 넘는 진입 모션,
반복 루프 애니메이션, 손글씨 자간 조정.
