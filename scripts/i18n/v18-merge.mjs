/**
 * V18 translation merge. Input files are flat dotted-key bundles:
 *   { "<locale>": { "<namespace>": { "v17.gate.named": "…", … } } }
 *
 * Refuses to write a value whose i18next placeholders differ from English, which is the defect
 * class a bulk merge actually introduces (a dropped {{count}} renders as a sentence with a hole).
 * Also refuses keys that do not exist in English, so a typo cannot create a locale-only key that
 * no screen ever reads.
 *
 * Usage: node scripts/i18n/v18-merge.mjs <file…>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../packages/i18n/locales/', import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const get = (o, k) => k.split('.').reduce((a, x) => (a && typeof a === 'object' ? a[x] : undefined), o);
const set = (o, k, v) => {
  const ps = k.split('.');
  let cur = o;
  for (const p of ps.slice(0, -1)) {
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[ps.at(-1)] = v;
};
const placeholders = (s) => (String(s).match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort().join(',');

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/i18n/v18-merge.mjs <file…>'); process.exit(2); }
const enCache = {};
const en = (ns) => (enCache[ns] ??= read(join(root, 'en', `${ns}.json`)));
let keys = 0; const touched = new Set(); const problems = [];
for (const f of files) {
  for (const [loc, namespaces] of Object.entries(read(f))) {
    for (const [ns, pairs] of Object.entries(namespaces)) {
      const target = join(root, loc, `${ns}.json`);
      if (!existsSync(target)) { problems.push(`${loc}/${ns}: no such bundle`); continue; }
      const obj = read(target);
      for (const [k, v] of Object.entries(pairs)) {
        const enVal = get(en(ns), k);
        if (enVal === undefined) { problems.push(`${loc}/${ns}:${k} — not an English key`); continue; }
        if (typeof v !== 'string' || !v.trim()) { problems.push(`${loc}/${ns}:${k} — empty`); continue; }
        if (placeholders(enVal) !== placeholders(v)) {
          problems.push(`${loc}/${ns}:${k} — placeholders EN[${placeholders(enVal)}] ≠ [${placeholders(v)}]`);
          continue;
        }
        set(obj, k, v); keys++;
      }
      writeFileSync(target, JSON.stringify(obj, null, 2) + '\n');
      touched.add(`${loc}/${ns}`);
    }
  }
}
console.log(`v18-merge: ${keys} keys → ${touched.size} bundles`);
if (problems.length) { console.error(`REFUSED ${problems.length}:\n` + problems.join('\n')); process.exit(1); }
