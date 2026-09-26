# 스토어 릴리스 준비

Google Play(Android)를 기준으로 쓴다. iOS는 이 컨테이너에 CocoaPods가 없어 프로젝트 생성 자체가
안 된다 — 빌드는 맥에서 해야 한다 (아래 [iOS](#ios) 참고).

## 0. 개발자 계정 만들기 (한 번만, 사람이 직접)

아직 Play Console 계정이 없다면 먼저 만든다. [play.google.com/console](https://play.google.com/console)

1. 구글 계정으로 로그인 (만 18세 이상)
2. Play 개발자 배포 계약 동의
3. **등록비 25달러** 결제 (Mastercard/Visa/Amex/Discover, 선불카드 불가) — 일회성, 평생 유효
4. 계정 유형 선택: **개인** 또는 **조직**. 혼자 만드는 앱이면 개인으로 충분하다. 조직은
   사업자등록번호·D-U-N-S 번호 등이 더 필요해 절차가 길다
5. **신원 확인** — 본인 법적 이름으로 발급된 정부 신분증(주민등록증·운전면허증·여권), 신용카드,
   개발자 이메일 인증, (대한민국은) 전화번호 인증, **기기 인증**(Play Console 모바일 앱을 실제
   안드로이드 기기에 설치해서 확인)까지 전부 필요하다. 각 항목은 이메일/문자로 오는 6자리
   코드로 확인한다

> **2026-09-30 마감 — Android 개발자 인증**: 구글이 새로 시작한 정책으로, Play의 모든 패키지가
> "본인 인증 + 패키지 이름 등록" 두 가지를 마쳐야 한다. 이 날짜까지 등록되지 않은 패키지는
> 삭제될 수 있다고 안내한다. 신규 앱도 대상이지만, 위 계정 등록 절차를 정상적으로 밟으면 이
> 인증도 같이 처리된다 — 이미 만들어 둔 계정이 있거나 사이드로딩으로 따로 테스트 중인 패키지가
> 있을 때만 별도로 챙기면 된다. ([공지](https://support.google.com/googleplay/android-developer/answer/16984799))

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

### 키를 옮기지 않고 서명하기 (클라우드 세션에서 빌드할 때)

키는 내 컴퓨터에만 둔다. 클라우드 세션은 `keystore.properties` 없이 `bundleRelease`를 돌려
**서명 안 된 AAB**를 넘겨주고, 서명은 내 컴퓨터에서 JDK의 `jarsigner`로 한 줄에 끝낸다
(`keytool`과 같은 폴더에 있다). Windows PowerShell 기준:

```powershell
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 `
  -keystore $HOME\keys\decision-note-release.jks `
  -signedjar decision-note-1.0.aab decision-note-1.0-unsigned.aab decision-note
jarsigner -verify decision-note-1.0.aab     # "jar verified." 이 나오면 끝
```

자체 서명 인증서·타임스탬프 없음 경고는 정상이다 — Play 업로드 키는 원래 자체 서명이다.

Play는 이제 APK가 아니라 **AAB(Android App Bundle)** 를 받는다. 위 파일을 그대로 올리면
된다. (테스트용 APK가 필요하면 지금처럼 `assembleDebug`를 계속 쓴다 — 서명 안 된 디버그
빌드라 스토어에는 못 올린다.)

## 4. Play Console — 앱 등록정보

1. **앱 만들기** — Play Console에서 새 앱. 기본 언어 한국어, 앱/게임 = 앱, 무료 = 무료.
2. **스토어 등록정보** — 제목·설명·아이콘·스크린샷. 초안은
   [`docs/store-listing.md`](store-listing.md)에 있다. 그대로 붙여넣거나 다듬어서 쓴다.
   - 고해상도 아이콘(512×512): `docs/icon.png` (이미 있음)
   - 휴대전화 스크린샷: `docs/store/01~06-*.png` (1080×1920, 순서대로 올린다).
     `docs/screenshots/`의 앱 캡처(780×1688)는 **그대로 올리면 거절된다** — 긴 변이 짧은 변의
     두 배를 넘으면 안 된다. 화면을 바꿨으면 `node scripts/promo/store-assets.mjs`로 다시 만든다.
   - 그래픽 이미지(1024×500): `docs/store/feature-graphic.png`
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
   | 수집 목적 | 앱 기능 제공(다른 기기와 동기화)만 |
   | 제3자와 공유하나? | 아니오 |
   | 전송 중 암호화되나? | 예 (HTTPS/TLS, Firestore 기본) |
   | 사용자가 삭제를 요청할 수 있나? | 예 — 앱 안 보관함에서 직접 전체 삭제 가능 |
   | 데이터 수집이 선택적인가? | 예 — 기본값은 수집 안 함. 동기화는 사용자가 직접 켜야 시작됨 |

   광고 SDK를 나중에 넣게 되면 이 표와 콘텐츠 등급 설문(아래 5번)을 그때 다시 맞춰야 한다 —
   광고에 쓰이는 식별자(광고 ID 등)도 수집 항목에 새로 추가된다.
5. **콘텐츠 등급** — 설문에서 폭력·선정성·도박·약물·사용자 간 소통(다른 사용자와
   콘텐츠를 주고받는지) 전부 **아니오**로 답한다. 동기화는 자기 자신의 기록을 자기
   계정으로만 보내는 것이라 "다른 사용자와 공유/소통"에 해당하지 않는다. 전부 아니오면
   보통 전체 이용가(Everyone / IARC 3+) 등급이 나온다.
6. **대상 및 콘텐츠** — 만 13세 미만 아동을 주 대상으로 하지 않음으로 답한다 (성인 대상
   생산성 도구). 그래야 Play의 아동용 정책(데이터 수집 제한 등)이 불필요하게 걸리지 않는다.
7. **카테고리** — 생산성(Productivity) 또는 라이프스타일. 의사결정 보조 도구이므로
   생산성 쪽을 권한다.
8. **앱 서명** — 업로드할 때 **Play 앱 서명(Play App Signing)** 을 켜는 걸 권한다. 내가
   위에서 만든 키는 "업로드 키"가 되고, 실제 배포 서명은 Google이 관리한다 — 업로드 키를
   잃어버려도 구글에 재발급을 요청할 길이 남는다 (완전히 키가 없어지는 것보단 낫다).

## 5. 폐쇄 테스트 — 건너뛸 수 없는 관문

2023-11-13 이후 만든 개인 개발자 계정은 전부 해당한다 (지금 새로 만드는 계정도 포함).
"권장"이 아니라 **프로덕션에 올리기 전에 강제로 거쳐야 하는 단계**다.

- **최소 12명의 테스터**가 **14일 연속으로 옵트인 상태**를 유지해야 한다
- 에뮬레이터·봇·중복 계정은 안 쳐준다 — 실제 사람이 실제 안드로이드 기기에서, 진짜 구글
  계정으로 참여해야 한다
- 14일 중간에 옵트아웃했다가 다시 들어오면 그 사람은 그 시점부터 다시 14일을 채워야 한다
- 14일을 채우고 조건을 만족하면 Play Console에서 **프로덕션 액세스**를 신청한다. 구글
  검토는 보통 7일 이내

실무적으로는:

1. Play Console에서 **비공개 테스트** 트랙을 만들고, 테스터 이메일 목록(또는 구글 그룹)을
   등록해서 옵트인 링크를 받는다
2. 지인 12명 이상에게 그 링크로 참여를 부탁하고, 14일 동안 한 번씩은 앱을 실제로 열어달라고
   부탁한다 (그냥 설치만 하고 안 열면 세션이 없어서 활동 테스터로 안 잡힐 수 있다)
3. 그 사이에 내부 테스트(최대 100명, 즉시 반영)로 나 스스로 실기기에서 아이콘·스플래시·
   기본 흐름을 먼저 확인해 둔다 — 비공개 테스터들에게 버그부터 보여주지 않기 위해서
4. 14일이 지나면 대시보드에 프로덕션 액세스 신청 버튼이 뜬다

## 6. 심사 전 마지막 확인

- [ ] `npm test && npm run build && npm run smoke` 전부 통과
- [ ] `keystore.properties`가 커밋되지 않았다 (`git status`로 확인)
- [ ] `bundleRelease`로 만든 AAB가 서명돼 있다 (`jarsigner -verify` 또는 Play Console 업로드 시
      자동 검증)
- [ ] `/privacy`가 실제로 배포돼 열린다 (`npm run deploy:hosting` 먼저)
- [ ] `Privacy.tsx`의 `[문의 이메일]`을 실제 주소로 바꿨다
- [ ] `versionCode`를 이전 업로드보다 올렸다
- [ ] 폐쇄 테스트 12명·14일 조건을 채웠고 프로덕션 액세스를 신청했다

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
