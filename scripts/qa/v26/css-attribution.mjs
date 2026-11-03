// V26 — where the bytes of a built stylesheet come from (REPORT §348). Build the app without minification so the
// consolidation's `── from <file>` provenance markers survive, then sum the bytes between markers.
//   cd apps/<app>-web && ../../node_modules/.bin/vite build --minify false --outDir dist-cssattr --emptyOutDir
//   node scripts/qa/v26/css-attribution.mjs apps/<app>-web/dist-cssattr
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const files = fs.readdirSync(path.join(dir, 'assets')).filter((f) => f.endsWith('.css'));
for (const f of files) {
  const css = fs.readFileSync(path.join(dir, 'assets', f), 'utf8');
  const parts = css.split(/\/\* ── from ([^ ]+) [─]+ \*\//);
  const sizes = { '(before first marker: shared packages + base)': parts[0].length };
  for (let i = 1; i < parts.length; i += 2) sizes[parts[i]] = (sizes[parts[i]] ?? 0) + parts[i + 1].length;
  console.log(`\n${f.replace(/-[A-Za-z0-9_-]{8}\.css$/, '.css')}: ${(css.length / 1024).toFixed(0)} KB (unminified)`);
  for (const [k, v] of Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${String((v / 1024).toFixed(1)).padStart(7)} KB  ${k}`);
}
