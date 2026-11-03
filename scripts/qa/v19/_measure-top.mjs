/**
 * V19 audit instrument — header clearance on every public marketing subpage, at nine widths.
 *
 * Measures the real gap between the floating header's actual footprint (its bounding box bottom, which
 * includes the pill's inset and so already accounts for `--kn-header-top`) and the top of the first
 * heading composition. This is the number the owner's screenshot is complaining about.
 */
import { chromium } from '@playwright/test';

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1728];
const PAGES = [
  ['/start?lang=ko', 'start-ko'],
  ['/start?lang=en', 'start-en'],
  ['/universities?lang=ko', 'universities'],
  ['/privacy?lang=ko', 'privacy'],
  ['/terms?lang=ko', 'terms'],
];

const browser = await chromium.launch();
const rows = [];
for (const [path, name] of PAGES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    try {
      await page.goto(`http://localhost:3100${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const header = document.querySelector('.kn-header');
        const hb = header?.getBoundingClientRect();
        // First heading in main, whatever its level — that is what the eye lands on.
        const h = document.querySelector('#main h1, #main h2');
        const hr = h?.getBoundingClientRect();
        const cs = h ? getComputedStyle(h) : null;
        return {
          headerBottom: hb ? hb.bottom : null,
          headerH: hb ? hb.height : null,
          headingTop: hr ? hr.top : null,
          headingText: h ? (h.textContent || '').slice(0, 40) : null,
          headingFont: cs ? cs.fontSize : null,
          // The box the heading sits in, so we can tell padding from margin.
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 1
            ? `${document.documentElement.scrollWidth}>${window.innerWidth}` : '',
          scrollY: window.scrollY,
        };
      });
      rows.push({ name, w, gap: m.headingTop != null && m.headerBottom != null
        ? Math.round(m.headingTop - m.headerBottom) : null, ...m, errs: errs.slice(0, 2) });
    } catch (e) {
      rows.push({ name, w, gap: null, error: String(e).slice(0, 80) });
    }
    await ctx.close();
  }
}
await browser.close();

console.log('page'.padEnd(16), 'w'.padStart(5), 'hdrBot'.padStart(7), 'h1Top'.padStart(7), 'GAP'.padStart(6), 'font'.padStart(8), 'ovf');
for (const r of rows) {
  console.log(
    r.name.padEnd(16),
    String(r.w).padStart(5),
    String(r.headerBottom ?? '-').padStart(7),
    String(Math.round(r.headingTop ?? 0) || '-').padStart(7),
    String(r.gap ?? r.error ?? '-').padStart(6),
    String(r.headingFont ?? '-').padStart(8),
    r.overflowX || '',
    r.errs?.length ? `ERR:${r.errs[0].slice(0, 60)}` : '',
  );
}
