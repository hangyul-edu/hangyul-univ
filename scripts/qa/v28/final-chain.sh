#!/usr/bin/env bash
# V28 final validation, one heavy step at a time (brief execution order: never Gradle and Playwright together). Each step
# writes docs/qa/v28/completion/logs/<step>.log ending in EXIT=<code>; read that line, never the prose. Resumable: a step
# whose log already ends in EXIT=0 is skipped. Needs the dev stack (8001, 3100–3103) for buttons/marquee/visual.
cd "$(dirname "$0")/../../.."
L=docs/qa/v28/completion/logs
step() { local name=$1; shift
  if [ -f "$L/$name.log" ] && tail -1 "$L/$name.log" | grep -q '^EXIT=0$'; then echo "skip $name"; return; fi
  echo "== $name: $*"; ( "$@" ; echo "EXIT=$?" ) > "$L/$name.log" 2>&1; tail -1 "$L/$name.log"; }
step typecheck npm run -s typecheck
step lint-api npm run -s lint:api
step admissions-sync node scripts/admissions/sync.mjs --check
step qa-v27-static npm run -s qa:v27
step particles npm run -s qa:v28-particles
step l10n-pass1 node scripts/i18n/v28/validate.mjs
step l10n-pass2 env JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs
step web-tests npm run -s test:web
step api-tests bash -c 'cd server && .venv/bin/python -m pytest -q -p no:warnings'
step build-web bash -c 'flock /tmp/claude-0/hg-build.lock npm run -s build'
step buttons node scripts/qa/v27/buttons.mjs --json docs/qa/v28/buttons-final.json
step marquee node scripts/qa/v27/marquee.mjs
step visual npm run -s qa:v28-visual
step e2e-template node scripts/qa/e2e-db.mjs template
step e2e node scripts/qa/e2e-run.mjs
echo CHAIN-DONE
