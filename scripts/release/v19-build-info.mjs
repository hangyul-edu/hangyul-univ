/**
 * V19 — recompute `result/student-mobile/metadata/BUILD_INFO.json` after an Android rebuild.
 *
 * Sizes and SHA-256s are read from the binaries that are actually on disk, never carried over, so the file
 * cannot drift from what it describes — which is the whole reason `qa:v18` can verify it and `qa:v19`
 * check F can tell whether it is older than its own source.
 *
 *   node scripts/release/v19-build-info.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const META = join(ROOT, 'result/student-mobile/metadata/BUILD_INFO.json');
const DIR = join(ROOT, 'result/student-mobile/android');

if (!existsSync(META)) { console.error(`missing ${META}`); process.exit(1); }
const info = JSON.parse(readFileSync(META, 'utf8'));

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const human = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

let changed = 0;
for (const a of info.artifacts ?? []) {
  const p = join(DIR, a.filename);
  if (!existsSync(p)) { console.error(`  ! ${a.filename} is not in ${DIR} — not updated`); continue; }
  const size = statSync(p).size;
  const digest = sha(p);
  if (a.sizeBytes !== size || a.sha256 !== digest) changed++;
  console.log(`  ${a.filename}: ${a.sizeBytes} → ${size} (${human(size)}), sha256 ${String(a.sha256).slice(0, 12)}… → ${digest.slice(0, 12)}…`);
  a.sizeBytes = size;
  a.sizeHuman = human(size);
  a.sha256 = digest;
}

info.builtAt = new Date().toISOString();
info.node = process.version;
info.rebuildNote = 'Rebuilt in V19 so the artifacts match the source they bundle: V19 changed '
  + 'packages/api-client (the request deadline), which the native app compiles. See REPORT §194.3 and '
  + '`qa:v19` check F, which compares this timestamp against the newest source the bundle includes.';

writeFileSync(META, `${JSON.stringify(info, null, 2)}\n`);
console.log(`\nbuiltAt → ${info.builtAt}`);
console.log(`${changed} artifact record(s) changed. Wrote ${META}`);
