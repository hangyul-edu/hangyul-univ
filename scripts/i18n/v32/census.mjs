#!/usr/bin/env node
/**
 * V32 — the ACTIVE string census: which translation keys the product can actually render.
 *
 * Reads every `t('ns:key')` / `t("key")` / `t(\`prefix.${x}\`)` in the web apps, the shared packages and the three
 * native apps, resolves the namespace the way `useLocale(ns)` / `useTranslation(ns)` resolve it (an explicit `ns:`
 * prefix wins; otherwise the file's default namespace), and expands a template prefix to every key under it. Keys
 * that exist in no bundle are reported, as are bundle keys nothing references (dead copy nobody will ever read).
 *
 *   node scripts/i18n/v32/census.mjs            → docs/qa/v32/l10n/active-keys.json + a summary
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const NS = ['agency', 'common', 'concierge', 'dossier', 'marketing', 'mobile', 'student', 'success', 'university', 'visaroute', 'writing'];
const DEFAULT_NS = { 'apps/marketing-web': 'marketing', 'apps/student-web': 'student', 'apps/agency-web': 'agency', 'apps/university-web': 'university',
  'apps/student-mobile': 'mobile', 'apps/agency-mobile': 'mobile', 'apps/university-mobile': 'mobile', 'packages/mobile-ui': 'mobile', 'packages/ui': 'common', 'packages': 'common' };

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]));
const bundles = Object.fromEntries(NS.map((ns) => [ns, new Map(flat(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/i18n/locales/ko', `${ns}.json`), 'utf8'))))]));
const enBundles = Object.fromEntries(NS.map((ns) => [ns, new Map(flat(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/i18n/locales/en', `${ns}.json`), 'utf8'))))]));

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('dist-') || e.name === 'android' || e.name === 'ios') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|mjs|py)$/.test(e.name) && !/\.test\.|\/test\/|\/tests\//.test(p)) yield p;
  }
}
const files = [...walk(path.join(ROOT, 'apps')), ...walk(path.join(ROOT, 'packages'))].filter((f) => !/packages\/i18n\/scripts|scripts\//.test(f));

const active = Object.fromEntries(NS.map((ns) => [ns, new Set()]));
const missing = new Set();
const dynamicPrefixes = [];
const plural = (k) => k.replace(/_(one|other|zero|two|few|many)$/, '');

function resolve(file, raw, defaultNs) {
  let ns = defaultNs, key = raw;
  const m = raw.match(/^([a-z]+):(.+)$/);
  if (m && NS.includes(m[1])) { ns = m[1]; key = m[2]; }
  return { ns, key };
}
function mark(ns, key, file) {
  const b = bundles[ns];
  if (b.has(key)) { active[ns].add(key); return true; }
  // plural families: `foo` ↔ `foo_one`/`foo_other`
  const fam = [...b.keys()].filter((k) => plural(k) === key);
  if (fam.length) { fam.forEach((k) => active[ns].add(k)); return true; }
  // the file's default namespace may be wrong for a shared package: try every namespace that has the key
  const hit = NS.find((n) => bundles[n].has(key) || [...bundles[n].keys()].some((k) => plural(k) === key));
  if (hit) { const bb = bundles[hit]; (bb.has(key) ? [key] : [...bb.keys()].filter((k) => plural(k) === key)).forEach((k) => active[hit].add(k)); return true; }
  missing.add(`${ns}:${key} (${path.relative(ROOT, file)})`);
  return false;
}
function markPrefix(ns, prefix, file) {
  let n = 0;
  for (const nsx of [ns, ...NS.filter((x) => x !== ns)]) {
    for (const k of bundles[nsx].keys()) if (k.startsWith(prefix)) { active[nsx].add(k); n++; }
    if (n) { dynamicPrefixes.push({ ns: nsx, prefix, keys: n, file: path.relative(ROOT, file) }); return; }
  }
  missing.add(`${ns}:${prefix}* (dynamic, ${path.relative(ROOT, file)})`);
}

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const defaultNs = Object.entries(DEFAULT_NS).find(([p]) => rel.startsWith(p))?.[1] ?? 'common';
  const src = fs.readFileSync(file, 'utf8');
  // the hook's namespace(s): useLocale('student') / useLocale(['marketing','common']) / useTranslation('mobile')
  const hook = src.match(/use(?:Locale|Translation|T)\(\s*(?:'([a-z]+)'|\[\s*'([a-z]+)')/);
  const fileNs = hook?.[1] ?? hook?.[2] ?? defaultNs;
  for (const m of src.matchAll(/\bt\(\s*(['"])([^'"`\n]+?)\1/g)) { const { ns, key } = resolve(file, m[2], fileNs); mark(ns, key, file); }
  for (const m of src.matchAll(/\bt\(\s*`([^`$\n]*)\$\{/g)) { const { ns, key } = resolve(file, m[1], fileNs); if (key) markPrefix(ns, key, file); }
  // keys passed as data: `labelKey: 'common:foo.bar'`, `title: 'v31.x.y'` (quoted strings that look like keys)
  for (const m of src.matchAll(/['"]((?:[a-z]+:)?(?:v\d+|common|states|actions|auth|nav|form|fit|plans?|pricing|services?)[a-zA-Z0-9_.]*\.[a-zA-Z0-9_.]+)['"]/g)) {
    const { ns, key } = resolve(file, m[1], fileNs);
    const n = NS.find((x) => bundles[x].has(key));
    if (n) active[n].add(key);
  }
}

// Keys the API emits by name (task / notification title keys): invisible to a client-side scan, rendered by every client.
for (const file of walk(path.join(ROOT, 'server/app'))) {
  if (!file.endsWith('.py')) continue;
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/"((?:task|notify|notification)\.[a-zA-Z0-9_.]+)"/g)) {
    const key = m[1];
    const ns = NS.find((n) => bundles[n].has(key) || [...bundles[n].keys()].some((k) => plural(k) === key));
    if (ns) mark(ns, key, file);
  }
}

const summary = {};
for (const ns of NS) {
  const total = bundles[ns].size;
  const dead = [...bundles[ns].keys()].filter((k) => !active[ns].has(k));
  summary[ns] = { total, active: active[ns].size, dead: dead.length };
}
const out = { generated_at: new Date().toISOString(), summary, active: Object.fromEntries(NS.map((ns) => [ns, [...active[ns]].sort()])),
  dead: Object.fromEntries(NS.map((ns) => [ns, [...bundles[ns].keys()].filter((k) => !active[ns].has(k)).sort()])), missing: [...missing].sort(), dynamicPrefixes };
fs.mkdirSync(path.join(ROOT, 'docs/qa/v32/l10n'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/qa/v32/l10n/active-keys.json'), JSON.stringify(out, null, 1));
console.log('namespace  total  active  dead');
for (const [ns, s] of Object.entries(summary)) console.log(`${ns.padEnd(10)} ${String(s.total).padStart(5)} ${String(s.active).padStart(7)} ${String(s.dead).padStart(5)}`);
const tot = Object.values(summary).reduce((a, s) => ({ total: a.total + s.total, active: a.active + s.active }), { total: 0, active: 0 });
console.log(`TOTAL      ${tot.total} keys, ${tot.active} active (${Math.round((tot.active / tot.total) * 100)}%), ${missing.size} referenced-but-missing, ${dynamicPrefixes.length} dynamic prefixes`);
void enBundles;
