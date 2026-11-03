// V9: common:tier.{COMPETITIVE,REACH} must use the same reviewed terms as student:verdict.* (STATE_MAP).
// Writes through v9-merge (validation + source hashes). Usage: node scripts/i18n/v9-sync-tier.mjs <loc...>
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
for (const loc of process.argv.slice(2)) {
  const st = JSON.parse(fs.readFileSync(`packages/i18n/locales/${loc}/student.json`, 'utf8'));
  const v = st.verdict; if (!v?.COMPETITIVE || !v?.REACH) { console.log(loc, 'no student verdicts — skipped'); continue; }
  const f = `scripts/i18n/v9-data/${loc}-tier.json`;
  fs.writeFileSync(f, JSON.stringify({ common: { 'tier.COMPETITIVE': v.COMPETITIVE, 'tier.REACH': v.REACH } }));
  console.log(execFileSync('node', ['scripts/i18n/v9-merge.mjs', loc, f]).toString().trim().split('\n').pop());
}
