#!/usr/bin/env bash
# V32 — production Expo exports of the three native apps (Android bundle), for the leak scan (scripts/qa/v32/leak.mjs).
# Output: docs/qa/v32/native/<app>-export (gitignored). Sequential: Metro at ~1.5 GB per export on this host.
set -eu
cd "$(dirname "$0")/../../.."
mkdir -p docs/qa/v32/native
for a in student-mobile agency-mobile university-mobile; do
  echo "== $a"
  rm -rf "docs/qa/v32/native/$a-export"
  # the same public origins the eas.json `production` profile sets (EAS injects them there; a local export must too)
  prod_env=$(node -e "const e=require('./apps/$a/eas.json').build.production.env||{};process.stdout.write(Object.entries(e).map(([k,v])=>k+'='+v).join(' '))")
  [ -n "$prod_env" ] || { echo "FAIL  apps/$a/eas.json production profile sets no public origin"; exit 1; }
  (cd "apps/$a" && env $prod_env NODE_ENV=production CI=1 npx expo export --platform android --output-dir "../../docs/qa/v32/native/$a-export" > "../../docs/qa/v32/native/$a-export.log" 2>&1) || { tail -20 "docs/qa/v32/native/$a-export.log"; exit 1; }
  ls "docs/qa/v32/native/$a-export/_expo/static/js/android/" | head -3
  # a production bundle must never point a customer's phone at a development host
  if grep -rlaE "localhost:(8001|3101)|10\.0\.2\.2" "docs/qa/v32/native/$a-export/_expo/static/js/android/" >/dev/null; then echo "FAIL  $a production export contains a development host"; exit 1; fi
  grep -qa "api.univ.talkhangyul.com" -r "docs/qa/v32/native/$a-export/_expo/static/js/android/" || { echo "FAIL  $a production export lacks the public API origin"; exit 1; }
done
echo "native exports done"
