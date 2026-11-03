#!/usr/bin/env bash
# V31 native driver: tap the first on-screen element whose text/content-desc matches a regex, or screenshot.
#   adb-tap.sh tap "<regex>"     ·   adb-tap.sh shot <out.png>   ·   adb-tap.sh texts   (list visible texts)
export PATH=/root/android-sdk/platform-tools:$PATH
dump() { adb shell rm -f /sdcard/ui.xml >/dev/null 2>&1; adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }
case "$1" in
  shot) timeout 60 adb exec-out screencap -p > "$2" ;;
  texts) dump | grep -oE '(text|content-desc)="[^"]+"' | sed -E 's/^(text|content-desc)="//; s/"$//' | sort -u ;;
  tap)
    b=$(dump | python3 -c "
import re,sys
x=sys.stdin.read(); rx=re.compile(sys.argv[1])
for m in re.finditer(r'<node[^>]*>', x):
    n=m.group(0); t=re.search(r' text=\"([^\"]*)\"',n); d=re.search(r'content-desc=\"([^\"]*)\"',n)
    s=(t.group(1) if t else '')+' '+(d.group(1) if d else '')
    if rx.search(s):
        b=re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',n); x1,y1,x2,y2=map(int,b.groups()); print((x1+x2)//2,(y1+y2)//2); break
" "$2")
    [ -n "$b" ] && adb shell input tap $b && echo "tapped $2 at $b" || { echo "NOT FOUND: $2"; exit 1; } ;;
esac
