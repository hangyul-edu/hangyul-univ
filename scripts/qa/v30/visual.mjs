/**
 * V30 visual crawl — every crawlable route in docs/qa/v30/ROUTE_INVENTORY.json (brief Parts 19–25, 45).
 *
 *   node scripts/qa/v30/visual.mjs --label=before|after [--locales=ko] [--widths=390,1280] [--product=agency]
 *                                  [--routes=/,/students] [--full] [--check]
 *
 * Runs against the dev stack (3100–3103 + API 8001). Signs each persona in through the dev demo hand-off
 * (`/login?demo=`), crawls their product, runs `inspect()` (scripts/qa/v30/inspect.mjs) and screenshots the first
 * viewport (+ the full page with --full). Findings → docs/qa/v30/visual/<label>/report.json; shots alongside.
 * --check exits 1 on any finding not listed in docs/qa/v30/visual/ACCEPTED.json (each entry carries a reason).
 * One Chromium, serial — never run beside another browser job on this host.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { inspect } from './inspect.mjs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d);
const LABEL = arg('label', 'after');
const LOCALES = arg('locales', 'ko').split(',');
const WIDTHS = arg('widths', '390,1280').split(',').map(Number);
const ONLY = arg('product', '');
const ROUTES = arg('routes', '') ? arg('routes').split(',') : null;
const FULL = process.argv.includes('--full');
const CHECK = process.argv.includes('--check');
const OUT = `docs/qa/v30/visual/${LABEL}`;
fs.mkdirSync(`${OUT}/shots`, { recursive: true });

const inv = JSON.parse(fs.readFileSync('docs/qa/v30/ROUTE_INVENTORY.json', 'utf8'));
const accepted = fs.existsSync('docs/qa/v30/visual/ACCEPTED.json') ? JSON.parse(fs.readFileSync('docs/qa/v30/visual/ACCEPTED.json', 'utf8')) : [];
const isAccepted = (f) => accepted.some((a) => (!a.product || a.product === f.product) && (!a.path || a.path === f.path) && a.check === f.check && (!a.match || f.detail.includes(a.match)));
const routes = inv.routes.filter((r) => r.crawl !== false && r.url && (!ONLY || r.product === ONLY) && (!ROUTES || ROUTES.includes(r.path)));
const slug = (s) => s.replace(/^\//, '').replace(/[/:?=&]+/g, '_') || 'root';

const b = await chromium.launch();
const findings = []; let pages = 0;
const groups = {};
for (const r of routes) (groups[`${r.product}|${r.signedOut ? 'out' : 'in'}`] ??= []).push(r);

for (const [key, list] of Object.entries(groups)) {
  const [product, mode] = key.split('|');
  for (const locale of LOCALES) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1, locale: locale === 'ko' ? 'ko-KR' : locale });
    const page = await ctx.newPage();
    let errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    const base = list[0].base;
    if (mode === 'in' && inv.personas[product]) {
      await page.goto(`${base}/login?demo=${encodeURIComponent(inv.personas[product])}&lang=${locale}`, { waitUntil: 'networkidle', timeout: 180000 });
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
    }
    for (const r of list) {
      errs = [];
      const id = `${product}${r.path} ${locale} ${w}`;
      try {
        const url = `${base}${r.url}${r.url.includes('?') ? '&' : '?'}lang=${locale}`;
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(700);
        // Reveal-on-scroll sections: sweep instantly so a full-page shot has no blank bands, then return to the top.
        if (FULL) {
          await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += innerHeight * 0.8) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } scrollTo({ top: 0, behavior: 'instant' }); });
          await page.waitForTimeout(300);
        }
        const res = await page.evaluate(inspect, locale);
        for (const c of errs) res.push({ check: 'console-error', detail: c });
        if (resp && resp.status() >= 500) res.push({ check: 'http', detail: String(resp.status()) });
        for (const f of res) findings.push({ page: id, product, path: r.path, kind: r.kind, locale, width: w, ...f, accepted: isAccepted({ product, path: r.path, ...f }) });
        const name = `${product}-${slug(r.path)}-${locale}-${w}`;
        await page.screenshot({ path: `${OUT}/shots/${name}.png` });
        if (FULL) await page.screenshot({ path: `${OUT}/shots/${name}-full.png`, fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(6000, await page.evaluate(() => document.documentElement.scrollHeight)) } });
        pages += 1;
      } catch (e) { findings.push({ page: id, product, path: r.path, locale, width: w, check: 'load', detail: String(e).slice(0, 160) }); }
    }
    await ctx.close();
  }
  console.log(`checked ${key} (${list.length} routes)`);
}
await b.close();
const byCheck = {};
for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
const open = findings.filter((f) => !f.accepted);
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ at: new Date().toISOString(), locales: LOCALES, widths: WIDTHS, pages, byCheck, open: open.length, findings }, null, 1));
console.log(JSON.stringify({ pages, byCheck, open: open.length }, null, 1));
for (const f of open.slice(0, 60)) console.log(`  ✗ ${f.page} ${f.check}: ${f.detail}`);
if (CHECK) { console.log(`EXIT=${open.length ? 1 : 0}`); process.exit(open.length ? 1 : 0); }
