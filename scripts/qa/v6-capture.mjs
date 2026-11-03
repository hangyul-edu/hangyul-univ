// V6 design QA: first-viewport + full-page screenshots and objective UX measurements.
// Usage: OUT=docs/qa/v6/before node scripts/qa/v4-capture.mjs [filter]
// Writes <OUT>/<name>-<w>.png (viewport), <OUT>/full/<name>-<w>.png, and <OUT>/metrics.json.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v6/before';
const filter = process.argv[2];
fs.mkdirSync(`${OUT}/full`, { recursive: true });

const M = 'http://localhost:3100', S = 'http://localhost:3101', A = 'http://localhost:3102', U = 'http://localhost:3103';
const ids = JSON.parse(fs.readFileSync(new URL('./v6-ids.json', import.meta.url)));

// [name, base, account|null, path, widths]
const PHONE = [390, 1440];
const ALL = [390, 430, 768, 1024, 1280, 1440, 1728];
const KEY = [390, 1440];
const screens = [
  ['mkt-home', M, null, '/', ALL],
  ['mkt-universities', M, null, '/universities', ALL],
  ['mkt-uni-detail', M, null, '/universities/pusan-national-university', PHONE],
  ['mkt-how', M, null, '/how-it-works', PHONE],
  ['stu-start', S, null, '/start', PHONE],
  ['stu-home-lan', S, 'student@demo.hangyul.kr', '/', ALL],
  ['stu-home-new', S, 'student.new@demo.hangyul.kr', '/', PHONE],
  ['stu-home-offer', S, 'student.offer@demo.hangyul.kr', '/', PHONE],
  ['stu-home-visa', S, 'student.visa@demo.hangyul.kr', '/', PHONE],
  ['stu-explore', S, 'student@demo.hangyul.kr', '/explore', ALL],
  ['stu-explore-all', S, 'student@demo.hangyul.kr', '/explore?tab=all', PHONE],
  ['stu-university', S, 'student@demo.hangyul.kr', `/universities/${ids.uniSlug}`, ALL],
  ['stu-compare', S, 'student@demo.hangyul.kr', '/compare', PHONE],
  ['stu-budget', S, 'student@demo.hangyul.kr', '/budget', PHONE],
  ['stu-application', S, 'student@demo.hangyul.kr', `/applications/${ids.lanApp}`, ALL],
  ['stu-applications', S, 'student@demo.hangyul.kr', '/applications', PHONE],
  ['stu-applications-offer', S, 'student.offer@demo.hangyul.kr', '/applications', PHONE],
  ['stu-offer', S, 'student.offer@demo.hangyul.kr', `/applications/${ids.offerApp}`, PHONE],
  ['stu-documents', S, 'student@demo.hangyul.kr', '/documents', ALL],
  ['stu-essays', S, 'student@demo.hangyul.kr', '/essays', PHONE],
  ['stu-visa', S, 'student.visa@demo.hangyul.kr', '/visa', ALL],
  ['stu-visa-lan', S, 'student@demo.hangyul.kr', '/visa', PHONE],
  ['stu-housing', S, 'student.visa@demo.hangyul.kr', '/housing', PHONE],
  ['stu-arrival', S, 'student.visa@demo.hangyul.kr', '/arrival', PHONE],
  ['stu-messages', S, 'student@demo.hangyul.kr', '/messages', PHONE],
  ['ag-today', A, 'counselor@lotus.demo.hangyul.kr', '/', ALL],
  ['ag-today-mgr', A, 'manager@lotus.demo.hangyul.kr', '/', PHONE],
  ['ag-students', A, 'counselor@lotus.demo.hangyul.kr', '/students', ALL],
  ['ag-workspace', A, 'counselor@lotus.demo.hangyul.kr', `/students/${ids.agStudent}`, ALL],
  ['ag-documents', A, 'reviewer@lotus.demo.hangyul.kr', '/documents', ALL],
  ['ag-essays', A, 'counselor@lotus.demo.hangyul.kr', '/essays', PHONE],
  ['ag-tasks', A, 'counselor@lotus.demo.hangyul.kr', '/tasks', ALL],
  ['ag-messages', A, 'counselor@lotus.demo.hangyul.kr', '/messages', ALL],
  ['ag-services', A, 'counselor@lotus.demo.hangyul.kr', '/services', PHONE],
  ['ag-essay-review', A, 'writing@demo.hangyul.kr', '/essays', PHONE],
  ['hq-sources', A, 'ops@demo.hangyul.kr', '/hq/sources', PHONE],
  ['hq-agencies', A, 'ops@demo.hangyul.kr', '/hq/agencies', PHONE],
  ['ag-performance', A, 'manager@lotus.demo.hangyul.kr', '/performance', PHONE],
  ['un-overview', U, 'admissions@pusan.univ.demo.hangyul.kr', '/', ALL],
  ['un-applicants', U, 'admissions@pusan.univ.demo.hangyul.kr', '/applicants', ALL],
  ['un-applicant', U, 'admissions@pusan.univ.demo.hangyul.kr', `/applications/${ids.uniApp}`, ALL],
  ['un-analytics', U, 'admin@pusan.univ.demo.hangyul.kr', '/analytics', PHONE],
  ['un-cohorts', U, 'admin@pusan.univ.demo.hangyul.kr', '/cohorts', PHONE],
  ['un-programs', U, 'admin@pusan.univ.demo.hangyul.kr', '/programs', PHONE],
  ['un-partnership', U, 'admin@pusan.univ.demo.hangyul.kr', '/partnership', PHONE],
].filter((s) => !filter || s[0].includes(filter));

