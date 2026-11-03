#!/usr/bin/env bash
# V32 — apply every reviewed patch present in docs/qa/v32/l10n/patches (idempotent: unchanged values are skipped).
#   bash scripts/i18n/v32/apply-all.sh [locale ...]
cd "$(dirname "$0")/../../.."
for f in docs/qa/v32/l10n/patches/*.json; do
  loc=$(basename "$f" | sed -E 's/^([a-zA-Z-]+?)-(marketing-common|student-mobile|consoles|deep1|deep2|server-keys|extra)\.json$/\1/')
  [ $# -gt 0 ] && ! printf '%s\n' "$@" | grep -qx "$loc" && continue
  node scripts/i18n/v32/apply-patch.mjs "$loc" "$f" | tail -1
done
