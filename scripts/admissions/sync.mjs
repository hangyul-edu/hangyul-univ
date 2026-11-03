/**
 * Writes `shared/admissions.json` from `packages/types/src/admissions.ts` (V27, REPORT §356) — study levels, the
 * language-test registry and the GPA scales, in the one direction they may flow. `--check` fails on drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, 'shared/admissions.json');
const m = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/admissions.ts')).href);
const payload = {
  _generated_by: 'scripts/admissions/sync.mjs from packages/types/src/admissions.ts — do not edit by hand',
  study_levels: m.STUDY_LEVELS,
  language_tests: m.LANGUAGE_TESTS,
  gpa_scales: m.GPA_SCALES,
  gpa_custom_max: m.GPA_CUSTOM_MAX,
  gpa_method: m.GPA_METHOD,
  gpa_help_url: m.GPA_HELP_URL,
  fit_tiers: m.FIT_TIERS,
  match_sorts: m.MATCH_SORTS,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((existsSync(OUT) ? readFileSync(OUT, 'utf8') : '') !== text) {
    console.error('shared/admissions.json is stale — run `npm run admissions:sync`.');
    process.exit(1);
  }
  console.log('shared/admissions.json: in sync');
} else {
  writeFileSync(OUT, text);
  console.log('wrote shared/admissions.json');
}
