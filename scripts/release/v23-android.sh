#!/usr/bin/env bash
# V23 Android release artifacts, one app and one stage at a time (low-memory host: one Gradle, no daemon, 1 worker,
# pinned to 2 CPUs, chunked under the tool's 10-minute limit — re-run a stage until it prints DONE).
#
#   scripts/release/v23-android.sh <student|agency|university> <prebuild-preview|apk|prebuild-prod|aab|collect>
#
# preview APK  : EXPO_PUBLIC_TEST_LOGIN=true,  HG_QA_CLEARTEXT=1 (talks to the local dev API from the emulator)
# production AAB: EXPO_PUBLIC_TEST_LOGIN=false, cleartext off (store-shaped; production API origin is an owner input)
# ABIs: arm64-v8a (devices / store) + x86_64 (emulator). Signed with the V22 QA key (NOT a store key).
set -euo pipefail
APP="$1"; STAGE="$2"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/apps/$APP-mobile"
export ANDROID_HOME=/root/android-sdk ANDROID_SDK_ROOT=/root/android-sdk
API="${HG_ANDROID_API_URL:-http://10.0.2.2:8001}"
set -a; source /root/.hangyul-qa-signing/hangyul-univ-v22-qa.env; set +a
SIGN=(-PHANGYUL_UPLOAD_STORE_FILE="$HANGYUL_QA_STORE_FILE" -PHANGYUL_UPLOAD_STORE_PASSWORD="$HANGYUL_QA_STORE_PASSWORD" -PHANGYUL_UPLOAD_KEY_ALIAS="$HANGYUL_QA_KEY_ALIAS" -PHANGYUL_UPLOAD_KEY_PASSWORD="$HANGYUL_QA_KEY_PASSWORD")
GRADLE=(taskset -c 0,1 ./gradlew --no-daemon --max-workers=1 -PreactNativeArchitectures=arm64-v8a,x86_64 "${SIGN[@]}")
common_env() { export NODE_ENV=production EXPO_PUBLIC_API_URL="$API" NODE_OPTIONS=--max-old-space-size=1536; if [ "$APP" = student ]; then export EXPO_PUBLIC_STUDENT_WEB_URL="${HG_ANDROID_WEB_URL:-http://10.0.2.2:3101}" EXPO_PUBLIC_MARKETING_URL="${HG_ANDROID_MARKETING_URL:-http://10.0.2.2:3100}"; fi; }
clear_metro() { rm -rf /tmp/metro-* /tmp/haste-map-* "$DIR/node_modules/.cache" "$DIR/.expo/web/cache" 2>/dev/null || true; }
case "$STAGE" in
  prebuild-preview)
    common_env; export EXPO_PUBLIC_TEST_LOGIN=true HG_QA_CLEARTEXT=1; clear_metro
    cd "$DIR" && CI=1 npx expo prebuild $([ -d "$DIR/android" ] || echo --clean) --platform android --no-install && grep -o 'usesCleartextTraffic="[a-z]*"' android/app/src/main/AndroidManifest.xml && echo DONE ;;
  apk)
    common_env; export EXPO_PUBLIC_TEST_LOGIN=true HG_QA_CLEARTEXT=1
    cd "$DIR/android" && timeout 560 "${GRADLE[@]}" :app:assembleRelease && echo DONE ;;
  prebuild-prod)
    common_env; export EXPO_PUBLIC_TEST_LOGIN=false; unset HG_QA_CLEARTEXT; clear_metro
    rm -rf "$DIR/android/app/build/generated/assets" "$DIR/android/app/build/intermediates/assets" 2>/dev/null || true
    cd "$DIR" && CI=1 npx expo prebuild --platform android --no-install && grep -o 'usesCleartextTraffic="[a-z]*"' android/app/src/main/AndroidManifest.xml && echo DONE ;;
  aab)
    common_env; export EXPO_PUBLIC_TEST_LOGIN=false; unset HG_QA_CLEARTEXT
    cd "$DIR/android" && timeout 560 "${GRADLE[@]}" :app:bundleRelease && echo DONE ;;
  *) echo "unknown stage $STAGE"; exit 2 ;;
esac
