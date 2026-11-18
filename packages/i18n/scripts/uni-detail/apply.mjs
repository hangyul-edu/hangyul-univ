#!/usr/bin/env node
/**
 * University detail page copy (`common:uniDetail.*`).
 *
 *   node packages/i18n/scripts/uni-detail/apply.mjs [--dry]
 *
 * Writes the English and Korean source copy from `source.json`, and any other locale's translation found in
 * `translations/<locale>.json` (same shape), into `packages/i18n/locales/<locale>/common.json`. A translation
 * that drops or adds a {{placeholder}} relative to English is refused. Locales with no translation file keep
 * falling back to English. Run `npm run i18n:check` afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../../..', import.meta.url).pathname);
const HERE = path.join(ROOT, 'packages/i18n/scripts/uni-detail');
const source = JSON.parse(fs.readFileSync(path.join(HERE, 'source.json'), 'utf8'));
const DRY = process.argv.includes('--dry');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const ph = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const en = Object.fromEntries(flat(source.en));
const set = (o, k, v) => { const ps = k.split('.'); let a = o; for (const p of ps.slice(0, -1)) a = (a[p] ??= {}); a[ps.at(-1)] = v; };

const bundles = { en: source.en, ko: source.ko };
const dir = path.join(HERE, 'translations');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) bundles[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

let failed = false;
for (const [locale, tree] of Object.entries(bundles)) {
  const file = path.join(ROOT, 'packages/i18n/locales', locale, 'common.json');
  if (!fs.existsSync(file)) { console.log(`${locale}: no bundle, skipped`); continue; }
  const out = {};
  let n = 0;
  for (const [k, v] of flat(tree)) {
    // A CLDR plural form English has no use for (_few, _many, _two, _zero) is checked against the English `_other`.
    const base = en[k] ?? en[k.replace(/_(zero|two|few|many)$/, '_other')];
    if (base === undefined) { console.log(`${locale}: unknown key ${k}`); failed = true; continue; }
    if (typeof v !== 'string' || !v.trim()) { console.log(`${locale}: empty ${k}`); failed = true; continue; }
    const want = ph(base), have = ph(v);
    const pluralWord = /_(zero|one|two)$/.test(k) && want.replace(/(^|,)count/, '') === have.replace(/(^|,)count/, '');
    if (want !== have && !pluralWord) { console.log(`${locale}: placeholder mismatch ${k} [${want}] vs [${have}]`); failed = true; continue; }
    set(out, k, v); n += 1;
  }
  const missing = Object.keys(en).filter((k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), out) === undefined);
  if ((locale === 'en' || locale === 'ko') && missing.length) { console.log(`${locale}: missing ${missing.join(', ')}`); failed = true; }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.uniDetail = out;
  if (!DRY) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`${locale}: ${n} keys${missing.length ? ` (${missing.length} fall back to English)` : ''}`);
}
process.exit(failed ? 1 : 0);
