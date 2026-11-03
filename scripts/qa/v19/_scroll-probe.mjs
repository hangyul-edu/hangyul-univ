/**
 * V19 — reproduce and characterise the route-scroll defect before fixing it.
 *
 * The owner's report: scroll Marketing Home to the bottom, click 유학 준비, land on `/start` near the bottom.
 * This probe records *why*, not just *that*: the navigation type, the `location.key` React Router sees on
 * each document, and what `sessionStorage` holds for the scroll-restoration map.
 */
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const dump = async (label) => {
  const s = await page.evaluate(() => ({
    url: location.pathname + location.search,
    scrollY: Math.round(window.scrollY),
    docH: document.documentElement.scrollHeight,
    restoration: history.scrollRestoration,
    positions: sessionStorage.getItem('react-router-scroll-positions'),
    keys: Object.keys(sessionStorage),
  }));
  console.log(`\n[${label}] ${s.url}`);
  console.log(`  scrollY=${s.scrollY}  docHeight=${s.docH}  history.scrollRestoration=${s.restoration}`);
  console.log(`  sessionStorage keys: ${JSON.stringify(s.keys)}`);
  console.log(`  scroll-positions: ${s.positions}`);
  return s;
};

await page.goto('http://localhost:3100/?lang=ko', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await dump('1. home loaded');

// Scroll to the bottom, the way a reader who has read the page arrives at the closing band.
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(900);
const atBottom = await dump('2. home scrolled to bottom');

// The closing band's primary action — the site's one conversion action.
const cta = page.locator('.kn-cta a[data-cta="primary"]').first();
console.log(`\n  CTA count=${await page.locator('a[data-cta="primary"]').count()}  closing-band CTA visible=${await cta.isVisible()}`);
console.log(`  CTA href=${await cta.getAttribute('href')}`);
console.log(`  CTA is a plain <a> (full document load) = ${await cta.evaluate((el) => !el.hasAttribute('data-discover'))}`);

await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), cta.click()]);
await page.waitForTimeout(1200);
const landed = await dump('3. after clicking 유학 준비');

console.log('\n==============================================');
console.log(`home bottom scrollY : ${atBottom.scrollY}`);
console.log(`/start arrival scrollY: ${landed.scrollY}`);
console.log(landed.scrollY > 100 ? '  *** DEFECT REPRODUCED ***' : '  (arrived at top)');
console.log('==============================================');

await browser.close();
