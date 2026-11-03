// V6 agency workstream captures: OUT=<dir> node scripts/qa/v6-agency-shots.mjs <email> <widths> <routes...>
// Signs in through the dev-only demo-login endpoint (client=agency). One Chromium, closed at the end.
import { chromium } from '@playwright/test';
const [,, email, widthsArg, ...routes] = process.argv;
const base = process.env.BASE || 'http://localhost:3102';
const out = process.env.OUT;
const full = process.env.FULL !== '0';
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const r = await page.request.post(`${base}/api/v1/auth/demo-login`, { data: { email, client: 'agency' } });
  if (!r.ok()) console.log('login failed', r.status());
  const tag = email.split('@')[0];
  for (const w of widthsArg.split(',').map(Number)) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(900);
      const f = `${out}/${tag}${route.replace(/[/:?=&]/g, '_')}-${w}.png`;
      await page.screenshot({ path: f, fullPage: full });
      console.log(f);
    }
  }
} finally { await browser.close(); }
