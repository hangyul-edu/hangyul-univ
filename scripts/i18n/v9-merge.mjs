// V9 merge: writes a translator's file into packages/i18n/locales/<loc>/<ns>.json after validating every value.
//   node scripts/i18n/v9-merge.mjs vi scripts/i18n/v9-data/vi.json [--check]
//   node scripts/i18n/v9-merge.mjs ko <file> --ko-add-missing     (ko: only keys that are ABSENT in ko are added)
// Input: { "<ns>": { "<key>": "<text>" | nested objects } , "_identical_ok": ["ns:key", …] }  (or the v9-todo file shape
// with the translations put in `todo`). Dotted keys and nested objects are both accepted.
// Validation (all-or-nothing — any error and nothing is written):
//   key exists in English (plural keys: the family exists and the suffix is a CLDR category of the locale) ·
//   identical {{placeholder}} set (count excepted) · identical <0>…</0> / <strong> tags · no empty strings ·
//   plural families complete for the locale after the merge · brand: Latin "Hangyul" kept wherever English has it
//   (ko: 한귤, never 한결; other locales never use a Hangul brand) · refuses en (and ko unless --ko-add-missing).
// Writes: the namespace file (created if missing → regenerates src/resources.ts), v9-data/source-hash/<loc>.json (English
// hash per merged key, so v9-todo can flag keys whose English changed later), v9-data/identical-ok.json. Runs rtl-mark for
// RTL locales. Re-reads every target file right before writing; idempotent.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATA, enMap, flat, hash, LOC, nsFile, phSet, PLURAL, pluralCats, readJson, root, RTL, tagSet } from './v9-lib.mjs';

const args = process.argv.slice(2);
const [loc, file] = args.filter((a) => !a.startsWith('--'));
const check = args.includes('--check');
const koAdd = args.includes('--ko-add-missing');
if (!loc || !file) { console.error('usage: v9-merge.mjs <loc> <file.json> [--check] [--ko-add-missing]'); process.exit(2); }
if (loc === 'en') { console.error('refused: en is the source language — edit it in the feature workstream.'); process.exit(2); }
if (loc === 'ko' && !koAdd) { console.error('refused: ko is maintained with en by feature agents. Use --ko-add-missing to add absent keys only.'); process.exit(2); }
if (!existsSync(join(LOC, loc))) { console.error(`unknown locale ${loc}`); process.exit(2); }

const input = JSON.parse(readFileSync(file, 'utf8'));
const okSameIn = input._identical_ok ?? [];
const body = input.todo && typeof input.todo === 'object' ? input.todo : input;
const cats = pluralCats(loc);
const errors = [];
const err = (m) => errors.push(m);
const setPath = (o, path, v) => { const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k] && typeof c[k] === 'object' ? c[k] : (c[k] = {}); c[ks.at(-1)] = v; };

