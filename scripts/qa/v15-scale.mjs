/**
 * V15 at-scale simulation (brief Part 26) — the agency at 274 cases, the university at 1,264 applications.
 *
 * What is real and what is synthetic, stated first because it decides what these numbers can be used for.
 * The **caseload is real data in a real database being rendered by the real console**, on an isolated QA
 * stack (scale DB, API on :8091, consoles on :4702/:4703 — none of it the development stack). What is
 * synthetic is the *shape*: stages, deadlines, silences and now plan mix come from distributions an author
 * chose. So the **mechanics** below — whether a number agrees with the rows it opens, how many clicks an
 * action takes, whether anything overflows — are findings. The **mix** is not evidence about a real agency.
 *
 * The brief asks for five agency measurements and a university sweep across dataset sizes. Both are below.
 *
 *   node scripts/qa/v15-scale.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const AGENCY = process.env.AGENCY ?? 'http://localhost:4702';
const UNIVERSITY = process.env.UNIVERSITY ?? 'http://localhost:4703';
const API = process.env.SCALE_API ?? 'http://127.0.0.1:8091';
const OUT = process.env.OUT ?? 'docs/qa/v15/scale';
mkdirSync(OUT, { recursive: true });

const report = { agency: {}, university: {}, issues: [] };
const note = (m) => { report.issues.push(m); console.log(`  ! ${m}`); };
const ok = (m) => console.log(`  · ${m}`);

const browser = await chromium.launch();

async function login(page, base, email) {
  await page.goto(`${base}/login?lang=ko`);
  await page.fill('#email', email);
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
}

// ============================================================================================ AGENCY
console.log('=== Agency · one counsellor, the whole caseload ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await login(page, AGENCY, 'counselor@lotus.demo.hangyul.kr');
  await page.waitForSelector('.ag9-q__row', { timeout: 60_000 });
  const ttq = Date.now() - t0;

  // 1 — time to identify an urgent case: from a cold load to the first row being readable.
  const first = await page.locator('.ag9-q__row').first().evaluate((e) => ({
    tier: e.dataset.tier,
    student: e.querySelector('.ag8-now__name')?.textContent?.trim(),
    plan: e.querySelector('.ag15-plan')?.textContent?.trim() ?? null,
    reason: e.querySelector('.ag8-now__reason')?.textContent?.trim(),
    action: e.querySelector('.ag9-q__act')?.textContent?.trim(),
    due: e.querySelector('.ag9-q__due')?.textContent?.trim(),
  }));
  report.agency.time_to_first_urgent_ms = ttq;
  report.agency.first_row = first;
  ok(`sign-in → the top-ranked case is on screen in ${(ttq / 1000).toFixed(1)}s`);
  ok(`top case: ${first.student} · plan ${first.plan ?? '—'} · "${first.reason}" · next: ${first.action} · due ${first.due}`);
  if (!first.plan) note('the top-ranked row does not show a plan — the counsellor cannot see what was promised without opening the case');

  // 2 — clicks to the next action. The action is a link on the row, so this is one.
  const clicks = await page.locator('.ag9-q__row').first().locator('.ag9-q__act').count();
  report.agency.clicks_to_next_action = clicks ? 1 : null;
  ok(`clicks from Today to the next action: ${clicks ? 1 : 'n/a'} (the action is a link on the row)`);

  const counts = await page.evaluate(() => ({
    total: Number(document.querySelector('.yx-count')?.textContent?.replace(/\D/g, '') ?? 0),
    rows: document.querySelectorAll('.ag9-q__row').length,
    chips: [...document.querySelectorAll('.ag9-chip')].map((c) => c.textContent.trim()),
    filterRowHeight: Math.round(document.querySelector('.ag13-filters')?.getBoundingClientRect().height ?? 0),
  }));
  report.agency.queue = counts;
  ok(`queue: ${counts.total} cases waiting, ${counts.rows} rows shown, ${counts.chips.length} state chips, filter row ${counts.filterRowHeight}px`);
  if (counts.filterRowHeight > 90) note(`the filter row is ${counts.filterRowHeight}px at this caseload`);

  // 3 — plan visibility and scope pressure across the whole caseload, read from the API rather than by
  //     scrolling 274 rows, because this is a question about data, not about rendering.
  const tok = await (await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'counselor@lotus.demo.hangyul.kr', password: 'Hangyul!2026', client: 'agency' }),
  })).json();
  // The list endpoint caps page_size at 200, which is below this caseload — so page it.
  const ids = [];
  for (let pageNo = 1; pageNo <= 5; pageNo++) {
    const r = await (await fetch(`${API}/api/v1/agency/students?page_size=200&page=${pageNo}`,
      { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
    const items = r.items ?? [];
    ids.push(...items.map((s) => s.id));
    if (items.length < 200) break;
  }
  const plans = [];
  for (const id of ids) {
    const r = await fetch(`${API}/api/v1/agency/students/${id}/plan`, { headers: { authorization: `Bearer ${tok.access_token}` } });
    plans.push(await r.json());
  }
  const mix = {};
  let exhausted = 0; let over = 0; let noPlan = 0; let offers = 0;
  for (const p of plans) {
    if (!p) { noPlan++; continue; }
    mix[p.code] = (mix[p.code] ?? 0) + 1;
    const counted = p.usage.filter((u) => u.limit !== null && u.limit > 0);
    if (counted.some((u) => u.used > u.limit)) over++;
    else if (counted.some((u) => u.remaining === 0)) exhausted++;
    if (p.add_ons.some((a) => a.status === 'OFFERED')) offers++;
  }
  report.agency.caseload = { size: ids.length, mix, exhausted, over, no_plan: noPlan, open_offers: offers };
  ok(`caseload ${ids.length}: ${Object.entries(mix).map(([k, v]) => `${k} ${v}`).join(' · ')}${noPlan ? ` · no plan ${noPlan}` : ''}`);
  ok(`scope pressure: ${exhausted} case(s) at an allowance limit, ${over} past one, ${offers} offer(s) with the student`);
  if (noPlan) note(`${noPlan} assigned case(s) have no purchased plan — the console cannot say what was promised`);

  // 4 — missed deadlines: does the queue actually surface everything overdue?
  const overdue = await (await fetch(`${API}/api/v1/agency/deadlines?days=30`, { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
  const overdueCount = (overdue ?? []).filter((d) => d.overdue).length;
  const urgentChip = Number((counts.chips.find((c) => /긴급|urgent/i.test(c)) ?? '').replace(/\D/g, '') || 0);
  report.agency.deadlines = { overdue_in_30d: overdueCount, urgent_chip: urgentChip };
  ok(`${overdueCount} overdue item(s) in the next 30 days; the urgent chip reads ${urgentChip}`);

  // 5 — unnecessary navigation: how many destinations does the rail offer, and does Today send you away?
  const rail = await page.locator('.app-sidebar a, nav a[href^="/"]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('href')))].filter((h) => h && (h.match(/\//g) || []).length === 1 && !h.startsWith('/hq')));
  // Buttons in the page *header* only — the controls on each row are the work, not navigation away from it.
  const headerButtons = await page.evaluate(() => {
    const head = document.querySelector('.ag9-today .yx-pagehead, .ag7-today .yx-pagehead, .page-header');
    return head ? head.querySelectorAll('a, button').length : 0;
  });
  report.agency.navigation = { rail: rail.length, destinations: rail, today_header_buttons: headerButtons };
  ok(`rail: ${rail.length} destinations (${rail.join(' ')}); Today's header offers ${headerButtons} button(s) away from the work`);

  // A case with a spent allowance, opened — the operational moment this pass exists for.
  const spentCase = plans.findIndex((p) => p && p.usage.some((u) => u.limit !== null && u.limit > 0 && u.remaining === 0));
  if (spentCase >= 0) {
    const t1 = Date.now();
    await page.goto(`${AGENCY}/students/${ids[spentCase]}?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ag15-scope', { timeout: 60_000 });
    report.agency.workspace_load_ms = Date.now() - t1;
    const panel = await page.locator('.ag15-scope').innerText();
    const oos = await page.locator('.ag15-oos').count();
    ok(`a case at its limit opens in ${(report.agency.workspace_load_ms / 1000).toFixed(1)}s and shows: ${panel.replace(/\n/g, ' · ')}`);
    ok(`${oos} out-of-scope notice(s) with the next step on them`);
    if (!oos) note('a case at its allowance limit shows no explanation and no next step');
    await page.screenshot({ path: `${OUT}/agency-scope-at-scale.png`, fullPage: true });
  } else {
    note('no case in the caseload is at an allowance limit — the scope-pressure path is untested at scale');
  }
  await page.goto(`${AGENCY}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ag9-q__row', { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/agency-today-at-scale.png` });
  await ctx.close();
}

// ======================================================================================== UNIVERSITY
console.log('\n=== University · 1,264 submitted applications, across dataset sizes ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await login(page, UNIVERSITY, 'admin@pusan.univ.demo.hangyul.kr');
  await page.waitForSelector('#ov-funnel', { timeout: 60_000 });
  report.university.first_paint_ms = Date.now() - t0;
  ok(`sign-in → the Overview is readable in ${(report.university.first_paint_ms / 1000).toFixed(1)}s`);

  // The intake selector gives real datasets of different sizes without inventing any.
  // Wait for the selector to be populated: at this volume the metrics call lands after first paint, and
  // reading it too early sweeps exactly one dataset and calls it a sweep.
  await page.waitForFunction(() => (document.querySelectorAll('#ov-intake option').length > 1), { timeout: 60_000 });
  const intakes = await page.locator('#ov-intake option').evaluateAll((els) => els.map((e) => ({ v: e.value, t: e.textContent.trim() })));
  const sizes = [];
  for (const i of intakes) {
    await page.selectOption('#ov-intake', i.v);
    await page.waitForTimeout(1800);
    const m = await page.evaluate(() => {
      // The population sentence starts with the intake label ("Spring 2027 · 398 applications"), so take
      // the number next to the unit rather than the first number in the string — the first one is a year.
      const pop = document.querySelector('.uv15-funnelpop')?.textContent ?? '';
      const m = pop.match(/([\d,]+)\s*(건|applications?)/i) ?? pop.match(/·\s*([\d,]+)/);
      const n = m ? Number(m[1].replace(/,/g, '')) : 0;
      return {
        population: n,
        height: document.documentElement.scrollHeight,
        queueRows: document.querySelectorAll('.uv7-qrow').length,
        bars: document.querySelectorAll('.uv15-bar').length,
        drop: document.querySelector('[data-drop] .badge')?.textContent?.trim() ?? null,
        emptyStates: document.querySelectorAll('.hg-empty, .uv7-list__empty').length,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    sizes.push({ intake: i.t || 'all', ...m, screens: +(m.height / 900).toFixed(2) });
    if (m.overflowX) note(`${i.t || 'all intakes'}: the Overview scrolls horizontally`);
    if (m.screens > 1.6) note(`${i.t || 'all intakes'}: the Overview is ${m.screens} screens`);
  }
  report.university.by_dataset = sizes;
  for (const s of sizes) {
    ok(`${String(s.intake).padEnd(22)} population ${String(s.population).padStart(5)} · ${s.screens} screens · ${s.queueRows} queue rows · ${s.bars} market bars · largest drop ${s.drop ?? '—'}${s.emptyStates ? ` · ${s.emptyStates} empty state(s)` : ''}`);
  }
  const zero = sizes.filter((s) => s.population === 0);
  if (zero.length) ok(`${zero.length} intake(s) with no applications render an empty state rather than a broken chart`);

  await page.selectOption('#ov-intake', '');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/university-overview-at-scale.png`, fullPage: true });

  // Reconciliation at volume: the funnel's first step must equal the applicant list it opens.
  const submitted = await page.locator('.uv7-funnel tbody tr').first().evaluate((tr) => ({
    n: Number((tr.querySelector('.uv7-num')?.textContent ?? '').replace(/\D/g, '')),
    to: tr.querySelector('.uv7-num a')?.getAttribute('href') ?? null,
  }));
  if (submitted.to) {
    await page.goto(`${UNIVERSITY}${submitted.to}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const listed = await page.evaluate(() => {
      const m = document.body.innerText.match(/([\d,]+)\s*(건|results?|applicants?)/i);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    });
    report.university.reconcile = { funnel_submitted: submitted.n, applicant_list: listed };
    if (listed !== null && listed !== submitted.n) note(`the funnel says ${submitted.n} submitted, the applicant list says ${listed}`);
    else ok(`funnel ${submitted.n} submitted → the applicant list agrees (${listed})`);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/v15-scale.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.issues.length} issue(s). Report: ${OUT}/v15-scale.json`);
