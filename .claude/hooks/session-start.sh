#!/bin/bash
# 세션이 열릴 때 개발 환경을 갖춰 둔다.
#
# 이 컨테이너는 세션이 끝나면 사라진다. 그래서 npm 의존성과 안드로이드 SDK를
# 매번 다시 마련해야 하는데, 손으로 하면 명령이 예닐곱 줄이고 SDK만 600MB다.
# 한 번 깔린 뒤에는 전부 건너뛰므로 두 번째부터는 몇 초 안에 끝난다.
set -euo pipefail

# 웹 세션에서만 돈다. 각자 컴퓨터의 SDK 설정을 덮어쓰지 않는다.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "▸ npm 의존성"
npm install --no-audit --no-fund --loglevel=error

# ── 안드로이드 SDK ────────────────────────────────────────────
# 버전은 android/variables.gradle이 요구하는 값을 그대로 따라간다.
# 거기서 compileSdk를 올리면 다음 세션부터 알아서 맞는 걸 받는다.
ANDROID_SDK="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
SDK_LEVEL="$(grep -oE 'compileSdkVersion *= *[0-9]+' android/variables.gradle | grep -oE '[0-9]+')"
BUILD_TOOLS="${SDK_LEVEL}.0.0"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

if [ -z "$SDK_LEVEL" ]; then
  echo "‼ android/variables.gradle에서 compileSdkVersion을 못 읽었습니다. SDK 설치를 건너뜁니다." >&2
elif [ -d "$ANDROID_SDK/platforms/android-$SDK_LEVEL" ]; then
  echo "▸ 안드로이드 SDK — 이미 있음 (android-$SDK_LEVEL)"
else
  echo "▸ 안드로이드 SDK 설치 (android-$SDK_LEVEL · 약 600MB, 처음 한 번만)"
  mkdir -p "$ANDROID_SDK/cmdline-tools"
  if [ ! -x "$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
    tmp="$(mktemp -d)"
    curl -sSL --max-time 600 -o "$tmp/cmdline-tools.zip" "$CMDLINE_TOOLS_URL"
    unzip -q "$tmp/cmdline-tools.zip" -d "$tmp"
    rm -rf "$ANDROID_SDK/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$ANDROID_SDK/cmdline-tools/latest"
    rm -rf "$tmp"
  fi
  SDKMANAGER="$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager"
  yes | "$SDKMANAGER" --sdk_root="$ANDROID_SDK" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --sdk_root="$ANDROID_SDK" \
    "platform-tools" "platforms;android-$SDK_LEVEL" "build-tools;$BUILD_TOOLS" >/dev/null
  echo "▸ 안드로이드 SDK 완료"
fi

# gradle이 SDK 위치를 찾는 파일. .gitignore에 있어서 세션마다 다시 써야 한다.
if [ -d android ]; then
  echo "sdk.dir=$ANDROID_SDK" > android/local.properties
fi

# 다음 명령들이 ANDROID_HOME을 그냥 쓸 수 있게 남긴다.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export ANDROID_HOME=$ANDROID_SDK"
    echo "export ANDROID_SDK_ROOT=$ANDROID_SDK"
  } >> "$CLAUDE_ENV_FILE"
fi

echo "▸ 준비 끝 — npm test · npm run build · (cd android && ./gradlew assembleDebug)"
