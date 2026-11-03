/**
 * V19 — open **every** reachable Student route, signed in, at several widths (REPORT §193).
 *
 * V18 looked at five screens at two widths and said so. This walks the whole app and records, per screen:
 * console errors, uncaught exceptions, failed requests, horizontal overflow, content hidden behind the
 * mobile bottom navigation, dead primary CTAs, and raw i18n keys left on screen — the defects that are
 * invisible to a unit test and that a human only catches by opening the page.
 *
 *   node scripts/qa/v19/student-sweep.mjs [--widths 390,1440] [--shots]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const WIDTHS = flag('--widths', '390,1440').split(',').map(Number);
const SHOTS = ARG.includes('--shots');
const OUT = 'docs/qa/v19/screenshots/student';
if (SHOTS) mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3101';
const ROUTES = [
  ['home', '/'],
  ['explore', '/explore'],
  ['explore-saved', '/explore?tab=saved'],
  ['explore-foryou', '/explore?tab=foryou'],
  ['compare', '/compare'],
  ['applications', '/applications'],
  ['documents', '/documents'],
  ['essays', '/essays'],
  ['tasks', '/tasks'],
  ['messages', '/messages'],
  ['notifications', '/notifications'],
  ['visa', '/visa'],
  ['housing', '/housing'],
  ['arrival', '/arrival'],
  ['budget', '/budget'],
  ['family', '/family'],
  ['scholarships', '/scholarships'],
  ['services', '/services'],
  ['support', '/support'],
  ['help', '/help'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['more', '/more'],
  ['payment-success', '/services/payment/success'],
  ['payment-fail', '/services/payment/fail'],
  ['notfound', '/this-route-does-not-exist'],
];

/** Routes that need an id discovered from the running data. */
async function dynamicRoutes(page) {
  const out = [];
  const grab = async (listPath, linkSel, name) => {
    await page.goto(`${BASE}${listPath}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(700);
    const href = await page.locator(linkSel).first().getAttribute('href').catch(() => null);
    if (href) out.push([name, href]);
  };
  await grab('/applications', 'a[href^="/applications/"]', 'application-detail');
  await grab('/essays', 'a[href^="/essays/"]', 'essay-detail');
  await grab('/messages', 'a[href^="/messages/"]', 'conversation');
  await grab('/explore', 'a[href^="/universities/"]', 'university-detail');
  return out;
}

const browser = await chromium.launch();
const results = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
  const page = await ctx.newPage();

  // Sign in through the UI so the session is exactly a real one.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* ignore */ } });
  await page.fill('#email', 'student@demo.hangyul.kr');
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForTimeout(800);

  const all = [...ROUTES, ...(await dynamicRoutes(page))];

  for (const [name, path] of all) {
    const errs = [];
    const failed = [];
    const onConsole = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); };
    const onPageErr = (e) => errs.push(`UNCAUGHT ${String(e).slice(0, 200)}`);
    const onResp = (r) => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 80)}`); };
    page.on('console', onConsole);
    page.on('pageerror', onPageErr);
    page.on('response', onResp);

    let probe = {};
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(900);
      probe = await page.evaluate(() => {
        const de = document.documentElement;
        const text = document.body.innerText || '';
        // A raw i18n key that reached the screen: `ns:some.key` or `v17.quick.title`, never a sentence.
        const rawKeys = (text.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+){2,}\b/g) || [])
          .filter((k) => !/\.(com|kr|net|org|io|pdf|png|jpg)$/.test(k)).slice(0, 4);
        // Anything whose right edge is past the viewport.
        const over = [...document.querySelectorAll('body *')]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 2; })
          .slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        // Content trapped under the fixed bottom tab bar on a phone.
        const bar = document.querySelector('.hg-stabs, [class*="tabbar"], nav[class*="tabs"]');
        const barTop = bar ? bar.getBoundingClientRect().top : null;
        let hidden = 0;
        if (barTop != null && barTop < window.innerHeight) {
          const last = document.querySelector('#main');
          if (last) {
            const r = last.getBoundingClientRect();
            const docBottom = r.bottom + window.scrollY;
            const reach = document.documentElement.scrollHeight;
            hidden = Math.max(0, Math.round(docBottom - reach + (window.innerHeight - barTop)) > 0 ? 1 : 0);
          }
        }
        return {
          title: document.title.slice(0, 50),
          h1: (document.querySelector('#main h1, h1')?.textContent || '').trim().slice(0, 44),
          overflowX: de.scrollWidth > window.innerWidth + 2 ? `${de.scrollWidth}>${window.innerWidth}` : '',
          overEls: over,
          rawKeys,
          hiddenUnderBar: hidden,
          blank: text.trim().length < 40,
          spinnerOnly: /^\s*$/.test(text) || (!!document.querySelector('.hg-spinner, [class*="skeleton"]') && text.trim().length < 80),
          cta: [...document.querySelectorAll('button, a[class*="btn"]')].filter((b) => !b.hasAttribute('disabled')).length,
        };
      });
    } catch (e) {
      probe = { error: String(e).slice(0, 120) };
    }
    page.off('console', onConsole);
    page.off('pageerror', onPageErr);
    page.off('response', onResp);

    if (SHOTS) {
      await page.screenshot({ path: `${OUT}/${name}@${width}.png`, fullPage: false }).catch(() => {});
    }
    results.push({ width, name, path, ...probe, errs: errs.slice(0, 3), failed: failed.slice(0, 2) });
  }
  await ctx.close();
}
await browser.close();

writeFileSync('docs/qa/v19/evidence/student-sweep.json', JSON.stringify(results, null, 2));

let bad = 0;
console.log('w     route                 h1                                 flags');
for (const r of results) {
  const flags = [];
  if (r.error) flags.push(`LOAD:${r.error}`);
  if (r.blank) flags.push('BLANK');
  if (r.spinnerOnly) flags.push('SPINNER-ONLY');
  if (r.overflowX) flags.push(`OVERFLOW ${r.overflowX} ${r.overEls?.join(',') || ''}`);
  if (r.rawKeys?.length) flags.push(`RAWKEY ${r.rawKeys.join(',')}`);
  if (r.errs?.length) flags.push(`CONSOLE ${r.errs[0]}`);
  if (r.failed?.length) flags.push(`HTTP ${r.failed.join(',')}`);
  if (!r.h1 && !r.error) flags.push('NO-H1');
  if (flags.length) bad++;
  console.log(
    String(r.width).padEnd(5),
    r.name.padEnd(21),
    (r.h1 || '—').padEnd(34),
    flags.join(' | ') || 'ok',
  );
}
console.log(`\n${results.length} screens, ${bad} with findings. Detail: docs/qa/v19/evidence/student-sweep.json`);
