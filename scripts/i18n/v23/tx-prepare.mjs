// V23 — per-locale translation work lists for the priority surface (docs/qa/v23/l10n/priority-keys.json).
// Writes scripts/i18n/v23/tx/source/<locale>.json: [{ ns, key, en, ko }] for every priority key the locale lacks.
// Two tiers: "customer" (marketing + student routes) and "console" (agency + university critical routes).
import fs from 'node:fs';
import path from 'node:path';
import { MARKET_LOCALES } from './markets.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else out[q] = v; } return out; };
const cache = {};
const b = (l, ns) => (cache[l + ns] ??= (() => { const p = path.join(ROOT, 'packages/i18n/locales', l, `${ns}.json`); return fs.existsSync(p) ? flat(JSON.parse(fs.readFileSync(p, 'utf8'))) : {}; })());
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v23/l10n/priority-keys.json'), 'utf8')).apps;
const tiers = { customer: ['marketing', 'student_public', 'student', 'student_visa', 'student_arrived'], console: ['agency', 'university'] };
const summary = {};
for (const loc of MARKET_LOCALES.filter((l) => l !== 'en')) {
  const out = {};
  for (const [tier, group] of Object.entries(tiers)) {
    const keys = [...new Set(group.flatMap((a) => apps[a].keys))].sort();
    out[tier] = [];
    for (const k of keys) {
      const [ns, ...r] = k.split(':'); const key = r.join(':');
      const en = b('en', ns)[key];
      if (typeof en !== 'string' || key in b(loc, ns)) continue;
      out[tier].push({ ns, key, en, ko: b('ko', ns)[key] ?? null });
    }
  }
  fs.writeFileSync(path.join(ROOT, 'scripts/i18n/v23/tx/source', `${loc}.json`), JSON.stringify(out, null, 1) + '\n');
  summary[loc] = { customer: out.customer.length, console: out.console.length };
}
console.log(JSON.stringify(summary));
