// Validates translated locale files against English: valid JSON, no unknown keys, identical {{placeholders}},
// plural keys allowed per Intl.PluralRules categories. Usage: node validate-locale.mjs <locale> [namespace...]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const [loc, ...nss] = process.argv.slice(2);
if (!loc) { console.error('usage: validate-locale.mjs <locale> [ns...]'); process.exit(2); }
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const ph = (s) => [...s.matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((m) => m[1]).sort().join(',');
const plural = /_(zero|one|two|few|many|other)$/;
let cats;
try { cats = new Intl.PluralRules(loc).resolvedOptions().pluralCategories; } catch { cats = ['one', 'other']; }
const namespaces = nss.length ? nss : ['common', 'marketing', 'student', 'mobile', 'agency', 'university'];
let errors = 0, report = [];
for (const ns of namespaces) {
  const p = join(root, loc, `${ns}.json`);
  if (!existsSync(p)) { report.push(`${ns}: missing file`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.error(`${ns}: INVALID JSON ${e.message}`); errors++; continue; }
  const en = new Map(flat(JSON.parse(readFileSync(join(root, 'en', `${ns}.json`), 'utf8'))));
  const enBases = new Set([...en.keys()].map((k) => k.replace(plural, '')));
  const tr = flat(data);
  if (tr.length === 0) { console.error(`${ns}: EMPTY file`); errors++; continue; }
  let covered = 0;
  for (const [k, v] of tr) {
    const base = k.replace(plural, '');
    const src = en.get(k) ?? en.get(`${base}_other`) ?? en.get(base);
    if (!en.has(k) && !(plural.test(k) && enBases.has(base) && cats.includes(k.match(plural)[1]))) { console.error(`${ns}: unknown key ${k}`); errors++; continue; }
    if (src !== undefined && ph(src).replace(/\bcount\b,?/, '') !== ph(v).replace(/\bcount\b,?/, '')) { console.error(`${ns}: placeholder mismatch at ${k}: "${v}"`); errors++; }
    if (!v.trim()) { console.error(`${ns}: empty value ${k}`); errors++; }
    if (en.has(k)) covered++;
  }
  report.push(`${ns}: ${Math.round((covered / en.size) * 100)}% (${covered}/${en.size})`);
}
console.log(`${loc} — ${report.join(' · ')}${errors ? ` — ${errors} error(s)` : ' — OK'}`);
process.exit(errors ? 1 : 0);
