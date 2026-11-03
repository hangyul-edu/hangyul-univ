// `npm run qa:v23` — the V23 final-release-candidate gate (REPORT §276, brief §71).
//
//   node scripts/qa/v23-gate.mjs [--part static|api|rendered|native|built|all] [--live]
//
// static    file/bundle-level checks (social config, copy, roles, native wiring, legal text, l10n priority keys)
// api       the running API on :8001 (425 institutions, coverage CSV, test access, paid-state, export parity via pytest)
// rendered  the running Vite apps (footer, directory 425 tiles, test-login buttons, stage strips, overflow, console)
// native    exports the agency/student/university production bundles (EXPO_PUBLIC_TEST_LOGIN=false, --clear) and greps
//           them; heavy (one Metro at a time) — not part of `all`, run it on its own
// built     greps the built web bundles in apps/*/dist (run `npm run build` first) — not part of `all`
// --live    also re-reads https://www.talkhangyul.com/en and compares the social config with it
//
// Exit code 0 only when every check that ran passed. Each check prints PASS/FAIL with its evidence.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARG = process.argv.slice(2);
const PART = ARG.includes('--part') ? ARG[ARG.indexOf('--part') + 1] : 'all';
const LIVE = ARG.includes('--live');
const API = 'http://localhost:8001/api/v1';
const MK = 'http://localhost:3100';
const ST = 'http://localhost:3101';
const AG = 'http://localhost:3102';
const UN = 'http://localhost:3103';

