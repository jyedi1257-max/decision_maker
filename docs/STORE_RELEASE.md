# 스토어 릴리스 준비

Google Play(Android)를 기준으로 쓴다. iOS는 이 컨테이너에 CocoaPods가 없어 프로젝트 생성 자체가
안 된다 — 빌드는 맥에서 해야 한다 (아래 [iOS](#ios) 참고).

## 1. 서명 키 (딱 한 번, 사람이 직접)

Play는 앱을 서명한 키로 그 앱의 정체성을 확인한다. **키를 잃어버리면 같은 앱으로 업데이트를
다시 올릴 방법이 없다** — 새 앱으로 처음부터 다시 올려야 한다. 그래서 이 키는 내가 대신
만들어서 넘겨주지 않는다. 직접 만들고, 직접 백업해 둔다 (비밀번호 관리자, 클라우드 드라이브
등 저장소 바깥 두 곳 이상).

```bash
keytool -genkeypair -v \
  -keystore ~/keys/decision-note-release.jks \
  -alias decision-note \
  -keyalg RSA -keysize 2048 -validity 10000
```

묻는 질문(조직명 등)은 대충 넣어도 된다 — 스토어에 노출되지 않는다. **키스토어 비밀번호와
키 비밀번호만 잊지 않으면 된다.**

그다음 `android/app/keystore.properties.example`을 `keystore.properties`로 복사해서 채운다:

```bash
cp android/app/keystore.properties.example android/app/keystore.properties
```

```properties
storeFile=/Users/나/keys/decision-note-release.jks
storePassword=방금 정한 키스토어 비밀번호
keyAlias=decision-note
keyPassword=방금 정한 키 비밀번호
```

`keystore.properties`와 `*.jks`는 `.gitignore`에 있다 — 커밋되지 않는다. 이 파일이 없으면
`build.gradle`이 조용히 서명 없는 빌드로 넘어가니, `bundleRelease` 결과가 서명 안 된 채
나온다면 이 파일이 제자리에 있는지부터 본다.

## 2. 버전 올리기

`android/app/build.gradle`의 `defaultConfig`:

```gradle
versionCode 1      // 올릴 때마다 정수로 1씩 증가. 되돌릴 수 없다.
versionName "1.0"  // 사람이 보는 버전. 의미 있게 올린다 (1.0 → 1.1 → 2.0)
```

## 3. 빌드

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease   # app/build/outputs/bundle/release/app-release.aab
```

Play는 이제 APK가 아니라 **AAB(Android App Bundle)** 를 받는다. 위 파일을 그대로 올리면
된다. (테스트용 APK가 필요하면 지금처럼 `assembleDebug`를 계속 쓴다 — 서명 안 된 디버그
빌드라 스토어에는 못 올린다.)

## 4. Play Console

1. **앱 만들기** — [play.google.com/console](https://play.google.com/console)에서 새 앱.
   기본 언어 한국어, 앱/게임 = 앱, 무료 = 무료.
2. **스토어 등록정보** — 제목·설명·아이콘·스크린샷. 초안은
   [`docs/store-listing.md`](store-listing.md)에 있다. 그대로 붙여넣거나 다듬어서 쓴다.
   - 고해상도 아이콘(512×512): `docs/icon.png` (이미 있음)
   - 스크린샷: `docs/screenshots/`의 것들을 골라 쓴다. 기기 스크린샷 규격(세로 16:9~19.5:9)에
     맞는지 업로드할 때 Play가 알려준다.
   - 그래픽 배너(1024×500)는 아직 없다 — 필요해지면 알려주면 만든다.
3. **개인정보 처리방침 URL** — 앱에 화면으로 만들어 뒀다. 배포하면
   `https://decision-maker-48224.web.app/privacy` (또는 커스텀 도메인을 연결했다면 그 주소 +
   `/privacy`)로 접근된다. `npm run deploy:hosting`으로 먼저 배포해야 링크가 실제로 열린다.

   화면 안에 문의 이메일이 `[문의 이메일]`로 비어 있다 — `src/screens/Privacy.tsx`에서
   실제로 쓸 주소로 바꾸고 다시 배포한다. Play 스토어 등록정보의 **지원 이메일** 항목도
   똑같이 채워야 심사가 통과된다.
4. **데이터 안전(Data safety)** — Play가 묻는 항목과 우리 앱이 실제로 하는 일을 맞춰
   적는다. 아래 표대로 답하면 된다 (Play 쪽 문항 문구는 계속 바뀌니, 뜻이 맞는 항목을
   찾아 적용한다):

   | Play가 묻는 것 | 답 |
   |---|---|
   | 데이터를 수집·공유하나? | 예 — 단, **사용자가 동기화를 켰을 때만** |
   | 수집하는 항목 | 사용자가 적은 텍스트(고민·대안·기준 이름 등), 기기 식별용 익명 ID (Firebase 익명 인증 UID) |
   | 개인 식별 정보(이름·이메일·전화번호 등) | 수집 안 함 |
   | 위치·연락처·사진·마이크 등 | 수집 안 함 |
   | 수집 목적 | 앱 기능 제공(다른 기기와 동기화)만. 광고·분석·마케팅 목적 없음 |
   | 제3자와 공유하나? | 아니오 |
   | 전송 중 암호화되나? | 예 (HTTPS/TLS, Firestore 기본) |
   | 사용자가 삭제를 요청할 수 있나? | 예 — 앱 안 보관함에서 직접 전체 삭제 가능 |
   | 데이터 수집이 선택적인가? | 예 — 기본값은 수집 안 함. 동기화는 사용자가 직접 켜야 시작됨 |

5. **콘텐츠 등급** — 설문에서 폭력·선정성·도박·약물·사용자 간 소통(다른 사용자와
   콘텐츠를 주고받는지) 전부 **아니오**로 답한다. 동기화는 자기 자신의 기록을 자기
   계정으로만 보내는 것이라 "다른 사용자와 공유/소통"에 해당하지 않는다. 전부 아니오면
   보통 전체 이용가(Everyone / IARC 3+) 등급이 나온다.
6. **대상 및 콘텐츠** — 만 13세 미만 아동을 주 대상으로 하지 않음으로 답한다 (성인 대상
   생산성 도구). 그래야 Play의 아동용 정책(광고·데이터 수집 제한 등)이 불필요하게
   걸리지 않는다.
7. **카테고리** — 생산성(Productivity) 또는 라이프스타일. 의사결정 보조 도구이므로
   생산성 쪽을 권한다.
8. **앱 서명** — 업로드할 때 **Play 앱 서명(Play App Signing)** 을 켜는 걸 권한다. 내가
   위에서 만든 키는 "업로드 키"가 되고, 실제 배포 서명은 Google이 관리한다 — 업로드 키를
   잃어버려도 구글에 재발급을 요청할 길이 남는다 (완전히 키가 없어지는 것보단 낫다).
9. **테스트 트랙** — 내부 테스트(최대 100명, 즉시) → 비공개 테스트(선택) → 프로덕션 순서를
   권한다. 처음부터 프로덕션에 바로 올리지 않는다 — 심사 전에 내부 테스트로 실기기에서
   한 번 직접 설치해보고 아이콘·스플래시·기본 동작을 확인한다.

## 5. 심사 전 마지막 확인

- [ ] `npm test && npm run build && npm run smoke` 전부 통과
- [ ] `keystore.properties`가 커밋되지 않았다 (`git status`로 확인)
- [ ] `bundleRelease`로 만든 AAB가 서명돼 있다 (`jarsigner -verify` 또는 Play Console 업로드 시
      자동 검증)
- [ ] `/privacy`가 실제로 배포돼 열린다 (`npm run deploy:hosting` 먼저)
- [ ] `Privacy.tsx`의 `[문의 이메일]`을 실제 주소로 바꿨다
- [ ] `versionCode`를 이전 업로드보다 올렸다

## iOS

`ios/` 프로젝트는 아직 생성되지 않았다 — `npx cap add ios`는 CocoaPods가 있는 맥에서
실행해야 한다.

```bash
# 맥에서
npm install
npx cap add ios
npx cap sync ios
npx cap open ios   # Xcode가 열림 — 여기서부터는 Apple Developer 계정, 서명 인증서,
                    # App Store Connect 등록이 전부 필요하다
```

디자인 시스템·아이콘 소스(`scripts/icon-source.mjs`)는 플랫폼 공용이라 Android에서 쓴 것
그대로 iOS 아이콘도 뽑을 수 있다 — `scripts/make-icons.mjs`에 iOS 사이즈를 추가하는 작업은
아직 안 했다. 필요해지면 알려주면 붙인다.
