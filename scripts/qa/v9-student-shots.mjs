// V9 student workstream screenshots (docs/qa/v9/student/). Usage:
//   node scripts/qa/v9-student-shots.mjs [filter] [widths=360,390,1440]
// Creates (once) a fresh "Nepal, no TOPIK" student through the register API, then signs in through the login form;
// demo personas sign in with the dev-only Demo access hand-off (?demo=). One Chromium at a time (RAM).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = process.env.STUDENT_URL ?? 'http://localhost:3101';
const MK = process.env.MARKETING_URL ?? 'http://localhost:3100';
const OUT = 'docs/qa/v9/student';
const [filter = '', widthArg = '360,390,1440'] = process.argv.slice(2);
const WIDTHS = widthArg.split(',').map(Number);
const H = { 360: 780, 390: 844, 1024: 768, 1440: 900 };
mkdirSync(OUT, { recursive: true });

const stateFile = `${OUT}/.nepal-account.json`;
async function nepalAccount() {
  if (existsSync(stateFile)) return JSON.parse(readFileSync(stateFile, 'utf8'));
  const email = `v9.nepal.shots.${Date.now().toString(36)}@example.com`;
  const password = 'Hangyul!2026x';
  const r = await fetch(`${BASE}/api/v1/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: 'Aarati Sharma', locale: 'en', nationality: 'NP', accept_terms: true, accept_privacy: true }) });
  if (!r.ok) throw new Error(`register ${r.status} ${await r.text()}`);
  const tok = (await r.json()).access_token;
  await fetch(`${BASE}/api/v1/me/profile`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
    body: JSON.stringify({ target_degree: 'BACHELOR', residence_country: 'NP' }) });
  const acc = { email, password };
  writeFileSync(stateFile, JSON.stringify(acc));
  return acc;
}

const SHOTS = [
  { id: 'start-nepal-none', who: null, path: '/start?nationality=NP&degree=BACHELOR&lang_kind=NONE' },
  { id: 'home-nepal-new', who: 'nepal', path: '/' },
  { id: 'explore-nepal-new', who: 'nepal', path: '/explore?tab=foryou' },
  { id: 'budget-myanmar', who: 'student.myanmar@demo.hangyul.kr', path: '/budget' },
  { id: 'family-myanmar', who: 'student.myanmar@demo.hangyul.kr', path: '/family' },
  { id: 'visa-bao', who: 'student.visa@demo.hangyul.kr', path: '/visa' },
  { id: 'visa-hnin', who: 'student.myanmar@demo.hangyul.kr', path: '/visa' },
  { id: 'visa-lan', who: 'student@demo.hangyul.kr', path: '/visa' },
  { id: 'documents-ha', who: 'student.offer@demo.hangyul.kr', path: '/documents' },
  { id: 'home-myanmar', who: 'student.myanmar@demo.hangyul.kr', path: '/', locale: 'my' },
  { id: 'explore-dilnoza', who: 'student.new@demo.hangyul.kr', path: '/explore?tab=foryou' },
  { id: 'sponsor', who: null, path: process.env.SPONSOR_PATH ?? '' },
  { id: 'marketing-quick', who: null, marketing: true, path: '/' },
].filter((s) => s.id.includes(filter) && s.path !== '');

const b = await chromium.launch();
for (const s of SHOTS) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', s.id, e.message));
  if (s.locale) await p.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* */ } }, s.locale);
  else await p.addInitScript(() => { try { localStorage.setItem('hg.locale', 'en'); } catch { /* */ } });
  if (s.who === 'nepal') {
    const a = await nepalAccount();
    await p.goto(`${BASE}/login`);
    await p.fill('#email', a.email);
    await p.fill('#password', a.password);
    await p.keyboard.press('Enter');
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  } else if (s.who) {
    await p.goto(`${BASE}/login?demo=${encodeURIComponent(s.who)}`);
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  }
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: H[w] ?? 900 });
    await p.goto(`${s.marketing ? MK : BASE}${s.path}`, { waitUntil: 'networkidle' });
    if (s.marketing) {
      // Fill the quick check: Nepal · Bachelor's · no test.
      const sel = p.locator('form.mk-qs select');
      const n = await sel.count();
      if (n >= 3) {
        await sel.nth(0).selectOption('NP'); await sel.nth(1).selectOption('BACHELOR'); await sel.nth(2).selectOption('NONE');
        await p.locator('form.mk-qs button[type=submit]').first().click();
      } else {
        // phone: progressive one-at-a-time form
        for (const v of ['NP', 'BACHELOR', 'NONE']) {
          await p.locator('form.mk-qs select').first().selectOption(v);
          const next = p.locator('form.mk-qs button[type=button].theme-btn, form.mk-qs button[type=submit]').last();
          await next.click();
        }
      }
      await p.waitForSelector('.mk-qs--result', { timeout: 15000 }).catch(() => {});
      await p.locator('.mk-qs--result').first().scrollIntoViewIfNeeded().catch(() => {});
    }
    await p.waitForTimeout(800);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    const vw = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    console.log(s.id, w, `screens=${(total / (H[w] ?? 900)).toFixed(1)}`, vw[0] > vw[1] ? `OVERFLOW ${vw[0]}>${vw[1]}` : 'ok');
    await p.screenshot({ path: `${OUT}/${s.id}-${w}.png` });
    await p.screenshot({ path: `${OUT}/${s.id}-${w}-full.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
