/**
 * V20 — the button QA sheet (brief §40), and the evidence behind §39.
 *
 * It renders the real buttons in the real page, not a mock: it opens each app, replaces the document
 * body with the variant matrix, and lets **that app's own stylesheet cascade** — including the licensed
 * Eduan and Koreanasha layers on the marketing site, which is where the V20 defect lived. A sheet built
 * from a standalone HTML file with the tokens imported would have been green the whole time.
 *
 * Each cell's state is forced through CDP (`CSS.forcePseudoState`) rather than by moving a mouse, so
 * `:hover`, `:focus-visible` and `:active` can be captured side by side and photographed at once.
 *
 * The sheet itself is `width: max-content`, so the 390 px capture shows all five states rather than
 * the two that fit a phone: the *viewport* is 390 px — which is what the media queries read, and so
 * what sizes the buttons — while the element screenshot is as wide as the grid.
 *
 * Writes `docs/qa/v20/buttons/<app>-<width>.png` plus `matrix.json`, which records the computed
 * background and foreground of every cell — a picture proves it looked right, the JSON proves it was.
 *
 *   node scripts/qa/v20/button-matrix.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'docs/qa/v20/buttons';
mkdirSync(OUT, { recursive: true });

const APPS = [
  { app: 'marketing', url: 'http://localhost:3100/', prefix: 'kn-btn', variants: ['primary', 'outline', 'onphoto', 'quiet-onphoto', ''] },
  { app: 'student', url: 'http://localhost:3101/login', prefix: 'hg-btn', variants: ['primary', 'soft', 'ghost', 'danger', ''] },
  { app: 'agency', url: 'http://localhost:3102/login', prefix: 'hg-btn', variants: ['primary', 'dark', 'ghost', 'danger', ''] },
  { app: 'university', url: 'http://localhost:3103/login', prefix: 'hg-btn', variants: ['primary', 'soft', 'ghost', 'danger', ''] },
];
const STATES = ['rest', 'hover', 'focus-visible', 'active', 'disabled'];

/**
 * `class="ed kn"` is not decoration. Koreanasha declares `--kn-accent` on `.kn`, so a `.kn-btn--primary`
 * rendered outside that scope has `background: var(--kn-accent)` with nothing to resolve and comes out
 * transparent — white text on white paper. The first run of this sheet printed three blank cells for
 * exactly that reason, which is a neat demonstration of why the matrix is rendered inside the real app
 * rather than in a standalone file: the scope is part of what is being tested.
 *
 * The sheet's ground is light grey, not white, because two of the marketing variants are white pills
 * intended for a photograph and would otherwise be invisible in their own QA evidence.
 */
const build = (prefix, variants) => `
  <div id="hg-matrix" class="ed kn" style="padding:28px;background:#F1F2F4;font:14px/1.4 system-ui,sans-serif;width:max-content">
    <div style="display:grid;grid-template-columns:auto repeat(${STATES.length},max-content);gap:14px 18px;align-items:center">
      <div></div>
      ${STATES.map((s) => `<div style="font:600 12px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#555A62">${s}</div>`).join('')}
      ${variants.map((v) => `
        <div style="font:600 13px/1 system-ui;color:#181A1F">${v || 'base'}</div>
        ${STATES.map((s) => `<div><button type="button" data-cell="${v || 'base'}:${s}" ${s === 'disabled' ? 'disabled' : ''}
          class="${prefix} ${v ? `${prefix}--${v}` : ''}">Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`).join('')}
      `).join('')}
    </div>
  </div>`;

const browser = await chromium.launch();
const matrix = {};
let dark = 0;

for (const { app, url, prefix, variants } of APPS) {
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const ok = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).then((r) => !!r).catch(() => false);
    if (!ok) { console.log(`  ! ${app} unreachable at ${url}`); await ctx.close(); continue; }
    await page.waitForTimeout(500);
    // Keep <body>'s own classes: `.ed`, `.kn` and the surface attribute are part of the cascade we are
    // testing. Only the content is replaced.
    await page.evaluate((html) => { document.body.innerHTML = html; }, build(prefix, variants));
    await page.waitForTimeout(150);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    for (const v of variants) {
      for (const s of STATES) {
        if (s === 'rest' || s === 'disabled') continue;
        const sel = `[data-cell="${v || 'base'}:${s}"]`;
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
        if (!nodeId) continue;
        const forced = s === 'focus-visible' ? ['focus', 'focus-visible'] : [s];
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
      }
    }
    await page.waitForTimeout(300);

    const cells = await page.$$eval('[data-cell]', (els) => els.map((el) => {
      const cs = getComputedStyle(el);
      const svg = el.querySelector('svg');
      return { cell: el.dataset.cell, bg: cs.backgroundColor, fg: cs.color, bd: cs.borderColor, icon: svg ? getComputedStyle(svg).color : null };
    }));
    matrix[`${app}-${width}`] = cells;

    const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[,/]/).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    for (const c of cells) {
      if (!c.cell.startsWith('primary:') || c.cell.endsWith(':disabled')) continue;
      const bg = parse(c.bg); const fg = parse(c.fg); const ic = c.icon ? parse(c.icon) : null;
      if (!bg || !fg) continue;
      if (lum(fg.rgb) <= 0.6) { dark += 1; console.log(`  ✖ ${app}-${width} ${c.cell}: fg ${c.fg} on ${c.bg}`); }
      if (ic && lum(ic.rgb) <= 0.6) { dark += 1; console.log(`  ✖ ${app}-${width} ${c.cell}: icon ${c.icon} on ${c.bg}`); }
    }

    await page.locator('#hg-matrix').screenshot({ path: `${OUT}/${app}-${width}.png` });
    console.log(`  ${OUT}/${app}-${width}.png`);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/matrix.json`, `${JSON.stringify(matrix, null, 1)}\n`);
console.log(`\n  primary-solid cells with a dark label or icon: ${dark}`);
process.exit(dark ? 1 : 0);
