#!/usr/bin/env bash
# V31 gate chain — `npm run qa:v31` (brief Part 70). Serial: one browser at a time on this host.
#
#   typecheck      every workspace (tsc)
#   lint-api       ruff on server/
#   l10n           qa:v31-l10n — placeholder/tags/plural/hangul over 56 bundles; script/untranslated/stale/forbidden
#                  over the market locales (exit 1 on any non-warning finding)
#   particles      qa:v28-particles — Korean particle pairs
#   fidelity       V11 owner copy fidelity (ko + ru Koreanasha strings verbatim)
#   localnames     pytest server/tests/test_v31_localnames.py — server names resolved for the reader
#   stage          qa:v31-stage — pipeline rail: views outside the rail, count == records, selection, keyboard, one
#                  target, zero stage, no overflow at 1440/1280/1024/768/390
#   pricing        qa:v31-pricing — homepage pricing tail: one composition, alignment, columns, disclosure groups,
#                  blank regions, sticky-header anchor (ko/en/vi/ar × 1440/1024/768/390)
#   crawl          V30 visual crawl (ko 390+1280, every route) — buttons, hitbox, overflow, raw key, mixed locale
#   crawl-locales  V30 crawl in en/vi/zh-Hans/ar on key routes
#   v30            V30 marquee + directory gates (regression)
#   native         native bundle export for the three apps (Metro bundle compiles; no device needed)
#
# Each step logs to docs/qa/v31/logs/<step>.log; read EXIT=, not prose.
set -u
cd "$(dirname "$0")/../../.."
mkdir -p docs/qa/v31/logs
BASE_MARKETING="${BASE_MARKETING:-http://127.0.0.1:3100}"
STEPS="${*:-typecheck lint-api l10n particles fidelity localnames stage pricing crawl crawl-locales v30 native}"
fails=0
run() { local name=$1; shift; echo "== $name"; "$@" > "docs/qa/v31/logs/$name.log" 2>&1; local rc=$?; tail -n 3 "docs/qa/v31/logs/$name.log"; echo "EXIT[$name]=$rc"; [ $rc -eq 0 ] || fails=$((fails+1)); }
native() { for a in student-mobile agency-mobile university-mobile; do (cd apps/$a && npx expo export --platform android --output-dir /tmp/claude-0/v31-export-$a >/dev/null) || return 1; echo "$a bundled"; done; }
for s in $STEPS; do
  case $s in
    typecheck)     run typecheck npm run typecheck ;;
    lint-api)      run lint-api npm run lint:api ;;
    l10n)          run l10n node scripts/qa/v31/l10n.mjs ;;
    particles)     run particles npm run qa:v28-particles ;;
    fidelity)      run fidelity node scripts/qa/v11-copy-fidelity.mjs ;;
    localnames)    run localnames bash -c 'cd server && HG_REDIS_URL=redis://localhost:6379/9 .venv/bin/python -m pytest -q -p no:warnings tests/test_v31_localnames.py' ;;
    stage)         run stage node scripts/qa/v31/stage.mjs ;;
    pricing)       run pricing env BASE="$BASE_MARKETING" node scripts/qa/v31/pricing.mjs ;;
    crawl)         run crawl node scripts/qa/v30/visual.mjs --label=v31-gate --locales=ko --widths=390,1280 --check ;;
    crawl-locales) run crawl-locales node scripts/qa/v30/visual.mjs --label=v31-gate-locales --locales=en,vi,zh-Hans,ar --widths=390,1280 \
                     --routes=/,/universities,/universities/:slug,/start,/explore,/services,/applications,/documents,/students,/applicants --check ;;
    v30)           run v30 env BASE_MARKETING="$BASE_MARKETING" bash scripts/qa/v30/chain.sh marquee directory ;;
    native)        run native native ;;
    *) echo "unknown step $s"; fails=$((fails+1)) ;;
  esac
done
echo "EXIT=$fails"
exit $fails
