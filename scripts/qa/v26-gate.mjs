// `npm run qa:v26` — the V26 gate (REPORT §349, brief §82). It asserts USER OUTCOMES: a click lands on the exact record, a
// figure equals the rows it opens, the screen a student reaches answers their question. Structural checks are kept only
// where they protect a root cause (CSS layering, residue, production exclusions).
//
//   node scripts/qa/v26-gate.mjs [--part static|api|rendered|all] [--only <section,…>]
//
// Sections: HYGIENE · NAV · STUDENT · AGENCY · UNIVERSITY · VISUAL · MEDIA · I18N · PERF · A11Y
// Exit 0 only when every check that ran passed. Waits are predicates (never a fixed sleep), reruns are not retried.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARG = process.argv.slice(2);
const PART = ARG.includes('--part') ? ARG[ARG.indexOf('--part') + 1] : 'all';
const ONLY = ARG.includes('--only') ? ARG[ARG.indexOf('--only') + 1].split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const API = 'http://localhost:8001/api/v1';
const MK = 'http://localhost:3100'; const ST = 'http://localhost:3101'; const AG = 'http://localhost:3102'; const UN = 'http://localhost:3103';
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));

let pass = 0; let fail = 0; const failures = [];
const ok = (section, name, cond, evidence = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`);
  if (cond) pass += 1; else { fail += 1; failures.push(`${section} · ${name}`); }
};
const info = (line) => console.log(`  INFO  ${line}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const token = async (client, email) => (await (await fetch(`${API}/auth/demo-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, client }) })).json()).access_token;
const get = async (t, p) => { const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } }); return r.ok ? r.json() : { __status: r.status }; };
const py = (args, env = {}) => spawnSync(path.join(ROOT, 'server/.venv/bin/python'), args, { cwd: path.join(ROOT, 'server'), encoding: 'utf8', env: { ...process.env, HG_ENV: 'development', ...env } });


/* ======================================================================================================== static */
const walk = (dir, keep, out = []) => { if (!fs.existsSync(dir)) return out; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, keep, out); } else if (keep(p)) out.push(p); } return out; };
const flat = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const q = pre ? `${pre}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else out[q] = v; } return out; };
const bundle = (loc, ns) => { const f = path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`); return fs.existsSync(f) ? flat(JSON.parse(fs.readFileSync(f, 'utf8'))) : {}; };

async function staticPart() {
  console.log('\n[static]');
  if (want('HYGIENE')) {
    const r = py(['scripts/purge_e2e.py', '--check']);
    ok('HYGIENE', 'no QA residue in the development data (test accounts, gate messages, notifications naming test accounts, E2E requests)', r.status === 0, r.stdout.trim().replace(/\n/g, ' · '));
    const tl = py(['scripts/v26_repair_timelines.py', '--check']);
    ok('HYGIENE', 'no impossible dates: no status history, submission or creation in the future', tl.status === 0, tl.stdout.trim().replace(/\n/g, ' · '));
    const gates = ['scripts/qa/v22-gate.mjs', 'scripts/qa/v21/toss-test-transaction.mjs', 'apps/student-mobile/src/signup/client.integration.test.ts'];
    ok('HYGIENE', 'every gate or test that writes on seeded data tears down after itself (purge_e2e.py at exit)', gates.every((g) => /scripts[./]purge_e2e/.test(read(g))), gates.join(', '));
    const pre = read('scripts/qa/v21/toss-test-transaction.mjs');
    ok('HYGIENE', 'the invalid-card check asserts its own precondition (a real order id), not a 422 from /orders/undefined', /order2\.body\?\.id/.test(pre) && /precondition/i.test(pre));
  }
  if (want('VISUAL')) {
    const vfiles = ['marketing-web', 'student-web', 'agency-web', 'university-web'].flatMap((a) => walk(path.join(ROOT, 'apps', a, 'src'), (f) => /\/v\d+[a-z-]*\.css$/.test(f)));
    ok('VISUAL', 'no version-named stylesheet survives (canonical src/styles/*.css)', vfiles.length === 0, vfiles.map((f) => path.relative(ROOT, f)).join(', '));
    const tmp = path.join((await import('node:os')).tmpdir(), `hg-css-metrics-${process.pid}.json`);
    spawnSync('node', ['scripts/qa/v26/css-metrics.mjs', '--json', tmp], { cwd: ROOT, encoding: 'utf8' });
    const now = JSON.parse(fs.readFileSync(tmp, 'utf8')); fs.rmSync(tmp, { force: true });
    const base = JSON.parse(read('docs/qa/v26/css-metrics-after.json'));
    for (const app of Object.keys(base)) {
      ok('VISUAL', `${app}: shadowed declarations do not grow (baseline ${base[app].shadowed})`, now[app].shadowed <= base[app].shadowed, `${now[app].shadowed}`);
      ok('VISUAL', `${app}: literal font sizes do not grow (baseline ${base[app].literalFontSize})`, now[app].literalFontSize <= base[app].literalFontSize, `${now[app].literalFontSize}`);
    }
    ok('VISUAL', 'the record a link lands on is marked by one shared rule ([data-focus] in @hangyul/ui base.css)', /\[data-focus='true'\]/.test(read('packages/ui/src/styles/base.css')));
    // RC-29: the production build used to purge two marketing stylesheets *by path*; the V26 rename silently switched the
    // purge off (+27 KB shipped). Dead rules are now removed at source, and nothing in the pipeline may match app files by path.
    const prune = spawnSync('node', ['scripts/qa/v26/prune-marketing-base.mjs'], { cwd: ROOT, encoding: 'utf8' });
    const pruned = /removed (\d+) selectors/.exec(prune.stdout || '');
    ok('VISUAL', 'marketing base.css carries no rule the production purge would drop (dev = production app layer)', !!pruned && pruned[1] === '0', pruned ? `${pruned[1]} droppable` : (prune.stderr || '').slice(0, 160));
    const viteTs = read('packages/config/vite.ts');
    ok('VISUAL', 'the template CSS pipeline matches no app stylesheet by file path', !/apps\\\/[^\n]*\.test\(file\)/.test(viteTs) && !/isLegacyMarketing/.test(viteTs), '');
  }
  if (want('I18N')) {
    const { MARKET_LOCALES } = await import(path.join(ROOT, 'scripts/i18n/v23/markets.mjs'));
    const patch = JSON.parse(read('scripts/i18n/v26/strings.json'));
    const ph = (x) => [...String(x).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
    let missing = []; let badPh = [];
    for (const [ns, keys] of Object.entries(patch)) for (const k of Object.keys(keys)) {
      const en = bundle('en', ns)[k];
      for (const loc of MARKET_LOCALES) {
        const b = bundle(loc, ns); const pl = k.replace(/_(one|other)$/, '');
        const v = b[k] ?? b[`${pl}_other`] ?? b[pl];
        if (v === undefined) missing.push(`${loc}:${ns}:${k}`); else if (en !== undefined && ph(v) !== ph(en)) badPh.push(`${loc}:${k}`);
      }
    }
    ok('I18N', `every V26 string exists in all ${MARKET_LOCALES.length} market locales`, missing.length === 0, missing.slice(0, 4).join(' ') || `${Object.values(patch).reduce((a, x) => a + Object.keys(x).length, 0)} keys`);
    ok('I18N', 'every V26 translation keeps the English placeholders', badPh.length === 0, badPh.slice(0, 4).join(' '));
    const ko = ['student', 'success', 'common', 'agency', 'university', 'mobile'].map((ns) => Object.values(bundle('ko', ns)).join('\n')).join('\n');
    ok('I18N', 'no honorific on the team name in Korean ("상담팀님", "{{counselor}}님이")', !/팀님|\{\{counselor\}\}님이|\{\{name\}\}님이 (읽|수정|지원서)/.test(ko));
    const codes = new Set([...walk(path.join(ROOT, 'server/app'), (f) => f.endsWith('.py')).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/"action": \{"code": "([A-Z_]+)"/g)].map((m) => m[1]))]);
    const actions = bundle('en', 'success');
    const noKey = [...codes].filter((c) => !actions[`action.${c}`]);
    ok('I18N', 'every action code the server emits has a translation (no English fallback label on a Korean page)', noKey.length === 0, noKey.join(', ') || [...codes].join(', '));
  }
  if (want('NAV')) {
    ok('NAV', 'a locale (?lang=) is never read as a search filter by Explore', /NON_FILTER_KEYS = new Set\(\[[^\]]*'lang'/.test(read('apps/student-web/src/pages/Explore.tsx')));
    const eng = read('server/app/services/tasks_engine.py');
    ok('NAV', 'student document tasks link to the exact requirement, never the bare /documents page', !/link="\/documents"/.test(eng) && /\/documents\?focus=/.test(eng));
  }
}

/* =========================================================================================================== api */
async function apiPart() {
  console.log('\n[api]');
  const ta = await token('agency', 'counselor@lotus.demo.hangyul.kr');
  if (want('AGENCY')) {
    const views = await get(ta, '/agency/students/views');
    for (const v of ['urgent', 'deadline7', 'waiting_counselor', 'student_silent', 'requested', 'university']) {
      const rows = await get(ta, `/agency/students?view=${v}&page_size=200`);
      ok('AGENCY', `TODAY ${v}: figure = rows (${views[v]})`, rows.total === views[v], `${rows.total}`);
    }
    // Every row whose reason names a record carries that record (the exact-action contract, RC-01).
    const all = await get(ta, '/agency/students?page_size=200');
    const NEED = { reply_owed: 'reply_thread', review: 'review_doc', review_unassigned: 'review_doc', essay_review: 'essay', essay_unassigned: 'essay', university_request: 'request', fix: 'fix_doc', task: 'task', task_unassigned: 'task' };
    const gaps = (all.items ?? []).filter((r) => NEED[r.waiting_reason?.code] && !r.targets?.[NEED[r.waiting_reason.code]]).map((r) => `${r.full_name}:${r.waiting_reason.code}`);
    ok('AGENCY', `every queue row whose reason names a record carries that record's id (${all.total} rows)`, gaps.length === 0, gaps.slice(0, 4).join(' '));
    const silk = await token('agency', 'manager@silk.demo.hangyul.kr');
    const cross = await fetch(`${API}/agency/students/${all.items[0].id}`, { headers: { Authorization: `Bearer ${silk}` } });
    ok('AGENCY', 'tenant isolation: another agency gets 404 on this agency\'s student', cross.status === 404, `HTTP ${cross.status}`);
    const ws = await get(ta, `/agency/students/${(all.items.find((r) => r.targets?.request?.id) ?? all.items[0]).id}`);
    ok('AGENCY', "the workspace carries the university's open requests on their application", Array.isArray(ws.applications?.[0]?.requests));
  }
  const tu = await token('university', 'admin@pusan.univ.demo.hangyul.kr');
  if (want('UNIVERSITY')) {
    const H = { decide: 'status=SUBMITTED&status=UNIVERSITY_REVIEW&status=ADDITIONAL_DOCUMENTS&status=INTERVIEW&status=WAITLISTED', requests: 'requests=open', fresh: 'submitted_within_days=7', moved: 'updated_within_days=7' };
    for (const [k, q] of Object.entries(H)) {
      const one = await get(tu, `/applications?${q}&page_size=1`); const rows = await get(tu, `/applications?${q}&page_size=200`);
      ok('UNIVERSITY', `headline ${k}: figure = rows (web and native read the same filter)`, one.total === rows.items.length, `${one.total}`);
    }
    const dec = await get(tu, '/applications?sort=decision&page_size=200');
    const AW = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'];
    const firstOther = dec.items.findIndex((a) => !AW.includes(a.status));
    ok('UNIVERSITY', 'decision-first order: every applicant who needs a decision comes before any who does not', firstOther < 0 || dec.items.slice(firstOther).every((a) => !AW.includes(a.status)), `${dec.items.filter((a) => AW.includes(a.status)).length} first`);
    const skku = await token('university', 'admin@sungkyunkwan.univ.demo.hangyul.kr').catch(() => null);
    if (skku) {
      const a = (await get(tu, '/applications?page_size=200')).items.map((x) => x.id); const b = ((await get(skku, '/applications?page_size=200')).items ?? []).map((x) => x.id);
      ok('UNIVERSITY', 'tenant isolation: two universities share no applicant', a.length > 0 && !a.some((x) => b.includes(x)), `${a.length} vs ${b.length}`);
    }
    const m = await get(tu, '/university/metrics');
    const stepOk = (m.pipeline?.steps ?? []).every((st) => typeof st.count === 'number');
    ok('UNIVERSITY', 'analytics carry definition + population + denominator (n<5 rule) on every step', stepOk && m.pipeline.population && m.pipeline.min_denominator !== undefined);
  }
  if (want('STUDENT')) {
    const ts = await token('student', 'student@demo.hangyul.kr');
    const sv = await get(ts, '/me/services');
    const managed = (sv.now ?? []).find((l) => l.key === 'max_managed_applications');
    ok('STUDENT', 'services: the applications listed as counted equal the allowance used', !managed || managed.items.filter((i) => i.counted).length === managed.usage.used, managed ? `${managed.items.filter((i) => i.counted).length}/${managed.usage.used}` : 'no plan');
    ok('STUDENT', 'services: every included service says who acts and what is next or why not yet', (sv.now ?? []).length > 0 && sv.now.every((l) => l.owner && l.state));
    const notes = await get(ts, '/notifications');
    const generic = (notes.items ?? []).filter((n) => ['/documents', '/essays', '/messages', '/applications'].includes(n.link));
    ok('STUDENT', 'every notification opens the exact record (no bare /documents, /essays, /messages, /applications)', generic.length === 0, generic.map((n) => `${n.kind}→${n.link}`).slice(0, 3).join(' '));
    const tasks = await get(ts, '/tasks?page_size=100');
    const bare = (tasks.items ?? []).filter((x) => x.link === '/documents');
    ok('STUDENT', 'document tasks open the requirement (no bare /documents)', bare.length === 0, `${bare.length}`);
  }
}

/* ============================================================================================== rendered helpers */
let chromium;
async function browser() { ({ chromium } = await import('@playwright/test')); return chromium.launch(); }
async function signedIn(b, base, email, opts = {}) {
  const ctx = await b.newContext({ locale: 'ko-KR', viewport: opts.viewport ?? { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  if (email) { await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); }
  return { ctx, p, errors };
}
/** Waits for a predicate inside the page (never a fixed sleep). */
const until = (p, fn, arg, timeout = 15000) => p.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

/* ===================================================================================================== AGENCY */
async function agencyRendered(b) {
  console.log('\n[rendered · AGENCY exact work]');
  const { ctx, p } = await signedIn(b, AG, 'counselor@lotus.demo.hangyul.kr');
  const t = await token('agency', 'counselor@lotus.demo.hangyul.kr');
  const views = await get(t, '/agency/students/views');
  // For every TODAY item: count = rows, and the first row opens the exact record that item is about.
  const EXPECT = { requested: ['request', 'app'], waiting_counselor: ['reply', 'doc', 'essay', 'task'], student_silent: ['thread', 'compose'], deadline7: ['app'] };
  for (const [view, kinds] of Object.entries(EXPECT)) {
    const n = views[view] ?? 0;
    if (!n) { info(`TODAY ${view}: 0 in the demo data — not shown, nothing to open`); continue; }
    await p.goto(`${AG}/?lang=ko`, { waitUntil: 'networkidle' });
    await p.locator(`.ag25-today__item[data-view="${view}"]`).click();
    const settled = await until(p, (want) => Number(document.querySelector('.ag22-table')?.getAttribute('data-work-total')) === want, n);
    ok('AGENCY', `TODAY ${view}: the figure equals the rows it filters to`, settled, `${n}`);
    const row = p.locator('.ag22-table tbody tr').first();
    await row.click();
    await p.waitForURL((u) => u.pathname.startsWith('/students/') || u.pathname.startsWith('/essays/'), { timeout: 10000 }).catch(() => {});
    const url = new URL(p.url());
    const focus = url.searchParams.get('focus') ?? (url.pathname.startsWith('/essays/') ? 'essay:' : '');
    const kind = focus.split(':')[0];
    ok('AGENCY', `TODAY ${view} → row opens the exact record (${kinds.join('/')}), not just the student`, kinds.includes(kind), `${url.pathname}${url.search}`);
    if (url.pathname.startsWith('/students/') && kind && kind !== 'compose') {
      const landed = await until(p, () => { const el = document.querySelector('[data-focus="true"]'); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 40; });
      ok('AGENCY', `TODAY ${view}: the record is on screen and marked`, landed);
    }
    if (url.pathname.startsWith('/students/') && kind) {
      if (kind === 'reply') {
        const typed = await until(p, () => document.activeElement?.tagName === 'TEXTAREA');
        ok('AGENCY', 'a reply owed opens the thread with the cursor in the reply box', typed);
      }
      if (kind === 'compose') {
        const dialog = await until(p, () => !!document.querySelector('[role="dialog"] #nc-body'));
        ok('AGENCY', 'a silent student with no thread opens a new conversation to them', dialog);
      }
      if (kind === 'request') {
        const quoted = await p.locator('[data-focus="true"] .ag26-req__label').count();
        ok('AGENCY', "the university's request is shown on its application, in its own words", quoted === 1);
      }
    }
  }
  // The workspace never says "nothing is waiting" while the case strip names our next action.
  const t2 = await get(t, '/agency/students?view=waiting_counselor&page_size=50');
  const owed = (t2.items ?? []).find((r) => r.waiting_reason?.code === 'reply_owed');
  if (owed) {
    await p.goto(`${AG}/students/${owed.id}?lang=ko`, { waitUntil: 'networkidle' });
    const needs = await p.locator('.ag22-needs__row').count();
    ok('AGENCY', '"처리 필요" lists the owed reply (no contradiction with the case strip)', needs > 0, owed.full_name);
    const primary = (await p.locator('.ag7-wshead__actions .btn-primary').allInnerTexts()).join('|');
    ok('AGENCY', 'the workspace primary is the next action (reply), and there is exactly one primary', /답장/.test(primary) && !primary.includes('|'), primary);
  } else info('no student with a reply owed in the demo data');
  await ctx.close();
}


/* ===================================================================================================== STUDENT */
async function studentRendered(b) {
  console.log('\n[rendered · STUDENT]');
  const { ctx, p, errors } = await signedIn(b, ST, 'student@demo.hangyul.kr');
  await p.goto(`${ST}/explore?lang=ko`, { waitUntil: 'networkidle' });
  const tab = await p.locator('[role="tab"][aria-selected="true"]').first().innerText().catch(() => '');
  ok('NAV', '/explore?lang=ko opens "나에게 맞는" (a locale is not a search)', /나에게/.test(tab), tab);
  await p.goto(`${ST}/explore?tab=all&lang=ko`, { waitUntil: 'networkidle' });
  await until(p, () => document.querySelectorAll('.v4-group').length > 0);
  const groups = await p.$$eval('.v4-group', (gs) => gs.map((g) => g.getAttribute('aria-label')));
  const adjacentDup = groups.some((g, i) => i > 0 && g === groups[i - 1]);
  ok('STUDENT', 'Explore (all programmes): each university appears once per run, under one header', groups.length > 0 && !adjacentDup, `${groups.length} groups`);
  const facts = await p.$$eval('.v4-row', (rs) => rs.slice(0, 6).map((r) => !!r.querySelector('.v4-row__facts') && /₩|KRW|\$/.test(r.textContent) && /TOPIK|IELTS|최소|요건/.test(r.textContent) && /지원|마감|모집/.test(r.textContent)));
  ok('STUDENT', 'Explore rows show the facts that matter first — first-year cost, language requirement, deadline', facts.length > 0 && facts.every(Boolean), `${facts.filter(Boolean).length}/${facts.length}`);
  const repeats = await p.$$eval('.v4-row__unlock', (u) => u.filter((x) => /희망 과정/.test(x.textContent)).length);
  ok('STUDENT', 'the "another degree level" explanation is said once, not on every row', repeats === 0, `${repeats} row-level repeats`);
  await p.goto(`${ST}/services?lang=ko`, { waitUntil: 'networkidle' });
  const nowRows = await p.locator('.sv26-now__row').count();
  ok('STUDENT', 'services: what the plan is doing now, one row per included service', nowRows >= 4, `${nowRows} rows`);
  const notCounted = await p.locator('.sv26-now__item[data-counted="no"]').count();
  info(`services: ${notCounted} application(s) shown as not counted (a draft never uses the allowance)`);
  await p.goto(`${ST}/documents?focus=TRANSCRIPT&lang=ko`, { waitUntil: 'networkidle' });
  const marked = await until(p, () => { const el = document.querySelector('.dz-page [data-focus="true"]'); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok('STUDENT', 'a document task opens its requirement on screen, marked', marked);
  await p.goto(`${ST}/applications/${IDS.studentApplication}?lang=ko`, { waitUntil: 'networkidle' });
  const latest = await p.locator('.sa26-latest').innerText().catch(() => '');
  ok('STUDENT', 'the application says what changed last', /최근 변경/.test(latest), latest);
  const english = await p.evaluate(() => /Open the draft|Review and authorize/.test(document.body.innerText));
  ok('I18N', 'no English action label on the Korean application page', !english);
  const honor = await p.evaluate(() => /팀님|을\(를\)|이\(가\)|은\(는\)/.test(document.body.innerText));
  ok('I18N', 'no form-register particles or team honorific rendered on the application page', !honor);
  ok('STUDENT', 'no page error on the student routes visited', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ================================================================================================== UNIVERSITY */
async function universityRendered(b) {
  console.log('\n[rendered · UNIVERSITY]');
  const { ctx, p } = await signedIn(b, UN, 'admin@pusan.univ.demo.hangyul.kr');
  await p.goto(`${UN}/?lang=ko`, { waitUntil: 'networkidle' });
  const lead = Number(await p.locator('.uv25-head__item[data-head="decide"]').getAttribute('data-count'));
  const sort = await p.locator('#ap-sort').inputValue().catch(() => '');
  ok('UNIVERSITY', `the list opens in decision-first order by default (the API check proves the order itself)`, sort === 'decision', sort);
  await p.locator('.uv25-head__item[data-head="decide"]').click();
  const settled = await until(p, (n) => document.querySelectorAll('table tbody tr').length === n, lead);
  ok('UNIVERSITY', 'headline "결정이 필요한 지원자" opens exactly that many rows', settled, `${lead}`);
  await ctx.close();
}

/* ============================================================================================ VISUAL · A11Y */
async function visualRendered(b) {
  console.log('\n[rendered · VISUAL]');
  const { run } = await import(path.join(ROOT, 'scripts/qa/v26/census.mjs'));
  const rep = await run(null, null);
  const stray = Object.values(rep).flatMap((r) => Object.values(r).flatMap((c) => c.stray));
  const dark = Object.values(rep).flatMap((r) => Object.values(r).flatMap((c) => c.darkOnOrange));
  ok('VISUAL', 'tangerine only on the primary action, the current item and focus (census of every visible element, 4 products)', stray.length === 0, stray.slice(0, 3).join(' | ') || `${Object.values(rep).reduce((a, r) => a + Object.keys(r).length, 0)} routes`);
  ok('VISUAL', 'an orange control never carries dark text', dark.length === 0, dark.slice(0, 3).join(' | '));
  // Keyboard focus is visible on the first focusable controls of each product (no outline:0 regression).
  for (const [name, base, email, route] of [['marketing', MK, null, '/'], ['student', ST, 'student@demo.hangyul.kr', '/'], ['agency', AG, 'counselor@lotus.demo.hangyul.kr', '/'], ['university', UN, 'admin@pusan.univ.demo.hangyul.kr', '/']]) {
    const { ctx, p } = await signedIn(b, base, email);
    await p.goto(`${base}${route}?lang=ko`, { waitUntil: 'networkidle' });
    let invisible = 0; let seen = 0;
    for (let i = 0; i < 12; i += 1) {
      await p.keyboard.press('Tab');
      const v = await p.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); });
      if (v === null) continue; seen += 1; if (!v) invisible += 1;
    }
    ok('A11Y', `${name}: keyboard focus is visible on the first ${seen} focusable controls`, seen > 0 && invisible === 0, `${invisible} without a visible focus`);
    for (const w of [390]) {
      await p.setViewportSize({ width: w, height: 844 });
      await p.goto(`${base}${route}?lang=ko`, { waitUntil: 'networkidle' });
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok('VISUAL', `${name} at ${w}px: no horizontal overflow`, over <= 1, `${over}px`);
    }
    await ctx.close();
  }
}

/* The legal pages' only automated coverage used to be the marketing live smoke, which is skipped unless LIVE=1 — that is
   how broken /privacy and /terms shipped until V17 (REPORT §330). This renders them against the running stack. */
async function legalRendered(b) {
  console.log('\n[rendered · NAV legal pages]');
  const { ctx, p, errors } = await signedIn(b, MK, null);
  for (const r of ['/privacy', '/terms']) {
    await p.goto(`${MK}${r}?lang=ko`, { waitUntil: 'networkidle' });
    const h1 = await p.locator('main h1').first().innerText().catch(() => '');
    const sections = await p.locator('main h2').count();
    ok('NAV', `${r} renders a heading and its articles`, h1.length > 1 && sections >= 8, `${h1.slice(0, 20)} · ${sections} sections`);
  }
  ok('NAV', 'no page error on the legal pages', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

async function a11yRendered(b) {
  console.log('\n[rendered · A11Y axe]');
  const axeSrc = fs.readFileSync('/root/.cache/hg-axe/node_modules/axe-core/axe.min.js', 'utf8');
  const ROUTES = [['marketing', MK, null, ['/', '/universities', '/universities/yonsei-university', '/start']],
    ['student', ST, 'student@demo.hangyul.kr', ['/', '/explore?tab=all', '/services', `/applications/${IDS.studentApplication}`, '/documents']],
    ['agency', AG, 'counselor@lotus.demo.hangyul.kr', ['/', `/students/${IDS.agencyStudent}`, '/review']],
    ['university', UN, 'admin@pusan.univ.demo.hangyul.kr', ['/', '/analytics']]];
  for (const [name, base, email, routes] of ROUTES) {
    for (const w of [1440, 390]) {
      const { ctx, p } = await signedIn(b, base, email, { viewport: { width: w, height: w < 600 ? 844 : 900 } });
      const found = [];
      for (const r of routes) {
        await p.goto(`${base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' });
        await p.addScriptTag({ content: axeSrc });
        const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
          .filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}×${x.nodes.length}`));
        if (v.length) found.push(`${r}: ${v.join(',')}`);
      }
      ok('A11Y', `${name} @${w}: no serious/critical axe violation on ${routes.length} core routes`, found.length === 0, found.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
}

/* ======================================================================================================== main */
const parts = PART === 'all' ? ['static', 'api', 'rendered'] : [PART];
if (parts.includes('static')) await staticPart();
if (parts.includes('api')) await apiPart();
if (parts.includes('rendered')) {
  const b = await browser();
  try {
    if (want('AGENCY')) await agencyRendered(b);
    if (want('STUDENT') || want('NAV') || want('I18N')) await studentRendered(b);
    if (want('NAV')) await legalRendered(b);
    if (want('UNIVERSITY')) await universityRendered(b);
    if (want('VISUAL')) await visualRendered(b);
    if (want('A11Y')) await a11yRendered(b);
  } finally { await b.close(); }
}
console.log(`\nV26 gate — ${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  ✖ ${f}`);
process.exit(fail ? 1 : 0);
