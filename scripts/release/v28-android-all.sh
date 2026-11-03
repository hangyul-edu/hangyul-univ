#!/usr/bin/env bash
# V28 (fork of v27-android-all.sh) — rebuild the six Android artifacts sequentially (student → agency → university; preview APK then production AAB),
# one Gradle at a time, each stage re-run in <10-min chunks until it prints DONE. Logs: docs/qa/v28/completion/logs/android-*.log
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$ROOT/docs/qa/v28/completion/logs"
for app in ${APPS:-student agency university}; do
  for stage in prebuild-preview apk prebuild-prod aab; do
    for try in 1 2 3 4 5 6 7 8; do
      echo "== $app $stage try $try $(date -Is)" | tee -a "$LOG/android-$app.log"
      if bash "$ROOT/scripts/release/v23-android.sh" "$app" "$stage" >> "$LOG/android-$app.log" 2>&1 && tail -1 "$LOG/android-$app.log" | grep -q DONE; then
        echo "   $app $stage DONE" | tee -a "$LOG/android-$app.log"; break
      fi
      [ "$try" = 8 ] && { echo "   $app $stage FAILED after 8 tries" | tee -a "$LOG/android-$app.log"; exit 1; }
    done
    if [ "$stage" = apk ] || [ "$stage" = aab ]; then node "$ROOT/scripts/release/v28-collect.mjs" "$app" "$stage" >> "$LOG/android-$app.log" 2>&1 || true; fi
  done
done
echo ALL-DONE
