/**
 * V13 — at-scale UI check (brief Parts 19, 20).
 *
 * V12's own hostile review said the remaining design risk was volume, and that every judgement in the product
 * had been made at seed size. This runs the agency and university consoles against the **isolated scale
 * database** (200 students for one counsellor, 1,011 submitted applications) and measures the things that
 * only go wrong when there is enough data: how tall a filter row gets, how many rows render, whether a
 * "largest drop" still means anything, whether anything overflows.
 *
 * It is QA-only by construction: `v9_scale_seed.py` refuses any database whose name does not contain "scale",
 * and these ports are not the dev stack's.
 *
 *   AGENCY=http://localhost:4702 UNIVERSITY=http://localhost:4703 node scripts/qa/v13-scale-qa.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const AGENCY = process.env.AGENCY ?? 'http://localhost:4702';
const UNIVERSITY = process.env.UNIVERSITY ?? 'http://localhost:4703';
const OUT = process.env.OUT ?? 'docs/qa/v13/scale';
const WIDTHS = (process.env.WIDTHS ?? '390,1440').split(',').map(Number);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report = [];
const issues = [];

async function login(page, base, email) {
  await page.goto(`${base}/login`);
  await page.fill('#email', email);
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

function note(surface, width, msg) { issues.push(`${surface} @${width}: ${msg}`); console.log(`  ✖ ${surface} @${width}: ${msg}`); }

// ---------------------------------------------------------------------------------------------- agency
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, AGENCY, 'counselor@lotus.demo.hangyul.kr');
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
    const t0 = Date.now();
    await page.goto(`${AGENCY}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const ms = Date.now() - t0;
    const m = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.ag9-chips .ag9-chip')];
      const row = document.querySelector('.ag9-chips');
      const filters = document.querySelector('.ag13-filters');
      const sel = document.querySelector('.ag13-typefilter select');
      return {
        chips: chips.length,
        chipLabels: chips.map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
        chipRowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
        filterBlockHeight: filters ? Math.round(filters.getBoundingClientRect().height) : null,
        typeOptions: sel ? sel.querySelectorAll('option').length : 0,
        queueRows: document.querySelectorAll('.ag9-q > li').length,
        total: document.querySelector('.yx-count')?.innerText ?? null,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        pageHeight: Math.round(document.body.scrollHeight / window.innerHeight * 10) / 10,
      };
    });
    report.push({ surface: 'agency/today', width: w, loadMs: ms, ...m });
    console.log(`agency Today @${w}: ${m.chips} chips in ${m.chipRowHeight}px, filter block ${m.filterBlockHeight}px, ${m.queueRows} rows, total ${m.total}, ${m.pageHeight} screens, ${ms}ms`);
    // The V12 complaint, now measurable: does the filter row stay one line's worth of chrome at real volume?
    if (m.chips > 6) note('agency/today', w, `${m.chips} chips — the row is a KPI gallery again`);
    if (w >= 1440 && m.filterBlockHeight > 72) note('agency/today', w, `filter block ${m.filterBlockHeight}px — wrapped to multiple rows`);
    if (m.overflow > 1) note('agency/today', w, `horizontal overflow ${m.overflow}px`);
    await page.screenshot({ path: `${OUT}/agency-today-${w}.png`, fullPage: false });
  }
  // The students list at 200 per counsellor.
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
    const t0 = Date.now();
    await page.goto(`${AGENCY}/students`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => ({
      rows: document.querySelectorAll('tbody tr, .ag-studentrow, [data-student-row]').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      pageHeight: Math.round(document.body.scrollHeight / window.innerHeight * 10) / 10,
    }));
    report.push({ surface: 'agency/students', width: w, loadMs: Date.now() - t0, ...m });
    console.log(`agency Students @${w}: ${m.rows} rows, ${m.pageHeight} screens, ${Date.now() - t0}ms`);
    if (m.overflow > 1) note('agency/students', w, `horizontal overflow ${m.overflow}px`);
    await page.screenshot({ path: `${OUT}/agency-students-${w}.png`, fullPage: false });
  }
  await ctx.close();
}

// ------------------------------------------------------------------------------------------ university
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, UNIVERSITY, 'admin@pusan.univ.demo.hangyul.kr');
  for (const route of ['/', '/applicants', '/analytics']) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      const t0 = Date.now();
      await page.goto(`${UNIVERSITY}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1400);
      const ms = Date.now() - t0;
      const m = await page.evaluate(() => ({
        queueRows: document.querySelectorAll('.uv7-queue .uv7-list > li').length,
        queueCounts: [...document.querySelectorAll('.uv7-qrow__n')].map((e) => e.innerText.trim()),
        statCards: document.querySelectorAll('.uv7-stats > *').length,
        tableRows: document.querySelectorAll('tbody tr').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        pageHeight: Math.round(document.body.scrollHeight / window.innerHeight * 10) / 10,
        h1: document.querySelectorAll('h1').length,
      }));
      report.push({ surface: `university${route}`, width: w, loadMs: ms, ...m });
      console.log(`university ${route} @${w}: queue ${m.queueRows} rows ${JSON.stringify(m.queueCounts)}, ${m.tableRows} table rows, ${m.pageHeight} screens, ${ms}ms`);
      if (m.overflow > 1) note(`university${route}`, w, `horizontal overflow ${m.overflow}px`);
      if (m.h1 !== 1) note(`university${route}`, w, `h1=${m.h1}`);
      // Brief Part 13: an Overview should be about one to one-and-a-half desktop screens.
      if (route === '/' && w >= 1440 && m.pageHeight > 2.2) note('university/', w, `Overview is ${m.pageHeight} screens tall`);
      await page.screenshot({ path: `${OUT}/university${route.replace(/\//g, '_') || '_root'}-${w}.png`, fullPage: false });
    }
  }
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify({ measured_at: new Date().toISOString(), agency: AGENCY, university: UNIVERSITY, report, issues }, null, 2));
console.log(`\n${report.length} at-scale views measured, ${issues.length} issue(s)`);
if (issues.length) process.exit(1);
