// V26 — validate per-locale translations of the V26 strings (copied from v25/validate.mjs) and merge them into the locale bundles.
//   node scripts/i18n/v26/validate.mjs [--apply]
// Source: scripts/i18n/v26/strings.json ({ ns: { key: { en, ko } } }). Translations: scripts/i18n/v26/tx/<locale>.json
// ({ ns: { key: "translation" } }). Checks per string: present and non-empty; identical {{placeholders}} and <tags> to
// English; not English-identical unless ≤ 3 words; no Hangul outside ko; script sanity for locales with their own script;
// length ≤ 2.2× English + 12 characters (layout). Exit 1 on any problem. --apply writes a v23-set patch and runs it.
// Status of every merged string: SYNTHETIC_NATIVE_REVIEWED (machine translation + model review), never HUMAN_REVIEWED.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const DIR = path.join(ROOT, 'scripts/i18n/v26');
const src = JSON.parse(fs.readFileSync(path.join(DIR, 'strings.json'), 'utf8'));
const LOCALES = ['ar', 'bn', 'cs', 'de', 'el', 'es', 'fil', 'fr', 'hi', 'hu', 'id', 'it', 'ja', 'kk', 'ky', 'mn', 'my', 'ne', 'nl', 'pl', 'pt', 'ro', 'ru', 'sr', 'sv', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'zh-Hans'];
const SCRIPT = {
  ar: /[؀-ۿ]/, ur: /[؀-ۿ]/, bn: /[ঀ-৿]/, hi: /[ऀ-ॿ]/, ne: /[ऀ-ॿ]/, el: /[Ͱ-Ͽ]/,
  ja: /[぀-ヿ一-鿿]/, 'zh-Hans': /[一-鿿]/, th: /[฀-๿]/, my: /[က-႟]/,
  ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, kk: /[Ѐ-ӿ]/, ky: /[Ѐ-ӿ]/, mn: /[Ѐ-ӿ]/, sr: /[Ѐ-ӿ]/,
};
const ph = (s) => [...s.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+[^>]*>/g)].map((m) => m[0].replace(/\s+/g, '')).sort().join('|');
const problems = []; const patch = {}; let ok = 0;
for (const loc of LOCALES) {
  const f = path.join(DIR, 'tx', `${loc}.json`);
  const out = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  for (const [ns, keys] of Object.entries(src)) {
    for (const [key, { en }] of Object.entries(keys)) {
      const v = out[ns]?.[key];
      const id = `${loc} ${ns}:${key}`;
      if (typeof v !== 'string' || !v.trim()) { problems.push(`${id} missing`); continue; }
      if (ph(v) !== ph(en)) { problems.push(`${id} placeholders ${ph(en)} ≠ ${ph(v)}`); continue; }
      if (v === en && en.trim().split(/\s+/).length > 3) { problems.push(`${id} left in English`); continue; }
      if (/[가-힣]/.test(v)) { problems.push(`${id} contains Hangul`); continue; }
      if (SCRIPT[loc] && !SCRIPT[loc].test(v.replace(/\{\{[^}]+\}\}/g, ''))) { problems.push(`${id} not in the locale's script`); continue; }
      if (v.length > en.length * 2.2 + 12) { problems.push(`${id} too long (${v.length} vs ${en.length})`); continue; }
      ((patch[ns] ??= {})[key] ??= {})[loc] = v; ok += 1;
    }
  }
}
console.log(`V26 l10n: ${ok} strings valid, ${problems.length} problems`);
for (const p of problems.slice(0, 60)) console.log('  ✗', p);
if (process.argv.includes('--apply') && !problems.length) {
  const pf = path.join(DIR, 'tx', '_patch.json');
  fs.writeFileSync(pf, JSON.stringify(patch, null, 1));
  const r = spawnSync('node', [path.join(ROOT, 'scripts/i18n/v23-set.mjs'), pf], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.exit(problems.length ? 1 : 0);
