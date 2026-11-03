// Shared helpers of the V9 student-localization pipeline (v9-manifest / v9-todo / v9-merge / v9-coverage).
// See docs/qa/v9/l10n/PIPELINE.md.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOC = join(root, 'packages/i18n/locales');
export const DATA = join(root, 'scripts/i18n/v9-data');
export const PLURAL = /_(zero|one|two|few|many|other)$/;
export const RTL = ['ar', 'fa', 'ur', 'he', 'ps'];

export const readJson = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
export const flat = (o, p = '') => Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
export const flatMap = (o) => new Map(flat(o).map(([k, v]) => [k, String(v)]));
export const nsFile = (loc, ns) => join(LOC, loc, `${ns}.json`);
export const enMap = (ns) => flatMap(readJson(nsFile('en', ns), {}));
export const locMap = (loc, ns) => flatMap(readJson(nsFile(loc, ns), {}));
export const hash = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);

export function pluralCats(loc) {
  try { return new Intl.PluralRules(loc).resolvedOptions().pluralCategories; } catch { return ['one', 'other']; }
}

/** {{placeholders}} without `count` (plural forms may drop {{count}}, e.g. "one" in Arabic/Japanese styles). */
export const placeholders = (s) => [...String(s).matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1]).filter((x) => x !== 'count');
export const phSet = (s) => [...new Set(placeholders(s))].sort().join(',');
/** Trans-style tags <0>…</0>, <strong>…</strong>, <br/> as an ordered multiset. */
export const tagSet = (s) => [...String(s).matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => m[0].replace(/\s+/g, '')).sort().join('');

// Tokens that may legitimately stay identical to English (proper nouns, codes, units). Case-sensitive words.
export const ALLOWED_TOKENS = [
  'Hangyul', 'HangyulUniv', 'Univ', 'TOPIK', 'IELTS', 'TOEFL', 'iBT', 'GKS', 'KIIP', 'D-2', 'D-4', 'D-2-2', 'D-4-1', 'D-10', 'E-7', 'F-2',
  'KRW', 'USD', 'EUR', 'VND', 'NPR', 'MMK', 'UZS', 'MNT', 'CNY', 'JPY', 'THB', 'IDR', 'INR', 'HiKorea', 'T-money', 'KakaoTalk', 'Kakao',
  'Naver', 'Zalo', 'WhatsApp', 'Viber', 'Telegram', 'LINE', 'WeChat', 'PDF', 'JPG', 'JPEG', 'PNG', 'HEIC', 'WEBP', 'KB', 'MB', 'GB', 'ARC',
  'GPA', 'CGPA', 'SIM', 'eSIM', 'Mastercard', 'PayPal', 'SWIFT', 'IBAN', 'URL', 'QR', 'SMS', 'Google', 'Apple', 'Android', 'iOS', 'ICN', 'KST', 'UTC',
]; // ordinary words that happen to be identical in some languages ("Email", "Visa", "OK") go in v9-data/identical-ok.json
const tokenRe = new RegExp(`(^|[^A-Za-z])(${ALLOWED_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})(?=$|[^A-Za-z])`, 'g');
/** True when a value that equals English contains nothing a translator could translate (codes, numbers, placeholders). */
export function onlyAllowedTokens(v) {
  const rest = String(v)
    .replace(/\$t\([^)]*\)/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<\/?\w+\s*\/?>/g, ' ')
    .replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+/g, ' ')
    .replace(tokenRe, '$1 ');
  return !/\p{L}{2,}/u.test(rest);
}

export const manifest = () => readJson(join(LOC, '_student_manifest.json'));

/** Expands manifest keys of one namespace for a locale: plural families become base_<cat> for the locale's categories. */
export function expectedKeys(loc, ns, keys, en) {
  const cats = pluralCats(loc);
  const out = new Map(); // locKey → english source
  const families = new Set();
  for (const k of keys) {
    if (PLURAL.test(k)) {
      const base = k.replace(PLURAL, '');
      if (families.has(base)) continue;
      families.add(base);
      for (const c of cats) out.set(`${base}_${c}`, en.get(`${base}_${c}`) ?? en.get(`${base}_other`) ?? en.get(k));
    } else out.set(k, en.get(k));
  }
  return { keys: out, families: [...families] };
}

export const identicalOk = () => readJson(join(DATA, 'identical-ok.json'), {});
export const sourceHashes = (loc) => readJson(join(DATA, 'source-hash', `${loc}.json`), {});

/**
 * Status of every manifest key in a locale: missing (absent/empty), identical (equal to English and not only allowed
 * tokens, unless listed in identical-ok.json), stale (English changed since the translation was merged by v9-merge).
 */
export function auditLocale(loc, { surface = 'web' } = {}) {
  const m = manifest();
  if (!m) throw new Error('run scripts/i18n/v9-manifest.mjs first');
  const okSame = new Set(identicalOk()[loc] ?? []);
  const hashes = sourceHashes(loc);
  const res = { total: 0, missing: [], identical: [], stale: [], todo: {}, families: [] };
  for (const [ns, keys] of Object.entries(m[surface])) {
    const en = enMap(ns);
    const mine = loc === 'en' ? en : locMap(loc, ns);
    const { keys: exp, families } = expectedKeys(loc === 'en' ? 'en' : loc, ns, keys, en);
    res.families.push(...families.map((f) => `${ns}:${f}`));
    for (const [k, src] of exp) {
      if (src === undefined || src === '') continue; // vanished from English since the manifest was built, or intentionally empty
      res.total++;
      const v = mine.get(k);
      const id = `${ns}:${k}`;
      let bad = null;
      if (v === undefined || !String(v).trim()) bad = 'missing';
      else if (loc !== 'en' && v === src && !onlyAllowedTokens(v) && !okSame.has(id)) bad = 'identical';
      else if (hashes[id] && hashes[id] !== hash(src)) bad = 'stale';
      if (bad) { res[bad].push(id); (res.todo[ns] ??= {})[k] = src; }
    }
  }
  res.done = res.total - res.missing.length - res.identical.length - res.stale.length;
  res.pct = res.total ? Math.floor((res.done / res.total) * 1000) / 10 : 100;
  return res;
}
