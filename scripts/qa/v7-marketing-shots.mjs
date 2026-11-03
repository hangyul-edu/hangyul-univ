// V7 marketing captures at the brief's viewports: node scripts/qa/v7-marketing-shots.mjs [outdir]
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'docs/qa/v7/hangyul/marketing';
const VP = [[390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1728, 1117]];
const ROUTES = [['home', '/'], ['universities', '/universities'], ['program', '/universities/kyung-hee-university'], ['services', '/students'], ['how', '/how-it-works']];
const b = await chromium.launch();
const issues = [];
for (const [name, path] of ROUTES) for (const [w, h] of VP) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => issues.push(`${name}@${w} ERR ${e.message}`));
  await p.goto('http://localhost:3100' + path, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); } scrollTo(0, 0); });
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => ({ ovf: document.documentElement.scrollWidth - innerWidth, H: document.body.scrollHeight }));
  if (m.ovf > 1) issues.push(`${name}@${w} overflow ${m.ovf}px`);
  await p.screenshot({ path: `${out}/${name}-${w}.png` });
  if (w === 390 || w === 1440) await p.screenshot({ path: `${out}/${name}-${w}-full.png`, fullPage: true });
  console.log(name, w, (m.H / h).toFixed(1), 'screens');
  await p.close();
}
await b.close();
console.log('ISSUES', issues.length ? issues.join('\n') : 'none');
