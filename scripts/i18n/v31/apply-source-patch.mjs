/**
 * V31 — apply a ko/en SOURCE patch (REPORT §425) and record it.
 *   node scripts/i18n/v31/apply-source-patch.mjs <patch.json> [--dry]
 * Patch: { "<ns>:<dotted.key>": { ko, en, why } }. Writes packages/i18n/locales/{ko,en}/<ns>.json, appends every
 * change (old → new, why) to docs/qa/v31/l10n/source-audit.json, and adds the key to docs/qa/v31/l10n/changed-keys.json
 * so every other locale's job includes it. Refuses a change that drops or adds a {{placeholder}} in either language.
 */
import fs from 'node:fs';
const [file, flag] = process.argv.slice(2);
const DRY = flag === '--dry';
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const L = (loc, ns) => `packages/i18n/locales/${loc}/${ns}.json`;
const cache = {};
const load = (loc, ns) => (cache[`${loc}/${ns}`] ??= JSON.parse(fs.readFileSync(L(loc, ns), 'utf8')));
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const set = (o, k, v) => { const ps = k.split('.'); let a = o; for (const p of ps.slice(0, -1)) a = (a[p] ??= {}); a[ps.at(-1)] = v; };
const ph = (s) => [...String(s ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const auditF = 'docs/qa/v31/l10n/source-audit.json', changedF = 'docs/qa/v31/l10n/changed-keys.json';
const audit = fs.existsSync(auditF) ? JSON.parse(fs.readFileSync(auditF, 'utf8')) : [];
const changed = new Set(fs.existsSync(changedF) ? JSON.parse(fs.readFileSync(changedF, 'utf8')) : []);
let n = 0, bad = 0;
for (const [full, v] of Object.entries(patch)) {
  if (full.startsWith('_')) continue;
  const [ns, key] = full.split(':');
  const oldKo = get(load('ko', ns), key), oldEn = get(load('en', ns), key);
  // An entry may re-author only the English (owner-verbatim Korean stays): `ko` omitted → keep it.
  if (v.ko === undefined) v.ko = oldKo;
  const ref = ph(oldEn ?? oldKo ?? v.en);
  if (ph(v.ko) !== ref || ph(v.en) !== ref) { console.log('PLACEHOLDER MISMATCH', full, ref, '|', ph(v.ko), '|', ph(v.en)); bad++; continue; }
  if (oldKo === v.ko && oldEn === v.en) continue;
  set(load('ko', ns), key, v.ko); set(load('en', ns), key, v.en);
  audit.push({ key: full, ko: { old: oldKo ?? null, new: v.ko }, en: { old: oldEn ?? null, new: v.en }, why: v.why, patch: file });
  changed.add(full); n++;
}
if (!DRY && !bad) {
  for (const [k, o] of Object.entries(cache)) { const [loc, ns] = k.split('/'); fs.writeFileSync(L(loc, ns), JSON.stringify(o, null, 2) + '\n'); }
  fs.writeFileSync(auditF, JSON.stringify(audit, null, 1)); fs.writeFileSync(changedF, JSON.stringify([...changed].sort(), null, 1));
}
console.log(`${n} changed, ${bad} refused${DRY ? ' (dry)' : ''}`);
process.exit(bad ? 1 : 0);
