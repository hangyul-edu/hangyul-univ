/**
 * V16 visual evidence (brief Parts 30–33).
 *
 * The gate (`npm run qa:v16`) decides whether the product is right; this exists so a person can look at the
 * same states the gate measured. Only what V16 touched is captured — padding the evidence with untouched
 * screens supports nothing.
 *
 *   node scripts/qa/v16-capture.mjs                 # → docs/qa/v16/
 *   OUT=/tmp/shots WIDTHS=390,1440 node scripts/qa/v16-capture.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v16';
const WIDTHS = (process.env.WIDTHS ?? '390,768,1024,1440,1728').split(',').map(Number);
const M = process.env.MARKETING ?? 'http://localhost:3100';
const S = process.env.STUDENT ?? 'http://localhost:3101';
const A = process.env.AGENCY ?? 'http://localhost:3102';
const U = process.env.UNIVERSITY ?? 'http://localhost:3103';
const PW = 'Hangyul!2026';

for (const d of ['pricing', 'student', 'header', 'login', 'payment']) mkdirSync(`${OUT}/${d}`, { recursive: true });
const browser = await chromium.launch();
const shot = (page, path, opts) => page.screenshot({ path: `${OUT}/${path}.png`, ...opts });

async function signIn(page, base, email) {
  await page.goto(`${base}/login?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
}

/* ---- pricing: rest, hover, keyboard focus, comparison closed and open (brief Part 30) */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${M}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pricing');
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.waitForTimeout(350);
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const sec = page.locator('#pricing');
    await shot(sec, `pricing/rest-${w}`);
    await page.locator('.kn-plan[data-recommended] .kn-plan__body').hover();
    await page.waitForTimeout(450);
    await shot(sec, `pricing/hover-${w}`);
    /*
     * `:focus-visible` is a *keyboard* state. `element.focus()` moves focus without it in Chromium, so a
     * capture taken that way shows no ring and silently claims there is none. Focusing the next control and
     * walking back with Shift+Tab is a keyboard interaction, so the ring is the one a reader would see.
     */
    await page.locator('.kn-compare__toggle').focus();
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(300);
    await shot(sec, `pricing/focus-${w}`);
    await page.mouse.move(2, 2);
    await page.locator('.kn-compare__toggle').click();
    await page.waitForTimeout(800);
    await shot(sec, `pricing/compare-open-${w}`);
    await page.locator('.kn-compare__toggle').click();
    await page.waitForTimeout(500);
  }
  await page.close();
}

/* ---- the student header: every count and every open menu (brief Part 32) */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(page, S, 'student@demo.hangyul.kr');
  const stub = async (unread) => {
    await page.unroute('**/api/v1/notifications**').catch(() => undefined);
    await page.route('**/api/v1/notifications**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const items = Array.from({ length: Math.min(unread, 3) }, (_, i) => ({
        id: `s${i}`, title_key: 'x', text: `알림 ${i + 1}`, params: {}, read: false, at: new Date().toISOString(), link: '/',
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread, items }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hg-bell');
    await page.waitForTimeout(800);
  };
  for (const w of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 950 });
    for (const n of [0, 1, 9, 120]) {
      await stub(n);
      await shot(page, `header/unread-${n}-${w}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
    }
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await stub(3);
  await page.click('.hg-bell .hg-btn');
  await page.waitForTimeout(500);
  await shot(page, 'header/notifications-open', { clip: { x: 700, y: 0, width: 740, height: 560 } });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('.hg-account');
  await page.waitForTimeout(500);
  await shot(page, 'header/profile-open', { clip: { x: 820, y: 0, width: 620, height: 420 } });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('.hg-snav__tools .hg-btn').first().click();
  await page.waitForTimeout(500);
  await shot(page, 'header/locale-open', { clip: { x: 740, y: 0, width: 700, height: 560 } });
  await page.close();
}

/* ---- every student route V16 touched, at every width (brief Part 31) */
{
  const ROUTES = ['/', '/explore', '/applications', '/documents', '/essays', '/visa', '/housing', '/arrival',
    '/services', '/messages', '/notifications', '/profile', '/settings', '/more'];
  for (const [who, email] of [['owner', 'student@demo.hangyul.kr'], ['buyer', 'student.new@demo.hangyul.kr']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    await signIn(page, S, email);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 950 });
      for (const r of who === 'buyer' ? ['/', '/services'] : ROUTES) {
        await page.goto(`${S}${r}?lang=ko`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await shot(page, `student/${who}-${r === '/' ? 'home' : r.slice(1).replace(/\//g, '-')}-${w}`);
      }
    }
    await page.close();
  }
}

/* ---- the payment journey (brief Part 33's sibling: the states a reviewer needs to see) */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await signIn(page, S, 'student.new@demo.hangyul.kr');
  await page.goto(`${S}/services?plan=all_in_one&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sv16-order');
  await shot(page, 'payment/1-order');
  await page.goto(`${S}/services?plan=all_in_one&payment=cancelled&lang=ko`, { waitUntil: 'domcontentloaded' });
  // Wait for the data, not for a timer: a 1.2 s pause caught the skeleton, and evidence that shows a
  // loading state is evidence of nothing.
  await page.waitForSelector('.sv16-order', { timeout: 30_000 });
  await page.waitForTimeout(500);
  await shot(page, 'payment/3-cancelled');
  await page.goto(`${S}/services/payment/fail?code=REJECT_CARD_COMPANY&message=declined&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'payment/4-failed');
  // The provider's own window, on a real order. It is the one state no mock can stand in for.
  await page.goto(`${S}/services?plan=all_in_one&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sv16-order');
  await page.click('.sv16-order__pay');
  await page.waitForTimeout(11_000);
  await shot(page, 'payment/2-toss-window');
  await page.close();
}

/* ---- both console logins, with the test entry and its disclosure (brief Part 33) */
for (const [name, base] of [['agency', A], ['university', U]]) {
  for (const w of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width: w, height: w < 500 ? 900 : 1000 } });
    await page.goto(`${base}/login?lang=ko`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await shot(page, `login/${name}-${w}`);
    if (w === 1440) {
      const more = await page.$('.hg-testlogin__more');
      if (more) { await more.click(); await page.waitForTimeout(400); await shot(page, `login/${name}-roles`); }
      await page.fill('#email', 'nobody@example.com');
      await page.fill('#password', 'wrong-password');
      await page.click('form button[type=submit]');
      await page.waitForTimeout(1600);
      await shot(page, `login/${name}-invalid`);
    }
    await page.close();
  }
}

await browser.close();
console.log(`V16 capture: done → ${OUT}`);
