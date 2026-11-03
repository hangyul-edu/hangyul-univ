// V26 — agency console at ~1,000 students (REPORT §344, brief §29). Runs against the ISOLATED scale stack only:
//   API  :8091  (HG_DATABASE_URL=…/hangyul_univ_scale26, seeded by server/scripts/v9_scale_seed.py with HG_SCALE_STUDENTS=1000)
//   web  :4702  (apps/agency-web vite with HG_API_URL=http://127.0.0.1:8091)
//   node scripts/qa/v26/scale.mjs [--json docs/qa/v26/scale-1000.json]
// Part 1 (API): median / p95 of 7 cold calls per endpoint that the Today and Students screens make. Part 2 (rendered, one
// Chromium, 1440 and 390): first-page time, paging, search, a filter, a saved view, selection + bulk bar, the sticky header,
// the TODAY figure = rows at this size, and the row → exact record link. Nothing here touches the development database.
import { apiToken } from '../auth.mjs';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const API = 'http://localhost:8091/api/v1';
const WEB = 'http://localhost:4702';
const USER = 'counselor@lotus.demo.hangyul.kr';
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const out = { api: {}, rendered: {} };
let fails = 0;
const ok = (name, cond, ev = '') => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${ev ? ` — ${ev}` : ''}`); if (!cond) fails += 1; };
const q = (a) => { const s = [...a].sort((x, y) => x - y); return { median: s[Math.floor(s.length / 2)], p95: s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] }; };

/* ---------------------------------------------------------------------------------------------- 1 · API */
const tok = await apiToken(API, USER, 'agency');
const H = { Authorization: `Bearer ${tok}` };
const total = (await (await fetch(`${API}/agency/students?page_size=1`, { headers: H })).json()).total;
console.log(`\n[api] ${total} students for ${USER}`);
const ENDPOINTS = {
  'students page 1 (50)': '/agency/students?page_size=50&sort=deadline',
  'students page 10 (50)': '/agency/students?page_size=50&sort=deadline&page=10',
  'students search "Nguyen"': '/agency/students?page_size=50&q=Nguyen',
  'students view=waiting_counselor': '/agency/students?page_size=50&view=waiting_counselor',
  'students nationality=VN + stage group': '/agency/students?page_size=50&nationality=VN&stage=DOCUMENT_PREPARATION&stage=READY_TO_APPLY',
  'stage-counts': '/agency/stage-counts',
  'views (TODAY figures)': '/agency/students/views',
  'today': '/agency/today',
  'today queue (ranked, 100)': '/agency/today/queue?scope=team&limit=100',
};
for (const [name, p] of Object.entries(ENDPOINTS)) {
  // One warm-up call (connection + plan cache), then nine measured ones — the usual lab form; the warm-up time is printed too.
  // Budget (G-SCALE-1): median < 1 s and p95 < 2.5 s over nine calls after one warm-up. The gate exists to catch the kind of
  // regression that made this endpoint 11.7 s (RC-27, a 10–20× effect); a p95-only bound at 1 s on a shared VM reported host
  // jitter (one slow call out of nine) as a product defect three times in one night with no code change.
  const ms = []; let status = 0; let n = null; let warm = 0;
  for (let i = 0; i < 10; i += 1) {
    const t0 = performance.now(); const r = await fetch(`${API}${p}`, { headers: H }); const body = await r.json().catch(() => ({})); const dt = performance.now() - t0; status = r.status;
    if (i === 0) warm = dt; else ms.push(dt);
    if (n === null) n = body.total ?? (Array.isArray(body.items) ? body.items.length : null);
  }
  const { median, p95 } = q(ms);
  out.api[name] = { status, warmup_ms: Math.round(warm), median_ms: Math.round(median), p95_ms: Math.round(p95), total: n };
  ok(`${name}: HTTP ${status}, median ${Math.round(median)} ms, p95 ${Math.round(p95)} ms (warm-up ${Math.round(warm)} ms)${n !== null ? `, ${n} rows` : ''}`, status === 200 && median < 1000 && p95 < 2500);
}
// Figure = rows at scale, for every TODAY view.
const views = await (await fetch(`${API}/agency/students/views`, { headers: H })).json();
for (const v of ['urgent', 'deadline7', 'waiting_counselor', 'student_silent', 'requested', 'university']) {
  const rows = await (await fetch(`${API}/agency/students?view=${v}&page_size=1`, { headers: H })).json();
  ok(`TODAY ${v}: figure (${views[v]}) = rows (${rows.total})`, views[v] === rows.total);
}
// Every row with a reason that names a record carries that record (the exact-action contract) — all pages.
let gaps = 0; let seen = 0;
const NEED = { reply_owed: 'reply_thread', review: 'review_doc', review_unassigned: 'review_doc', essay_review: 'essay', essay_unassigned: 'essay', university_request: 'request', fix: 'fix_doc', task: 'task', task_unassigned: 'task' };
for (let page = 1; ; page += 1) {
  const r = await (await fetch(`${API}/agency/students?page_size=200&page=${page}`, { headers: H })).json();
  for (const row of r.items ?? []) { seen += 1; const k = NEED[row.waiting_reason?.code]; if (k && !row.targets?.[k]) gaps += 1; }
  if (!r.items?.length || page * 200 >= r.total) break;
}
ok(`exact-action contract holds on all ${seen} rows (rows whose reason names a record but carry no id: ${gaps})`, gaps === 0);

/* ----------------------------------------------------------------------------------------- 2 · rendered */
const browser = await chromium.launch();
for (const width of [1440, 390]) {
  console.log(`\n[rendered @${width}]`);
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`${WEB}/login?demo=${encodeURIComponent(USER)}&lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  const R = (out.rendered[width] = {});
  const settled = (want) => p.waitForFunction((n) => { const t = document.querySelector('.ag22-table'); return t && Number(t.getAttribute('data-work-total')) === n && !t.querySelector('[aria-busy="true"]'); }, want, { timeout: 30000 }).then(() => true, () => false);

  // Today: first paint to a complete table.
  let t0 = performance.now();
  await p.goto(`${WEB}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  const todayOk = await settled(total);
  R.today_ms = Math.round(performance.now() - t0);
  ok(`Today renders the complete table (${total}) in ${R.today_ms} ms`, todayOk && R.today_ms < 6000);
  const todayN = Number(await p.locator('.ag25-today__item[data-view="waiting_counselor"]').getAttribute('data-count').catch(() => '0'));
  await p.locator('.ag25-today__item[data-view="waiting_counselor"]').click();
  ok(`TODAY 우리 답변을 기다리는 중 (${todayN}) filters to exactly that many rows`, await settled(todayN));
  const firstHref = await p.evaluate(() => { const a = document.querySelector('.ag22-table tbody tr .ag26-next'); return a ? a.getAttribute('href') : null; });
  ok('the first row\'s next action links to the exact record (focus=…)', !!firstHref && /focus=(reply|doc|essay|task|request|app|thread|compose):/.test(firstHref) || /\/essays\//.test(firstHref ?? ''), firstHref ?? 'no link');

  // Students: paging, search, filter, saved view, selection, sticky header.
  t0 = performance.now();
  await p.goto(`${WEB}/students?lang=ko`, { waitUntil: 'domcontentloaded' });
  ok(`Students page 1 complete in ${Math.round(performance.now() - t0)} ms`, await settled(total));
  R.students_ms = Math.round(performance.now() - t0);
  const rowsOnPage = await p.locator('.ag22-table tbody tr').count();
  ok(`page size 50 on page 1 (${rowsOnPage} rows)`, rowsOnPage === 50 || (width < 600 && rowsOnPage >= 25));
  if (width >= 600) {
    const next = p.locator('.ag22-table button[aria-label="다음"]').first();
    if (await next.count()) {
      const firstName = await p.locator('.ag22-table tbody tr').first().innerText();
      await next.click();
      const changed = await p.waitForFunction((prev) => { const r = document.querySelector('.ag22-table tbody tr'); return r && r.innerText !== prev; }, firstName, { timeout: 15000 }).then(() => true, () => false);
      ok('paging: page 2 shows different rows and the URL carries ?page=2', changed && /page=2/.test(p.url()));
    } else ok('paging control present', false);
  }
  await p.goto(`${WEB}/students?q=Nguyen&lang=ko`, { waitUntil: 'domcontentloaded' });
  const searchTotal = (await (await fetch(`${API}/agency/students?page_size=1&q=Nguyen`, { headers: H })).json()).total;
  ok(`search "Nguyen": table total = API total (${searchTotal})`, await settled(searchTotal));
  await p.goto(`${WEB}/students?nationality=VN&lang=ko`, { waitUntil: 'domcontentloaded' });
  const vnTotal = (await (await fetch(`${API}/agency/students?page_size=1&nationality=VN`, { headers: H })).json()).total;
  ok(`filter nationality=VN: table total = API total (${vnTotal}); strip counts recomputed`, await settled(vnTotal));
  if (width >= 600) {
    // Saved view round-trip through the toolbar select (team views are seeded by the scale seed when present).
    const sel = p.locator('select[aria-label="보기"]').first();
    const hasSaved = (await sel.count()) ? await sel.locator('optgroup option').count() : 0;
    if (hasSaved) {
      const val = await sel.locator('optgroup option').first().getAttribute('value');
      await sel.selectOption(val);
      ok('saved view applies (URL carries ?saved=)', await p.waitForFunction(() => /saved=/.test(location.search), null, { timeout: 10000 }).then(() => true, () => false));
    } else console.log('  INFO  no saved views in the scale data — saved-view apply not exercised here (covered by e2e)');
    // Selection + bulk bar.
    await p.goto(`${WEB}/students?lang=ko`, { waitUntil: 'domcontentloaded' }); await settled(total);
    const boxes = p.locator('.ag22-table tbody input[type="checkbox"]');
    const nBoxes = await boxes.count();
    if (nBoxes) {
      await boxes.nth(0).check(); await boxes.nth(1).check(); await boxes.nth(2).check();
      const bulk = await p.locator('.hg-table-bulk').first().isVisible().catch(() => false);
      ok('selecting 3 rows shows the bulk-action bar', bulk);
    } else ok('selectable rows (checkboxes) present', false);
    // Sticky header: scroll inside the page and check the header row stays in view.
    await p.evaluate(() => window.scrollTo(0, 1400));
    // The header CELLS are sticky (`.hg-table th { position: sticky; top: var(--hg-table-sticky-top) }`); the <thead> box itself scrolls away.
    const stuck = await p.evaluate(() => { const th = document.querySelector('.ag22-table thead th'); if (!th) return null; const r = th.getBoundingClientRect(); return r.top >= 0 && r.top < 160 && r.bottom > 0; });
    ok('table header cells stay visible after scrolling 1,400 px (sticky under the app header)', stuck === true, String(stuck));
  }
  // Density: row height within the dense band, no horizontal overflow.
  // Desktop: dense table rows. Phone: the table becomes one card per student (DataTable renderCard), so measure the card.
  // On a phone the DataTable renders cards (`.hg-rowcard`) AND keeps the table rows in the DOM at zero height, so the card
  // must be looked for first.
  const rowH = await p.evaluate((w) => { const r = (w < 600 ? document.querySelector('.ag22-table .hg-rowcard') : null) ?? document.querySelector('.ag22-table tbody tr'); return r ? r.getBoundingClientRect().height : 0; }, width);
  R.row_height = Math.round(rowH);
  ok(width < 600 ? `card height ${Math.round(rowH)} px on a phone (one student per card, 72–180)` : `row height ${Math.round(rowH)} px (dense but not cramped: 40–64)`,
    width < 600 ? rowH >= 72 && rowH <= 180 : rowH >= 40 && rowH <= 64);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`no horizontal page overflow at ${width}`, over <= 1, `${over}px`);
  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
if (jsonOut) fs.writeFileSync(path.join(ROOT, jsonOut), JSON.stringify(out, null, 2));
console.log(`\nscale test — ${fails ? `${fails} FAILED` : 'all passed'}`);
process.exit(fails ? 1 : 0);