const plan = {}; // ns → Map(key → value)
for (const [ns, tree] of Object.entries(body)) {
  if (ns.startsWith('_')) continue;
  if (!existsSync(nsFile('en', ns))) { err(`unknown namespace ${ns}`); continue; }
  if (!tree || typeof tree !== 'object') { err(`${ns}: expected an object`); continue; }
  const en = enMap(ns);
  const enBases = new Set([...en.keys()].filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
  const entries = new Map();
  for (const [k, v0] of flat(tree)) {
    const id = `${ns}:${k}`;
    if (typeof v0 !== 'string') { err(`${id}: value must be a string`); continue; }
    const v = v0.normalize('NFC');
    const m = k.match(PLURAL);
    const base = k.replace(PLURAL, '');
    let src = en.get(k);
    if (src === undefined) {
      if (m && enBases.has(base)) {
        if (!cats.includes(m[1])) { err(`${id}: plural category "${m[1]}" is not used by ${loc} (needs ${cats.join('/')})`); continue; }
        src = en.get(`${base}_other`);
      } else { err(`${id}: key does not exist in English`); continue; }
    } else if (m && enBases.has(base) && !cats.includes(m[1])) { err(`${id}: plural category "${m[1]}" is not used by ${loc} (needs ${cats.join('/')})`); continue; }
    if (!v.trim()) { err(`${id}: empty string`); continue; }
    if (phSet(src) !== phSet(v)) err(`${id}: placeholders {{${phSet(v)}}} ≠ English {{${phSet(src)}}}`);
    if (tagSet(src) !== tagSet(v)) err(`${id}: tags ${tagSet(v) || '(none)'} ≠ English ${tagSet(src) || '(none)'}`);
    if (loc === 'ko') {
      if (/한결/.test(v)) err(`${id}: Korean brand is 한귤, never 한결`);
    } else {
      if (/[한귤결]/.test(v) && /한귤|한결/.test(v)) err(`${id}: Hangul brand outside ko — keep "Hangyul" in Latin`);
      if (/Hangyul/.test(src) && !/Hangyul/.test(v)) err(`${id}: English has "Hangyul" — keep the brand in Latin script`);
    }
    entries.set(k, v);
  }
  plan[ns] = entries;
}
for (const id of okSameIn) if (typeof id !== 'string' || !id.includes(':')) err(`_identical_ok: bad id ${id}`);

// plural completeness after the merge
for (const [ns, entries] of Object.entries(plan)) {
  const current = new Map(flat(readJson(nsFile(loc, ns), {})).map(([k, v]) => [k, String(v)]));
  const touched = new Set([...entries.keys()].filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
  for (const base of touched) {
    const missing = cats.filter((c) => !entries.has(`${base}_${c}`) && !current.has(`${base}_${c}`));
    if (missing.length) err(`${ns}:${base}: plural family incomplete for ${loc} — add ${missing.map((c) => `${base}_${c}`).join(', ')}`);
  }
}

if (errors.length) {
  console.error(`${errors.length} error(s) — nothing written:`);
  for (const e of errors.slice(0, 200)) console.error('  ' + e);
  process.exit(1);
}

let written = 0, unchanged = 0, skippedKo = 0, created = false;
const hashes = readJson(join(DATA, 'source-hash', `${loc}.json`), {});
for (const [ns, entries] of Object.entries(plan)) {
  if (!entries.size) continue;
  const p = nsFile(loc, ns);
  const isNew = !existsSync(p);
  const data = readJson(p, {}); // re-read right before writing (other agents edit concurrently)
  const cur = new Map(flat(data).map(([k, v]) => [k, String(v)]));
  const en = enMap(ns);
  let changed = 0;
  for (const [k, v] of entries) {
    if (koAdd && cur.has(k)) { skippedKo++; continue; }
    hashes[`${ns}:${k}`] = hash(en.get(k) ?? en.get(`${k.replace(PLURAL, '')}_other`));
    if (cur.get(k) === v) { unchanged++; continue; }
    setPath(data, k, v); changed++;
  }
  if (changed && !check) {
    writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    if (isNew) created = true;
  }
  written += changed;
  console.log(`${loc}/${ns}.json: ${changed} written${isNew ? ' (new file)' : ''}`);
}
if (!check) {
  mkdirSync(join(DATA, 'source-hash'), { recursive: true });
  writeFileSync(join(DATA, 'source-hash', `${loc}.json`), JSON.stringify(Object.fromEntries(Object.entries(hashes).sort()), null, 1) + '\n');
  if (okSameIn.length) {
    const all = readJson(join(DATA, 'identical-ok.json'), {});
    all[loc] = [...new Set([...(all[loc] ?? []), ...okSameIn])].sort();
    writeFileSync(join(DATA, 'identical-ok.json'), JSON.stringify(all, null, 1) + '\n');
  }
  if (created) execFileSync('node', [join(root, 'packages/i18n/scripts/gen-resources.mjs')], { stdio: 'inherit' });
  if (RTL.includes(loc) && written) execFileSync('node', [join(root, 'scripts/i18n/rtl-mark.mjs')], { stdio: 'inherit', cwd: root });
}
console.log(`${check ? '[check] ' : ''}${loc}: ${written} value(s) ${check ? 'would be ' : ''}written, ${unchanged} unchanged${koAdd ? `, ${skippedKo} existing ko value(s) left untouched` : ''}`);
