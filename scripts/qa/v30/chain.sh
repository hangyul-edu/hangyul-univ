#!/usr/bin/env bash
# V30 gate chain — `npm run qa:v30` (brief Part 59). Serial: one browser at a time on this host.
#
#   qa:v30-marquee     every rendered crest instance, 4 loop positions, real clicks, 5 locales, reduced motion
#   qa:v30-directory   /universities toolbar geometry (5 locales × 3 widths) + real filter/chip/search/map/back/sheet
#   visual crawl       every crawlable route in ROUTE_INVENTORY (ko 390+1280, plus en/vi/zh-Hans/ar on key routes):
#                      control geometry, hitbox/pointer, overlays, overflow, broken image, raw key, mixed locale,
#                      console error — fails on any finding not in docs/qa/v30/visual/ACCEPTED.json
#   qa:marquee         V14 seam gate (group width == half track) — the hitbox change must not reopen a seam
#   qa:v27-marquee     V27 duplicate/affordance gate, rewritten for the V30 invariant (copies not inert)
#
# BASE_MARKETING defaults to the production preview (scripts/qa/v30/serve.sh); the crawl uses the dev stack.
# Each step logs to docs/qa/v30/logs/<step>.log and the chain prints EXIT=<n> per step; read EXIT=, not prose.
set -u
cd "$(dirname "$0")/../../.."
mkdir -p docs/qa/v30/logs
BASE_MARKETING="${BASE_MARKETING:-http://localhost:4630}"
STEPS="${*:-marquee directory crawl crawl-locales seam v27}"
fails=0
run() { local name=$1; shift; echo "== $name"; "$@" > "docs/qa/v30/logs/$name.log" 2>&1; local rc=$?; tail -n 3 "docs/qa/v30/logs/$name.log"; echo "EXIT[$name]=$rc"; [ $rc -eq 0 ] || fails=$((fails+1)); }
for s in $STEPS; do
  case $s in
    marquee)       run marquee env BASE="$BASE_MARKETING" node scripts/qa/v30/marquee.mjs ;;
    directory)     run directory env BASE="$BASE_MARKETING" node scripts/qa/v30/directory.mjs ;;
    crawl)         run crawl node scripts/qa/v30/visual.mjs --label=gate --locales=ko --widths=390,1280 --check ;;
    crawl-locales) run crawl-locales node scripts/qa/v30/visual.mjs --label=gate-locales --locales=en,vi,zh-Hans,ar --widths=390,1280 \
                     --routes=/,/universities,/universities/:slug,/start,/explore,/services,/applications,/documents,/students,/applicants --check ;;
    seam)          run seam env BASE="$BASE_MARKETING" node scripts/qa/v14-marquee.mjs ;;
    v27)           run v27 env BASE="$BASE_MARKETING" node scripts/qa/v27/marquee.mjs ;;
    *) echo "unknown step $s"; fails=$((fails+1)) ;;
  esac
done
echo "EXIT=$fails"
exit $fails
