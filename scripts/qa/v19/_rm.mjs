import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const rm of [undefined, 'no-preference']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(rm ? { reducedMotion: rm } : {}) });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3100/?lang=ko', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    armedCount: document.querySelectorAll('.kn-reveal--armed').length,
    revealCount: document.querySelectorAll('.kn-reveal').length,
    inCount: document.querySelectorAll('.kn-reveal.is-in').length,
  }));
  console.log('reducedMotion option =', rm ?? '(default)', JSON.stringify(r));
  await ctx.close();
}
await b.close();
