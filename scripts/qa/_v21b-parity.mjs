/** One-off: the homepage and the student plan screen print the same plan content, in ko and en. Not a gate. */
import { chromium } from '@playwright/test';

const MARKETING = process.env.BASE_MARKETING ?? 'http://localhost:3100';
const STUDENT = process.env.BASE_STUDENT ?? 'http://localhost:3101';
const SLUGS = ['basic', 'all_in_one', 'premium'];

const browser = await chromium.launch();
let bad = 0;
const fail = (m) => { bad++; console.log(`  ✖ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

for (const lang of ['ko', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: lang });
  await ctx.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* private */ } }, lang);
  const page = await ctx.newPage();

  // ---- the homepage
  await page.goto(`${MARKETING}/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const home = Object.fromEntries(await page.locator('.kn-plan').evaluateAll((els) => els.map((e) => [
    e.dataset.plan,
    {
      name: e.querySelector('.kn-plan__name')?.textContent,
      desc: e.querySelector('.kn-plan__position')?.textContent,
      lines: [...e.querySelectorAll('.kn-plan__list li span')].map((s) => s.textContent),
      price: e.querySelector('.kn-plan__price strong')?.textContent,
    },
  ])));

  // ---- the student plan screen, on a fresh account
  await page.goto(`${STUDENT}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (e) => fetch('/api/v1/auth/register', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: e, password: 'Hangyul!2026x', full_name: 'Parity Check', locale: 'en',
                           nationality: 'UZ', accept_terms: true, accept_privacy: true }),
  }).then((r) => r.status), `v21b.par.${Math.random().toString(16).slice(2, 10)}@example.com`);
  await page.goto(`${STUDENT}/services`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sv15-plan');
  await page.waitForTimeout(700);
  const student = await page.locator('.sv15-plan').evaluateAll((els) => els.map((e) => ({
    desc: e.querySelector('.sv15-plan__desc')?.textContent,
    lines: [...e.querySelectorAll('.st-ticks li')].map((li) => li.textContent),
    price: e.querySelector('.st-price strong')?.textContent,
  })));

  SLUGS.forEach((slug, i) => {
    const a = home[slug];
    const b = student[i];
    if (!a || !b) { fail(`${lang}/${slug}: missing on one of the two surfaces`); return; }
    if (norm(a.desc) !== norm(b.desc)) fail(`${lang}/${slug}: description differs\n      home:    ${norm(a.desc)}\n      student: ${norm(b.desc)}`);
    const al = a.lines.map(norm);
    const bl = b.lines.map(norm);
    if (JSON.stringify(al) !== JSON.stringify(bl)) fail(`${lang}/${slug}: lines differ\n      home:    ${JSON.stringify(al)}\n      student: ${JSON.stringify(bl)}`);
    if (al.length !== 5) fail(`${lang}/${slug}: ${al.length} lines, expected 5`);
    const digits = (s) => (s ?? '').replace(/\D/g, '');
    if (digits(a.price) !== digits(b.price)) fail(`${lang}/${slug}: price ${a.price} vs ${b.price}`);
    if (!bad) ok(`${lang}/${slug}: identical description, five identical lines, ${norm(a.price)}`);
  });
  await ctx.close();
}

await browser.close();
console.log(bad ? `\nFAILED (${bad})` : '\nmarketing and student print the same plan content');
process.exit(bad ? 1 : 0);