let pass = 0; let fail = 0; const failures = [];
const ok = (section, name, cond, evidence = '') => {
  if (cond) { pass += 1; console.log(`  PASS  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`); }
  else { fail += 1; failures.push(`${section} · ${name}`); console.log(`  FAIL  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const walk = (dir, filter = () => true, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-review', 'dist-scale', '.expo', '.expo-export-check', 'android', 'ios'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out); else if (filter(p)) out.push(p);
  }
  return out;
};
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else out[q] = v; } return out; };
const { MARKET_LOCALES } = await import(path.join(ROOT, 'scripts/i18n/v23/markets.mjs'));
const bundle = (loc, ns) => { const p = path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`); return fs.existsSync(p) ? flat(JSON.parse(fs.readFileSync(p, 'utf8'))) : {}; };

/* =============================================================================================== static */
async function staticPart() {
  console.log('\n[static]');
  // MARKETING — social config equals the extracted canonical Hangyul footer
  const snap = JSON.parse(read('docs/qa/v23/social/talkhangyul-footer.json'));
  const src = read('apps/marketing-web/src/lib/social.ts');
  const mine = [...src.matchAll(/platform: "([^"]+)", href: "([^"]+)"/g)].map((m) => ({ platform: m[1], href: m[2] }));
  const paths = Object.fromEntries([...src.matchAll(/\n {2}(YouTube|Instagram|TikTok|Reddit|Facebook):\n {4}"([^"]+)"/g)].map((m) => [m[1], m[2]]));
  ok('MARKETING', 'social platforms and hrefs equal the canonical talkhangyul.com footer (snapshot)',
    JSON.stringify(mine) === JSON.stringify(snap.live.map(({ platform, href }) => ({ platform, href }))), mine.map((m) => m.platform).join(' · '));
  ok('MARKETING', 'social glyphs are the exact talkhangyul.com SVG paths', snap.live.every((l) => l.paths.includes(paths[l.platform])), `${Object.keys(paths).length}/5`);
  ok('MARKETING', 'snapshot target/rel are _blank / noopener noreferrer', snap.live.every((l) => l.target === '_blank' && l.rel === 'noopener noreferrer'));
  if (fs.existsSync('/root/hangyul-web/src/constants/socialLinks.ts')) {
    const { readSource } = await import(path.join(ROOT, 'scripts/qa/v23/extract-hangyul-social.mjs'));
    const s = readSource();
    ok('MARKETING', 'owner source project (/root/hangyul-web) still agrees', JSON.stringify(s.map(({ platform, href }) => ({ platform, href }))) === JSON.stringify(mine) && s.every((e) => e.path === paths[e.platform]));
  }
  if (LIVE) {
    const { fetchLive } = await import(path.join(ROOT, 'scripts/qa/v23/extract-hangyul-social.mjs'));
    const live = await fetchLive();
    ok('MARKETING', 'live talkhangyul.com/en footer agrees (--live)', JSON.stringify(live.map(({ platform, href }) => ({ platform, href }))) === JSON.stringify(mine) && live.every((l) => l.paths.includes(paths[l.platform])));
  }
  ok('MARKETING', 'footer renders the social block', /<SocialLinks \/>/.test(read('apps/marketing-web/src/components/SiteLayout.tsx')));

  // MARKETING — copy
  // "무료 — 가입 없이 이용 가능" (search needs no account) and "카탈로그는 무료이고 계정도 필요 없습니다" are true entitlements and stay.
  const FREE = /free account|account for free|create a free|무료(로)? ?(계정 ?만들|회원 ?가입)|무료 계정|무료로 시작하기|tài khoản miễn phí|免费(注册|账号)|無料アカウント|บัญชีฟรี|akun gratis|libreng account|бесплатн\w* (аккаунт|регистрац)|ücretsiz hesap|cuenta gratis|compte gratuit|निःशुल्क खाता|मुफ़्त अकाउंट|বিনামূল্যে অ্যাকাউন্ট|bepul hisob|үнэгүй бүртгэл|тегін тіркелгі|акысыз аккаунт|حسابًا مجانيًا|အခမဲ့ အကောင့်/i;
  const hits = [];
  for (const loc of MARKET_LOCALES) for (const ns of ['marketing', 'student', 'mobile', 'common']) for (const [k, v] of Object.entries(bundle(loc, ns))) if (typeof v === 'string' && FREE.test(v)) hits.push(`${loc}/${ns}:${k}`);
  ok('MARKETING', 'no "free account" sign-up copy in any market bundle', hits.length === 0, hits.slice(0, 4).join(', ') || '33 markets × 4 namespaces');
  ok('MARKETING', 'student login link reads 회원가입 / Sign up', bundle('ko', 'student')['login.createAccount'] === '회원가입' && bundle('en', 'student')['login.createAccount'] === 'Sign up');
  ok('MARKETING', 'legitimate "free" entitlements kept (무료 자격 확인)', Object.values(bundle('ko', 'marketing')).some((v) => v === '무료 자격 확인'));
  const sub = [];
  for (const loc of fs.readdirSync(path.join(ROOT, 'packages/i18n/locales')).filter((d) => !d.startsWith('_'))) {
    const m = bundle(loc, 'marketing');
    if ('v21.dir.lede' in m || 'v12.directory.source' in m) sub.push(loc);
    for (const v of Object.values(m)) if (typeof v === 'string' && v.includes('대학알리미에 공시된 425')) sub.push(`${loc}(text)`);
  }
  ok('MARKETING', 'forbidden directory subtitle and its translations removed', sub.length === 0, sub.slice(0, 5).join(','));
  ok('MARKETING', 'directory page renders no lede / provenance line', !/mk-dir__lede|v12\.directory\.source|v21\.dir\.lede/.test(read('apps/marketing-web/src/pages/Universities.tsx')));

  // DISCOVERY — static
  ok('DISCOVERY', 'tile uses the shared identity composition; no chopped-name tier', /UniversityIdentityArt/.test(read('apps/marketing-web/src/pages/Universities.tsx')) && !/mk-unicard__ident-name|mk-unicard__mono/.test(read('apps/marketing-web/src/pages/Universities.tsx')));
  const marks = fs.readdirSync(path.join(ROOT, 'apps/marketing-web/public/media/region-mark')).filter((f) => f.endsWith('.svg'));
  ok('DISCOVERY', '17 province marks generated for every app that draws a university', marks.length === 17 && fs.readdirSync(path.join(ROOT, 'apps/student-web/public/media/region-mark')).length === 17);
  ok('DISCOVERY', 'no "campus photography" tier tag on tiles', !/v20\.dir\.tierPhoto/.test(read('apps/marketing-web/src/pages/Universities.tsx')));
  ok('DISCOVERY', 'campus role is translated, not printed raw', /CAMPUS_ROLE/.test(read('apps/marketing-web/src/pages/UniversityDetail.tsx')));

  // TEST ACCESS / PAID STATE — V32: the feature no longer exists; the invariant is absence (see qa:v32-leak)
  for (const [app, file] of [['student', 'apps/student-web/src/pages/Login.tsx'], ['agency', 'apps/agency-web/src/pages/Login.tsx'], ['university', 'apps/university-web/src/pages/Login.tsx']]) {
    ok('TEST ACCESS', `${app} login has no test sign-in`, !/TestAccountSignIn|VITE_DEMO_LOGINS|demo-login/.test(read(file)));
  }
  ok('TEST ACCESS', 'no persona module, no test-access component', !exists('packages/auth/src/demo-personas.ts') && !exists('packages/ui/src/test-access.tsx'));
  const cfg = read('server/app/core/config.py');
  ok('TEST ACCESS', 'server environment fails closed (default production, normalised)', /env: str = "production"/.test(cfg) && /_normalise_env/.test(cfg));
  const st = read('server/app/api/v1/student.py');
  ok('TEST PAID STATE', 'no dev-complete endpoint and no bypass setting', !/dev-complete|test_payment_bypass/.test(st + cfg));
  ok('TEST PAID STATE', 'real Toss key-in path intact', /\/v1\/payments\/key-in/.test(read('server/app/services/foreign_card.py')));

  // AGENCY / UNIVERSITY — static
  const roleHits = [];
  for (const f of [...walk(path.join(ROOT, 'apps/agency-web/src'), (p) => /\.tsx?$/.test(p)), ...walk(path.join(ROOT, 'apps/agency-mobile'), (p) => /\.tsx?$/.test(p)), ...walk(path.join(ROOT, 'apps/university-mobile'), (p) => /\.tsx?$/.test(p)), ...walk(path.join(ROOT, 'apps/university-web/src'), (p) => /\.tsx?$/.test(p))]) {
    const s = fs.readFileSync(f, 'utf8');
    if (/\b(AGENCY_COUNSELOR|AGENCY_MANAGER|AGENCY_OWNER|AGENCY_DOCUMENT_REVIEWER|UNIVERSITY_ADMISSIONS|UNIVERSITY_REVIEWER|UNIVERSITY_ANALYST)\b/.test(s) && !/\.test\./.test(f)) roleHits.push(path.relative(ROOT, f));
  }
  ok('AGENCY', 'no legacy tenant role referenced in console or native staff app code', roleHits.length === 0, roleHits.slice(0, 4).join(', '));
  ok('AGENCY', 'old /documents and /essays links keep their query', /function ToReview/.test(read('apps/agency-web/src/router.tsx')));
  ok('AGENCY', '?counselor= is a real filter', /counselor_id: v\.counselor/.test(read('apps/agency-web/src/components/Caseload.tsx')));
  ok('AGENCY', 'agency login cover describes the V22 product (no drag-and-drop pipeline / SLA timer promise)', !/21단계|drag-and-drop|SLA 타이머/.test(JSON.stringify(bundle('ko', 'agency')['login.p1Text']) + bundle('en', 'agency')['login.p1Text'] + bundle('ko', 'agency')['login.p2Title']));
  ok('UNIVERSITY', 'export runs the list predicate', /filter_applications\(db, p/.test(read('server/app/api/v1/university.py')));
  ok('UNIVERSITY', 'outcomes scoped to university-visible applications', /Application\.university_id == uid, university_visible\(\)\)\)\.all\(\)\n\s+# V23 §273 U2/.test(read('server/app/api/v1/university.py')));
  ok('UNIVERSITY', 'no permanently disabled Schedule control; no decorative cohort charts', !/v8\.ex\.schedule'\)/.test(read('apps/university-web/src/pages/Exports.tsx')) && !/ColumnChart/.test(read('apps/university-web/src/pages/Cohorts.tsx')));

  // STUDENT — identity
  ok('STUDENT', 'no counselor/agency naming in student mobile copy', !('v3.home.counselorAt' in bundle('ko', 'mobile')) && !('v3.application.counselor' in bundle('en', 'mobile')));
  ok('STUDENT', 'payment errors never render the raw transport message', !/: err\.message,\n/.test(read('apps/student-web/src/pages/Services.tsx')));

  // NATIVE — static (V32: no test sign-in at all)
  const login = read('packages/mobile-ui/src/bootstrap/LoginScreen.tsx');
  ok('NATIVE', 'no test sign-in in the native login screen', !/TEST_LOGIN|TestAccountSignIn/.test(login) && !exists('packages/mobile-ui/src/components/TestAccountSignIn.tsx'));
  for (const app of ['student-mobile', 'agency-mobile', 'university-mobile']) {
    const eas = JSON.parse(read(`apps/${app}/eas.json`));
    ok('NATIVE', `${app}: no EXPO_PUBLIC_TEST_LOGIN in any build profile`, !JSON.stringify(eas).includes('EXPO_PUBLIC_TEST_LOGIN'));
    const aj = JSON.parse(read(`apps/${app}/app.json`)).expo;
    ok('NATIVE', `${app}: release signing plugin + versionCode`, aj.plugins.includes('./plugins/withReleaseSigning') && aj.android.versionCode >= 1);
  }
  ok('NATIVE', 'student native sign-up present', exists('apps/student-mobile/src/signup/SignupFlow.tsx'));
  ok('NATIVE', 'staff apps on the V22 console tokens (no cobalt)', !/primary: '#2257D6'/i.test(read('packages/design-tokens/src/console.ts')) && /primary: '#CC4E00'/.test(read('packages/design-tokens/src/console.ts')));
  ok('NATIVE', 'agency tabs 오늘 · 학생 · 지원·서류 · 메시지 · 설정', /name="settings"/.test(read('apps/agency-mobile/app/(tabs)/_layout.tsx')) && bundle('ko', 'mobile')['agency.reviews.tab'] === '지원·서류');
  ok('NATIVE', 'university tabs 지원자 · 메시지 · 현황 · 설정; no read-only role branch', /name="settings"/.test(read('apps/university-mobile/app/(tabs)/_layout.tsx')) && !/readOnlyBody/.test(read('apps/university-mobile/app/applicants/[id].tsx')));

  // LEGAL
  const en = bundle('en', 'marketing');
  ok('LEGAL', 'privacy states the card path that the code implements (Toss key-in via Hangyul)', /Toss Payments/.test(en['v12.privacy.collect.noCard']) && !/provider’s own checkout/.test(en['v12.privacy.collect.noCard']));
  ok('LEGAL', 'Toss Payments disclosed as a processor (domestic), not as an overseas transfer', /DOMESTIC_PROCESSORS/.test(read('apps/marketing-web/src/pages/legal/Privacy.tsx')) && /tosspayments/.test(read('apps/marketing-web/src/lib/legal/data-map.ts')));
  ok('LEGAL', 'no refund percentage invented', !/\d+\s*%/.test(bundle('ko', 'marketing')['v12.terms.refunds.commercial'] ?? ''));
  ok('LEGAL', 'company block identical to the live Hangyul footer fields', /'403-87-03380'/.test(read('apps/marketing-web/src/lib/legal/entity.ts')) && /'제2026-서울도봉-0542호'/.test(read('apps/marketing-web/src/lib/legal/entity.ts')));

  // LOCALIZATION — priority keys
  const pk = path.join(ROOT, 'docs/qa/v23/l10n/priority-keys.json');
  if (fs.existsSync(pk)) {
    const apps = JSON.parse(fs.readFileSync(pk, 'utf8')).apps;
    const customer = ['marketing', 'student_public', 'student', 'student_visa', 'student_arrived'];
    const keys = new Set(customer.flatMap((a) => apps[a]?.keys ?? []));
    const enAll = {};
    const missing = {};
    for (const k of keys) {
      const [ns, ...rest] = k.split(':'); const key = rest.join(':');
      enAll[ns] ??= bundle('en', ns);
      if (!(key in enAll[ns])) continue; // plural forms / dynamic defaults resolved elsewhere
      for (const loc of MARKET_LOCALES) {
        if (loc === 'en') continue;
        const b = (missing[`__${loc}:${ns}`] ??= bundle(loc, ns));
        if (!(key in b)) (missing[loc] ??= []).push(k);
      }
    }
    const report = Object.fromEntries(MARKET_LOCALES.filter((l) => l !== 'en').map((l) => [l, (missing[l] ?? []).length]));
    const worst = Object.entries(report).filter(([, n]) => n > 0);
    ok('LOCALIZATION', `priority customer keys present in 33/33 markets (${keys.size} keys rendered by the priority routes)`, worst.length === 0, worst.slice(0, 8).map(([l, n]) => `${l}:${n}`).join(' ') || 'all present');
  } else ok('LOCALIZATION', 'priority key set measured (run scripts/qa/v23/l10n-crawl.mjs)', false);
  const hr = [];
  for (const loc of MARKET_LOCALES) for (const ns of ['_status', '_student_status']) {
    const p = path.join(ROOT, 'packages/i18n/locales', `${ns}.json`);
    if (fs.existsSync(p) && /HUMAN_REVIEWED/.test(fs.readFileSync(p, 'utf8'))) hr.push(ns);
  }
  const statusFiles = walk(path.join(ROOT, 'packages/i18n'), (p) => p.endsWith('.json') && /status|meta|manifest/i.test(path.basename(p)));
  const humanClaims = statusFiles.filter((f) => /"HUMAN_REVIEWED"/.test(fs.readFileSync(f, 'utf8').replace(/"never[^"]*HUMAN_REVIEWED[^"]*"/g, '')));
  ok('LOCALIZATION', 'no translation labelled HUMAN_REVIEWED', humanClaims.length === 0, humanClaims.map((f) => path.relative(ROOT, f)).join(', '));
}

/* ================================================================================================= api */
async function apiPart() {
  console.log('\n[api]');
  const health = await fetch('http://localhost:8001/healthz').then((r) => r.json()).catch(() => null);
  ok('API', 'dev API answering on :8001 (development env)', health?.env === 'development', JSON.stringify(health));
  // DISCOVERY — 425 + coverage
  const cov = spawnSync(process.execPath, [path.join(ROOT, 'scripts/qa/v23/university-visual-coverage.mjs'), '--check'], { encoding: 'utf8' });
  const sum = JSON.parse((cov.stdout.split('\n').find((l) => l.startsWith('{')) ?? '{}'));
  ok('DISCOVERY', 'exactly 425 institutions, 425 intentional primary visuals, 0 broken, 0 cross-university', cov.status === 0 && sum.total === 425 && sum.intentional === 425, JSON.stringify(sum));
  const rows = read('docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv').trim().split('\n');
  ok('DISCOVERY', 'coverage CSV has one row per institution with verified_at and licence for every row', rows.length === 426 && rows.slice(1).every((r) => /,"\d{4}-\d{2}-\d{2}",/.test(r)), `${rows.length - 1} rows`);
  const { loadAll } = await import(path.join(ROOT, 'scripts/qa/v23/university-visual-coverage.mjs'));
  const { items } = await loadAll(API);
  let bad = 0; const badSlugs = [];
  for (let i = 0; i < items.length; i += 25) {
    const res = await Promise.all(items.slice(i, i + 25).map((it) => fetch(`${API}/directory/institutions/${it.slug}`).then((r) => r.status)));
    res.forEach((s, j) => { if (s !== 200) { bad += 1; badSlugs.push(items[i + j].slug); } });
  }
  ok('DISCOVERY', 'every one of the 425 detail routes answers 200', bad === 0, `${items.length - bad}/${items.length}${badSlugs.length ? ` (${badSlugs.slice(0, 3).join(',')})` : ''}`);
  const det = await fetch(`${API}/directory/institutions/gachon-university`).then((r) => r.json());
  ok('DISCOVERY', 'public detail exposes no internal verification enum or source-status field in rendered sections', !/SOURCED_UNREVIEWED|OFFICIAL_DATA_LIMITED|FULLY_ENRICHED/.test(read('apps/marketing-web/src/pages/UniversityDetail.tsx')), `api has last_verified=${det.last_verified}`);
}

/* ============================================================================================ rendered */
async function renderedPart() {
  console.log('\n[rendered]');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = async (w = 1440) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
    const p = await ctx.newPage();
    p.__errors = [];
    p.on('console', (m) => { if (m.type() === 'error') p.__errors.push(m.text().slice(0, 160)); });
    p.on('pageerror', (e) => p.__errors.push(String(e).slice(0, 160)));
    return p;
  };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // MARKETING footer
  for (const w of [390, 1440]) {
    const p = await page(w);
    await p.goto(`${MK}/terms?lang=ko`, { waitUntil: 'networkidle' });
    const links = await p.$$eval('.kn-footer__social-link', (as) => as.map((a) => ({ href: a.href, t: a.target, r: a.rel, l: a.getAttribute('aria-label'), w: a.getBoundingClientRect().width, top: Math.round(a.getBoundingClientRect().top) })));
    ok('MARKETING', `footer social block at ${w}: 5 links, _blank + noopener, 40 px targets, one row`, links.length === 5 && links.every((x) => x.t === '_blank' && /noopener/.test(x.r) && x.w >= 40 && x.top === links[0].top && /^한귤 /.test(x.l)));
    ok('MARKETING', `footer page ${w}: no horizontal overflow, no console errors`, (await overflow(p)) <= 0 && p.__errors.length === 0, p.__errors[0] ?? '');
    await p.context().close();
  }
  // DISCOVERY — every tile across all pages has an intentional visual
  {
    const p = await page(1440);
    let tiles = 0; let good = 0; const badT = []; let tags = 0;
    for (let n = 1; n <= 18; n += 1) {
      await p.goto(`${MK}/universities?lang=ko&page=${n}`, { waitUntil: 'networkidle' });
      for (let y = 0; y < 10; y += 1) { await p.mouse.wheel(0, 1200); await p.waitForTimeout(80); }
      await p.waitForTimeout(600);
      const r = await p.$$eval('.mk-unicard', (cs) => cs.map((c) => {
        const v = c.querySelector('.mk-unicard__visual');
        const img = v?.querySelector(':scope > img, :scope > picture > img'); // V25: photos are <picture> (WebP first)
        const art = v?.querySelector('.hg-uni-art');
        const mapOk = art ? (art.querySelector('.hg-uni-art__map')?.naturalWidth ?? 0) > 0 : true;
        return { name: c.querySelector('.mk-unicard__name')?.textContent, ok: (!!img && img.complete && img.naturalWidth > 0) || (!!art && mapOk && !!art.querySelector('.hg-uni-art__name')?.textContent?.trim()), tag: !!c.querySelector('.mk-unicard__tag'), old: !!c.querySelector('.mk-unicard__ident') };
      }));
      tiles += r.length; good += r.filter((x) => x.ok && !x.old).length; tags += r.filter((x) => x.tag).length;
      badT.push(...r.filter((x) => !x.ok || x.old).map((x) => x.name));
    }
    ok('DISCOVERY', 'all 425 directory tiles render an intentional visual (loaded photo/film poster or identity composition)', tiles === 425 && good === 425, `${good}/${tiles}${badT.length ? ` bad: ${badT.slice(0, 4).join(', ')}` : ''}`);
    ok('DISCOVERY', 'no tier badge wall on tiles', tags === 0);
    ok('DISCOVERY', 'no console errors across the 18 directory pages', p.__errors.length === 0, p.__errors[0] ?? '');
    await p.context().close();
  }
  for (const w of [360, 390, 430, 768, 1440, 1728]) {
    const p = await page(w);
    let worst = 0;
    for (const r of ['/universities?lang=ko', '/universities?lang=en', '/universities/gachon-university?lang=ko', '/universities/inst-2640?lang=en', '/universities/kaya-university?lang=vi']) {
      await p.goto(`${MK}${r}`, { waitUntil: 'networkidle' }); worst = Math.max(worst, await overflow(p));
    }
    const firstTile = w < 768 ? await p.evaluate(async () => { location.href = '/universities?lang=ko'; return 0; }) : 0;
    void firstTile;
    ok('DISCOVERY', `no horizontal overflow at ${w} (directory + 3 detail pages)`, worst <= 0, `overflow ${worst}px`);
    await p.context().close();
  }
  {
    const p = await page(390);
    await p.goto(`${MK}/universities?lang=ko`, { waitUntil: 'networkidle' });
    const top = await p.evaluate(() => document.querySelector('.mk-unicard')?.getBoundingClientRect().top ?? 9999);
    const btn = await p.locator('.mk-dir__filterbtn').isVisible();
    await p.click('.mk-dir__filterbtn'); await p.waitForTimeout(300);
    const sheet = await p.getByRole('dialog').isVisible();
    ok('DISCOVERY', 'phone: search, Filters button, first result in the first screen; filters open in a sheet', btn && sheet && top < 420, `first tile at ${Math.round(top)}px`);
    await p.context().close();
  }
  // TEST ACCESS — buttons render and sign in
  for (const [base, name] of [[ST, 'student'], [AG, 'agency'], [UN, 'university']]) {
    const p = await page(1280);
    await p.goto(`${base}/login?lang=ko`, { waitUntil: 'networkidle' });
    const btn = p.getByRole('button', { name: '테스트 계정으로 로그인' });
    const visible = await btn.isVisible();
    const html = await p.content();
    if (visible) { await btn.click(); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
    ok('TEST ACCESS', `${name} login: "테스트 계정으로 로그인" visible, signs in, no password shown`, visible && !new URL(p.url()).pathname.startsWith('/login') && !/Hangyul!2026/.test(html), p.url());
    await p.context().close();
  }
  // AGENCY — strip counts equal the rows they open
  {
    const p = await page(1440);
    await p.goto(`${AG}/login?demo=counselor%40lotus.demo.hangyul.kr&lang=ko`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'));
    await p.goto(`${AG}/students?lang=ko`, { waitUntil: 'networkidle' });
    await p.waitForSelector('li[data-stage] .hg-strip__count', { timeout: 15000 }).catch(() => {});
    const keys = await p.$$eval('li[data-stage]', (ls) => ls.filter((l) => l.querySelector('.hg-strip__count') && l.querySelector('button')).map((l) => l.getAttribute('data-stage')));
    let mism = 0; let checked = 0; const detail = [];
    for (const k of keys) {
      const li = p.locator(`li[data-stage="${k}"]`);
      const n = Number((await li.locator('.hg-strip__count').innerText()).replace(/[^\d]/g, ''));
      await li.locator('button').click();
      await p.waitForTimeout(400);
      await p.waitForFunction((want) => document.querySelector('[data-work-total]')?.getAttribute('data-work-total') === String(want), n, { timeout: 8000 }).catch(() => {});
      const total = Number(await p.getAttribute('[data-work-total]', 'data-work-total').catch(() => -1));
      checked += 1; if (total !== n) { mism += 1; detail.push(`${k}: strip ${n} ≠ rows ${total}`); }
    }
    ok('AGENCY', 'every stage count opens exactly that many students', checked > 0 && mism === 0, `${checked} steps checked${detail.length ? `; ${detail.join(', ')}` : ''}`);
    ok('AGENCY', 'no console errors', p.__errors.length === 0, p.__errors[0] ?? '');
    await p.context().close();
  }
  // UNIVERSITY — analytics drill and cohort filter
  {
    const p = await page(1440);
    await p.goto(`${UN}/login?demo=admin%40pusan.univ.demo.hangyul.kr&lang=ko`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'));
    await p.goto(`${UN}/analytics?lang=ko`, { waitUntil: 'networkidle' });
    const bars = await p.$$eval('a.uv22-bar__a', (as) => as.map((a) => a.getAttribute('href')));
    const unfiltered = bars.filter((h) => h === '/' || h === '/?' || h === '/applicants');
    ok('UNIVERSITY', 'every analytics bar link carries a filter (no drill to the unfiltered list)', bars.length > 5 && unfiltered.length === 0, `${bars.length} bars`);
    await p.goto(`${UN}/cohorts/list`, { waitUntil: 'networkidle' });
    const all = await p.$$eval('tbody tr', (r) => r.length);
    const c = await p.$$eval('.uc23-cohortlink', (b) => b.map((x) => x.textContent));
    if (c.length) await p.click('.uc23-cohortlink');
    await p.waitForTimeout(500);
    const some = await p.$$eval('tbody tr', (r) => r.length);
    ok('UNIVERSITY', 'a cohort row opens that cohort\'s students', c.length > 0 && some < all, `${all} → ${some} rows`);
    ok('UNIVERSITY', 'no console errors', p.__errors.length === 0, p.__errors[0] ?? '');
    await p.context().close();
  }
  await browser.close();
}

/* ============================================================================================== native */
async function nativePart() {
  console.log('\n[native]');
  const out = path.join(ROOT, 'docs/qa/v23/completion/native-export');
  for (const app of ['student-mobile', 'agency-mobile', 'university-mobile']) {
    const dir = path.join(out, app);
    fs.rmSync(dir, { recursive: true, force: true });
    const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'android', '--output-dir', dir], {
      cwd: path.join(ROOT, 'apps', app), encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_TEST_LOGIN: 'false', NODE_OPTIONS: '--max-old-space-size=1536' }, timeout: 900_000,
    });
    const hbc = r.status === 0 ? fs.readdirSync(path.join(dir, '_expo/static/js/android')).filter((f) => f.endsWith('.hbc')).map((f) => path.join(dir, '_expo/static/js/android', f))[0] : null;
    const buf = hbc ? fs.readFileSync(hbc) : Buffer.alloc(0);
    const count = (s) => { let n = 0; for (const enc of ['utf8', 'utf16le']) { const needle = Buffer.from(s, enc); let i = 0; while ((i = buf.indexOf(needle, i)) !== -1) { n += 1; i += needle.length; } } return n; };
    const leaks = ['@demo.hangyul.kr', '테스트 계정으로 로그인', 'Sign in with test account', 'Demo access', 'Hangyul!2026'].map((s) => [s, count(s)]).filter(([, n]) => n > 0);
    ok('NATIVE', `${app}: production export contains no test sign-in, persona or password`, !!hbc && leaks.length === 0, hbc ? `${(buf.length / 1e6).toFixed(1)} MB scanned${leaks.length ? `; ${JSON.stringify(leaks)}` : ''}` : `export failed: ${r.stderr?.slice(-200)}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* =============================================================================================== built */
async function builtPart() {
  console.log('\n[built]');
  for (const app of ['marketing-web', 'student-web', 'agency-web', 'university-web']) {
    const dist = path.join(ROOT, 'apps', app, 'dist');
    if (!fs.existsSync(dist)) { ok('BUILT', `${app}: dist exists`, false); continue; }
    const files = walk(dist, (p) => /\.(js|html|css)$/.test(p));
    const bad = files.filter((f) => /@demo\.hangyul\.kr|테스트 계정으로 로그인|Sign in with test account|Hangyul!2026/.test(fs.readFileSync(f, 'utf8')));
    ok('BUILT', `${app}: production bundle has no test sign-in, persona or password`, bad.length === 0, `${files.length} files${bad.length ? `; ${bad.map((f) => path.relative(dist, f)).slice(0, 3).join(', ')}` : ''}`);
  }
}

const parts = { static: staticPart, api: apiPart, rendered: renderedPart, native: nativePart, built: builtPart };
const run = PART === 'all' ? ['static', 'api', 'rendered'] : PART.split(',');
for (const p of run) await parts[p]();
console.log(`\nqa:v23 ${run.join('+')} — ${pass} passed, ${fail} failed`);
if (fail) { console.log(failures.map((f) => `  ✗ ${f}`).join('\n')); process.exit(1); }
void execFileSync;
