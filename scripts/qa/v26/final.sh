#!/usr/bin/env bash
# V26 — the sequential final validation (brief §79/§83/§100), one heavy process at a time, resumable.
#   scripts/qa/v26/final.sh [step…]          run the listed steps (default: all, in order)
#   FORCE=1 scripts/qa/v26/final.sh step      re-run a step whose final log is already green
# Each step writes docs/qa/v26/completion/logs/<step>-final.log ending in "EXIT=<code>"; a step whose log already ends in
# EXIT=0 is skipped unless FORCE=1, so a VM restart resumes where it stopped. Requirements: the dev stack (:8001, :3100–3103)
# for the rendered gates, the isolated scale stack (:8091/:4702) for `scale`, nothing else heavy running.
set -u
ROOT=/root/hangyul-univ
LOGS=$ROOT/docs/qa/v26/completion/logs
mkdir -p "$LOGS"
cd "$ROOT"

run() {
  local name=$1; shift
  local log=$LOGS/$name-final.log
  if [ "${FORCE:-0}" != 1 ] && [ -f "$log" ] && tail -1 "$log" | grep -q '^EXIT=0$'; then
    echo "== $name: already green ($log) — skipped"; return 0
  fi
  echo "== $name: $(date +%H:%M:%S) → $log"
  : > "$log"
  ( "$@" ) >> "$log" 2>&1
  local code=$?
  echo "EXIT=$code" >> "$log"
  echo "== $name: EXIT=$code ($(tail -2 "$log" | head -1 | cut -c1-100))"
  return $code
}

# Latency gates (scale) need a host that is not saturated by sibling jobs: wait up to 20 min for a 1-min load under 4,
# then record the load the run started under — a red under load is still red, but the log says what it ran against.
quiet() { local i; for i in $(seq 1 80); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l < 4)}" && break; sleep 15; done; echo "host load at start: $(cut -d' ' -f1-3 /proc/loadavg) · ffmpeg procs: $(pgrep -c ffmpeg || true) · free: $(free -m | awk 'NR==2{print $7}') MB"; }
export -f quiet
step() {
  case $1 in
    typecheck)  run typecheck npm run -s typecheck ;;
    lint)       run lint npm run -s lint:api ;;
    web-tests)  run web-tests npm run -s test:web ;;
    api-tests)  run api-tests npm run -s test:api ;;
    security)   run security node scripts/qa/v21/security-scan.mjs --no-runtime ;;
    e2e)        run e2e node scripts/qa/e2e-run.mjs ;;
    qa-v26)     run qa-v26 node scripts/qa/v26-gate.mjs ;;
    scale)      run scale bash -c 'quiet; node scripts/qa/v26/scale.mjs --json docs/qa/v26/scale-1000.json' ;;
    regression) run regression bash -c 'set -o pipefail; node scripts/qa/v25-gate.mjs; a=$?; node scripts/qa/v23-gate.mjs; b=$?; echo "qa:v25 exit $a · qa:v23 exit $b"; [ $a = 0 ] && [ $b = 0 ]' ;;
    build-web)  run build-web npm run -s build ;;
    *) echo "unknown step: $1"; return 2 ;;
  esac
}

ALL=(typecheck lint web-tests api-tests security e2e qa-v26 scale regression build-web)
steps=("$@"); [ ${#steps[@]} -eq 0 ] && steps=("${ALL[@]}")
fail=0
for s in "${steps[@]}"; do step "$s" || fail=1; done
echo "== final: $([ $fail = 0 ] && echo ALL GREEN || echo 'some steps FAILED — see the logs')"
exit $fail
