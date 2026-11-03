#!/bin/bash
# V9 gates, serialized behind the build lock; logs in docs/qa/v9/gates/. Usage: scripts/qa/v9-gates.sh
cd /root/hangyul-univ
G=docs/qa/v9/gates; mkdir -p $G; : > $G/summary.txt
run() { name=$1; shift; flock /tmp/claude-0/hg-build.lock "$@" > $G/$name.log 2>&1; echo "$name: exit $?" >> $G/summary.txt; }
run typecheck npm run typecheck
run ruff bash -c "cd server && .venv/bin/ruff check ."
run i18n npm run i18n:check
run vitest npm run test:web
run pytest bash -c "cd server && .venv/bin/pytest -q -x --no-header -p no:cacheprovider"
echo "GATES DONE" >> $G/summary.txt
