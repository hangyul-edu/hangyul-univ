#!/usr/bin/env node
/**
 * V32 — cut the review work into job files a reviewer (person or agent) can take whole.
 *
 *   node scripts/i18n/v32/jobs.mjs en                → docs/qa/v32/l10n/jobs/en-<group>.json   { "<ns>:<key>": { ko, en } }
 *   node scripts/i18n/v32/jobs.mjs <locale>          → docs/qa/v32/l10n/jobs/<locale>-<group>.json { "<ns>:<key>": { en, cur } }
 *   node scripts/i18n/v32/jobs.mjs <locale> --tier-b → the deeper student namespaces (concierge, dossier, success, visaroute, writing)
 *
 * Groups (tier A, every market locale): marketing+common · student+mobile · agency+university.
 * The reviewer returns a patch in apply-patch.mjs's format for the keys that need a change — nothing else.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const [locale, flag] = process.argv.slice(2);
if (!locale) { console.error('usage: jobs.mjs <locale> [--tier-b]'); process.exit(2); }
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]));
const bundle = (loc, ns) => { try { return new Map(flat(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`), 'utf8')))); } catch { return new Map(); } };
const active = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v32/l10n/active-keys.json'), 'utf8')).active;
const critical = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v32/l10n/critical-keys.json'), 'utf8'));
const GROUPS = flag === '--tier-b'
  ? { deep1: ['concierge', 'dossier', 'success'], deep2: ['visaroute', 'writing'] }
  : { 'marketing-common': ['marketing', 'common'], 'student-mobile': ['student', 'mobile'], consoles: ['agency', 'university'] };
const dir = path.join(ROOT, 'docs/qa/v32/l10n/jobs'); fs.mkdirSync(dir, { recursive: true });
for (const [group, nss] of Object.entries(GROUPS)) {
  const out = {};
  for (const ns of nss) {
    const ko = bundle('ko', ns), en = bundle('en', ns), cur = locale === 'en' ? null : bundle(locale, ns);
    const keys = flag === '--tier-b' ? active[ns] : Object.keys(critical).filter((k) => k.startsWith(`${ns}:`)).map((k) => k.slice(ns.length + 1));
    for (const key of keys) {
      const k = `${ns}:${key}`;
      out[k] = locale === 'en' ? { ko: ko.get(key) ?? null, en: en.get(key) ?? null } : { en: en.get(key) ?? null, cur: cur.get(key) ?? null };
    }
  }
  const f = path.join(dir, `${locale}-${group}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  console.log(`${f}: ${Object.keys(out).length} keys`);
}
