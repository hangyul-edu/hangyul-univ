// Prints the synthetic-review sample (en | target) for one locale: the student core flow strings.
// Usage: node scripts/i18n/v8-data/_review-sample.mjs <loc> [--count]
import { existsSync, readFileSync } from 'node:fs';
const [loc] = process.argv.slice(2);
const L = (l, ns) => { const p = `packages/i18n/locales/${l}/${ns}.json`; return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
const fl = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? fl(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
export const SCOPE = {
  common: /^(brand|actions\.(save|cancel|back|next|continue|compare|signIn|signUp|getStarted|upload)|states\.|freshness\.(verified|unverified|officialSource)|nav\.(home|explore|universities|programs|saved|compare|applications|documents|visa|profile)|degree\.|instruction\.|tier\.|eligibility\.|matchReason\.|docStatus\.|time\.|footer\.noGuarantee|i18n\.)/,
  student: /^(discover\.|budget\.|compare\.|nav\.|v8\.|v4\.verdictText\.|v4\.compare\.|more\.(budget|hint\.(universities|compare|applications|documents|budget)))/,
  marketing: /^(hero\.|check\.|quick\.|v8\.)/,
};
let n = 0, total = 0;
for (const ns of Object.keys(SCOPE)) {
  const en = L('en', ns), t = L(loc, ns);
  if (!t) { console.log(`## ${ns}: no file for ${loc} (falls back to English)`); continue; }
  const tm = new Map(fl(t));
  for (const [k, v] of fl(en)) {
    if (!SCOPE[ns].test(k)) continue;
    total++;
    const tv = tm.get(k);
    if (tv === undefined) { if (!process.argv.includes('--count')) console.log(`${ns}:${k}\n  EN ${v}\n  -- MISSING (English fallback)`); continue; }
    n++;
    if (!process.argv.includes('--count')) console.log(`${ns}:${k}\n  EN ${v}\n  ${loc.toUpperCase()} ${tv}`);
  }
}
console.log(`# ${loc}: ${n} translated / ${total} in scope`);
