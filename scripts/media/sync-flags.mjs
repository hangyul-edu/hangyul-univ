/**
 * Publish the owner's flag assets to every web app, under their real ISO 3166-1 country code.
 *
 * `apps/flags` is the owner's drop and is never edited (brief Part 39): two of its filenames name the wrong
 * country — the French tricolour is `GP.svg` and the Polish flag is `ID2.svg` — and Korea's is `KO.svg`, which
 * is a language tag. `packages/i18n/src/markets.ts` holds the real mapping; this script copies each asset to
 * `<app>/public/flags/<ISO>.svg` so the product can address a flag by the country it actually is.
 *
 * The SVGs are 345–4,373 bytes each. Serving them as files rather than inlining them keeps them out of every
 * app's JavaScript and off the critical path: they are fetched when the language picker first opens.
 *
 *   node scripts/media/sync-flags.mjs [--check]
 *
 * `--check` writes nothing and exits non-zero if any app is out of date, which is what CI runs.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'apps', 'flags');
const APPS = ['marketing-web', 'student-web', 'agency-web', 'university-web'];
const check = process.argv.includes('--check');

/** Read the market table without TypeScript: the rows are a plain literal and this script runs in plain node. */
const table = readFileSync(join(ROOT, 'packages', 'i18n', 'src', 'markets.ts'), 'utf8');
const markets = [...table.matchAll(/\{ code: '(\w+)',\s*asset: '(\w+)'/g)].map((m) => ({ code: m[1], asset: m[2] }));
if (markets.length === 0) { console.error('! markets.ts: no rows matched — did the literal shape change?'); process.exit(1); }

const assets = new Set(readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
const missing = markets.filter((m) => !assets.has(m.asset));
if (missing.length) { console.error(`! no asset for ${missing.map((m) => `${m.code}←${m.asset}`).join(', ')}`); process.exit(1); }

const unused = [...assets].filter((a) => !markets.some((m) => m.asset === a));
if (unused.length) console.log(`  note: ${unused.length} asset(s) in apps/flags that no market claims: ${unused.join(', ')}`);

let stale = 0;
let written = 0;
for (const app of APPS) {
  const dir = join(ROOT, 'apps', app, 'public', 'flags');
  if (!check) mkdirSync(dir, { recursive: true });
  for (const m of markets) {
    const body = readFileSync(join(SRC, `${m.asset}.svg`), 'utf8');
    const dest = join(dir, `${m.code}.svg`);
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    if (current === body) continue;
    if (check) { stale += 1; console.error(`! stale: apps/${app}/public/flags/${m.code}.svg`); continue; }
    writeFileSync(dest, body);
    written += 1;
  }
}

if (check) {
  console.log(stale ? `${stale} flag file(s) out of date — run node scripts/media/sync-flags.mjs` : `flags up to date (${markets.length} × ${APPS.length})`);
  process.exit(stale ? 1 : 0);
}
console.log(`${markets.length} markets → ${APPS.length} apps (${written} file(s) written)`);
