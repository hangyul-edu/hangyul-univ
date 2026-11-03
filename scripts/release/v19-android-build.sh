#!/usr/bin/env bash
# V19 — rebuild the Android artifacts so they match the source they bundle (REPORT §194.3, brief §36).
#
# Reproduces V18's documented recipe exactly (result/student-mobile/metadata/BUILD_REPORT.md):
#   expo prebuild --platform android --clean   # CNG: android/ is output, app.json is the source of truth
#   ./gradlew :app:assembleRelease             # → APK
#   ./gradlew :app:bundleRelease               # → AAB
#
# The memory flags are not optional on this host: 5.9 GB total, and V18 recorded that a Gradle build here
# needs -Xmx2048m with the daemon off and no parallel execution. Run it with the web dev servers stopped.
#
#   bash scripts/release/v19-android-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/apps/student-mobile"
OUT="$ROOT/result/student-mobile/android"
export ANDROID_HOME="${ANDROID_HOME:-/root/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
# Same origins V18 built against. There is still no production API origin in this repository; the owner
# supplies it and both artifacts must be rebuilt again with it before release.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://10.0.2.2:8001}"
export EXPO_PUBLIC_STUDENT_WEB_URL="${EXPO_PUBLIC_STUDENT_WEB_URL:-http://10.0.2.2:3101}"
export GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx2048m -Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.workers.max=1"

echo "== free memory before =="
free -m | head -2

cd "$APP"
echo "== expo prebuild =="
npx expo prebuild --platform android --clean --no-install

echo "== gradle :app:assembleRelease =="
cd "$APP/android"
./gradlew --no-daemon --max-workers=1 :app:assembleRelease

echo "== gradle :app:bundleRelease =="
./gradlew --no-daemon --max-workers=1 :app:bundleRelease

APK="$(find "$APP/android/app/build/outputs/apk/release" -name '*.apk' | head -1)"
AAB="$(find "$APP/android/app/build/outputs/bundle/release" -name '*.aab' | head -1)"
[ -n "$APK" ] || { echo "no APK produced"; exit 1; }
[ -n "$AAB" ] || { echo "no AAB produced"; exit 1; }

# Verify the signature *before* replacing anything in result/, so a debug-signed build can never be
# published over a release-signed one — the trap V18's report calls out by name.
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -name apksigner | sort | tail -1)"
echo "== signature =="
"$APKSIGNER" verify --print-certs "$APK" | head -8

mkdir -p "$OUT"
cp "$APK" "$OUT/hangyul-univ-preview.apk"
cp "$AAB" "$OUT/hangyul-univ-production.aab"

echo "== artifacts =="
cd "$OUT"
for f in hangyul-univ-preview.apk hangyul-univ-production.aab; do
  printf '%s  %s bytes  sha256 %s\n' "$f" "$(stat -c%s "$f")" "$(sha256sum "$f" | cut -d' ' -f1)"
done
echo "== free memory after =="
free -m | head -2
echo "Now run: node scripts/release/v19-build-info.mjs   (recomputes BUILD_INFO.json)"
