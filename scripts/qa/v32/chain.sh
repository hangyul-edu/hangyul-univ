#!/usr/bin/env bash
# `npm run qa:v32` — the V32 release gate, sequential (the host has ~5 GB; nothing memory-heavy runs concurrently).
# Every step writes docs/qa/v32/logs/<step>.log and the ledger docs/qa/v32/logs/ledger.txt; the chain stops at the
# first failure unless QA_V32_CONTINUE=1. Native exports (step 13) run only when QA_V32_NATIVE=1 (they need the Expo
# toolchain and ~10 minutes); the leak scan still checks whatever export is present.
set -u
cd "$(dirname "$0")/../../.."
mkdir -p docs/qa/v32/logs
LEDGER=docs/qa/v32/logs/ledger.txt
: > "$LEDGER"
fail=0
step() {
  local name="$1"; shift
  local log="docs/qa/v32/logs/$name.log"
  printf '%s  %s … ' "$(date -u +%H:%M:%S)" "$name"
  if "$@" > "$log" 2>&1; then
    printf 'PASS\n'; printf 'PASS  %s\n' "$name" >> "$LEDGER"
  else
    printf 'FAIL (see %s)\n' "$log"; printf 'FAIL  %s\n' "$name" >> "$LEDGER"; fail=1
    [ "${QA_V32_CONTINUE:-0}" = "1" ] || { tail -20 "$log"; exit 1; }
  fi
}
step 01-leak-source        node scripts/qa/v32/leak.mjs
step 02-data-clean         npm run -s qa:v32-data-clean
step 03-i18n               npm run -s i18n:check
step 04-typecheck          npm run -s typecheck
step 05-lint-api           npm run -s lint:api
step 06-api-tests          npm run -s test:api
step 07-web-unit           npm run -s test:web
step 08-build-web          npm run -s build
step 09-marketing-serverless node scripts/qa/marketing-serverless.mjs
step 10-selects            node scripts/qa/e2e-run.mjs e2e/v32-selects.spec.ts
step 11-crawl              node scripts/qa/e2e-run.mjs e2e/v32-crawl.spec.ts
step 12-a11y               node scripts/qa/e2e-run.mjs e2e/v32-a11y.spec.ts
step 13-critical-e2e       node scripts/qa/e2e-run.mjs e2e/v29-contract.spec.ts e2e/v16-journey.spec.ts e2e/tenancy.spec.ts
step 13b-native-signup-api node scripts/qa/e2e-run.mjs --vitest apps/student-mobile
step 14-e2e-teardown-check node scripts/qa/v32/teardown-check.mjs
if [ "${QA_V32_NATIVE:-0}" = "1" ]; then step 15-native-exports bash scripts/qa/v32/native-export.sh; fi
step 16-leak-bundles       node scripts/qa/v32/leak.mjs
echo; cat "$LEDGER"
exit $fail
