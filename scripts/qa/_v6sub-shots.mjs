// V6 submission screenshots (docs/qa/v6/submission). Read-only: opens dialogs but never confirms them.
// Usage: node scripts/qa/_v6sub-shots.mjs
import { chromium } from '@playwright/test';

const OUT = 'docs/qa/v6/submission';
const API = 'http://localhost:8001/api/v1';
const browser = await chromium.launch();

async function login(page, base, email) {
  await page.goto(`${base}/login`);
  await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'en'); } catch { /* ignore */ } });
  await page.fill('#email', email); await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}
async function readyApp(email) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Hangyul!2026', client: 'student' }) });
  const tok = (await r.json()).access_token;
  const apps = await (await fetch(`${API}/applications?page_size=20`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  return apps.items.find((a) => a.status === 'READY')?.id;
}
async function shot(page, name, full = true) { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log(name); }

const only = process.argv[2];
for (const w of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 } });
  const page = await ctx.newPage();
  if (!only || only === 'student') {
    const fx = await readyApp('student.authorize@demo.hangyul.kr');
    await login(page, 'http://localhost:3101', 'student.authorize@demo.hangyul.kr');
    await page.goto(`http://localhost:3101/applications/${fx}`, { waitUntil: 'networkidle' });
    await shot(page, `student-authorize-ready-${w}`);
    await page.getByRole('button', { name: 'Authorize submission' }).first().click();
    await shot(page, `student-authorize-consent-${w}`, false);
    await page.keyboard.press('Escape');
    // Guided self-submission (no API): Nepal persona, Kyungpook via UWAY.
    await page.context().clearCookies();
    const np = await readyApp('student.nepal@demo.hangyul.kr');
    if (np) {
      await login(page, 'http://localhost:3101', 'student.nepal@demo.hangyul.kr');
      await page.goto(`http://localhost:3101/applications/${np}`, { waitUntil: 'networkidle' });
      await page.locator('.sx-enter summary').first().click().catch(() => {});
      await shot(page, `student-guided-${w}`);
    }
  }
  if (w === 1440 && (!only || only === 'agency')) {
    await page.context().clearCookies();
    await login(page, 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr');
    await page.goto('http://localhost:3102/submissions', { waitUntil: 'networkidle' });
    await shot(page, 'agency-queue-1440', false);
    await page.locator('table tbody tr').first().click();
    await page.waitForSelector('.sxa-detail');
    await shot(page, 'agency-detail-1440', false);
    await page.goto('http://localhost:3102/submissions?view=awaiting', { waitUntil: 'networkidle' });
    await shot(page, 'agency-queue-awaiting-1440', false);
  }
  await ctx.close();
}
await browser.close();
