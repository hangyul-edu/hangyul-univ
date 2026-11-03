/**
 * Evidence for the university-logo crop fix (V14 continuation, Task 1).
 *
 * Three kinds of shot per width, because "nothing is clipped" is a claim about edges and a full-band
 * screenshot at 1440 px draws each crest about 100 px tall — too small to see a 5 px slice:
 *
 *   band-<w>.png   the whole university section, for the overall rhythm
 *   rows-<w>.png   the three marquee rows alone, tight, so the top and bottom edges are the frame
 *   tall-<w>.png   the eleven crests that were being cut — the ones `--c-scale` pushed to its 1.10 ceiling —
 *                  cloned into one strip, each in a box outlined at its row's exact bounds, so artwork
 *                  crossing the outline *is* the defect
 *
 * `cta-<w>.png` is here too rather than in the compose set: the button's border and the logos above it were
 * the same complaint — things on white that the eye loses.
 *
 *   node scripts/qa/v14-logo-shots.mjs
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = process.env.OUT ?? 'docs/qa/v14/logo-crop-fix';
const WIDTHS = (process.env.WIDTHS ?? '390,430,768,1024,1440,1728').split(',').map(Number);
/** The eleven the old geometry sliced — see scripts/qa/v14-polish.mjs. */
const WAS_CLIPPED = ['u-1-4', 'u-1-5', 'u-1-6', 'u-2-2', 'u-2-6', 'u-2-7', 'u-2-10', 'u-2-11', 'u-3-1', 'u-3-4', 'u-1-10'];

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
let n = 0;

for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  // Stop the belts, or three shots of the same row show three different crests and nothing can be compared.
  await p.addStyleTag({ content: '.kn-marquee__track { animation-play-state: paused !important; } .kn-header { visibility: hidden; }' });
  await p.waitForTimeout(400);

  for (const [name, sel] of [['band', '.kn-band--canvas'], ['rows', '.kn-crests'], ['cta', '.kn-crests__foot']]) {
    const el = p.locator(sel).first();
    if (await el.count() === 0) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(150);
    await el.screenshot({ path: `${OUT}/${name}-${w}.png` }).catch((e) => console.log(`  ~ ${name}@${w}: ${e.message.split('\n')[0]}`));
    n += 1;
  }

  // The enlargement. The eleven are spread over three rows at different x positions, so there is no single
  // rectangle on the page that contains them — they are cloned into one strip instead. Each clone keeps its
  // real slot height and sits in a box outlined at exactly the row's bounds, so a crest that overflowed its
  // row would show as artwork crossing the outline. That is the defect, drawn.
  const framed = await p.evaluate((was) => {
    const seen = new Map();
    for (const c of document.querySelectorAll('.kn-crest')) {
      const file = (c.querySelector('img')?.getAttribute('src') || '').split('/').pop()?.replace(/\.\w+$/, '');
      if (!file || !was.includes(file) || seen.has(file)) continue;
      seen.set(file, { el: c, rowH: c.closest('.kn-marquee').getBoundingClientRect().height });
    }
    const strip = document.createElement('div');
    strip.id = 'qa-tall-strip';
    strip.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;display:flex;flex-wrap:wrap;gap:18px;padding:18px;max-width:100vw;';
    for (const [, { el, rowH }] of seen) {
      const cell = document.createElement('div');
      cell.style.cssText = `height:${rowH}px;outline:1px solid #E5484D;outline-offset:0;display:inline-flex;align-items:center;flex:0 0 auto;`;
      cell.appendChild(el.cloneNode(true));
      strip.appendChild(cell);
    }
    document.body.appendChild(strip);
    return seen.size;
  }, WAS_CLIPPED);

  if (framed) {
    await p.locator('#qa-tall-strip').screenshot({ path: `${OUT}/tall-${w}.png` })
      .catch((e) => console.log(`  ~ tall@${w}: ${e.message.split('\n')[0]}`));
    n += 1;
  }
  await p.evaluate(() => document.getElementById('qa-tall-strip')?.remove());

  console.log(`${w}px done — ${framed} formerly-clipped crest(s) framed`);
  await ctx.close();
}
await b.close();
console.log(`${n} shots → ${OUT}`);
