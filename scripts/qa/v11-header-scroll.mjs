/**
 * V11 — prove the marketing header stays a floating pill at every scroll position (brief Parts 1, 31, 32).
 *
 * The V10 defect only appeared after scrolling, so a first-viewport screenshot could not see it. This measures
 * the header's real geometry at 0 / 25 / 50 / 75 % of the page at nine widths and fails if the pill ever:
 *   - touches either viewport edge (inset must stay > 0),
 *   - loses its radius (must stay pill-like relative to its own height),
 *   - spans the full viewport width,
 *   - stops being fixed, or changes height between scroll positions.
 *
 *   OUT=docs/qa/v11/header node scripts/qa/v11-header-scroll.mjs [widths] [path]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.MK_BASE ?? 'http://localhost:3100';
const OUT = process.env.OUT ?? '/tmp/claude-0/v11-header';
const WIDTHS = (process.argv[2] ?? '320,360,390,430,768,1024,1280,1440,1728').split(',').map(Number);
const PATHNAME = process.argv[3] ?? '/';
const H = { 320: 568, 360: 740, 390: 844, 430: 932, 768: 1024, 1024: 768, 1280: 800, 1440: 900, 1728: 1117 };
const STOPS = [0, 0.25, 0.5, 0.75];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const rows = [];
const failures = [];

for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: H[w] ?? 900 } });
  page.on('pageerror', (e) => failures.push(`${w}px page error: ${e.message}`));
  await page.goto(`${BASE}${PATHNAME}`, { waitUntil: 'networkidle' });
  // Let lazy crests decode first, so the page height is final before we compute the scroll stops.
  const full = await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
    return document.documentElement.scrollHeight;
  });
  await page.waitForTimeout(300);

  const perStop = [];
  for (const stop of STOPS) {
    const y = Math.round((full - (H[w] ?? 900)) * stop);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(350);           // longer than any transition we ship
    const m = await page.evaluate(() => {
      const el = document.querySelector('.kn-header');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        left: Math.round(r.left), right: Math.round(innerWidth - r.right),
        top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
        radius: parseFloat(cs.borderTopLeftRadius), position: cs.position,
        viewport: innerWidth, scrollY: Math.round(window.scrollY),
      };
    });
    if (!m) { failures.push(`${w}px @${stop * 100}%: no .kn-header in the DOM`); continue; }
    perStop.push({ stop, ...m });
    await page.screenshot({ path: `${OUT}/home-${w}-${Math.round(stop * 100)}.png` });

    const label = `${w}px @${stop * 100}%`;
    if (m.position !== 'fixed') failures.push(`${label}: position is ${m.position}, expected fixed`);
    if (m.left < 8) failures.push(`${label}: left inset ${m.left}px — the pill has reached the viewport edge`);
    if (m.right < 8) failures.push(`${label}: right inset ${m.right}px — the pill has reached the viewport edge`);
    if (m.width >= m.viewport) failures.push(`${label}: width ${m.width}px spans the full ${m.viewport}px viewport`);
    // A pill's radius is at least half its height; allow a little slack for a rounded-rect reading.
    if (m.radius < m.height / 2 - 1) failures.push(`${label}: radius ${m.radius}px is not a pill (height ${m.height}px)`);
    if (m.top < 4) failures.push(`${label}: top ${m.top}px — the pill is flush against the top edge`);
  }

  // The geometry must not change between scroll positions: that is what "does not change character" means.
  const first = perStop[0];
  for (const s of perStop.slice(1)) {
    for (const k of ['left', 'right', 'width', 'height', 'radius']) {
      if (Math.abs(s[k] - first[k]) > 1) failures.push(`${w}px: ${k} changed from ${first[k]} to ${s[k]} between 0% and ${s.stop * 100}%`);
    }
  }
  rows.push({ width: w, pageHeight: full, screens: +(full / (H[w] ?? 900)).toFixed(1), stops: perStop });
  await page.close();
}
await browser.close();

writeFileSync(`${OUT}/header-geometry.json`, `${JSON.stringify({ base: BASE, path: PATHNAME, rows, failures }, null, 2)}\n`);
for (const r of rows) {
  const s = r.stops[0] ?? {};
  console.log(`${String(r.width).padStart(4)}px  inset ${String(s.left).padStart(2)}/${String(s.right).padStart(2)}  top ${String(s.top).padStart(2)}  w ${String(s.width).padStart(4)}/${r.width}  r ${String(s.radius).padStart(3)}  h ${s.height}  ${r.screens} screens  ${r.stops.length} stops identical: ${r.stops.every((x) => Math.abs(x.left - s.left) <= 1 && Math.abs(x.radius - s.radius) <= 1) ? 'yes' : 'NO'}`);
}
if (failures.length) { console.error(`\nHEADER FAILURES (${failures.length}):`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
console.log(`\nHeader: floating pill preserved at ${WIDTHS.length} widths x ${STOPS.length} scroll positions.`);
