#!/usr/bin/env bash
# V21 §58 — run a card charge against an API whose own output is captured, so the log can be read.
#
# The dev server writes to a terminal, which cannot be scanned after the fact. This starts a second
# API on a spare port with stdout and stderr redirected to $1, drives one real card payment through
# it, and leaves the file for the scanner. The API is stopped again on the way out.
set -u
LOG="${1:?usage: capture-runtime-log.sh <logfile>}"
PORT="${HG_QA_LOG_PORT:-8099}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

: > "$LOG"
cd "$ROOT/server" || exit 1
# `--log-level debug` on purpose: if anything sensitive is ever written, this is the setting that
# writes it. A scan of a quiet log proves less than a scan of a loud one.
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --log-level debug \
  >> "$LOG" 2>&1 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null; wait "$API_PID" 2>/dev/null' EXIT

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 1
done

cd "$ROOT" || exit 1
HG_QA_API="http://127.0.0.1:$PORT/api/v1" node scripts/qa/v21/toss-test-transaction.mjs >> "$LOG" 2>&1
RC=$?
sleep 1
echo "transaction exit=$RC" >> "$LOG"
exit 0
