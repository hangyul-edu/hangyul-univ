#!/bin/bash
# Serial leak checks for the locales given as args. Results appended to /tmp/claude-0/leakrun.done
cd /root/hangyul-univ
for loc in "$@"; do
  node scripts/i18n/v9-manifest.mjs >/dev/null 2>&1
  flock /tmp/claude-0/hg-build.lock node scripts/qa/leak-check-v9.mjs "$loc" --widths=390,1440 > /tmp/claude-0/leak-$loc.log 2>&1
  echo "$(date +%H:%M) $loc: $(tail -2 /tmp/claude-0/leak-$loc.log | head -1 | sed 's/.*total leaking text nodes: //')" >> /tmp/claude-0/leakrun.done
done
echo "ALL DONE" >> /tmp/claude-0/leakrun.done
