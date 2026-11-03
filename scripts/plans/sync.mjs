/**
 * Writes `shared/plans.json` from `packages/types/src/plans.ts` — the one direction plan data is allowed to
 * flow.
 *
 * The TypeScript manifest is the source of truth (REPORT §117); the server is Python and cannot import it,
 * so this generates the JSON both sides agree on. With `--check` it regenerates in memory and fails if the
 * committed file differs, which is what `npm run qa:pricing` runs — so editing a price in the manifest can
 * never silently leave the seed behind.
 *
 * The manifest is imported directly: Node strips the type annotations itself (>=23.6), so there is no build
 * step and, more to the point, no second hand-maintained copy of these numbers anywhere in the tree.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, 'shared/plans.json');
const CHECK = process.argv.includes('--check');

const {
  PLANS, COMPARE_ROWS, EXTERNAL_COSTS, COUNTED_ENTITLEMENTS, SERVICE_CATALOG, ADD_ONS, SERVICE_NOTES,
  CONTRACTED_ESSAY_TYPES, UPGRADE_POLICY, compareCell,
} = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/plans.ts')).href);

// V29: the catalogue version and everything a purchase snapshots travel with the plans, so the server can
// freeze exactly what was sold. `cells` is the comparison as data — the server's agency summary and the QA
// gate read the same cell keys the web renders.
const payload = {
  _generated_by: 'scripts/plans/sync.mjs from packages/types/src/plans.ts — do not edit by hand',
  catalog: SERVICE_CATALOG,
  counted_entitlements: COUNTED_ENTITLEMENTS,
  contracted_essay_types: CONTRACTED_ESSAY_TYPES,
  compare_rows: COMPARE_ROWS,
  external_costs: EXTERNAL_COSTS,
  service_notes: SERVICE_NOTES,
  upgrade_policy: UPGRADE_POLICY,
  plans: PLANS.map((p) => ({
    code: p.code, slug: p.slug, sort_order: p.sort_order, name_ko: p.name_ko, name_en: p.name_en,
    currency: p.currency, amount_minor: p.amount_minor, recommended: p.recommended,
    entitlements: p.entitlements,
    cells: Object.fromEntries(COMPARE_ROWS.map((r) => [r.key, compareCell(r, p)])),
  })),
  add_ons: ADD_ONS,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;

if (CHECK) {
  const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (have !== text) {
    console.error('shared/plans.json is stale — run `npm run plans:sync`.');
    process.exit(1);
  }
  // The previous catalogue must be frozen before a new version ships (V29 §7).
  const prev = resolve(ROOT, `shared/plan-catalog/${SERVICE_CATALOG.previous}.json`);
  if (SERVICE_CATALOG.previous && !existsSync(prev)) {
    console.error(`shared/plan-catalog/${SERVICE_CATALOG.previous}.json is missing — freeze the previous catalogue.`);
    process.exit(1);
  }
  console.log(`shared/plans.json: up to date (${payload.plans.length} plans, ${payload.add_ons.length} add-ons, catalogue ${SERVICE_CATALOG.version})`);
} else {
  writeFileSync(OUT, text);
  console.log(`shared/plans.json: wrote ${payload.plans.length} plans`);
}
