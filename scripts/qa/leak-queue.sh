#!/bin/bash
# Serial leak-check queue: append locale codes to /tmp/claude-0/leakq (one per line); this loop checks them one at a time.
# Results: /tmp/claude-0/leak-<loc>.log and docs/qa/v9/l10n/leaks/<loc>.json; summary lines in /tmp/claude-0/leakq.done
cd /root/hangyul-univ
touch /tmp/claude-0/leakq /tmp/claude-0/leakq.done
while true; do
  loc=$(head -1 /tmp/claude-0/leakq)
  if [ -z "$loc" ]; then sleep 15; continue; fi
  sed -i '1d' /tmp/claude-0/leakq
  node scripts/i18n/v9-manifest.mjs >/dev/null 2>&1
  flock /tmp/claude-0/hg-build.lock node scripts/qa/leak-check-v9.mjs "$loc" --widths=390,1440 > /tmp/claude-0/leak-$loc.log 2>&1
  echo "$(date +%H:%M) $loc: $(tail -2 /tmp/claude-0/leak-$loc.log | head -1 | sed 's/.*total leaking text nodes: //')" >> /tmp/claude-0/leakq.done
done
