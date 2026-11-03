/** V19 — the hero entrance as a strip of frames, because it plays on mount and cannot be traced in time. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const OUT = 'docs/qa/v19/screenshots/marketing/motion';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const p = await ctx.newPage();
const t0 = Date.now();
await p.goto('http://localhost:3100/?lang=ko', { waitUntil: 'commit' });
for (let i = 0; i < 9; i++) {
  await p.screenshot({ path: `${OUT}/hero-f${i}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  const s = await p.evaluate(() => {
    const c = document.querySelector('.kn-hero__content');
    if (!c) return 'no hero yet';
    return [...c.children].map((el) => Number(getComputedStyle(el).opacity).toFixed(2)).join(' ');
  }).catch(() => 'n/a');
  console.log(`frame ${i}  t≈${Date.now() - t0}ms  child opacities: ${s}`);
}
await b.close();
