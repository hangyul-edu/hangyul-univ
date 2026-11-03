// V23 — validate a translation output file against its source list and turn it into a v23-set patch.
//   node scripts/i18n/v23/tx-validate.mjs <locale> [--apply]
// out/<locale>.json: { "<ns>": { "<key>": "translation" } }. Checks: every source key present, non-empty, same
// {{placeholders}} and <tags> as English, not identical to English (unless the English is a brand/number-only string).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const [loc, ...rest] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/i18n/v23/tx/source', `${loc}.json`), 'utf8'));
const outP = path.join(ROOT, 'scripts/i18n/v23/tx/out', `${loc}.json`);
const out = fs.existsSync(outP) ? JSON.parse(fs.readFileSync(outP, 'utf8')) : {};
const ph = (s) => [...s.matchAll(/\{\{\s*[\w.]+\s*(?:,[^}]*)?\}\}|<\/?\w+[^>]*>|\$t\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, '')).sort().join('|');
const problems = []; const patch = {}; let okN = 0; let missing = 0;
for (const tier of ['customer', 'console']) for (const { ns, key, en } of src[tier] ?? []) {
  const v = out[ns]?.[key];
  if (typeof v !== 'string' || !v.trim()) { missing += 1; continue; }
  if (ph(v) !== ph(en)) { problems.push(`${ns}:${key} placeholders ${ph(en)} ≠ ${ph(v)}`); continue; }
  const brandOnly = !/[a-z]{3,}/i.test(en.replace(/\{\{[^}]+\}\}|Hangyul|Univ|TOPIK|IELTS|TOEFL|GPA|KRW|USD|D-2|D-4|E-7|ARC|PDF|CSV|SMS|OTP|ID|URL/g, ''));
  // Up to three words may legitimately be the same as English (Status, Team, Campus, Premium, Busan · Gyeongnam):
  // the first V23 run rejected them and forced padded rewrites, which the cognate review pass undid.
  const short = en.trim().split(/\s+/).length <= 3;
  if (v === en && !brandOnly && !short && loc !== 'en') { problems.push(`${ns}:${key} left in English`); continue; }
  ((patch[ns] ??= {})[key] ??= {})[loc] = v; okN += 1;
}
// Extra CLDR plural categories (ru/uk/pl/cs/sr/ro: _few/_many; ar: _zero/_two/_few/_many) for a key whose _one/_other
// sibling is in the source list — English has no such keys, but i18next looks them up in these languages.
const srcKeys = new Set(['customer', 'console'].flatMap((t) => (src[t] ?? []).map(({ ns, key }) => `${ns}:${key}`)));
let extra = 0;
for (const [ns, keys] of Object.entries(out)) for (const [key, v] of Object.entries(keys)) {
  const m = key.match(/^(.*)_(zero|two|few|many)$/);
  if (!m || srcKeys.has(`${ns}:${key}`) || typeof v !== 'string') continue;
  const base = [`${m[1]}_other`, `${m[1]}_one`].find((k) => srcKeys.has(`${ns}:${k}`));
  if (!base) continue;
  const enOther = (src.customer.concat(src.console ?? [])).find((x) => x.ns === ns && x.key === base)?.en ?? '';
  if (ph(v) !== ph(enOther)) { problems.push(`${ns}:${key} placeholders`); continue; }
  ((patch[ns] ??= {})[key] ??= {})[loc] = v; extra += 1;
}
console.log(`${loc}: ${okN} valid (+${extra} plural forms), ${missing} missing, ${problems.length} rejected`);
for (const p of problems.slice(0, 10)) console.log('  ✗', p);
if (rest.includes('--apply') && okN) {
  const pp = path.join(ROOT, 'scripts/i18n/v23/tx', `patch-${loc}.json`);
  fs.writeFileSync(pp, JSON.stringify(patch));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/i18n/v23-set.mjs'), pp], { encoding: 'utf8' });
  process.stdout.write(r.stdout);
}
process.exit(missing || problems.length ? 2 : 0);
