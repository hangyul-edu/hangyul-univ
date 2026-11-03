#!/usr/bin/env bash
# V26 — the Android phase, sequential (brief §61, §79): build the six artifacts one Gradle at a time, scan the production
# bundles, then boot one emulator and smoke-test each preview APK. Never alongside Playwright or a web build.
#   scripts/qa/v26/android-phase.sh [build|scan|smoke|all]
# Final logs (brief §93): docs/qa/v26/completion/logs/{student,agency,university}-android-final.log, android-scan-final.log,
# emulator-smoke-final.log — each ends in EXIT=<code>.
set -u
ROOT=/root/hangyul-univ; LOGS=$ROOT/docs/qa/v26/completion/logs; SDK=/root/android-sdk
export ANDROID_HOME=$SDK ANDROID_SDK_ROOT=$SDK
cd "$ROOT"
what=${1:-all}
fail=0

if [ "$what" = build ] || [ "$what" = all ]; then
  for app in student agency university; do
    log=$LOGS/$app-android-final.log
    if tail -1 "$log" 2>/dev/null | grep -q '^EXIT=0$' && [ "${FORCE:-0}" != 1 ]; then echo "== $app build already green — skipped"; continue; fi
    echo "== $app android build $(date +%H:%M:%S)"
    : > "$log"
    APPS=$app bash scripts/release/v26-android-all.sh >> "$log" 2>&1; code=$?
    # v26-android-all.sh appends its own per-stage lines to android-$app.log; fold that detail in, then the verdict
    [ -f "$LOGS/android-$app.log" ] && { echo "--- stage log ---" >> "$log"; cat "$LOGS/android-$app.log" >> "$log"; rm -f "$LOGS/android-$app.log"; }
    ls -la result/$app-mobile/android/hangyul-$app-v26-* >> "$log" 2>&1
    echo "EXIT=$code" >> "$log"; echo "   $app EXIT=$code"; [ $code = 0 ] || fail=1
  done
fi

if [ "$what" = scan ] || [ "$what" = all ]; then
  log=$LOGS/android-scan-final.log; : > "$log"; code=0
  for app in student agency university; do
    aab=result/$app-mobile/android/hangyul-$app-v26-production.aab
    echo "== $aab" >> "$log"
    if [ -f "$aab" ]; then python3 scripts/release/v23-scan-artifact.py "$aab" >> "$log" 2>&1 || code=1; else echo "missing" >> "$log"; code=1; fi
  done
  echo "== positive control: the student PREVIEW apk must contain the test sign-in (expected: findings > 0)" >> "$log"
  # The scanner prints the per-marker counts and exits 0 either way; the verdict is read from the counts.
  pc=$(python3 scripts/release/v23-scan-artifact.py result/student-mobile/android/hangyul-student-v26-preview.apk 2>&1); echo "$pc" >> "$log"
  if echo "$pc" | grep -qE "'@demo.hangyul.kr': [1-9]"; then echo "positive control: findings present (as expected)" >> "$log"; else echo "positive control found NOTHING — the scanner is not seeing the bundle" >> "$log"; code=1; fi
  # and the production bundles must be all-zero
  for app in student agency university; do grep -A1 "hangyul-$app-v26-production.aab" "$log" | grep -qE "': [1-9]" && { echo "production bundle $app carries a test marker" >> "$log"; code=1; }; done
  echo "EXIT=$code" >> "$log"; echo "   scan EXIT=$code"; [ $code = 0 ] || fail=1
fi

if [ "$what" = smoke ] || [ "$what" = all ]; then
  log=$LOGS/emulator-smoke-final.log; : > "$log"
  echo "== boot hg35 headless $(date +%H:%M:%S)" | tee -a "$log"
  ( setsid nohup $SDK/emulator/emulator -avd hg35 -no-window -no-audio -no-boot-anim -memory 2048 -cores 4 -gpu swiftshader_indirect -no-snapshot > "$LOGS/emulator-console.log" 2>&1 < /dev/null & )
  ok=0
  for i in $(seq 1 120); do if [ "$($SDK/platform-tools/adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; then ok=1; break; fi; sleep 3; done
  if [ $ok = 1 ]; then
    echo "booted after ~$((i*3))s" | tee -a "$log"
    $SDK/platform-tools/adb reverse tcp:8001 tcp:8001 >> "$log" 2>&1 || true
    node scripts/qa/v26/android-smoke.mjs student,agency,university >> "$log" 2>&1; code=$?
    echo "--- logcat FATAL/AndroidRuntime since boot:" >> "$log"; $SDK/platform-tools/adb logcat -d -b crash 2>/dev/null | tail -40 >> "$log"
  else
    echo "emulator did not boot in 6 min" | tee -a "$log"; code=1
  fi
  $SDK/platform-tools/adb emu kill >> "$log" 2>&1 || true
  echo "EXIT=$code" >> "$log"; echo "   smoke EXIT=$code"; [ $code = 0 ] || fail=1
fi
echo "== android phase: $([ $fail = 0 ] && echo GREEN || echo 'FAILED steps — see logs')"
exit $fail
