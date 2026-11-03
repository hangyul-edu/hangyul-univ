#!/usr/bin/env node
/**
 * V32 — record that the V32 reviewers checked a locale's strings against the CURRENT English.
 *
 *   node scripts/i18n/v32/restamp.mjs [--dry]
 *
 * The V9 coverage gate (scripts/i18n/v9-coverage.mjs → packages/i18n/locales/_student_status.json) calls a translation
 * "stale" when the English changed after the translation was merged (v9-data/source-hash/<loc>.json). The V32 English
 * pass changed hundreds of English strings and every market locale was then reviewed key by key against that new
 * English (docs/qa/v32/l10n/jobs/<loc>-*.json, "change only what needs changing"). For exactly the keys in a locale's
 * review jobs — and only those — this stamps the current English hash, so a reviewed-and-kept translation is no longer
 * reported stale. A key the reviewers never saw keeps its old hash and stays stale. A reviewed value that is still
 * identical to the English (a word both languages share, e.g. "Visa" in Vietnamese) goes on the identical-ok list.
 */
import fs from 'node:fs';
import path from 'node:path';

import { hash } from '../v9-lib.mjs';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const DRY = process.argv.includes('--dry');
const JOBS = path.join(ROOT, 'docs/qa/v32/l10n/jobs');
const DATA = path.join(ROOT, 'scripts/i18n/v9-data');
const L = (loc, ns) => path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`);
const cache = {};
const load = (loc, ns) => (cache[`${loc}/${ns}`] ??= fs.existsSync(L(loc, ns)) ? JSON.parse(fs.readFileSync(L(loc, ns), 'utf8')) : {});
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);

const okFile = path.join(DATA, 'identical-ok.json');
const ok = fs.existsSync(okFile) ? JSON.parse(fs.readFileSync(okFile, 'utf8')) : {};
const byLocale = {};
for (const f of fs.readdirSync(JOBS)) {
  const m = f.match(/^(.+)-(marketing-common|consoles|student-mobile|deep)\.json$/);
  if (!m || m[1] === 'en') continue;
  (byLocale[m[1]] ??= []).push(...Object.keys(JSON.parse(fs.readFileSync(path.join(JOBS, f), 'utf8'))));
}
let stamped = 0, sameOk = 0;
for (const [loc, keys] of Object.entries(byLocale)) {
  const hf = path.join(DATA, 'source-hash', `${loc}.json`);
  const hashes = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : {};
  const okSet = new Set(ok[loc] ?? []);
  for (const id of keys) {
    const [ns, key] = id.split(/:(.+)/);
    // the plural siblings a reviewer added (_few/_many/…) were reviewed with the family
    const fam = [key, ...['zero', 'one', 'two', 'few', 'many', 'other'].map((s) => `${key.replace(/_(zero|one|two|few|many|other)$/, '')}_${s}`)];
    for (const k of new Set(fam)) {
      // a CLDR sibling English does not have (_few/_many/_two/_zero) is measured against the English `_other`, as the audit does
      const en = get(load('en', ns), k) ?? (/_(zero|two|few|many)$/.test(k) ? get(load('en', ns), k.replace(/_(zero|two|few|many)$/, '_other')) : undefined); const v = get(load(loc, ns), k);
      if (typeof en !== 'string' || typeof v !== 'string' || !v.trim()) continue;
      const h = hash(en);
      if (hashes[`${ns}:${k}`] !== h) { hashes[`${ns}:${k}`] = h; stamped++; }
      if (v === en && !okSet.has(`${ns}:${k}`)) { okSet.add(`${ns}:${k}`); sameOk++; }
    }
  }
  ok[loc] = [...okSet].sort();
  if (!DRY) { fs.mkdirSync(path.dirname(hf), { recursive: true }); fs.writeFileSync(hf, JSON.stringify(Object.fromEntries(Object.entries(hashes).sort()), null, 1) + '\n'); }
}
if (!DRY) fs.writeFileSync(okFile, JSON.stringify(ok, null, 1) + '\n');
console.log(`restamp${DRY ? ' (dry)' : ''}: ${Object.keys(byLocale).length} locales, ${stamped} source hashes stamped, ${sameOk} reviewed identical-to-English values allowed`);
