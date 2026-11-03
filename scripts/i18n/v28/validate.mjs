// V28 — validate per-locale translations of the V28 job (customer-critical A + operational B keys that were missing or
// English, V28's new keys, and keys whose English the V28 copy pass rewrote) and merge them (REPORT §374).
//   node scripts/i18n/v28/validate.mjs [--apply] [--only=vi,ne]
// Source: scripts/i18n/v28/jobs/<locale>.json ({ ns: { key: { en, ko, current } } }). Translations:
// scripts/i18n/v28/tx/<locale>.json ({ ns: { key: "translation" } }). Extra CLDR plural forms (`x_few`, `x_many`, `x_two`,
// `x_zero`) are accepted when the job has `x_other`. Checks: present, identical {{placeholders}}/<tags>, not English
// unless ≤ 3 words, no Hangul, locale script, length ≤ 2.2× English + 12, forbidden terms. Exit 1 on any problem.
// Status of every merged string: SYNTHETIC_NATIVE_REVIEWED, never HUMAN_REVIEWED.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const DIR = path.join(ROOT, 'scripts/i18n/v28');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const LOCALES = onlyArg ? onlyArg.slice(7).split(',') : fs.readdirSync(path.join(DIR, process.env.TX ?? 'tx')).filter((f) => /^[\w-]+\.json$/.test(f) && !f.startsWith('_')).map((f) => f.slice(0, -5));
const SCRIPT = {
  ar: /[؀-ۿ]/, ur: /[؀-ۿ]/, fa: /[؀-ۿ]/, 'zh-Hant': /[一-鿿]/, bn: /[ঀ-৿]/, hi: /[ऀ-ॿ]/, ne: /[ऀ-ॿ]/, el: /[Ͱ-Ͽ]/,
  ja: /[぀-ヿ一-鿿]/, 'zh-Hans': /[一-鿿]/, th: /[฀-๿]/, my: /[က-႟]/,
  ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, kk: /[Ѐ-ӿ]/, ky: /[Ѐ-ӿ]/, mn: /[Ѐ-ӿ]/, sr: /[Ѐ-ӿ]/,
};
// Known wrong renderings (V27 records, UX_AUDIT L-2/L-4): consular *confirmation* instead of legalization; "ambitious" for
// the far tier; Brazilian forms in European Portuguese.
const FORBID = {
  de: [/konsularische Bestätigung/i], uk: [/консульське підтвердження/i], tr: [/konsolosluk onayı/i], id: [/konfirmasi konsuler/i],
  fil: [/konsular na kumpirmasyon/i], kk: [/консулдық растау/i], ky: [/консулдук ырастоо/i], cs: [/konzulární potvrzení/i],
  fa: [/جاه‌طلبانه|جاه طلبانه/], // Unicode-aware boundaries: `\b` treats ê/ô as non-word characters and never matches "você".
  pt: [/(?<![\p{L}])vocês?(?![\p{L}])/iu, /(?<![\p{L}])cadastr/iu, /(?<![\p{L}])celular(?![\p{L}])/iu, /(?<![\p{L}])ônibus(?![\p{L}])/iu, /(?<![\p{L}])tela(?![\p{L}])/iu, /(?<![\p{L}])equipe(?![\p{L}])/iu, /(?<![\p{L}])Vietnã/u],
};
const ph = (s) => [...s.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+[^>]*>/g)].map((m) => m[0].replace(/\s+/g, '')).sort().join('|');
const EXTRA = /_(zero|two|few|many)$/;
const problems = []; const patch = {}; let ok = 0;
for (const loc of LOCALES) {
  const src = JSON.parse(fs.readFileSync(path.join(DIR, process.env.JOBS ?? 'jobs', `${loc}.json`), 'utf8'));
  const f = path.join(DIR, process.env.TX ?? 'tx', `${loc}.json`);
  const out = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const check = (ns, key, en, v) => {
    const id = `${loc} ${ns}:${key}`;
    // An intentionally empty English value (an optional adjective slot) must stay empty in every locale.
    if (en === '') { if (v === '') { ((patch[ns] ??= {})[key] ??= {})[loc] = v; ok += 1; return; } return problems.push(`${id} must be empty like the English`); }
    if (typeof v !== 'string' || !v.trim()) return problems.push(`${id} missing`);
    if (ph(v) !== ph(en)) return problems.push(`${id} placeholders ${ph(en)} ≠ ${ph(v)}`);
    if (v === en && en.trim().split(/\s+/).length > 3) return problems.push(`${id} left in English`);
    if (/[가-힣]/.test(v)) return problems.push(`${id} contains Hangul`);
    if (/[\u0590-\u05FF]/.test(v)) return problems.push(`${id} contains Hebrew script`);
    const letters = en.replace(/\{\{[^}]+\}\}|<[^>]+>/g, '').match(/[A-Za-z]{2,}/g) ?? [];
    if (SCRIPT[loc] && letters.length > 3 && !SCRIPT[loc].test(v.replace(/\{\{[^}]+\}\}/g, ''))) return problems.push(`${id} not in the locale's script`);
    if (v.length > en.length * 2.2 + 12) return problems.push(`${id} too long (${v.length} vs ${en.length})`);
    for (const re of FORBID[loc] ?? []) if (re.test(v)) return problems.push(`${id} forbidden term ${re}`);
    ((patch[ns] ??= {})[key] ??= {})[loc] = v; ok += 1;
  };
  for (const [ns, keys] of Object.entries(src)) {
    for (const [key, { en }] of Object.entries(keys)) {
      if (key.startsWith('fit.test.') && !['fit.test.KIIP', 'fit.test.KING_SEJONG', 'fit.test.UNIV_KLI'].includes(key)) { ((patch[ns] ??= {})[key] ??= {})[loc] = en; ok += 1; continue; }
      check(ns, key, en, out[ns]?.[key]);
    }
    for (const [key, v] of Object.entries(out[ns] ?? {})) {
      if (!EXTRA.test(key) || keys[key]) continue; // a real job key that happens to end in _few is not an extra form
      const base = key.replace(EXTRA, '_other');
      if (!keys[base]) { problems.push(`${loc} ${ns}:${key} plural form without ${base} in the job`); continue; }
      check(ns, key, keys[base].en, v);
    }
  }
}
console.log(`V28 l10n (${LOCALES.length} locales): ${ok} strings valid, ${problems.length} problems`);
for (const p of problems.slice(0, 60)) console.log('  ✗', p);
if (process.argv.includes('--apply') && !problems.length) {
  const pf = path.join(DIR, process.env.TX ?? 'tx', '_patch.json');
  fs.writeFileSync(pf, JSON.stringify(patch, null, 1));
  const r = spawnSync('node', [path.join(ROOT, 'scripts/i18n/v23-set.mjs'), pf], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.exit(problems.length ? 1 : 0);
