// V26 — before/after table for REPORT §348 from docs/qa/v26/perf-before.json and perf-after.json.
//   node scripts/qa/v26/perf-compare.mjs [--md]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v26/perf-before.json'), 'utf8'));
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/qa/v26/perf-after.json'), 'utf8'));
const md = process.argv.includes('--md');
const f = (a, b, unit = '', dp = 0) => (a === undefined || b === undefined ? '–' : `${Number(a).toFixed(dp)} → **${Number(b).toFixed(dp)}**${unit}`);
const rows = [];
for (const app of Object.keys(B)) {
  if (app === '_bundle') continue;
  for (const [route, b] of Object.entries(B[app])) {
    const a = A[app]?.[route] ?? {};
    rows.push(`| ${app} | \`${route.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, 'id')}\` | ${f(a.lcp_ms, b.lcp_ms, ' ms')} | ${f(a.cls, b.cls, '', 3)} | ${f(a.long_task_ms, b.long_task_ms, ' ms')} | ${f(a.requests, b.requests)} | ${f(a.js_kb, b.js_kb, ' KB')} | ${f(a.img_kb, b.img_kb, ' KB')} | ${f(a.api, b.api)} (dup ${f(a.duplicate_api, b.duplicate_api)}) |`);
  }
}
const bundle = Object.keys(B._bundle ?? {}).map((app) => { const a = A._bundle?.[app] ?? {}; const b = B._bundle[app]; return `| ${app} | ${f(a.entry_js_kb, b.entry_js_kb, ' KB')} | ${f(a.entry_css_kb, b.entry_css_kb, ' KB')} | ${f(a.total_js_kb, b.total_js_kb, ' KB')} | ${f(a.total_css_kb, b.total_css_kb, ' KB')} | ${f(a.chunks, b.chunks)} |`; });
const out = [
  '| App | Route | LCP (median of 3) | CLS | Long tasks | Requests | JS transferred | Images | API calls |', '|---|---|---|---|---|---|---|---|---|', ...rows, '',
  '| App | Entry JS | Entry CSS | Total JS (all chunks) | Total CSS | Chunks |', '|---|---|---|---|---|---|', ...bundle,
].join('\n');
console.log(out);
