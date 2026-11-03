#!/usr/bin/env node
/**
 * V32 — the CUSTOMER-CRITICAL string set for the foreign-language review: every active key a customer reads before
 * they trust us with money or documents, plus the operational labels the consoles render on every screen.
 *
 *   node scripts/i18n/v32/critical-keys.mjs  → docs/qa/v32/l10n/critical-keys.json
 *     { "<ns>:<key>": { ko, en } }  (source values; the per-locale jobs read their own bundle)
 *
 * Membership = active (docs/qa/v32/l10n/active-keys.json from census.mjs) ∩ the prefixes below. Nothing is sampled:
 * every key under a listed prefix is in.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const active = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v32/l10n/active-keys.json'), 'utf8')).active;
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]));
const bundle = (loc, ns) => new Map(flat(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`), 'utf8'))));

/** Prefixes per namespace. `*` = the whole active set of that namespace. */
const PREFIXES = {
  marketing: ['*'],                                           // everything a visitor can read is critical
  common: ['*'],                                              // states, actions, auth, fit, nav, pricing, plans
  student: ['dashboard', 'home', 'v11', 'v15', 'v16', 'v17', 'v19', 'v20', 'v21', 'v22', 'v26', 'v29', 'v30', 'v31', 'login', 'register', 'onboarding', 'profile',
    'applications', 'application', 'documents', 'services', 'tasks', 'messages', 'notifications', 'nav', 'shell', 'settings', 'visa', 'arrival', 'housing', 'essays', 'writing', 'eligibility'],
  mobile: ['*'],
  // consoles: the shell, sign-in, the two home screens, the queues, statuses and the V22+ vocabulary every screen shares
  agency: ['nav', 'shell', 'sidebar', 'login', 'today', 'students', 'ws', 'apps', 'docs', 'inbox', 'waiting', 'misc', 'actions', 'notifs', 'stage', 'v22', 'v23', 'v25', 'v26', 'v27', 'v28', 'v29', 'v30', 'v31', 'savedViews', 'settings', 'dash'],
  university: ['nav', 'shell', 'header', 'login', 'product', 'applicants', 'decision', 'documents', 'filters', 'stage', 'search', 'picker', 'kpi', 'metric', 'v22', 'v23', 'v25', 'v26', 'v28', 'v30', 'v31', 'analytics', 'notifications', 'notFound', 'settings', 'common', 'dash', 'detail', 'af'],
  // the deeper student flows are reviewed in tier B (the student-app locales); see jobs.mjs
  concierge: [], dossier: [], success: [], visaroute: [], writing: [],
};

const out = {};
let n = 0;
for (const [ns, prefixes] of Object.entries(PREFIXES)) {
  const ko = bundle('ko', ns), en = bundle('en', ns);
  for (const key of active[ns] ?? []) {
    if (!(prefixes.includes('*') || prefixes.some((p) => key === p || key.startsWith(`${p}.`)))) continue;
    out[`${ns}:${key}`] = { ko: ko.get(key) ?? null, en: en.get(key) ?? null };
    n++;
  }
}
fs.mkdirSync(path.join(ROOT, 'docs/qa/v32/l10n'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/qa/v32/l10n/critical-keys.json'), JSON.stringify(out, null, 1));
const perNs = {};
for (const k of Object.keys(out)) { const ns = k.split(':')[0]; perNs[ns] = (perNs[ns] ?? 0) + 1; }
console.log(`critical set: ${n} keys`, JSON.stringify(perNs));
