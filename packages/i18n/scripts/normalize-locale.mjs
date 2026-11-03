// Rewrites locale files in English key order (2-space JSON, UTF-8 unescaped, trailing newline).
// Extra plural forms the locale needs (`_two`, `_few`, `_many`, `_zero`) are placed right after the English `_one`/`_other`
// siblings of the same base key. Keys unknown to English are kept at the end of their object and reported.
// Usage: node normalize-locale.mjs <locale> [namespace...]   (default: every namespace file the locale has)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const [loc, ...nss] = process.argv.slice(2);
if (!loc || loc === 'en') { console.error('usage: normalize-locale.mjs <locale (not en)> [ns...]'); process.exit(2); }
const plural = /_(zero|one|two|few|many|other)$/;
const ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const unknown = [];

function order(src, tr, path) {
  const out = {};
  const used = new Set();
  const take = (k) => { if (k in tr && !used.has(k)) { out[k] = isObj(src?.[k]) && isObj(tr[k]) ? order(src[k], tr[k], `${path}${k}.`) : tr[k]; used.add(k); } };
  for (const k of Object.keys(src)) {
    if (plural.test(k)) {
      const base = k.replace(plural, '');
      // emit every plural form of this base the translation has, in CLDR order, at the first English plural sibling
      for (const c of ORDER) take(`${base}_${c}`);
    } else take(k);
  }
  for (const k of Object.keys(tr)) if (!used.has(k)) { out[k] = tr[k]; unknown.push(`${path}${k}`); }
  return out;
}

const files = nss.length ? nss.map((n) => `${n}.json`) : readdirSync(join(root, loc)).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const p = join(root, loc, f);
  if (!existsSync(p)) { console.warn(`${loc}/${f}: missing`); continue; }
  const en = JSON.parse(readFileSync(join(root, 'en', f), 'utf8'));
  const tr = JSON.parse(readFileSync(p, 'utf8'));
  writeFileSync(p, `${JSON.stringify(order(en, tr, ''), null, 2)}\n`);
}
if (unknown.length) console.warn(`${loc}: ${unknown.length} key(s) not in English (kept at the end): ${unknown.slice(0, 10).join(', ')}`);
console.log(`${loc}: normalized ${files.join(', ')}`);
