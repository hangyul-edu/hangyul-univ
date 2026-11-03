#!/usr/bin/env bash
# V32 — drive one native app on the `hg35` Android emulator (API 35) through Expo Go + Metro, against the QA stack's API.
#   bash scripts/qa/v32/native-emulator.sh boot                 # start the emulator headless and wait for boot
#   bash scripts/qa/v32/native-emulator.sh metro <app>          # student-mobile | agency-mobile | university-mobile (Metro on :8081, CI mode)
#   bash scripts/qa/v32/native-emulator.sh open                 # open Expo Go on exp://10.0.2.2:8081
#   bash scripts/qa/v32/native-emulator.sh shot <file.png>      # screenshot
#   bash scripts/qa/v32/native-emulator.sh stop                 # stop Metro and the emulator
# Memory: the guest takes 1.5 GB and Metro ~1 GB; stop the web stack's builds before running this (REPORT §431 host limits).
set -u
SDK=/root/android-sdk
ADB=$SDK/platform-tools/adb
cd "$(dirname "$0")/../../.."
mkdir -p docs/qa/v32/native
case "${1:-}" in
  boot)
    nohup "$SDK/emulator/emulator" -avd hg35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 1536 -no-snapshot-save > docs/qa/v32/native/.emulator.log 2>&1 &
    echo $! > docs/qa/v32/native/.emulator.pid
    "$ADB" wait-for-device
    until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
    "$ADB" shell settings put global window_animation_scale 0 >/dev/null; "$ADB" shell settings put global transition_animation_scale 0 >/dev/null; "$ADB" shell settings put global animator_duration_scale 0 >/dev/null
    "$ADB" reverse tcp:8081 tcp:8081 >/dev/null
    echo "booted: $("$ADB" shell getprop ro.build.version.release | tr -d '\r'); Expo Go: $("$ADB" shell pm list packages | grep -c host.exp.exponent)" ;;
  metro)
    app="$2"
    [ -f docs/qa/v32/native/.metro.pid ] && kill "$(cat docs/qa/v32/native/.metro.pid)" 2>/dev/null
    (cd "apps/$app" && CI=1 EXPO_PUBLIC_API_URL=http://10.0.2.2:8091 nohup npx expo start --port 8081 > "../../docs/qa/v32/native/.metro-$app.log" 2>&1 & echo $! > ../../docs/qa/v32/native/.metro.pid)
    until curl -s -o /dev/null http://localhost:8081/status; do sleep 2; done
    echo "metro up for $app" ;;
  open)
    "$ADB" shell am force-stop host.exp.exponent >/dev/null 2>&1
    "$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081" >/dev/null
    echo "opened" ;;
  shot)
    "$ADB" exec-out screencap -p > "$2" && echo "$2" ;;
  stop)
    [ -f docs/qa/v32/native/.metro.pid ] && kill "$(cat docs/qa/v32/native/.metro.pid)" 2>/dev/null
    "$ADB" emu kill >/dev/null 2>&1
    [ -f docs/qa/v32/native/.emulator.pid ] && kill "$(cat docs/qa/v32/native/.emulator.pid)" 2>/dev/null
    echo "stopped" ;;
  *) echo "usage: native-emulator.sh boot|metro <app>|open|shot <file>|stop"; exit 1 ;;
esac
