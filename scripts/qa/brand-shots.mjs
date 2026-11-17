// Brand QA screenshots: header geometry at phone/tablet/desktop widths + footer. BASE=<origin> OUT=<dir>.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4699';
const OUT = process.env.OUT ?? 'docs/qa/brand/shots';
const WIDTHS = (process.env.WIDTHS ?? '320,360,375,390,412,430,768,1280,1440,1920').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let fail = 0;
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 780 : 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const g = await page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right) }; };
    const header = document.querySelector('.kn-header');
    const img = header.querySelector('.hg-logo__img');
    const visible = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const cta = [...header.querySelectorAll('.kn-header__right .kn-btn')].find(visible);
    const burger = [...header.querySelectorAll('.kn-burger')].find(visible);
    return {
      header: r(header), logoLink: r(header.querySelector('.hg-logo')), img: r(img), src: img.currentSrc.split('/').pop(),
      natural: [img.naturalWidth, img.naturalHeight], cta: r(cta), burger: r(burger),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  const ratio = g.img.w / g.img.h, nat = g.natural[0] / g.natural[1];
  const problems = [];
  if (Math.abs(ratio - nat) > 0.06) problems.push(`distorted ${ratio.toFixed(2)} vs ${nat.toFixed(2)}`);
  if (!/horizontal-orange/.test(g.src) && !g.src.startsWith('data:')) problems.push(`unexpected src ${g.src}`);
  if (g.cta && g.cta.x - g.img.r < 8) problems.push('logo crowds CTA');
  if (g.burger && (g.burger.w < 44 || g.burger.h < 44)) problems.push('burger < 44px');
  if (g.cta && g.cta.h < 44 && w < 768) problems.push('CTA < 44px');
  if (g.logoLink.h < 44) problems.push('home link < 44px');
  if (w < 768 && g.header.h > 56) problems.push(`header ${g.header.h}px tall`);
  if (g.overflow) problems.push('horizontal overflow');
  if (problems.length) fail += 1;
  console.log(`${w}: header ${g.header.h}px · logo ${g.img.w}×${g.img.h} · cta ${g.cta ? `${g.cta.w}×${g.cta.h} gap ${g.cta.x - g.img.r}` : '—'} · burger ${g.burger ? `${g.burger.w}×${g.burger.h}` : '—'} → ${problems.length ? `FAIL ${problems.join('; ')}` : 'PASS'}`);
  await page.screenshot({ path: `${OUT}/marketing-header-${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(160, g.header.h + g.header.y + 40) } });
  if ([320, 390, 1440].includes(w)) await page.screenshot({ path: `${OUT}/marketing-top-${w}.png`, clip: { x: 0, y: 0, width: w, height: 420 } });
  if ([390, 1440].includes(w)) {
    const footer = page.locator('.kn-footer');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await footer.screenshot({ path: `${OUT}/marketing-footer-${w}.png` });
  }
  await ctx.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
