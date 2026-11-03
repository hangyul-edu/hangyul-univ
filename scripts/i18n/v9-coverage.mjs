// V9 coverage gate: per locale, the share of the student-journey manifest that is translated, and the gate records.
// Writes packages/i18n/locales/_student_status.json:
//   { generated_at, gate, locales: { <loc>: { manifest_pct, native_pct, missing, leak_check: null|{date, leaks, widths},
//                                              synthetic_review: null|{date, min_score} } } }
// leak_check is written by scripts/qa/leak-check-v9.mjs; synthetic_review with --record-review=<loc>:<min>:<YYYY-MM-DD>
// after a review record exists in docs/qa/v9/l10n/<loc>.md. packages/i18n `isStudentAppLocale()` reads this file:
// a locale is offered in the student app only when manifest_pct = 100 AND leak_check.leaks = 0 (en always).
//   node scripts/i18n/v9-coverage.mjs            # all locales
//   node scripts/i18n/v9-coverage.mjs vi ko      # only these rows are recomputed (others kept)
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { auditLocale, LOC, readJson, root } from './v9-lib.mjs';

const args = process.argv.slice(2);
const STATUS = join(LOC, '_student_status.json');
const status = readJson(STATUS, { locales: {} });
status.locales ??= {};
const only = args.filter((a) => !a.startsWith('--'));
const all = readdirSync(LOC).filter((d) => !d.startsWith('_') && existsSync(join(LOC, d, 'common.json'))).sort();
const locs = only.length ? only : all;

for (const a of args.filter((x) => x.startsWith('--record-review='))) {
  const [loc, min, date] = a.slice(16).split(':');
  if (!existsSync(join(root, 'docs/qa/v9/l10n', `${loc}.md`))) {
    console.error(`no review record docs/qa/v9/l10n/${loc}.md — not recorded`); process.exit(1);
  }
  (status.locales[loc] ??= {}).synthetic_review = { date: date ?? new Date().toISOString().slice(0, 10), min_score: Number(min) };
}

const rows = [];
for (const loc of locs) {
  const web = auditLocale(loc, { surface: 'web' });
  const nat = auditLocale(loc, { surface: 'native' });
  const prev = status.locales[loc] ?? {};
  status.locales[loc] = {
    manifest_pct: web.pct,
    native_pct: nat.pct,
    manifest_keys: web.total,
    missing: web.missing.length + web.identical.length + web.stale.length,
    leak_check: prev.leak_check ?? null,
    synthetic_review: prev.synthetic_review ?? null,
  };
}
status.generated_at = new Date().toISOString();
status.gate = 'student app offers a locale iff manifest_pct = 100 and leak_check.leaks = 0 (en always); synthetic_review is recorded for §58.4 but does not gate the picker';
status.locales = Object.fromEntries(Object.entries(status.locales).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(STATUS, JSON.stringify(status, null, 1) + '\n');

console.log('locale   web%    native%  missing  leak-check            review     offered');
for (const [loc, s] of Object.entries(status.locales)) {
  if (only.length && !only.includes(loc)) continue;
  const offered = loc === 'en' || (s.manifest_pct >= 100 && s.leak_check && s.leak_check.leaks === 0);
  const lc = s.leak_check ? `${s.leak_check.date} ${s.leak_check.leaks} leaks` : '—';
  const rv = s.synthetic_review ? `${s.synthetic_review.min_score}` : '—';
  console.log(`${loc.padEnd(8)} ${String(s.manifest_pct).padStart(5)}  ${String(s.native_pct).padStart(7)}  ${String(s.missing).padStart(7)}  ${lc.padEnd(20)}  ${rv.padEnd(9)}  ${offered ? 'yes' : 'no'}`);
}
