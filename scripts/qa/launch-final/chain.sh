#!/usr/bin/env bash
# `npm run qa:launch` — the launch-final gate chain. Sequential; every step logs to
# docs/qa/launch-final/after/logs/<step>.log and the ledger is docs/qa/launch-final/after/logs/ledger.txt.
# Needs no API and no database: the signed-in screens run in Design Preview (synthetic fixtures), sign-up runs with
# the identity API mocked at the network layer. API tests / seeded E2E are separate (`npm run qa:v32`, needs the stack).
# Zoom runs model N% zoom as a (width/N) CSS-px viewport on 768/1280/1440 windows; language runs cover Marketing and
# Student (the consoles offer ko/en only) at 320/390/1440.
# The chain continues past a failure so the ledger is complete; the exit code is non-zero if any step failed.
set -u
cd "$(dirname "$0")/../../.."
OUT=docs/qa/launch-final/after
mkdir -p "$OUT/logs"
LEDGER="$OUT/logs/ledger.txt"
: > "$LEDGER"
fail=0
step() {
  local name="$1"; shift
  local log="$OUT/logs/$name.log"
  printf '%s  %s … ' "$(date -u +%H:%M:%S)" "$name"
  if "$@" > "$log" 2>&1; then printf 'PASS\n'; printf 'PASS  %s\n' "$name" >> "$LEDGER"
  else printf 'FAIL (see %s)\n' "$log"; printf 'FAIL  %s\n' "$name" >> "$LEDGER"; fail=1; fi
}
build_all() {
  npm run build -w @hangyul/marketing-web \
    && VITE_ENABLE_DESIGN_PREVIEW=1 npm run build -w @hangyul/student-web \
    && VITE_ENABLE_DESIGN_PREVIEW=1 npm run build -w @hangyul/agency-web \
    && VITE_ENABLE_DESIGN_PREVIEW=1 npm run build -w @hangyul/university-web
}
serve_start() { node scripts/qa/launch-final/serve.mjs > "$OUT/logs/serve.out" 2>&1 & echo $! > "$OUT/logs/serve.pid"; sleep 2; }
serve_stop() { [ -f "$OUT/logs/serve.pid" ] && kill "$(cat "$OUT/logs/serve.pid")" 2>/dev/null; rm -f "$OUT/logs/serve.pid" "$OUT/logs/serve.out"; }
B="--marketing http://127.0.0.1:4100 --student http://127.0.0.1:4101 --agency http://127.0.0.1:4102 --university http://127.0.0.1:4103"

step 01-docs-gates          python3 scripts/docs/check-links.py --all
step 02-leak-source         node scripts/qa/v32/leak.mjs
step 03-i18n                npm run -s i18n:check
step 04-tokens-current      bash -c 'a=$(sha1sum < packages/design-tokens/tokens.css); npm run -s tokens:build; [ "$a" = "$(sha1sum < packages/design-tokens/tokens.css)" ]'
step 05-typecheck           npm run -s typecheck
step 06-web-unit            npm run -s test:web
step 07-build-preview-on    build_all
step 08-preview-gate        node scripts/release/preview-gate.mjs --bundles on
step 09-leak-bundles        node scripts/qa/v32/leak.mjs
serve_start
step 10-preview-isolation   node scripts/qa/launch-final/preview.mjs --strict --out after
step 11-signup-walk-ko      node scripts/qa/launch-final/signup-walk.mjs --out after --lang ko
step 12-signup-walk-ar      node scripts/qa/launch-final/signup-walk.mjs --out after --lang ar
step 13-matrix              node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview $B
step 14-matrix-zoom-200     node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview --zoom 2 --widths 768,1280,1440 --shots none $B
step 15-matrix-zoom-150     node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview --zoom 1.5 --widths 768,1280,1440 --shots none $B
step 16-matrix-zoom-125     node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview --zoom 1.25 --widths 768,1280,1440 --shots none $B
for L in ko vi ja zh-Hans ru ar; do
  step "17-matrix-lang-$L"  node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview --lang "$L" --widths 320,390,1440 --apps marketing,student --shots key $B
done
step 18-matrix-dark-device  node scripts/qa/launch-final/matrix.mjs --tag after --out after --preview --dark --widths 390,1440 --shots none $B
step 19-a11y                node scripts/qa/launch-final/a11y.mjs --out after
serve_stop
# Public-launch shape: the same apps built with the flag OFF must contain no preview code at all.
build_off() { npm run build -w @hangyul/student-web && npm run build -w @hangyul/agency-web && npm run build -w @hangyul/university-web; }
step 20-build-preview-off   build_off
step 21-preview-gate-off    node scripts/release/preview-gate.mjs --bundles off
echo; cat "$LEDGER"
exit $fail
