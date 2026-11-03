// V26 — axe inventory over the gate's 14 core routes × 2 widths, every impact (REPORT §348/§352).
//   node scripts/qa/v26/axe-inventory.mjs [--json docs/qa/v26/axe-after.json]
// The gate fails on serious/critical only; this records minor/moderate too, so §352 lists what remains instead of implying zero.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
const OUT = process.argv.includes('--json') ? path.join(ROOT, process.argv[process.argv.indexOf('--json') + 1]) : null;
const ROUTES = [['marketing', 'http://localhost:3100', null, ['/', '/universities', '/universities/yonsei-university', '/start']],
  ['student', 'http://localhost:3101', 'student@demo.hangyul.kr', ['/', '/explore?tab=all', '/services', `/applications/${IDS.studentApplication}`, '/documents']],
  ['agency', 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr', ['/', `/students/${IDS.agencyStudent}`, '/review']],
  ['university', 'http://localhost:3103', 'admin@pusan.univ.demo.hangyul.kr', ['/', '/analytics']]];
const axeSrc = fs.readFileSync('/root/.cache/hg-axe/node_modules/axe-core/axe.min.js', 'utf8');
const b = await chromium.launch(); const out = { generated: new Date().toISOString(), byImpact: {}, rules: {}, routes: [] };
for (const [name, base, email, routes] of ROUTES) {
  for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, locale: 'ko-KR', reducedMotion: 'reduce' }); const p = await ctx.newPage();
    if (email) { await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
    for (const r of routes) {
      await p.goto(`${base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.addScriptTag({ content: axeSrc });
      const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations
        .map((x) => ({ id: x.id, impact: x.impact, help: x.help, n: x.nodes.length, sample: x.nodes[0] ? x.nodes[0].target.join(' ') : '' })));
      out.routes.push({ app: name, route: r, width: w, violations: v });
      for (const x of v) { out.byImpact[x.impact] = (out.byImpact[x.impact] || 0) + x.n; const k = `${x.impact}:${x.id}`; out.rules[k] = out.rules[k] || { help: x.help, nodes: 0, where: [] }; out.rules[k].nodes += x.n; if (out.rules[k].where.length < 4) out.rules[k].where.push(`${name}${r}@${w} ${x.sample}`.slice(0, 120)); }
      console.log(`${name.padEnd(10)} ${r.padEnd(44)} @${w}: ${v.length ? v.map((x) => `${x.impact}:${x.id}×${x.n}`).join(' ') : 'clean'}`);
    }
    await ctx.close();
  }
}
await b.close();
console.log('\nby impact:', JSON.stringify(out.byImpact));
if (OUT) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('written', path.relative(ROOT, OUT)); }
