#!/usr/bin/env node
/**
 * V32 — apply a reviewed translation patch to one locale and record it.
 *
 *   node scripts/i18n/v32/apply-patch.mjs <locale> <patch.json> [--dry] [--allow-same]
 *
 * Patch: { "<ns>:<dotted.key>": "<new text>" }  or  { "<ns>:<dotted.key>": { "text": "...", "why": "..." } }
 *
 * Refuses a value that drops or adds a {{placeholder}} relative to the English source, a value identical to the English
 * for a non-English locale when the key has a non-identical Korean source (an untranslated line), an empty value, and a
 * key that neither the locale nor the English bundle has (a missing translation is created; a new key never is).
 * Every applied change is appended to docs/qa/v32/l10n/applied/<locale>.json (key, old → new, why).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const [locale, file, ...flags] = process.argv.slice(2);
if (!locale || !file) { console.error('usage: apply-patch.mjs <locale> <patch.json> [--dry] [--allow-same]'); process.exit(2); }
const DRY = flags.includes('--dry');
// --allow-same: the reviewer deliberately keeps the English term (Filipino console UI uses English loan terms such as
// Status / Deadline / Inbox); recorded in the applied log like any other change.
const ALLOW_SAME_FLAG = flags.includes('--allow-same');
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const L = (loc, ns) => path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`);
const cache = {};
const load = (loc, ns) => (cache[`${loc}/${ns}`] ??= JSON.parse(fs.readFileSync(L(loc, ns), 'utf8')));
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const set = (o, k, v) => { const ps = k.split('.'); let a = o; for (const p of ps.slice(0, -1)) a = (a[p] ??= {}); a[ps.at(-1)] = v; };
const ph = (s) => [...String(s ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const ALLOW_SAME = new Set(['en', ...(ALLOW_SAME_FLAG ? [locale] : [])]);
const log = [];
let applied = 0, refused = 0, touched = new Set();
for (const [full, raw] of Object.entries(patch)) {
  if (full.startsWith('_')) continue;
  const text = typeof raw === 'string' ? raw : raw?.text;
  const why = typeof raw === 'string' ? '' : raw?.why ?? '';
  const [ns, key] = full.split(/:(.+)/);
  let bundle;
  try { bundle = load(locale, ns); } catch { console.log('NO BUNDLE', full); refused++; continue; }
  const old = get(bundle, key);
  let en = get(load('en', ns), key), ko = get(load('ko', ns), key);
  // A CLDR plural form English has no use for (_few, _many, _two, _zero) is checked against the English `_other`.
  const cldr = key.match(/^(.*)_(few|many|two|zero)$/);
  if (typeof en !== 'string' && cldr) { en = get(load('en', ns), `${cldr[1]}_other`) ?? get(load('en', ns), `${cldr[1]}_one`); ko = get(load('ko', ns), `${cldr[1]}_other`) ?? ko; }
  // A key the locale lacks is created when the English source has it (a missing translation), never invented.
  if ((old === undefined || typeof old !== 'string') && typeof en !== 'string') { console.log('UNKNOWN KEY', full); refused++; continue; }
  if (!text || !String(text).trim()) { console.log('EMPTY', full); refused++; continue; }
  // The _zero / _one / _two forms of a plural family may state the number in words (Arabic dual "رسالتان", "one message"),
  // so `count` may be absent there; every other placeholder must match exactly.
  const want = ph(en ?? ko ?? old), have = ph(text);
  const strip = (x) => x.split(',').filter((y) => y && y !== 'count').join(',');
  // _zero/_one/_two may spell the number in words (Arabic dual), so `count` may be absent there; and in languages where
  // CLDR "one" also covers 21, 31… (ru, uk, …) a `_one` must be able to ADD `{{count}}` the English `_one` lacks.
  const dualForm = /_(zero|one|two)$/.test(key) && strip(want) === strip(have);
  if (want !== have && !dualForm) { console.log('PLACEHOLDER MISMATCH', full, `[${want}] vs [${have}]`); refused++; continue; }
  if (!ALLOW_SAME.has(locale) && typeof en === 'string' && text === en && typeof ko === 'string' && ko !== en && /[A-Za-z]{3,}/.test(en)) {
    // Identical to English with a different Korean source: not a translation (a brand name or code is fine — those have no Korean difference).
    console.log('UNTRANSLATED', full); refused++; continue;
  }
  if (old === text) continue;
  log.push({ key: full, old, new: text, why });
  if (!DRY) set(bundle, key, text);
  touched.add(ns); applied++;
}
if (!DRY) {
  for (const ns of touched) fs.writeFileSync(L(locale, ns), JSON.stringify(load(locale, ns), null, 2) + '\n');
  const dir = path.join(ROOT, 'docs/qa/v32/l10n/applied'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${locale}.json`);
  const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  fs.writeFileSync(f, JSON.stringify([...prev, ...log], null, 1));
}
console.log(`${locale}: ${applied} applied${DRY ? ' (dry)' : ''}, ${refused} refused, namespaces ${[...touched].join(',') || '-'}`);
process.exit(refused && !applied ? 1 : 0);
