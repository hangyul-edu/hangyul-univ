#!/usr/bin/env node
// V29 — checks the CSP policy (no unsafe-eval, no wildcards, unsafe-inline only for styles) and every built app's
// dist/*.html for inline <script> or inline event handlers that the policy would block. Skips an app with no dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { APP_DIRS, directivesFor, loadPolicy, problems, ROOT } from './csp.mjs';

const policy = loadPolicy();
const errors = [...problems(policy)];
let checked = 0;
const htmlFiles = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return f === 'assets' ? [] : htmlFiles(p);
  return f.endsWith('.html') ? [p] : [];
});
const allowedHosts = (d) => (d['script-src'] ?? []).filter((s) => s.startsWith('https://'));

for (const [app, dirName] of Object.entries(APP_DIRS)) {
  const dist = resolve(ROOT, 'apps', dirName, 'dist');
  if (!existsSync(dist)) { console.log(`SKIP ${app}: apps/${dirName}/dist not built`); continue; }
  const d = directivesFor(policy, app);
  for (const file of htmlFiles(dist)) {
    checked += 1;
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const [, attrs, body] = m;
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!src) {
        if (/type\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs)) continue; // data, not executed
        if (body.trim()) errors.push(`${app}: inline <script> in ${file.slice(ROOT.length + 1)} (blocked by script-src)`);
      } else if (/^https?:\/\//.test(src) && !allowedHosts(d).some((h) => src.startsWith(h))) {
        errors.push(`${app}: external script ${src} not allowed by script-src`);
      }
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) errors.push(`${app}: inline event handler attribute in ${file.slice(ROOT.length + 1)}`);
    if (/javascript:/i.test(html)) errors.push(`${app}: javascript: URL in ${file.slice(ROOT.length + 1)}`);
  }
  console.log(`OK   ${app}: ${htmlFiles(dist).length} html file(s) checked`);
}
if (errors.length) { console.error(`\nCSP check FAILED:\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`\nCSP check passed (${checked} html files; policy has no unsafe-eval).`);
