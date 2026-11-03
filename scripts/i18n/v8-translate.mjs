// V8 translations for non-source locales — merges hand-drafted data from scripts/i18n/v8-data/*.json into
// packages/i18n/locales/<loc>/<ns>.json. Reusable and idempotent; never touches keys outside its scope.
//
//   node scripts/i18n/v8-translate.mjs            # merge everything
//   node scripts/i18n/v8-translate.mjs --check    # validate data only, write nothing
//
// Data files:  marketing-*.json  → { "<loc>": <marketing `v8` subtree> }   (the whole `v8` subtree is owned here)
//              student-*.json    → { "<loc>": <partial student tree> }     (only the V8 keys below are owned here)
// Rules
// - en/ko are written by v8-marketing.mjs / v8-student.mjs and are never touched by this script.
// - Only locales that already have the target file are written (no new namespace files are created).
// - Every value must exist in English and keep the same {{placeholders}}; plural suffixes must be CLDR categories
//   of the locale. Unknown keys abort the run.
// - Student: keys under STUDENT_OWNED are overwritten; other `more.*` keys are filled only when missing
//   (earlier passes may already have a reviewed translation).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const loc = (l, ns) => join(root, 'packages/i18n/locales', l, `${ns}.json`);
const dataDir = join(here, 'v8-data');
const checkOnly = process.argv.includes('--check');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const ph = (s) => [...s.matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((m) => m[1]).filter((x) => x !== 'count').sort().join(',');
const tags = (s) => [...s.matchAll(/<\/?(\w+)>/g)].map((m) => m[0]).sort().join('');
const plural = /_(zero|one|two|few|many|other)$/;
const setPath = (o, path, v) => { const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k] && typeof c[k] === 'object' ? c[k] : (c[k] = {}); c[ks.at(-1)] = v; };
const hasPath = (o, path) => path.split('.').reduce((c, k) => (c && typeof c === 'object' && k in c ? c[k] : undefined), o) !== undefined;

const STUDENT_OWNED = [
  'discover.verdict.check', 'discover.emptyVerdict.check', 'discover.otherDegree_', 'discover.confirmEducation.',
  'more.budget', 'more.hint.universities', 'more.hint.compare', 'more.hint.applications', 'more.hint.documents', 'more.hint.budget',
  'v8.compare.', 'v8.budget.fee.', 'v4.verdictText.check',
];
const owned = (k) => STUDENT_OWNED.some((p) => (p.endsWith('.') || p.endsWith('_') ? k.startsWith(p) : k === p));

let errors = 0;
const err = (m) => { console.error('ERROR', m); errors++; };
function validate(l, ns, entries, enMap) {
  let cats;
  try { cats = new Intl.PluralRules(l).resolvedOptions().pluralCategories; } catch { cats = ['one', 'other']; }
  for (const [k, v] of entries) {
    const base = k.replace(plural, '');
    const src = enMap.get(k) ?? enMap.get(`${base}_other`);
    if (src === undefined) { err(`${l}/${ns}: unknown key ${k}`); continue; }
    if (plural.test(k) && !enMap.has(k) && !cats.includes(k.match(plural)[1])) err(`${l}/${ns}: plural ${k} not a CLDR category for ${l} (${cats})`);
    if (ph(src) !== ph(v)) err(`${l}/${ns}: placeholder mismatch at ${k}: "${v}"`);
    if (tags(src) !== tags(v)) err(`${l}/${ns}: tag mismatch at ${k}`);
    if (!v.trim()) err(`${l}/${ns}: empty ${k}`);
  }
}

const files = readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort();
const enMarketing = read(loc('en', 'marketing')).v8;
const enMktMap = new Map(flat(enMarketing));
const enStudentMap = new Map(flat(read(loc('en', 'student'))));
const summary = {};

for (const f of files) {
  const ns = f.startsWith('marketing-') ? 'marketing' : f.startsWith('student-') ? 'student' : null;
  if (!ns) continue;
  const data = read(join(dataDir, f));
  for (const [l, tree] of Object.entries(data)) {
    if (l === 'en' || l === 'ko') { err(`${f}: ${l} is owned by v8-${ns}.mjs`); continue; }
    const target = loc(l, ns);
    if (!existsSync(target)) { console.warn(`skip ${l}/${ns}: no ${ns}.json for this locale`); continue; }
    const entries = flat(tree);
    if (ns === 'marketing') {
      validate(l, 'marketing.v8', entries, enMktMap);
      const have = new Set(entries.map(([k]) => k));
      const missing = [...enMktMap.keys()].filter((k) => !have.has(k));
      if (missing.length) err(`${l}/marketing.v8: missing ${missing.join(', ')}`);
      if (!checkOnly) { const j = read(target); j.v8 = tree; writeFileSync(target, JSON.stringify(j, null, 2) + '\n'); }
      summary[l] = { ...(summary[l] ?? {}), marketing: entries.length };
    } else {
      validate(l, 'student', entries, enStudentMap);
      const j = read(target);
      let written = 0, filled = 0, kept = 0;
      for (const [k, v] of entries) {
        if (owned(k)) { setPath(j, k, v); written++; }
        else if (k.startsWith('more.')) { if (hasPath(j, k)) kept++; else { setPath(j, k, v); filled++; } }
        else err(`${l}/student: ${k} is outside the V8 scope of this script`);
      }
      if (!checkOnly) writeFileSync(target, JSON.stringify(j, null, 2) + '\n');
      summary[l] = { ...(summary[l] ?? {}), student: `${written} V8 + ${filled} filled (${kept} existing kept)` };
    }
  }
}
for (const [l, s] of Object.entries(summary).sort()) console.log(l.padEnd(8), JSON.stringify(s));
if (errors) { console.error(`${errors} error(s)${checkOnly ? '' : ' — files may be partly written; fix data and re-run'}`); process.exit(1); }
console.log(checkOnly ? 'check OK' : 'merged OK');
if (!checkOnly) await import('./rtl-mark.mjs'); // RTL strings must start with an RLM (see rtl-mark.mjs)
