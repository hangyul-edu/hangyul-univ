// Visa screenshots + Latin-script leak scan. Usage: OUT=<dir> node docs/qa/v5/visaroute/shot.mjs <email> <locale> <widths> <routes...>
import { chromium } from '@playwright/test';

const [, , email, locale, widthsArg, ...routes] = process.argv;
const out = process.env.OUT;
const base = 'http://localhost:3101';
const ALLOWED = /^(TOPIK|IELTS|TOEFL|KRW|USD|D-\d(-\d)?|Hangyul|Univ|visa\.go\.kr|g4k\.go\.kr)$/;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* ignore */ } }, locale);
const page = await ctx.newPage();
await page.goto(`${base}/login`);
await page.fill('#email', email);
await page.fill('#password', 'Hangyul!2026');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => console.log('login fail'));
for (const w of widthsArg.split(',').map(Number)) {
  await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
  for (const r of routes) {
    await page.goto(`${base}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    const f = `${out}/${locale}${r.replace(/[/:?=&#]/g, '_')}-${w}.png`;
    await page.screenshot({ path: f, fullPage: true });
    console.log(f);
    if (locale !== 'en' && w < 500) {
      const text = await page.locator('main').innerText().catch(() => '');
      const names = await page.evaluate(() => [...document.querySelectorAll('main [data-proper-name], main .sv-head p')].map((e) => e.textContent ?? ''));
      const proper = new Set(names.join(' ').split(/[\s·,()]+/).filter(Boolean));
      const leaks = [...new Set((text.match(/[A-Za-z][A-Za-z'.\-]{1,}/g) ?? []).filter((x) => !ALLOWED.test(x) && !proper.has(x)))];
      console.log(`LEAKS ${r}: ${leaks.join(' ') || '(none)'}`);
    }
  }
}
await browser.close();
