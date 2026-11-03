// Applies the fixes from the V8 synthetic persona reviews (docs/qa/v8/l10n/<loc>.md) to locale JSON.
// Data: scripts/i18n/v8-data/review-fixes.json → { "<loc>": { "<ns>": { "<dotted.key>": "new value" } } }
// Idempotent; refuses unknown English keys and placeholder changes. Run: node scripts/i18n/v8-review-fixes.mjs
// (Fixes to keys owned by v8-translate.mjs data are made in that data instead, so a re-merge keeps them.)
import { readFileSync, writeFileSync } from 'node:fs';

const fixes = JSON.parse(readFileSync('scripts/i18n/v8-data/review-fixes.json', 'utf8'));
const ph = (s) => [...String(s).matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((m) => m[1]).filter((x) => x !== 'count').sort().join(',');
const get = (o, k) => k.split('.').reduce((c, p) => (c && typeof c === 'object' ? c[p] : undefined), o);
const set = (o, k, v) => { const ks = k.split('.'); let c = o; for (const p of ks.slice(0, -1)) c = c[p] ??= {}; c[ks.at(-1)] = v; };
let changed = 0, errors = 0;
for (const [loc, byNs] of Object.entries(fixes)) {
  if (loc.startsWith('_')) continue;
  for (const [ns, keys] of Object.entries(byNs)) {
    const en = JSON.parse(readFileSync(`packages/i18n/locales/en/${ns}.json`, 'utf8'));
    const f = `packages/i18n/locales/${loc}/${ns}.json`;
    const j = JSON.parse(readFileSync(f, 'utf8'));
    for (const [k, v] of Object.entries(keys)) {
      const src = get(en, k) ?? get(en, k.replace(/_(zero|one|two|few|many)$/, '_other'));
      if (typeof src !== 'string') { console.error(`ERROR ${loc}/${ns}: ${k} not an English key`); errors++; continue; }
      if (ph(src) !== ph(v)) { console.error(`ERROR ${loc}/${ns}: placeholder mismatch ${k}`); errors++; continue; }
      if (String(get(j, k) ?? '').replace(/^\u200F/, '') !== v) { set(j, k, v); changed++; }
    }
    writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  }
}
console.log(`${changed} value(s) changed${errors ? `, ${errors} error(s)` : ''}`);
if (errors) process.exit(1);
await import('./rtl-mark.mjs'); // RTL strings must start with an RLM (see rtl-mark.mjs)
