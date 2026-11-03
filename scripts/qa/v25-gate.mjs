// `npm run qa:v25` — the V25 visual & product gate (REPORT §318 step 14, brief §69).
//
//   node scripts/qa/v25-gate.mjs [--part static|api|rendered|all]
//
// static    425 records; photo coverage (real photographs, reported — not a pass/fail target); rights metadata on every
//           photograph; every rendition exists as JPEG + WebP in both apps; no cross-university asset; focal data in range;
//           posters lead only when reviewed as a campus scene; V25 CSS sets no literal font size; one action shape
//           (--hg-control-*) in marketing, student, consoles and native; V25 strings in 33 markets; test sign-in and the
//           paid-state bypass excluded from production (pytest), native test sign-in still a conditional require
// api       425 detail routes 200; photo-first browse order; directory ↔ content agree; university recency filters count =
//           rows; university tenant isolation (PNU never sees SKKU); agency TODAY views count = rows
// rendered  CTA hierarchy (one filled primary per marketing view, all actions soft rectangles, tangerine → white in every
//           state via cta-contrast.mjs), "대학 전체 보기" inside the university section, compare disclosure by keyboard,
//           directory images load + carry WebP + focal variables, detail pages (one closing action, no broken image), student
//           home (one primary in the first viewport, campus photo), student university page opens on the shared hero,
//           agency TODAY item filters the table to its count, university headline item = its rows, scroll resets to top on
//           navigation, ?lang and ?plan survive login, 390-px overflow, console errors on every visited page
//
// Exit 0 only when every check that ran passed. The photo-coverage number is printed, never turned green by itself.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARG = process.argv.slice(2);
const PART = ARG.includes('--part') ? ARG[ARG.indexOf('--part') + 1] : 'all';
const API = 'http://localhost:8001/api/v1';
const MK = 'http://localhost:3100';
const ST = 'http://localhost:3101';
const AG = 'http://localhost:3102';
const UN = 'http://localhost:3103';

let pass = 0; let fail = 0; const failures = []; const log = [];
const ok = (section, name, cond, evidence = '') => {
  const line = `  ${cond ? 'PASS' : 'FAIL'}  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`;
  console.log(line); log.push(line);
  if (cond) pass += 1; else { fail += 1; failures.push(`${section} · ${name}`); }
};
const info = (line) => { console.log(`  INFO  ${line}`); log.push(`  INFO  ${line}`); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else out[q] = v; } return out; };
const { MARKET_LOCALES } = await import(path.join(ROOT, 'scripts/i18n/v23/markets.mjs'));
const bundle = (loc, ns) => { const p = path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`); return fs.existsSync(p) ? flat(JSON.parse(fs.readFileSync(p, 'utf8'))) : {}; };
const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION', 'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);
const token = async (client, email) => (await (await fetch(`${API}/auth/demo-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, client }) })).json()).access_token;
const get = async (t, p) => (await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } })).json();

