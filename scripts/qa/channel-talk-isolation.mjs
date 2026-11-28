#!/usr/bin/env node
// Channel Talk lives on the public marketing site only (apps/marketing-web/src/lib/channelTalk.ts).
// Checks the production bundles in apps/*-web/dist and the native apps' sources:
//   marketing  → the SDK loader is present exactly once in the JS, and no inline <script> was added to the HTML
//   student, agency (Operations), university, *-mobile → no Channel Talk code at all
// The CSP side is checked by scripts/ops/check-csp.mjs (only marketing may name channel.io).
// Build first: `npm run build` (or the four web builds). Exit 1 on any finding.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const MARK = /cdn\.channel\.io|ch-plugin-web|ChannelIO|VITE_CHANNEL_IO_KEY/;
const files = (dir, ext) => !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (n === 'node_modules' || n.startsWith('.')) return [];
  return statSync(p).isDirectory() ? files(p, ext) : ext.test(n) ? [p] : [];
});
const hits = (list) => list.filter((f) => MARK.test(readFileSync(f, 'utf8'))).map((f) => f.slice(ROOT.length + 1));

const problems = [];
const report = {};

const mdist = join(ROOT, 'apps/marketing-web/dist');
if (!existsSync(mdist)) problems.push('marketing: apps/marketing-web/dist missing — build first');
else {
  const js = files(mdist, /\.js$/);
  const withSdk = js.filter((f) => readFileSync(f, 'utf8').includes('cdn.channel.io/plugin/ch-plugin-web.js'));
  const html = hits(files(mdist, /\.html$/));
  report.marketing = { sdkChunks: withSdk.length, htmlWithChannel: html.length };
  if (withSdk.length !== 1) problems.push(`marketing: expected the SDK loader in exactly one chunk, found ${withSdk.length}`);
  if (html.length) problems.push(`marketing: Channel Talk in static HTML (${html.slice(0, 3).join(', ')}) — it must load from the app chunk only`);
}

for (const app of ['student', 'agency', 'university']) {
  const dist = join(ROOT, `apps/${app}-web/dist`);
  if (!existsSync(dist)) { problems.push(`${app}: apps/${app}-web/dist missing — build first`); continue; }
  const h = hits(files(dist, /\.(js|html|css)$/));
  report[app] = h.length ? h : 'clean';
  if (h.length) problems.push(`${app}: Channel Talk in production bundle: ${h.slice(0, 5).join(', ')}`);
}

for (const app of ['student-mobile', 'agency-mobile', 'university-mobile']) {
  const h = hits(files(join(ROOT, `apps/${app}`), /\.(tsx?|jsx?|json)$/));
  report[app] = h.length ? h : 'clean';
  if (h.length) problems.push(`${app}: Channel Talk in native sources: ${h.slice(0, 5).join(', ')}`);
}

// Shared packages must not carry it, or every app that imports them would.
const pk = hits(files(join(ROOT, 'packages'), /\.(tsx?|jsx?)$/));
report.packages = pk.length ? pk : 'clean';
if (pk.length) problems.push(`packages: Channel Talk in shared code: ${pk.slice(0, 5).join(', ')}`);

console.log(JSON.stringify(report, null, 1));
if (problems.length) { console.error(`\n✖ channel-talk isolation\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log('\n✔ channel-talk isolation: marketing only');
