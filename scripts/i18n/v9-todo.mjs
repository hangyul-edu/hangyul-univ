// V9 translator to-do list for one locale (or --all): manifest keys that are missing, identical to English (beyond
// allowed tokens such as TOPIK, D-2, KRW, the brand) or stale (English changed since v9-merge recorded the source).
//   node scripts/i18n/v9-todo.mjs vi            → scripts/i18n/v9-todo/vi.json
//   node scripts/i18n/v9-todo.mjs vi --native   → also the native student app (mobile namespace)
//   node scripts/i18n/v9-todo.mjs --all         → every non-en locale + a table
// Output: { locale, plural_categories, counts, todo: { ns: { key: english } }, identical: [...], stale: [...] }.
// Plural families appear as <base>_<category> for exactly the categories the locale needs (Intl.PluralRules / CLDR).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { auditLocale, LOC, pluralCats, root } from './v9-lib.mjs';

const args = process.argv.slice(2);
const surface = args.includes('--native') ? 'native' : 'web';
const outDir = join(root, 'scripts/i18n/v9-todo');
mkdirSync(outDir, { recursive: true });
const locs = args.includes('--all') ? readdirSync(LOC).filter((d) => !d.startsWith('_') && d !== 'en').sort() : args.filter((a) => !a.startsWith('--'));
if (!locs.length) { console.error('usage: v9-todo.mjs <loc>|--all [--native]'); process.exit(2); }

const rows = [];
for (const loc of locs) {
  const a = auditLocale(loc, { surface });
  const out = {
    locale: loc,
    surface,
    generated_at: new Date().toISOString(),
    plural_categories: pluralCats(loc),
    note: 'Translate every value in `todo` (keep {{placeholders}} and <0>…</0> tags exactly; plural keys: one entry per category listed). Then: node scripts/i18n/v9-merge.mjs <loc> <your-file.json>. Mark a value that must stay identical to English with "_identical_ok": ["ns:key"].',
    counts: { manifest: a.total, done: a.done, missing: a.missing.length, identical: a.identical.length, stale: a.stale.length, pct: a.pct },
    plural_families: a.families.length,
    todo: a.todo,
    identical: a.identical,
    stale: a.stale,
  };
  writeFileSync(join(outDir, `${loc}${surface === 'native' ? '.native' : ''}.json`), JSON.stringify(out, null, 1) + '\n');
  rows.push([loc, a.total, a.missing.length, a.identical.length, a.stale.length, a.pct]);
}
console.log('locale   manifest  missing  identical  stale  coverage');
for (const [l, t, m, i, s, p] of rows) console.log(`${l.padEnd(8)} ${String(t).padStart(8)} ${String(m).padStart(8)} ${String(i).padStart(10)} ${String(s).padStart(6)}  ${p}%`);