async function measure(page) {
  return page.evaluate(() => {
    const vh = innerHeight, vw = innerWidth;
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.top < vh && r.bottom > 0; };
    const all = [...document.querySelectorAll('body *')];
    const primaries = all.filter((e) => /hg-btn--primary|btn-primary/.test(e.className?.baseVal ?? e.className) && vis(e)).length;
    // "boxes": elements with a 4-side border and radius that look like cards/panels
    let boxes = 0, pills = 0, small = 0, textNodes = 0;
    const sizes = {};
    for (const e of all) {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || cs.display === 'none') continue;
      const bw = ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
      const rad = parseFloat(cs.borderTopLeftRadius);
      if (bw && rad >= 6 && r.height > 60 && r.width > 120 && e.tagName !== 'INPUT' && e.tagName !== 'BUTTON' && e.tagName !== 'SELECT' && e.tagName !== 'TEXTAREA') boxes++;
      if (rad >= 10 && r.height <= 28 && r.height >= 16 && r.width < 200 && (bw || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') && e.textContent.trim()) pills++;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) { textNodes++; const fs = Math.round(parseFloat(cs.fontSize)); sizes[fs] = (sizes[fs] || 0) + 1; if (fs < 12) small++; }
    }
    const nav = document.querySelectorAll('nav a, [role=navigation] a, .hg-tabbar a').length;
    const rows = [...document.querySelectorAll('tbody tr, [role=row]')].filter((r) => { const b = r.getBoundingClientRect(); return b.height > 0 && b.top >= 0 && b.bottom <= vh; }).length;
    const h1 = document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null;
    const overflow = document.documentElement.scrollWidth > vw + 1;
    return { height: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(1), primariesInView: primaries, boxes, pills, smallText: small, textNodes, fontSizes: sizes, navLinks: nav, rowsInView: rows, h1, overflow };
  });
}

const browser = await chromium.launch({ channel: 'chromium' }); // new headless: renders PDFs in document previews
const metrics = fs.existsSync(`${OUT}/metrics.json`) ? JSON.parse(fs.readFileSync(`${OUT}/metrics.json`)) : {};
const sessions = new Map();
async function ctxFor(base, account) {
  const key = `${base}|${account}`;
  if (sessions.has(key)) return sessions.get(key);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (account) {
    const p = await ctx.newPage();
    await p.goto(`${base}/login`);
    await p.fill('#email', account); await p.fill('#password', 'Hangyul!2026');
    await p.click('button[type=submit]');
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => console.log('login fail', account));
    await p.close();
  }
  sessions.set(key, ctx); return ctx;
}
for (const [name, base, account, path, widths] of screens) {
  const ctx = await ctxFor(base, account);
  const page = await ctx.newPage();
  for (const w of widths) {
    const h = w < 500 ? (w === 430 ? 932 : 844) : w === 768 ? 1024 : w === 1024 ? 768 : w === 1280 ? 800 : w === 1728 ? 1117 : 900;
    await page.setViewportSize({ width: w, height: h });
    const t0 = Date.now();
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}-${w}.png` });
    await page.screenshot({ path: `${OUT}/full/${name}-${w}.png`, fullPage: true });
    metrics[`${name}@${w}`] = { ...(await measure(page)), loadMs };
    console.log(name, w, JSON.stringify({ h: metrics[`${name}@${w}`].screens, p: metrics[`${name}@${w}`].primariesInView, b: metrics[`${name}@${w}`].boxes }));
  }
  await page.close();
}
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
await browser.close();
