// V26 — axe detail for one route (REPORT §348). node scripts/qa/v26/axe-probe.mjs <url> [width] [demo-login-email]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [url, w = '1440', login] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: Number(w), height: 900 }, reducedMotion: 'reduce' })).newPage();
if (login) { const u = new URL(url); await p.goto(`${u.origin}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((x) => !x.pathname.startsWith('/login')); }
await p.goto(url, { waitUntil: 'networkidle' });
await p.addScriptTag({ content: fs.readFileSync('/root/.cache/hg-axe/node_modules/axe-core/axe.min.js', 'utf8') });
const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
  .filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => ({ id: x.id, nodes: x.nodes.map((n) => `${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 160)}`) })));
console.log(JSON.stringify(v, null, 1)); await b.close();
