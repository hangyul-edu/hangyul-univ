#!/usr/bin/env bash
# Tiny adb driver for native QA on the Android emulator: adb-shot.sh <out.png> [tap x y | text "..." | key CODE | swipe x1 y1 x2 y2]...
set -e
export PATH=/root/android-sdk/platform-tools:$PATH
out=$1; shift
while [ $# -gt 0 ]; do
  case $1 in
    tap) adb shell input tap $2 $3; shift 3;;
    text) adb shell input text "$(printf %s "$2" | sed 's/ /%s/g')"; shift 2;;
    key) adb shell input keyevent $2; shift 2;;
    swipe) adb shell input swipe $2 $3 $4 $5 400; shift 5;;
    wait) for _ in $(seq 1 $2); do adb shell true; done; shift 2;;
  esac
  adb shell true
done
adb exec-out screencap -p > "$out"