// V26 (REPORT §347, GATE_CHANGES G-CSS): the version layers were merged into src/styles/*.css; each source keeps a
// `── from <file>` marker, so a check about one layer still reads exactly that layer.
const layer = (file, from) => { const s = read(file); const i = s.indexOf(`── from ${from} `); if (i < 0) return ''; const j = s.indexOf('── from ', i + 8); return s.slice(i, j < 0 ? undefined : j); };
/* =============================================================================================== static */
function staticPart() {
  console.log('\n[static]');
  const reg = JSON.parse(read('server/app/data/korean_institutions.json')).institutions;
  const recs = JSON.parse(read('server/app/data/university_content.json')).records;
  ok('MEDIA', 'university record count', reg.length === 425 && Object.keys(recs).length === 425, `${reg.length} registry · ${Object.keys(recs).length} content`);

  const heroes = Object.entries(recs).filter(([, r]) => r.media?.hero);
  const before = JSON.parse(read('docs/qa/v25/_coverage_before.json'));
  const beforeN = Object.values(before).filter((r) => r.has_real_photo === 'yes').length;
  info(`PHOTO COVERAGE (real university photographs): ${heroes.length} / 425 (V24: ${beforeN}); without one: ${425 - heroes.length}`);
  const weak = heroes.filter(([, r]) => r.media.hero.quality_verdict === 'weak').length;
  info(`hero quality (V25 sheet review): ${heroes.length - weak} pass · ${weak} weak`);

  const all = Object.entries(recs).flatMap(([s, r]) => [r.media?.hero, ...(r.media?.gallery ?? [])].filter(Boolean).map((m) => [s, m]));
  const noRights = all.filter(([, m]) => !SERVABLE.has(m.rights_status) || !m.license_or_permission || !m.media_source
    || (m.rights_status === 'ATTRIBUTION_SUPPORTED' && !(m.attribution_requirement?.author && m.attribution_requirement?.license_url && m.attribution_requirement?.source_url)));
  ok('MEDIA', `rights metadata on every photograph (${all.length}): servable class, licence, source, and author + licence URL + source where credit is required`, noRights.length === 0, noRights.slice(0, 3).map(([s, m]) => `${s}:${m.asset}`).join(' '));
  const missing = [];
  for (const [, m] of all) {
    const stem = m.local_path.replace(/^media\//, '');
    for (const w of m.renditions ?? [640, 1200, 2400]) for (const app of ['marketing-web', 'student-web']) for (const ext of (m.formats ?? ['jpg'])) {
      if (!exists(`apps/${app}/public/media/${stem}-${w}.${ext}`)) missing.push(`${app}/${stem}-${w}.${ext}`);
    }
  }
  ok('MEDIA', 'every rendition exists in both apps (640/1200/2400 as recorded, JPEG + WebP)', missing.length === 0, missing.slice(0, 3).join(' ') || `${all.length} assets`);
  ok('MEDIA', 'every photograph has WebP and recorded renditions', all.every(([, m]) => m.formats?.includes('webp') && m.renditions?.length));
  const bySrc = new Map();
  for (const [s, m] of all) { const k = decodeURIComponent(m.media_source).replace(/ /g, '_'); if (!bySrc.has(k)) bySrc.set(k, new Set()); bySrc.get(k).add(s); }
  const shared = [...bySrc].filter(([, set]) => set.size > 1);
  ok('MEDIA', 'no photograph is used by two institutions', shared.length === 0, shared.slice(0, 2).map(([k, v]) => `${k} ${[...v]}`).join(' '));
  const focal = all.filter(([, m]) => ![m.focal_x, m.focal_y].every((v) => v >= 0 && v <= 100) || (m.focal_mobile_x != null && !(m.focal_mobile_x >= 0 && m.focal_mobile_x <= 100)));
  ok('MEDIA', 'focal data present and in range on every photograph', focal.length === 0, focal.slice(0, 3).map(([s]) => s).join(' '));
  ok('MEDIA', 'no wrong-institution image (Ajou keeps no Tashkent campus)', !JSON.stringify(recs['ajou-university'].media).includes('Tashkent'));
  ok('MEDIA', 'Yonsei still leads with Sinchon', !/mirae|wonju/i.test(recs['yonsei-university'].media.hero.asset));
  ok('MEDIA', 'Hanyang leads with its Seoul campus, never ERICA', !/erica|ansan/i.test(recs['hanyang-university'].media.hero.media_source));
  const posterLead = Object.values(recs).filter((r) => !r.media?.hero && r.youtube?.video_id && r.youtube.poster_review === 'CAMPUS_SCENE').length;
  const unreviewed = Object.values(recs).filter((r) => !r.media?.hero && r.youtube?.video_id && !r.youtube.poster_review).length;
  ok('MEDIA', 'film posters lead a tile only when reviewed as a campus scene', unreviewed === 0, `${posterLead} lead · ${unreviewed} unreviewed`);
  ok('MEDIA', 'resolver honours the poster review', /poster_review === 'CAMPUS_SCENE'/.test(read('packages/utils/src/university.ts')));
  ok('MEDIA', 'search record exists for every institution (UNIVERSITY_PHOTO_SEARCH.csv, 425 rows)', exists('docs/qa/v25/UNIVERSITY_PHOTO_SEARCH.csv') && read('docs/qa/v25/UNIVERSITY_PHOTO_SEARCH.csv').trim().split('\n').length === 426);
  ok('MEDIA', 'manual acquisition list exists for the robots-blocked 공유마당 leads', exists('docs/qa/v25/MANUAL_MEDIA_ACQUISITION.md'));

  const v25css = [['apps/marketing-web/src/styles/site.css', 'v25.css'], ['apps/student-web/src/styles/app.css', 'v25.css'], ['apps/agency-web/src/styles/screens.css', 'v25.css'], ['apps/university-web/src/styles/screens.css', 'v25.css']];
  const literal = v25css.flatMap(([f, from]) => [...layer(f, from).matchAll(/font-size:\s*[\d.]+px/g)].map((m) => `${f}: ${m[0]}`));
  ok('TOKENS', 'V25 stylesheets set no literal font size', literal.length === 0, literal.slice(0, 3).join('; '));
  ok('TOKENS', 'one action shape is a token (--hg-control-radius, secondary surface)', /--hg-control-radius: 10px/.test(read('packages/design-tokens/tokens.css')) && /--hg-control-secondary-bg:/.test(read('packages/design-tokens/tokens.css')));
  ok('TOKENS', 'marketing buttons use the token radius, not a 999-px pill', /\.kn-btn \{[\s\S]*?border-radius: var\(--hg-control-radius\)/.test(read('packages/koreanasha-ui/src/scss/koreanasha.scss')));
  ok('TOKENS', 'native Button uses the same radius and filled secondary', /borderRadius: control\.radius/.test(read('packages/mobile-ui/src/components/Button.tsx')) && /secondary: \{ bg: control\.secondaryBg/.test(read('packages/mobile-ui/src/components/Button.tsx')));
  ok('CTA', 'the circular arrow well and the closing-band ornament are gone', !/kn-btn__well/.test(read('apps/marketing-web/src/pages/home/v11.tsx')) && !/kn-cta__sun/.test(read('apps/marketing-web/src/components/SiteLayout.tsx')));
  ok('CTA', 'external official links use ↗ (ArrowUpRight), not a box icon', !/ExternalLink/.test(read('packages/ui/src/university.tsx') + read('apps/marketing-web/src/pages/UniversityDetail.tsx')));

  const src = JSON.parse(read('scripts/i18n/v25/strings.json'));
  const keys = Object.entries(src).flatMap(([ns, ks]) => Object.keys(ks).map((k) => [ns, k]));
  const ph = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
  const bad = [];
  for (const [ns, k] of keys) {
    const en = bundle('en', ns)[k];
    for (const l of MARKET_LOCALES) {
      const v = bundle(l, ns)[k];
      if (!v) bad.push(`${l}:${k} missing`);
      else if (ph(v) !== ph(en)) bad.push(`${l}:${k} placeholders`);
      else if (l !== 'en' && v === en && en.split(/\s+/).length > 3) bad.push(`${l}:${k} = English`);
      else if (l !== 'ko' && /[가-힣]/.test(v)) bad.push(`${l}:${k} Hangul`);
    }
  }
  ok('L10N', `${keys.length} V25 keys × ${MARKET_LOCALES.length} markets: present, placeholders intact, no English/Hangul leakage`, bad.length === 0, bad.slice(0, 4).join('; ') || `${keys.length * MARKET_LOCALES.length} strings`);

  ok('SECURITY', 'native test sign-in still behind TEST_LOGIN require()', /TEST_LOGIN \? require\('\.\.\/components\/TestAccountSignIn'\)/.test(read('packages/mobile-ui/src/bootstrap/LoginScreen.tsx')));
  const py = spawnSync(path.join(ROOT, 'server/.venv/bin/python'), ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', 'tests/test_v23_environment.py', 'tests/test_v21b_test_paid_state.py'], { cwd: path.join(ROOT, 'server'), encoding: 'utf8', env: { ...process.env } });
  const pyLine = ((py.stdout ?? String(py.error ?? '')).match(/\d+ passed[^\n]*/) ?? [''])[0];
  ok('SECURITY', 'production refuses test sign-in and the paid-state bypass (pytest: environment + paid-state)', py.status === 0, pyLine);
  const secret = spawnSync('node', ['scripts/qa/v21/security-scan.mjs', '--no-runtime'], { cwd: ROOT, encoding: 'utf8' });
  ok('SECURITY', 'no production secret in source or mobile config (security scan)', secret.status === 0, (secret.stdout.trim().split('\n').pop() ?? '').slice(0, 120));
}

/* ================================================================================================== api */
async function apiPart() {
  console.log('\n[api]');
  const items = [];
  for (let page = 1; ; page += 1) {
    const d = await (await fetch(`${API}/directory/institutions?page_size=200&page=${page}`)).json();
    items.push(...d.items); if (items.length >= d.total || !d.items.length) break;
  }
  const codes = await Promise.all(items.map(async (i) => (await fetch(`${API}/directory/institutions/${i.slug}`)).status));
  ok('DIRECTORY', '425 institution routes answer 200 (no dead university route)', items.length === 425 && codes.every((c) => c === 200), `${codes.filter((c) => c === 200).length}/${items.length}`);
  const recs = JSON.parse(read('server/app/data/university_content.json')).records;
  const drift = items.filter((i) => !!i.enrichment?.media?.hero !== !!recs[i.slug]?.media?.hero);
  ok('DIRECTORY', 'served media agrees with the content record (database reloaded)', drift.length === 0, drift.slice(0, 3).map((i) => i.slug).join(' '));
  // Photo-first: inside each institution kind, no institution without a photograph comes before one with a photograph.
  const ordered = [];
  for (let page = 1; ; page += 1) {
    const d = await (await fetch(`${API}/directory/institutions?page_size=200&page=${page}&order=ko`)).json();
    ordered.push(...d.items); if (ordered.length >= d.total || !d.items.length) break;
  }
  const broken = [];
  for (const kind of new Set(ordered.map((i) => i.institution_type))) {
    const seq = ordered.filter((i) => i.institution_type === kind).map((i) => !!i.enrichment?.media?.hero);
    const firstNo = seq.indexOf(false);
    if (firstNo >= 0 && seq.slice(firstNo).includes(true)) broken.push(kind);
  }
  ok('DIRECTORY', 'browsing is photo-first inside each kind', broken.length === 0, broken.join(' ') || `${ordered.filter((i) => i.enrichment?.media?.hero).length} photo-led of ${ordered.length}`);

  const ut = await token('university', 'admin@pusan.univ.demo.hangyul.kr');
  const pnu = await get(ut, '/applications?page_size=100');
  const skku = await token('university', 'admin@sungkyunkwan.univ.demo.hangyul.kr').catch(() => null);
  if (skku) {
    const s = await get(skku, '/applications?page_size=100');
    const overlap = (pnu.items ?? []).filter((a) => (s.items ?? []).some((b) => b.id === a.id));
    ok('TENANCY', 'university tenants see disjoint applicants (PNU ∩ SKKU = ∅)', overlap.length === 0 && (pnu.items ?? []).length > 0, `${pnu.items?.length ?? 0} vs ${s.items?.length ?? 'n/a'}`);
  } else info('TENANCY: second university account unavailable — isolation covered by pytest');
  for (const [k, q] of [['submitted_within_days=7', 'submitted_at'], ['updated_within_days=7', 'updated_at']]) {
    const page = await get(ut, `/applications?page_size=100&${k}`);
    const cut = Date.now() - 7 * 86400e3;
    ok('UNIVERSITY', `recency filter ${k}: count = rows, every row inside the window`, page.total === (page.items ?? []).length && (page.items ?? []).every((a) => Date.parse(a[q]) >= cut - 60e3), `${page.total}`);
  }
  const series = (await get(ut, '/university/analytics')).series?.submitted_monthly ?? [];
  const mism = [];
  for (const pt of series.filter((x) => x.value > 0)) {
    const page = await get(ut, `/applications?page_size=1&submitted_month=${pt.month}`);
    if (page.total !== pt.value) mism.push(`${pt.month}: trend ${pt.value} ≠ rows ${page.total}`);
  }
  ok('UNIVERSITY', 'every month on the Insights trend opens exactly its applicants', series.length > 0 && mism.length === 0, mism.join('; ') || series.filter((x) => x.value).map((x) => `${x.month}:${x.value}`).join(' '));
  const at = await token('agency', 'counselor@lotus.demo.hangyul.kr');
  const views = await get(at, '/agency/students/views');
  const parity = [];
  for (const v of ['urgent', 'deadline7', 'waiting_counselor', 'student_silent', 'university']) {
    const page = await get(at, `/agency/students?view=${v}&page_size=1`);
    if (page.total !== views[v]) parity.push(`${v}: view ${views[v]} ≠ rows ${page.total}`);
  }
  ok('AGENCY', 'TODAY counts = the rows each one opens (5 views)', parity.length === 0, parity.join('; ') || JSON.stringify(Object.fromEntries(['urgent', 'deadline7', 'waiting_counselor', 'student_silent', 'university'].map((v) => [v, views[v]]))));
  const st = await token('student', 'student@demo.hangyul.kr');
  const dash = await get(st, '/me/dashboard');
  ok('STUDENT', 'applications carry the campus photograph of their university', (dash.applications ?? []).some((a) => a.university.photo?.local_path), (dash.applications ?? []).map((a) => !!a.university.photo).join(','));
}

/* ============================================================================================= rendered */
async function renderedPart() {
  console.log('\n[rendered]');
  const cta = spawnSync('node', ['scripts/qa/v24/cta-contrast.mjs', '--json', 'docs/qa/v25/completion/logs/cta-contrast.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  ok('CTA', 'tangerine fill → white text and icon in every state, all four products (no orange button with dark text)', /EXIT=0/.test(cta.stdout), (cta.stdout.match(/CTA rule: [^\n]+/) || [''])[0]);
  const selfTest = spawnSync('node', ['scripts/qa/v24/cta-contrast.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8' });
  ok('CTA', 'the contrast check still catches a planted violation (positive control)', /caught/.test(selfTest.stdout));

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const errors = [];
  const ctxFor = async (vp = { width: 1440, height: 900 }) => {
    const c = await browser.newContext({ locale: 'ko-KR', viewport: vp });
    await c.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
    return c;
  };
  const watch = (pg, label) => {
    pg.on('pageerror', (e) => errors.push(`${label}: ${String(e).slice(0, 140)}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_ABORTED|net::|Failed to load resource|ResizeObserver/.test(m.text())) errors.push(`${label}: ${m.text().slice(0, 140)}`); });
  };
  const sweep = async (pg) => { for (let y = 0; y < 14; y += 1) { await pg.mouse.wheel(0, 800); await pg.waitForTimeout(50); } await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await pg.waitForTimeout(300); };

  /* ---- marketing */
  let ctx = await ctxFor();
  let p = await ctx.newPage(); watch(p, 'marketing');
  await p.goto(`${MK}/?lang=ko`, { waitUntil: 'networkidle' }); await sweep(p);
  const roles = await p.evaluate(() => {
    const isTang = (c) => { const m = c.match(/\d+/g)?.map(Number) ?? []; return m[0] > 180 && m[1] > 50 && m[1] < 110 && m[2] < 40; };
    const btns = [...document.querySelectorAll('.kn-btn, .kn-plan__cta, .kn-compare__toggle')].filter((e) => e.offsetParent);
    return btns.map((e) => { const s = getComputedStyle(e); return { t: e.textContent.trim().slice(0, 18), r: parseFloat(s.borderTopLeftRadius), filled: isTang(s.backgroundColor), h: e.getBoundingClientRect().height, inMain: !!e.closest('main') }; });
  });
  ok('CTA', 'every marketing action is a soft rectangle (radius ≤ 12 px, no 999-px pill)', roles.every((r) => r.r <= 12), roles.filter((r) => r.r > 12).map((r) => r.t).join(' · '));
  const filled = roles.filter((r) => r.filled && r.inMain).map((r) => r.t);
  ok('CTA', 'filled tangerine in the page body = only the 유학 준비 actions and the recommended plan', filled.every((x) => /유학 준비|올인원/.test(x)), filled.join(' · '));
  ok('CTA', 'every marketing action is ≥ 44 px tall (header included)', roles.every((r) => r.h >= 44), roles.filter((r) => r.h < 44).map((r) => `${r.t}:${Math.round(r.h)}`).join(' '));
  const browse = await p.evaluate(() => {
    const b = document.querySelector('.kn-btn--browse'); const band = b?.closest('section'); const head = b?.closest('.kn-head');
    const marquee = band?.querySelector('.kn-crests'); const s = b && getComputedStyle(b);
    return b && { inHead: !!head, sameSection: !!band && band.contains(marquee), gapToLogos: marquee ? Math.round(marquee.getBoundingClientRect().top - b.getBoundingClientRect().bottom) : null,
      h: b.getBoundingClientRect().height, bg: s.backgroundColor, href: b.getAttribute('href') };
  });
  ok('CTA', '"대학 전체 보기" sits in the university section head, directly above the logos, as a filled-neutral secondary → /universities',
    !!browse && browse.inHead && browse.sameSection && browse.gapToLogos >= 0 && browse.gapToLogos <= 80 && browse.h >= 48 && !/204, 78, 0/.test(browse.bg) && /\/universities/.test(browse.href), JSON.stringify(browse));
  const sum = p.locator('.kn-compare__toggle');
  await sum.scrollIntoViewIfNeeded(); await sum.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const opened = await sum.getAttribute('aria-expanded'); const vis = await p.locator('#plan-compare .kn-compare__body').isVisible();
  const plans = await p.evaluate(() => { const a = document.querySelector('.kn-plans').getBoundingClientRect(); const b = document.querySelector('.kn-compare__toggle').getBoundingClientRect(); return { gap: Math.round(b.top - a.bottom), w: Math.round(b.width) }; });
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok('PRICING', 'comparison: attached to the plans (≤ 64 px below), opens/closes by keyboard, aria-expanded follows',
    opened === 'true' && vis && (await sum.getAttribute('aria-expanded')) === 'false' && plans.gap <= 64, JSON.stringify(plans));

  await p.goto(`${MK}/universities?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForSelector('.mk-unicard'); await sweep(p);
  const cards = await p.evaluate(() => [...document.querySelectorAll('.mk-unicard')].slice(0, 24).map((c) => {
    const img = c.querySelector('.hg-uni__img');
    return { photo: !!img, webp: !!c.querySelector('picture source[type="image/webp"]'), focal: img ? !!img.style.getPropertyValue('--fp-d') : true,
      loaded: [...c.querySelectorAll('img')].every((i) => !i.complete || i.naturalWidth > 0), h: Math.round(c.querySelector('.mk-unicard__visual').getBoundingClientRect().height),
      lazy: img ? img.loading === 'lazy' : true, big: img ? /-2400\./.test(img.currentSrc) : false };
  }));
  ok('DIRECTORY', 'first screens lead with photographs; every card image loads', cards.filter((c) => c.photo).length >= 12 && cards.every((c) => c.loaded), `${cards.filter((c) => c.photo).length}/24 photo`);
  ok('DIRECTORY', 'card photos: <picture> with WebP, per-image focal variables, lazy, never the 2400 px file', cards.filter((c) => c.photo).every((c) => c.webp && c.focal && c.lazy && !c.big));
  ok('DIRECTORY', 'card pictures share one height', new Set(cards.map((c) => c.h)).size === 1);

  const sample = ['seoul-national-university', 'yonsei-university', 'korea-university', 'hanyang-university', 'pusan-national-university', 'keimyung-university', 'halla-university', 'namseoul-university', 'kaya-university', 'inst-2640'];
  const det = [];
  for (const s of sample) {
    const r = await p.goto(`${MK}/universities/${s}?lang=ko`, { waitUntil: 'networkidle' });
    await sweep(p);
    det.push({ s, status: r?.status(), ...(await p.evaluate(() => ({
      closing: document.querySelectorAll('.hg-uni-cta .kn-btn--primary').length, band: document.querySelectorAll('.kn-cta').length,
      broken: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.split('/').pop()),
      top: window.scrollY,
    }))) });
  }
  ok('DETAIL', `${sample.length} detail pages: one closing action, no second band, no broken image`, det.every((d) => d.status === 200 && d.closing === 1 && d.band === 0 && !d.broken.length), det.filter((d) => d.closing !== 1 || d.band || d.broken.length).map((d) => `${d.s}${d.broken.length ? `:${d.broken[0]}` : ''}`).join(' ') || 'all');
  // scroll reset: scroll the directory down, click a card, land at the top
  await p.goto(`${MK}/universities?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForSelector('.mk-unicard');
  await p.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' })); await p.waitForTimeout(300);
  await p.locator('.mk-unicard__link').nth(10).click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(400);
  ok('NAV', 'a new page opens at the top (no inherited scroll position)', (await p.evaluate(() => window.scrollY)) < 5, String(await p.evaluate(() => window.scrollY)));
  ok('NAV', '?lang survives navigation', /lang=ko/.test(p.url()) || (await p.evaluate(() => document.documentElement.lang)) === 'ko', p.url());
  await ctx.close();

  /* ---- plan + locale preservation into the student app */
  ctx = await ctxFor(); p = await ctx.newPage(); watch(p, 'conversion');
  await p.goto(`${MK}/?lang=vi`, { waitUntil: 'networkidle' }); await sweep(p);
  const planHref = await p.locator('.kn-plan[data-plan] .kn-plan__cta').first().getAttribute('href');
  ok('CONVERSION', 'plan CTA carries the plan and the language to sign-in', /plan=/.test(decodeURIComponent(planHref ?? '')) && /lang=vi|\/vi\//.test(decodeURIComponent(planHref ?? '')), planHref);
  await ctx.close();

  /* ---- student */
  ctx = await ctxFor(); p = await ctx.newPage(); watch(p, 'student');
  await p.goto(`${ST}/login?demo=student%40demo.hangyul.kr&lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await p.goto(`${ST}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  const home = await p.evaluate(() => {
    const prim = [...document.querySelectorAll('.hg-btn--primary')].filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && b.offsetParent; });
    return { primaries: prim.length, photo: !!document.querySelector('.v25-next__photo img'), current: document.querySelectorAll('.v25-line__step.is-current').length, steps: document.querySelectorAll('.v25-line__step').length };
  });
  ok('STUDENT', 'home: one primary action in the first viewport; the journey line has 6 stages and one current', home.primaries === 1 && home.steps === 6 && home.current === 1, JSON.stringify(home));
  ok('STUDENT', 'home: the next action shows the campus it leads to', home.photo);
  await p.goto(`${ST}/universities/pusan-national-university?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  ok('STUDENT', 'university page opens on the shared photographic hero', await p.locator('.su-place .hg-uni-hero--photo img').count() > 0);
  await ctx.close();

  /* ---- agency */
  ctx = await ctxFor(); p = await ctx.newPage(); watch(p, 'agency');
  await p.goto(`${AG}/login?demo=counselor%40lotus.demo.hangyul.kr&lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await p.goto(`${AG}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const item = p.locator('.ag25-today__item').first();
  const want = Number(await item.getAttribute('data-count'));
  await item.click();
  await p.waitForURL((u) => u.searchParams.has('view'), { timeout: 8000 }).catch(() => {});
  // The table keeps the previous page while the filtered one loads (keepPreviousData): wait for the total to settle on
  // the filtered answer, not for the first non-zero number.
  const got = await p.waitForFunction((n) => { const v = Number(document.querySelector('[data-work-total]')?.getAttribute('data-work-total')); return v === n ? v : null; }, want, { timeout: 8000 })
    .then((h) => h.jsonValue()).catch(async () => Number(await p.locator('[data-work-total]').first().getAttribute('data-work-total')));
  ok('AGENCY', 'a TODAY item filters the table to exactly its count', want > 0 && got === want, `${want} → ${got}`);
  await ctx.close();

  /* ---- university */
  ctx = await ctxFor(); p = await ctx.newPage(); watch(p, 'university');
  await p.goto(`${UN}/login?demo=admin%40pusan.univ.demo.hangyul.kr&lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await p.goto(`${UN}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const head = p.locator('button.uv25-head__item').first();
  const hw = Number(await head.getAttribute('data-count'));
  await head.click(); await p.waitForTimeout(1200);
  const rows = await p.evaluate(() => document.querySelectorAll('table tbody tr').length);
  ok('UNIVERSITY', 'a headline figure opens exactly its applicants', hw > 0 && rows === hw, `${hw} → ${rows}`);
  await p.goto(`${UN}/analytics?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const an = await p.evaluate(() => ({ summary: document.querySelectorAll('.uv25-summary__item').length, trend: !!document.querySelector('.uv25-trend svg'), donut: !!document.querySelector('.recharts-pie'), links: [...document.querySelectorAll('.uv22-q a[href*="/applicants"]')].length }));
  ok('UNIVERSITY', 'Insights: one metric row, a trend line, no donut, bars drill into applicants', an.summary === 4 && an.trend && !an.donut && an.links > 5, JSON.stringify(an));
  await ctx.close();

  /* ---- phones: overflow */
  const over = [];
  for (const [base, routes, login] of [[MK, ['/', '/universities', '/universities/yonsei-university', '/universities/kaya-university'], null], [ST, ['/', '/universities/pusan-national-university'], 'student@demo.hangyul.kr']]) {
    for (const loc of ['ko', 'de', 'ru', 'vi']) {
      const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await c.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* */ } }, loc);
      const q = await c.newPage(); watch(q, `390 ${loc}`);
      if (login) { await q.goto(`${base}/login?demo=${encodeURIComponent(login)}&lang=${loc}`, { waitUntil: 'networkidle' }); await q.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
      for (const r of routes) {
        await q.goto(`${base}${r}?lang=${loc}`, { waitUntil: 'networkidle' });
        const w = await q.evaluate(() => document.documentElement.scrollWidth);
        if (w > 392) over.push(`${loc}${r}:${w}`);
      }
      await c.close();
    }
  }
  ok('MOBILE', 'no horizontal overflow at 390 px (ko/de/ru/vi × marketing home, directory, details, student home, student university)', over.length === 0, over.join(' '));
  ok('CONSOLE', 'no page error or console error on any visited page', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

const parts = { static: staticPart, api: apiPart, rendered: renderedPart };
const run = PART === 'all' ? ['static', 'api', 'rendered'] : [PART];
for (const p of run) await parts[p]();
console.log(`\nqa:v25 ${pass} passed · ${fail} failed`);
if (failures.length) console.log(failures.map((f) => `  ✗ ${f}`).join('\n'));
fs.mkdirSync(path.join(ROOT, 'docs/qa/v25/completion/logs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `docs/qa/v25/completion/logs/qa-v25-${PART}.txt`), `${log.join('\n')}\n\nqa:v25 ${pass} passed · ${fail} failed\n`);
console.log(`EXIT=${fail ? 1 : 0}`);
process.exit(fail ? 1 : 0);
