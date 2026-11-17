// Brand QA screenshots for the signed-in products: auth screen at phone/tablet/desktop, then the shell when a
// local API with seeded accounts is available. Checks every visible lockup for distortion and the right ink.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/brand/shots';
const PW = process.env.HG_DEMO_PASSWORD ?? 'Hangyul!2026';
const APPS = [
  { key: 'student', base: process.env.STUDENT ?? 'http://localhost:4701', login: '/login', email: 'student@demo.hangyul.kr' },
  { key: 'admin', base: process.env.ADMIN ?? 'http://localhost:4702', login: '/login', email: 'manager@lotus.demo.hangyul.kr' },
  { key: 'university', base: process.env.UNIVERSITY ?? 'http://localhost:4703', login: '/login', email: 'admin@pusan.univ.demo.hangyul.kr' },
];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let fail = 0;

async function audit(page, label) {
  const logos = await page.evaluate(() => [...document.querySelectorAll('.hg-logo img, .hg-logo-vertical')].filter((i) => i.getBoundingClientRect().width > 0).map((img) => {
    const b = img.getBoundingClientRect();
    let el = img, bg = 'rgba(0, 0, 0, 0)';
    while (el && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(el).backgroundColor; el = el.parentElement; }
    // Nothing painted all the way up means the canvas default: white.
    const [r, g, bl] = /rgba\(0, 0, 0, 0\)|transparent/.test(bg) ? [255, 255, 255] : bg.match(/[\d.]+/g).map(Number);
    return { w: b.width, h: b.height, nw: img.naturalWidth, nh: img.naturalHeight, src: img.currentSrc.slice(0, 22) === 'data:image/png;base64,' ? 'inline' : img.currentSrc.split('/').pop(), lum: (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255, cls: img.className };
  }));
  for (const l of logos) {
    const bad = [];
    if (!l.nw) bad.push('image failed to load');
    else if (Math.abs(l.w / l.h - l.nw / l.nh) > 0.06) bad.push('distorted');
    if (/ivory/.test(l.src) && l.lum > 0.6) bad.push('ivory ink on a light surface');
    if (/black/.test(l.src) && l.lum < 0.35) bad.push('black ink on a dark surface');
    if (l.cls.includes('hg-logo__img') && (l.h < 20 || l.h > 34)) bad.push(`lockup ${l.h}px tall`);
    if (bad.length) fail += 1;
    console.log(`  ${label}: ${l.cls} ${Math.round(l.w)}×${Math.round(l.h)} ${l.src} bg-lum ${l.lum.toFixed(2)} → ${bad.length ? `FAIL ${bad.join('; ')}` : 'PASS'}`);
  }
  if (!logos.length) console.log(`  ${label}: no logo on screen`);
}

for (const app of APPS) {
  console.log(app.key);
  for (const w of [390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 780 : 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${app.base}${app.login}`, { waitUntil: 'networkidle' });
    await audit(page, `login ${w}`);
    await page.screenshot({ path: `${OUT}/${app.key}-login-${w}.png` });
    if (w !== 768) {
      try {
        await page.locator('input[type="email"], input[name="email"]').first().fill(app.email, { timeout: 4000 });
        await page.locator('input[type="password"]').first().fill(PW);
        await page.locator('form button[type="submit"]').first().click();
        await page.locator('.app-sidebar, .hg-sshell, .hg-shell').first().waitFor({ state: 'attached', timeout: 10000 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        await audit(page, `shell ${w}`);
        await page.screenshot({ path: `${OUT}/${app.key}-shell-${w}.png` });
      } catch (e) {
        console.log(`  shell ${w}: not captured (${String(e.message).split('\n')[0].slice(0, 90)})`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
