// V27 — drive the public quick fit like a student: node scripts/qa/v27/start-walk.mjs <base> <out-prefix> [width] [lang]
import { chromium } from 'playwright';

const [base = 'http://127.0.0.1:3100', out = 'docs/qa/v27/shots/start', width = '1280', lang = 'ko'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/start?lang=${lang}`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}-${width}-empty.png`, fullPage: true });
await page.locator('.hg-fit-q button.hg-select').first().click();
await page.locator('.hg-input--sm').fill('Viet');
await page.locator('.hg-menu-item').first().click();
await page.getByRole('radio', { name: lang === 'ko' ? '학사' : "Bachelor's", exact: true }).click();
await page.locator('#hg-fit-gpa').fill('8.2');
await page.locator('#hg-fit-scale').selectOption('10');
await page.getByRole('button', { name: /한국어 시험|Korean test/ }).click();
await page.locator('#hg-fit-test-KOREAN').selectOption('TOPIK');
await page.locator('#hg-fit-score-KOREAN').selectOption('3');
await page.screenshot({ path: `${out}-${width}-filled.png`, fullPage: true });
await page.getByRole('button', { name: /내 조건으로 대학 보기|Show my universities/ }).click();
await page.waitForSelector('.hg-fit-row', { timeout: 15000 });
await page.waitForTimeout(800);
const rows = await page.locator('.hg-fit-row').count();
const first = await page.locator('.hg-fit-row__link').first().getAttribute('href');
await page.screenshot({ path: `${out}-${width}-results.png`, fullPage: true });
console.log(JSON.stringify({ rows, first, url: page.url(), errors }, null, 1));
await browser.close();
