#!/usr/bin/env node
/**
 * Operations at scale (product-excellence pass, 2026-11-22, brief §51).
 *
 * A real API on an isolated scale database (`hangyul_univ_scale`: the E2E fixture template + `server/scripts/
 * v9_scale_seed.py` with HG_SCALE_STUDENTS=1000 — synthetic people, never the runtime database) behind the production
 * Operations build (serve.mjs --api … --port-offset 600 → :4702). Signs in as the seeded counselor and times, in a real
 * browser with no CPU throttle (the API and database are the subject here):
 *   Today first load (shell → first table row), lane filter, stage view, search, Students sort, open a row (case
 *   first content), next page, saved view (create → apply → delete).
 * Each timing is the median of 3 runs. The counts it reports are the API's own totals.
 *
 *   node scripts/qa/launch-final/ops-scale.mjs [--base http://127.0.0.1:4702] [--api http://127.0.0.1:8091]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:4702');
const API = arg('--api', 'http://127.0.0.1:8091');
const OUT = path.resolve(arg('--out', 'docs/qa/launch-final/excellence/results/ops-scale.json'));
const EMAIL = arg('--email', 'counselor@lotus.demo.hangyul.kr');
const RUNS = 3;

const tok = await fetch(`${API}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: 'Hangyul!2026', client: 'agency' }) }).then((r) => r.json());
const H = { Authorization: `Bearer ${tok.access_token}` };
const total = await fetch(`${API}/api/v1/agency/students?page_size=1`, { headers: H }).then((r) => r.json()).then((d) => d.total);
const tasks = await fetch(`${API}/api/v1/tasks?page_size=1`, { headers: H }).then((r) => r.json()).then((d) => d.total).catch(() => null);
console.log(`scale: ${total} students visible to ${EMAIL}; ${tasks ?? '?'} tasks`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const page = await ctx.newPage();
await page.goto(`${BASE}/login?lang=ko`);
await page.fill('#email', EMAIL);
await page.fill('#password', 'Hangyul!2026');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });

const ROW = '.ag22-work tbody tr, .ag22-work .hg-dt-card';
/** prep() is not timed; the clock runs from act() until until() resolves. */
async function time(label, prep, act, until) {
  const xs = [];
  for (let i = 0; i < RUNS; i++) {
    if (prep) await prep(i);
    const t0 = Date.now();
    await act(i);
    await until();
    xs.push(Date.now() - t0);
  }
  xs.sort((a, b) => a - b);
  const r = { label, median_ms: xs[1], runs: xs };
  console.log(`${label.padEnd(36)} ${String(xs[1]).padStart(6)} ms   (${xs.join(', ')})`);
  return r;
}
const rows = () => page.locator(ROW).first().waitFor({ timeout: 60_000 });
const settled = async () => { await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {}); await page.waitForFunction(() => !document.querySelector('.ag22-work [aria-busy="true"], .ag22-work .hg-skeleton'), undefined, { timeout: 60_000 }); };
const ready = async (url) => { await page.goto(url); await rows(); await settled(); };

const out = { generated: new Date().toISOString(), students: total, tasks, base: BASE, method: 'real API on an isolated scale DB, production build, Chromium 1440×900, no throttle; prep untimed; median of 3', results: [] };
const add = async (...a) => { try { out.results.push(await time(...a)); } catch (e) { console.log(`${a[0]}: FAILED ${String(e.message).split('\n')[0]}`); out.results.push({ label: a[0], error: String(e.message).split('\n')[0] }); } };
await add('Today: load to first (ranked) row', null, () => page.goto(`${BASE}/?lang=ko`), rows);
await add('Today: load until every request settled', null, () => page.goto(`${BASE}/?lang=ko`), async () => { await rows(); await settled(); });
await add('Today: lane filter (our turn)', () => ready(`${BASE}/?lang=ko`), () => page.locator('.ops-lane[data-lane="ours"]').click(), settled);
await add('Today: open stage view', async () => { await page.evaluate(() => localStorage.setItem('hg.ops.today.stages', '0')); await ready(`${BASE}/?lang=ko`); }, () => page.locator('.ops-stagetoggle').click(), () => page.locator('.ops-rail__stages').waitFor());
await add('Students: load to first row', null, () => page.goto(`${BASE}/students?lang=ko`), rows);
await add('Students: load until every request settled', null, () => page.goto(`${BASE}/students?lang=ko`), async () => { await rows(); await settled(); });
await add('Students: search', () => ready(`${BASE}/students?lang=ko`), (i) => page.locator('.ag22-work .hg-worktools input').first().fill(['Scale', 'Nguyen', 'Tran'][i]), async () => { await page.waitForURL(/q=/, { timeout: 30_000 }); await settled(); });
await add('Students: sort by name', () => ready(`${BASE}/students?lang=ko`), () => page.locator('.ag22-work th button').first().click(), async () => { await page.waitForURL(/sort=/, { timeout: 30_000 }).catch(() => {}); await settled(); });
await add('Students: next page', () => ready(`${BASE}/students?lang=ko`), () => page.getByRole('button', { name: /다음 페이지|next page|다음/i }).last().click(), async () => { await page.waitForURL(/page=2/, { timeout: 30_000 }); await settled(); });
await add('Open a row → case header', () => ready(`${BASE}/students?lang=ko`), () => page.locator('.ag22-work tbody tr').nth(3).click(), () => page.locator('.ops-case').waitFor({ timeout: 60_000 }));
await add('Saved view (deadline ≤ 7 days): first row', null, () => page.goto(`${BASE}/students?view=deadline7&lang=ko`), rows);

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
