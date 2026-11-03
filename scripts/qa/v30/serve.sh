#!/usr/bin/env bash
# Serves the marketing PRODUCTION build on :4630 (proxying /api to the dev API on :8001) for the V30 gates.
#   npm run build -w @hangyul/marketing-web && bash scripts/qa/v30/serve.sh
cd "$(dirname "$0")/../../../apps/marketing-web" || exit 1
exec ../../node_modules/.bin/vite preview --port 4630 --strictPort --host 127.0.0.1
