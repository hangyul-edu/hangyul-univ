#!/usr/bin/env bash
# V27 final validation, one heavy step at a time (brief §57). Each step writes docs/qa/v27/completion/logs/<step>-final.log
# ending in EXIT=<code>; read that line, never the prose. Resumable: a step whose log already ends in EXIT=0 is skipped.
cd "$(dirname "$0")/../../.."
L=docs/qa/v27/completion/logs
step() { local name=$1; shift
  if [ -f "$L/$name-final.log" ] && tail -1 "$L/$name-final.log" | grep -q '^EXIT=0$'; then echo "skip $name"; return; fi
  echo "== $name: $*"; ( "$@" ; echo "EXIT=$?" ) > "$L/$name-final.log" 2>&1; tail -1 "$L/$name-final.log"; }
step typecheck npm run -s typecheck
step lint npm run -s lint:api
step admissions-sync node scripts/admissions/sync.mjs --check
step qa-v27 npm run -s qa:v27
step web-tests npm run -s test:web
step api-tests bash -c 'cd server && .venv/bin/python -m pytest -q -p no:warnings'
step build-web bash -c 'flock /tmp/claude-0/hg-build.lock npm run -s build'
step buttons node scripts/qa/v27/buttons.mjs --json docs/qa/v27/buttons-final.json
step marquee node scripts/qa/v27/marquee.mjs
step identity-live npm run -s qa:identity-live
step e2e-template node scripts/qa/e2e-db.mjs template
step e2e node scripts/qa/e2e-run.mjs
echo CHAIN-DONE
