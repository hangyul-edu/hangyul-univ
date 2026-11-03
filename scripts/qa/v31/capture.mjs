/**
 * V31 before/after capture (brief Part 65) — the same screens, data and viewports for both runs.
 *
 *   node scripts/qa/v31/capture.mjs <before|after> [only-prefix]
 *
 * Dev stack (3100–3103). Marketing: pricing tail at 1440 + 390 (clipped from the plan-compare control to the end of
 * the pricing band), the whole homepage at 1440. Agency: Today 1440 + 1024, the stage rail close-up, a workspace.
 * University: home + pipeline. Student: home (1440 + 390), applications, documents. → docs/qa/v31/<label>/
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const LABEL = process.argv[2] ?? 'before';
const ONLY = process.argv[3] ?? '';
const OUT = `docs/qa/v31/${LABEL}`;
fs.mkdirSync(OUT, { recursive: true });
const inv = JSON.parse(fs.readFileSync('docs/qa/v30/ROUTE_INVENTORY.json', 'utf8'));
const url = (product, path) => inv.routes.find((r) => r.product === product && r.path === path)?.url ?? path;

const sweep = (p) => p.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 70)); }
  scrollTo({ top: 0, behavior: 'instant' });
});
const box = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return b; };

const b = await chromium.launch();
async function session(base, email, w, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR' });
  const p = await ctx.newPage();
  if (email) {
    await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  }
  return { ctx, p };
}
async function shot(name, fn) {
  if (ONLY && !name.startsWith(ONLY)) return;
  try { await fn(); console.log('ok', name); } catch (e) { console.log('FAIL', name, String(e).slice(0, 160)); }
}

const MK = 'http://127.0.0.1:3100';
for (const w of [1440, 390]) {
  await shot(`mk-pricing-tail-${w}`, async () => {
    const { ctx, p } = await session(MK, null, w, w < 600 ? 844 : 900);
    await p.goto(`${MK}/?lang=ko`, { waitUntil: 'networkidle' }); await sweep(p);
    await p.locator('#pricing').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    const start = await box(p, '.kn-compare-wrap, #plan-compare'); const band = await box(p, '#pricing');
    const y0 = (await p.evaluate(() => scrollY)) + start.y - 40;
    const y1 = (await p.evaluate(() => scrollY)) + band.y + band.height + 60;
    await p.screenshot({ path: `${OUT}/mk-pricing-tail-${w}.png`, fullPage: true, clip: { x: 0, y: y0, width: w, height: y1 - y0 } });
    await ctx.close();
  });
}
await shot('mk-home-full-1440', async () => {
  const { ctx, p } = await session(MK, null, 1440);
  await p.goto(`${MK}/?lang=ko`, { waitUntil: 'networkidle' }); await sweep(p); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/mk-home-full-1440.png`, fullPage: true });
  await ctx.close();
});

const AG = 'http://127.0.0.1:3102';
for (const w of [1440, 1024]) {
  await shot(`ag-today-${w}`, async () => {
    const { ctx, p } = await session(AG, inv.personas.agency, w);
    await p.goto(`${AG}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/ag-today-${w}.png` });
    if (w === 1440) {
      const r = await box(p, '.ag22-strip');
      if (r) await p.screenshot({ path: `${OUT}/ag-stage-rail-1440.png`, clip: { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: Math.min(1440 - r.x + 16, r.width + 32), height: r.height + 32 } });
      await p.goto(`${AG}${url('agency', '/students/:id')}?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/ag-workspace-1440.png` });
    }
    await ctx.close();
  });
}

const UN = 'http://127.0.0.1:3103';
await shot('un-home-1440', async () => {
  const { ctx, p } = await session(UN, inv.personas.university, 1440);
  await p.goto(`${UN}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/un-home-1440.png` });
  await p.goto(`${UN}/pipeline?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/un-pipeline-1440.png` });
  await ctx.close();
});

const ST = 'http://127.0.0.1:3101';
for (const w of [1440, 390]) {
  await shot(`st-home-${w}`, async () => {
    const { ctx, p } = await session(ST, inv.personas.student, w, w < 600 ? 844 : 900);
    await p.goto(`${ST}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/st-home-${w}.png` });
    if (w === 1440) for (const r of ['/applications', '/documents']) {
      await p.goto(`${ST}${r}?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/st${r.replace('/', '-')}-1440.png` });
    }
    await ctx.close();
  });
}
await b.close();
