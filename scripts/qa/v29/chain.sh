#!/usr/bin/env bash
# V29 final validation chain — one heavy process at a time (brief §79: never Gradle and Playwright together).
# Each step writes docs/qa/v29/completion/logs/<step>.log ending in EXIT=<code>; `release:check` reads that line and the
# log's time (evidence older than the newest source change is stale). Resumable: a step whose log ends in EXIT=0 and is
# newer than every source file is skipped. Needs the dev stack (API 8001, web 3100–3103) for the rendered steps. Start the
# dev API with HG_RATELIMIT_SCALE=1000 (as e2e-run does): the gates register more than the production limit of 10 accounts
# per IP per hour, and the native sign-up test then fails with 429 for a reason that is not a defect.
#   bash scripts/qa/v29/chain.sh [step ...]      run all steps, or only the named ones
cd "$(dirname "$0")/../../.."
L=docs/qa/v29/completion/logs
NEWEST=$(find apps/*/src apps/*/app packages/*/src server/app shared -type f -newer "$L/.stamp" 2>/dev/null | head -1)
ONLY=" $* "
step() { local name=$1; shift
  if [ "$ONLY" != "  " ] && [[ "$ONLY" != *" $name "* ]]; then return; fi
  if [ -f "$L/$name.log" ] && tail -1 "$L/$name.log" | grep -q '^EXIT=0$' \
     && [ -z "$(find apps/*/src apps/*/app packages/*/src server/app shared -type f -newer "$L/$name.log" 2>/dev/null | head -1)" ]; then
    echo "skip $name (fresh)"; return; fi
  echo "== $name: $*"; ( "$@" ; echo "EXIT=$?" ) > "$L/$name.log" 2>&1; tail -1 "$L/$name.log"; }
API_ENV="HG_ENV=development HG_REDIS_URL=redis://localhost:6379/9"
step plans            node scripts/qa/v29/plans.mjs
step addons           node scripts/qa/v29/addons.mjs
step typecheck        npm run -s typecheck
step lint-api         npm run -s lint:api
step i18n-check       npm run -s i18n:check
step console-locales  node scripts/i18n/v29/console-locales.mjs --check
step particles        npm run -s qa:v28-particles
step l10n-v29         env JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs
step web-tests        npm run -s test:web
step api-tests        bash -c "cd server && flock /tmp/claude-0/hg-build.lock env $API_ENV .venv/bin/python -m pytest -q -p no:warnings"
step security-scan    npm run -s qa:v21-security
step build-web        bash -c 'flock /tmp/claude-0/hg-build.lock npm run -s build'
step built-scan       node scripts/qa/v23-gate.mjs --part built
step csp              node scripts/ops/check-csp.mjs
step bundle-secrets   node scripts/ops/scan-bundles-for-secrets.mjs
step pricing-visual   node scripts/qa/v29/pricing-shots.mjs
step visual           npm run -s qa:v28-visual
step buttons          node scripts/qa/v27/buttons.mjs --json docs/qa/v29/completion/buttons.json
step a11y             node scripts/qa/a11y.mjs /root/.cache/hg-axe/node_modules/axe-core/axe.min.js
step e2e-template     node scripts/qa/e2e-db.mjs template
step e2e              node scripts/qa/e2e-run.mjs
step native-scan      npm run -s qa:v23-native
touch "$L/.stamp"
echo CHAIN-DONE
