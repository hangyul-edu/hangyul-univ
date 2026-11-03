// V6 writing review captures: agency queue + workspace, student editor at 1440×900 and 390×844.
// Usage: OUT=docs/qa/v6/writing/after node scripts/qa/v6-writing-shots.mjs [agencyEssayId] [studentEssayId]
// One Chromium; first viewport + full page per view.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.env.OUT ?? 'docs/qa/v6/writing/after';
mkdirSync(out, { recursive: true });
const [,, agencyEssay = '2ec9d833-cc46-419b-9e49-476d1813273e', studentEssay = agencyEssay] = process.argv;
const AGENCY = 'http://localhost:3102';
const STUDENT = 'http://localhost:3101';
const PREFIX = process.env.PREFIX ?? '';
const SIZES = [[1440, 900], [390, 844]];

async function login(page, base, email, password = 'Hangyul!2026') {
  await page.goto(`${base}/login`);
  await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'en'); } catch { /* ignore */ } });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

async function shoot(page, name) {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${PREFIX}${name}-${w}.png` });
    await page.screenshot({ path: `${out}/${PREFIX}${name}-${w}-full.png`, fullPage: true });
    console.log(`${out}/${PREFIX}${name}-${w}.png`);
  }
}

const browser = await chromium.launch();
try {
  const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await login(a, AGENCY, process.env.AGENCY_USER ?? 'counselor@lotus.demo.hangyul.kr');
  await a.goto(`${AGENCY}/essays?view=team`, { waitUntil: 'networkidle' }).catch(() => {});
  await shoot(a, 'agency-queue');
  await a.goto(`${AGENCY}/essays/${agencyEssay}`, { waitUntil: 'networkidle' }).catch(() => {});
  await shoot(a, 'agency-workspace');
  const s = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await login(s, STUDENT, process.env.STUDENT_USER ?? 'student@demo.hangyul.kr', process.env.STUDENT_PASSWORD ?? 'Hangyul!2026');
  await s.goto(`${STUDENT}/essays/${studentEssay}`, { waitUntil: 'networkidle' }).catch(() => {});
  await shoot(s, 'student-editor');
} finally {
  await browser.close();
}
