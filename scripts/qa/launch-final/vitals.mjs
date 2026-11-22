#!/usr/bin/env node
/**
 * Lab Core Web Vitals for the critical pages (product-excellence pass, 2026-11-22).
 *
 * Production builds served by serve.mjs; signed-in pages in Design Preview (synthetic fixtures, no API). Each page:
 * cold load in a fresh context, 4× CPU throttle (CDP), then
 *   LCP — the last `largest-contentful-paint` entry and a description of its element;
 *   CLS — session-window sum of `layout-shift` entries without recent input, measured to 3 s after load;
 *   INP (lab) — one or more real interactions per page (click / type / key), each measured as the longest
 *               `event` timing entry (durationThreshold 16 ms) it produced; the page's value is the worst of them.
 * Lab numbers on a shared 4-core WSL machine — a regression signal and a target check, not field data.
 *
 *   node scripts/qa/launch-final/vitals.mjs [--runs 2] [--out docs/qa/launch-final/excellence/results/vitals.json]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY } from './routes.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', 'docs/qa/launch-final/excellence/results/vitals.json'));
const RUNS = Number(arg('--runs', 2));
const ONLY = arg('--only', null);
const off = Number(arg('--port-offset', 0));
const B = { marketing: 4100 + off, student: 4101 + off, agency: 4102 + off, university: 4103 + off };

/** [app, name, route, interactions] — an interaction is { click | type | key, target, label }. */
const PAGES = [
  ['marketing', 'home', '/', [{ click: 'header a[href*="universities"], nav a[href*="universities"]', label: 'open directory link' }]],
  ['marketing', 'directory', '/universities', [{ type: 'input[type="search"], input[type="text"]', text: '부산', label: 'search' }]],
  ['marketing', 'university', '/universities/pusan-national-university', []],
  ['student', 'home', '/', [{ click: '.v34-journey__toggle', label: 'open journey' }]],
  ['student', 'match', '/match', [{ click: '.sx-bar .hg-seg button:nth-child(2)', label: 'switch match group' }, { click: '.v4-row__actions button', label: 'open why' }]],
  ['student', 'application', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', [{ click: '.v4-history summary', label: 'open history' }]],
  ['student', 'documents', '/documents', [{ click: '.dg-views .hg-seg button:last-child', label: 'show all documents' }]],
  ['student', 'explore', '/explore?tab=all', [{ type: '.st-page input[type="search"], .st-page input[type="text"]', text: 'business', label: 'search programmes' }]],
  ['student', 'thread', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d', [{ type: '.st-composer textarea', text: '안녕하세요 서류 질문이 있어요', label: 'type message' }]],
  ['agency', 'today', '/', [{ click: '.ops-lane[data-lane="ours"]', label: 'filter lane' }, { click: '.ops-stagetoggle', label: 'show stages' }]],
  ['agency', 'review', '/review?mode=documents', [{ key: 'j', label: 'next document (J)' }]],
  ['agency', 'case', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=application', []],
  ['university', 'home', '/', [{ click: '.un-inbox [data-head="decide"]', label: 'needs decision filter' }]],
  ['university', 'review', '/applications/8a3d287f-9d03-4198-8e72-7bfa14a2a3a8', []],
];
const WIDTHS = [390, 1440];

const INIT = () => {
  window.__v = { lcp: 0, lcpEl: '', cls: 0, events: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__v.lcp = e.startTime; const el = e.element; window.__v.lcpEl = el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || el.getAttribute('alt') || '').trim().slice(0, 40)}"` : (e.url || ''); } }).observe({ type: 'largest-contentful-paint', buffered: true });
  let win = 0; let last = 0; let first = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; if (e.startTime - last > 1000 || e.startTime - first > 5000) { win = 0; first = e.startTime; } win += e.value; last = e.startTime; window.__v.cls = Math.max(window.__v.cls, win); } }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.events.push({ name: e.name, d: e.duration }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
};

const browser = await chromium.launch();
const rows = [];
for (const [app, name, route, acts] of PAGES) {
  if (ONLY && !ONLY.split(',').includes(app)) continue;
  for (const width of WIDTHS) {
    const runs = [];
    for (let r = 0; r < RUNS; r++) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, locale: 'ko-KR' });
      if (app !== 'marketing') await ctx.addInitScript(([k]) => { try { sessionStorage.setItem(k, 'paid'); } catch { /* */ } }, [PREVIEW_KEY]);
      await ctx.addInitScript(INIT);
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`http://127.0.0.1:${B[app]}${route}${route.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'load' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
      const base = await page.evaluate(() => ({ lcp: Math.round(window.__v.lcp), lcpEl: window.__v.lcpEl, cls: Number(window.__v.cls.toFixed(3)) }));
      const inter = [];
      for (const a of acts) {
        const before = await page.evaluate(() => window.__v.events.length);
        try {
          if (a.click) { const el = page.locator(a.click).first(); if (!(await el.count())) { inter.push({ label: a.label, skipped: 'not found' }); continue; } await el.scrollIntoViewIfNeeded(); await el.click({ timeout: 4000 }); }
          if (a.type) { const el = page.locator(a.type).first(); if (!(await el.count())) { inter.push({ label: a.label, skipped: 'not found' }); continue; } await el.click(); await page.keyboard.type(a.text, { delay: 60 }); }
          if (a.key) await page.keyboard.press(a.key);
        } catch (e) { inter.push({ label: a.label, skipped: String(e.message).slice(0, 60) }); continue; }
        await page.waitForTimeout(1200);
        const worst = await page.evaluate((n) => window.__v.events.slice(n).reduce((m, e) => Math.max(m, e.d), 0), before);
        inter.push({ label: a.label, ms: Math.round(worst) });
      }
      runs.push({ ...base, inter });
      await ctx.close();
    }
    const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
    const row = {
      app, name, route, width,
      lcp: med(runs.map((x) => x.lcp)), lcpEl: runs.at(-1).lcpEl, cls: Math.max(...runs.map((x) => x.cls)),
      inp: Math.max(0, ...runs.flatMap((x) => x.inter.map((i) => i.ms ?? 0))),
      interactions: runs.at(-1).inter,
    };
    rows.push(row);
    console.log(`${String(width).padEnd(5)} ${app.padEnd(10)} ${name.padEnd(12)} LCP ${String(row.lcp).padStart(5)} ms  CLS ${row.cls.toFixed(3)}  INP ${String(row.inp).padStart(4)} ms  ← ${row.lcpEl}`);
  }
}
await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), method: 'cold load, 4x CPU throttle, Design Preview for signed-in pages, median of runs; INP = worst event duration of scripted interactions', rows }, null, 2));
const bad = rows.filter((r) => r.lcp > 2500 || r.cls > 0.1 || r.inp > 200);
console.log(`${rows.length} page×width rows · over target (LCP>2.5 s, CLS>0.1, INP>200 ms): ${bad.length}`);
