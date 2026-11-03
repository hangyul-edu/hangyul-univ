#!/usr/bin/env bash
# V30 final validation on the frozen tree: typecheck → builds → qa:v30 chain (preview :4630) → isolated E2E.
cd "$(dirname "$0")/../../.."
L=docs/qa/v30/logs
bash scripts/qa/v30/regress.sh typecheck web-tests build
P=$(ss -ltnp | awk '/:4630 /{print $6}' | grep -oP 'pid=\K[0-9]+' | head -1); [ -n "$P" ] && kill $P; sleep 1
nohup bash scripts/qa/v30/serve.sh > $L/serve.log 2>&1 &
until curl -s -o /dev/null http://127.0.0.1:4630/; do sleep 1; done
bash scripts/qa/v30/chain.sh > $L/chain-final.log 2>&1; echo "CHAIN-EXIT=$?"
( node scripts/qa/e2e-run.mjs; echo "EXIT=$?" ) > $L/e2e.log 2>&1; tail -1 $L/e2e.log
echo FINAL-DONE
