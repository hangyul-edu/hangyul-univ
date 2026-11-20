#!/usr/bin/env bash
# API evidence for `npm run release:check`: ruff over the whole server tree and the full pytest suite against a dedicated
# test database (HG_TEST_DATABASE_URL; its name must contain "test"). Needs PostgreSQL, Redis and poppler (pdftotext).
# Writes docs/qa/launch-final/after/logs/{api-lint,api-tests}.log and api-ledger.txt.
set -u
cd "$(dirname "$0")/../../.."
OUT=docs/qa/launch-final/after/logs
mkdir -p "$OUT"
L="$OUT/api-ledger.txt"; : > "$L"; fail=0
step() { local n="$1"; shift; if "$@" > "$OUT/$n.log" 2>&1; then echo "PASS  $n" >> "$L"; else echo "FAIL  $n" >> "$L"; fail=1; fi; tail -3 "$OUT/$n.log"; }
step api-lint  bash -c 'cd server && .venv/bin/python -m ruff check app tests scripts alembic'
step api-tests bash -c 'cd server && HG_ENV=development .venv/bin/python -m pytest -q -p no:warnings'
cat "$L"; exit $fail
