#!/bin/bash
# Production builds (serialized), initial JS sizes, demo-email leak grep. Logs: docs/qa/v9/gates/
cd /root/hangyul-univ; G=docs/qa/v9/gates; : > $G/builds.txt
for a in marketing-web student-web agency-web university-web; do
  flock /tmp/claude-0/hg-build.lock npm run build -w @hangyul/$a > $G/build-$a.log 2>&1; echo "build $a: exit $?" >> $G/builds.txt
  python3 scripts/qa/initial-js.py apps/$a >> $G/builds.txt
done
n=$(grep -rl "@demo.hangyul.kr" apps/*/dist 2>/dev/null | wc -l); echo "bundles containing a demo email: $n" >> $G/builds.txt
echo "BUILDS DONE" >> $G/builds.txt
