/**
 * V14 final composition capture (brief Part 11 of the continuation).
 *
 * The homepage at the six widths the owner named, plus the named bands sliced out of each, because a
 * 6,000 px full-page PNG is not something a person can judge. The hero → first-section seam gets its own
 * frame: it is the page's one remaining hard boundary and the thing the warm bridge exists to soften.
 *
 *   OUT=docs/qa/v14/compose node scripts/qa/v14-compose-shots.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = process.env.OUT ?? 'docs/qa/v14/compose';
const WIDTHS = (process.env.WIDTHS ?? '390,430,768,1024,1440,1728').split(',').map(Number);
const BANDS = [['hero', '.kn-hero'], ['marquee', '.kn-band--canvas'], ['services', '#services'],
  ['value', '#why'], ['faq', '#faq'], ['footer', '.kn-footer']];

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
let n = 0;
for (const w of WIDTHS) {
  const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 1000 } });
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  // Reveal-on-scroll content has to have been on screen before it can be photographed. `behavior: 'instant'`
  // because Bootstrap sets `html { scroll-behavior: smooth }` here and a loop of plain scrollTo calls
  // restarts the animation each step, leaving the page near the top however many steps you ask for.
  await p.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await p.waitForTimeout(900);

  await p.screenshot({ path: `${OUT}/home-${w}.png` });                      // first viewport
  await p.screenshot({ path: `${OUT}/home-${w}-full.png`, fullPage: true }); // whole page
  n += 2;

  // The seam, framed across the boundary rather than at it.
  const heroH = await p.evaluate(() => Math.round(document.querySelector('.kn-hero').getBoundingClientRect().height));
  const h = w < 500 ? 420 : 620;
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, heroH - Math.round(h * 0.42)));
  await p.waitForTimeout(350);
  await p.screenshot({ path: `${OUT}/seam-${w}.png`, clip: { x: 0, y: 0, width: w, height: h } });
  n += 1;

  // Playwright scrolls an element into view itself before an element screenshot, and it puts the element's
  // top flush with the viewport top — i.e. under the floating header, which then covers the band's own
  // heading in the shot. Scrolling first does not help, because that internal scroll undoes it. The header
  // is not part of any band, and it has its own shots (`home-*`, `seam-*`, both contexts), so it is hidden
  // for the band captures rather than left to sit on top of the thing being judged.
  // The hero is the exception: it sits at the top of the page, so nothing is covered, and the header floating
  // over the photograph is part of what the hero has to look right with.
  const bar = p.locator('.kn-header');
  const hideBar = async (hide) => { if (await bar.count()) await bar.evaluate((n2, h) => { n2.style.visibility = h ? 'hidden' : ''; }, hide); };

  for (const [id, sel] of BANDS) {
    const el = p.locator(sel).first();
    if (await el.count() === 0) continue;
    await hideBar(id !== 'hero');
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(260);
    await el.screenshot({ path: `${OUT}/${id}-${w}.png` }).catch((e) => console.log(`  ~ ${id}@${w}: ${e.message.split('\n')[0]}`));
    n += 1;
  }
  await hideBar(false);
  await p.close();
  console.log(`${w}px done`);
}
await b.close();
console.log(`${n} shots → ${OUT}`);
