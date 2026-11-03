/**
 * V18 locale coverage gate.
 *
 * Two questions, measured against English rather than against a stored manifest — a manifest goes
 * stale the moment a pass adds strings, which is exactly how V17 shipped 69 strings that reached
 * only 10 of 32 markets while the status file still read "100 %".
 *
 *   1. V18 CORE  — the conversion surface every exposed market must own outright (no English
 *      fallback): the quick check, the paywall/upgrade copy, the payment handoff and its result.
 *   2. FULL CORE — every user-facing key in common/student/mobile/marketing. Reported per market,
 *      never gated, because closing it is a funded translation programme (see §172).
 *
 * Exit 1 if any exposed market is short of V18 CORE, or if a placeholder set differs from English.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = new URL('../../packages/i18n/locales/', import.meta.url).pathname;
const MARKETS_TS = new URL('../../packages/i18n/src/markets.ts', import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const get = (o, k) => k.split('.').reduce((a, x) => (a && typeof a === 'object' ? a[x] : undefined), o);
const phSet = (s) => new Set((String(s).match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')));
/**
 * Korean adds its own placeholders the other locales never see: `koParticle()` feeds {{particle}} and
 * {{particleRo}} so 지원 관리**는** and 기숙사 지원**은** agree with the noun in front of them. An *extra*
 * placeholder from this list is correct; a *dropped* English one is the real defect, so the check is
 * directional — EN ⊆ translation — rather than an equality test.
 */
const PARTICLE_PLACEHOLDERS = new Set(['{{particle}}', '{{particleRo}}']);
/** The English placeholders this translation fails to carry, if any. */
const droppedPlaceholders = (enVal, locVal) => {
  const have = phSet(locVal);
  const extra = [...have].filter((x) => !phSet(enVal).has(x) && !PARTICLE_PLACEHOLDERS.has(x));
  const missing = [...phSet(enVal)].filter((x) => !have.has(x));
  return { missing, extra };
};

const src = readFileSync(MARKETS_TS, 'utf8');
const block = src.slice(src.indexOf('export const MARKETS'), src.indexOf('\n];', src.indexOf('export const MARKETS')));
const markets = [...block.matchAll(/code:\s*'([^']+)',\s*asset:\s*'[^']+',\s*locale:\s*'([^']+)'/g)].map((m) => ({ code: m[1], locale: m[2] }));

const NS = ['common', 'student', 'mobile', 'marketing'];
const enKeys = Object.fromEntries(NS.map((ns) => [ns, flat(read(join(LOCALES, 'en', `${ns}.json`)))]));
const enObj = Object.fromEntries(NS.map((ns) => [ns, read(join(LOCALES, 'en', `${ns}.json`))]));

/** The V18 core conversion surface: prefixes that must be complete in every exposed market. */
const CORE = {
  student: ['v17.gate.', 'v17.upgrade.', 'v17.pay.'],
  marketing: ['v17.quick.', 'v17.uni.'],
  // V18 added the native offline state, which §8 lists among the flows that may never fall back to English.
  mobile: ['v18.offline.'],
};
const coreKeys = Object.entries(CORE).flatMap(([ns, prefixes]) =>
  enKeys[ns].filter((k) => prefixes.some((p) => k.startsWith(p))).map((k) => `${ns}:${k}`),
);

const bundle = (loc, ns) => {
  const p = join(LOCALES, loc, `${ns}.json`);
  return existsSync(p) ? read(p) : {};
};
const rows = [];
const phProblems = [];
for (const m of markets) {
  const cache = Object.fromEntries(NS.map((ns) => [ns, bundle(m.locale, ns)]));
  let coreHave = 0;
  const coreMissing = [];
  for (const entry of coreKeys) {
    const i = entry.indexOf(':');
    const [ns, k] = [entry.slice(0, i), entry.slice(i + 1)];
    const v = get(cache[ns], k);
    if (v === undefined) { coreMissing.push(entry); continue; }
    coreHave++;
    const { missing, extra } = droppedPlaceholders(get(enObj[ns], k), v);
    if (missing.length) phProblems.push(`${m.locale} ${entry}: drops ${missing.join(' ')}`);
    if (extra.length) phProblems.push(`${m.locale} ${entry}: unknown placeholder ${extra.join(' ')}`);
  }
  let fullHave = 0, fullTotal = 0;
  for (const ns of NS) {
    fullTotal += enKeys[ns].length;
    fullHave += enKeys[ns].filter((k) => get(cache[ns], k) !== undefined).length;
  }
  rows.push({
    ...m,
    corePct: coreKeys.length ? +(coreHave / coreKeys.length * 100).toFixed(1) : 100,
    coreMissing,
    fullPct: +(fullHave / fullTotal * 100).toFixed(1),
    fullMissing: fullTotal - fullHave,
  });
}

console.log(`V18 locale coverage — ${markets.length} exposed markets, ${coreKeys.length} core keys\n`);
console.log('code loc        V18CORE   FULL   full-missing');
for (const r of [...rows].sort((a, b) => a.corePct - b.corePct || a.fullPct - b.fullPct)) {
  console.log(`${r.code.padEnd(4)} ${r.locale.padEnd(9)} ${String(r.corePct).padStart(6)}% ${String(r.fullPct).padStart(6)}% ${String(r.fullMissing).padStart(8)}`);
}
const short = rows.filter((r) => r.corePct < 100);
const fullComplete = rows.filter((r) => r.fullPct >= 99.95).length;
console.log(`\nV18 CORE complete:  ${rows.length - short.length}/${rows.length} markets`);
console.log(`FULL core complete: ${fullComplete}/${rows.length} markets (not gated — see docs/REPORT.md §172)`);
console.log(`FULL core gap:      ${rows.reduce((a, r) => a + r.fullMissing, 0)} strings across all markets`);
let failed = false;
if (short.length) {
  failed = true;
  console.error(`\nFAIL — ${short.length} exposed market(s) fall back to English on the core conversion surface:`);
  for (const r of short) console.error(`  ${r.code}/${r.locale}: ${r.coreMissing.length} missing — ${r.coreMissing.slice(0, 4).join(', ')}…`);
}
if (phProblems.length) {
  failed = true;
  console.error(`\nFAIL — ${phProblems.length} placeholder mismatch(es):\n  ` + phProblems.slice(0, 20).join('\n  '));
}
if (!failed) console.log('\nPASS — every exposed market owns the V18 core conversion surface.');
process.exit(failed ? 1 : 0);
