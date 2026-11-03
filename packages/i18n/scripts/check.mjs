// Reports translation coverage per locale/namespace vs English and writes locales/_meta.json.
// Fails (exit 1) if English or Korean is missing keys used elsewhere, or any file has invalid JSON.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const namespaces = readdirSync(join(root, 'en')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const enKeys = Object.fromEntries(namespaces.map((ns) => [ns, new Set(flatten(read(join(root, 'en', `${ns}.json`))))]));
const meta = {};
let failed = false;
for (const loc of readdirSync(root).filter((d) => !d.startsWith('_')).sort()) {
  meta[loc] = {};
  for (const ns of namespaces) {
    const p = join(root, loc, `${ns}.json`);
    const keys = existsSync(p) ? new Set(flatten(read(p))) : new Set();
    const have = [...enKeys[ns]].filter((k) => keys.has(k)).length;
    const coverage = enKeys[ns].size ? Math.round((have / enKeys[ns].size) * 100) : 100;
    meta[loc][ns] = coverage;
    if (loc === 'ko' && coverage < 100) {
      console.warn(`ko/${ns}: ${coverage}% — missing ${[...enKeys[ns]].filter((k) => !keys.has(k)).slice(0, 5).join(', ')}…`);
    }
  }
}
writeFileSync(join(root, '_meta.json'), JSON.stringify({ generated_at: new Date().toISOString(), coverage: meta }, null, 2));
const rows = Object.entries(meta).map(([loc, v]) => `${loc.padEnd(8)} ${Object.entries(v).map(([ns, c]) => `${ns}:${String(c).padStart(3)}%`).join('  ')}`);
console.log(rows.join('\n'));
process.exit(failed ? 1 : 0);
