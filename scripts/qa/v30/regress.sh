#!/usr/bin/env bash
# V30 regression (brief Part 60) — non-browser steps, serial. Each step → docs/qa/v30/logs/regress-<name>.log ending EXIT=<n>.
cd "$(dirname "$0")/../../.."
L=docs/qa/v30/logs; mkdir -p $L
API_ENV="HG_ENV=development HG_REDIS_URL=redis://localhost:6379/9"
step() { local name=$1; shift; echo "== $name"; ( "$@"; echo "EXIT=$?" ) > "$L/regress-$name.log" 2>&1; tail -1 "$L/regress-$name.log"; }
for s in ${*:-typecheck lint-api i18n-check console-locales particles web-tests api-tests}; do case $s in
  typecheck)       step typecheck npm run -s typecheck ;;
  lint-api)        step lint-api npm run -s lint:api ;;
  i18n-check)      step i18n-check npm run -s i18n:check ;;
  console-locales) step console-locales node scripts/i18n/v29/console-locales.mjs --check ;;
  particles)       step particles npm run -s qa:v28-particles ;;
  web-tests)       step web-tests npm run -s test:web ;;
  api-tests)       step api-tests bash -c "cd server && flock /tmp/claude-0/hg-build.lock env $API_ENV .venv/bin/python -m pytest -q -p no:warnings" ;;
  build)           step build bash -c 'flock /tmp/claude-0/hg-build.lock npm run -s build' ;;
esac; done
echo REGRESS-DONE
