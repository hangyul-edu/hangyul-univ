// `npm run qa:v24` — the V24 visual & experience gate (REPORT §298, brief Part M).
//
//   node scripts/qa/v24-gate.mjs [--part static|api|rendered|all]
//
// static    CTA hierarchy in source, V24 CSS uses tokens (no literal type sizes), 33-market completeness of every V24 key,
//           media files / rights / no cross-university reuse (coverage CSV --check), Yonsei is Sinchon, production
//           test-access exclusion still wired (V23 invariants)
// api       425 detail routes answer; no gate-created account sits on a demo agency roster
// rendered  tangerine→white in every state (cta-contrast.mjs), homepage CTA routes, the browse secondary, the pricing
//           disclosure by keyboard, directory cards (5 facts, no credit outside the picture, aligned rows), detail pages
//           (one closing action, no orphan gallery row, no broken image), the agency strip (empty stages static),
//           university drill-downs, 390-px overflow in long-word locales
//
// Exit code 0 only when every check that ran passed. Student/agency/university regression lives in qa:v19–v23.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARG = process.argv.slice(2);
const PART = ARG.includes('--part') ? ARG[ARG.indexOf('--part') + 1] : 'all';
const API = 'http://localhost:8001/api/v1';
const MK = 'http://localhost:3100';
const AG = 'http://localhost:3102';
const UN = 'http://localhost:3103';

let pass = 0; let fail = 0; const failures = [];
const ok = (section, name, cond, evidence = '') => {
  if (cond) { pass += 1; console.log(`  PASS  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`); }
  else { fail += 1; failures.push(`${section} · ${name}`); console.log(`  FAIL  ${section} · ${name}${evidence ? ` — ${evidence}` : ''}`); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flat(v, q, out); else out[q] = v; } return out; };
const { MARKET_LOCALES } = await import(path.join(ROOT, 'scripts/i18n/v23/markets.mjs'));
const bundle = (loc, ns) => { const p = path.join(ROOT, 'packages/i18n/locales', loc, `${ns}.json`); return fs.existsSync(p) ? flat(JSON.parse(fs.readFileSync(p, 'utf8'))) : {}; };
const node = (args) => spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });

/* =============================================================================================== static */
function staticPart() {
// V26 (REPORT §347, GATE_CHANGES G-CSS): the version layers were merged into src/styles/*.css; each source keeps a
// `── from <file>` marker, so a check about one layer still reads exactly that layer.
const layer = (file, from) => { const s = read(file); const i = s.indexOf(`── from ${from} `); if (i < 0) return ''; const j = s.indexOf('── from ', i + 8); return s.slice(i, j < 0 ? undefined : j); };
  console.log('\n[static]');
  const v11 = read('apps/marketing-web/src/pages/home/v11.tsx');
  ok('CTA', '"대학 전체 보기" is the designed secondary (kn-btn--browse), not a filled button', /className="kn-btn kn-btn--browse"/.test(v11) && !/kn-btn--browse[^"]*kn-btn--primary/.test(v11));
  const css = layer('apps/marketing-web/src/styles/site.css', 'v24.css');
  const browse = css.slice(css.indexOf('.kn-btn--browse {'), css.indexOf('}', css.indexOf('.kn-btn--browse {')));
  ok('CTA', 'browse secondary: ≥48 px, ink border, white fill', /min-height: (4[89]|5\d)px/.test(browse) && /border: 1\.5px solid var\(--hg-text\)/.test(browse) && /background: #fff/.test(browse));
  ok('CTA', 'browse secondary motion is off under prefers-reduced-motion', /prefers-reduced-motion: reduce[\s\S]*kn-btn--browse/.test(css));
  const pricing = read('apps/marketing-web/src/pages/home/pricing.tsx');
  ok('CTA', 'plan comparison is a native <details> with a mirrored aria-expanded and an open/close label',
    /<details className="kn-compare"/.test(pricing) && /aria-expanded=\{open\}/.test(pricing) && /v24\.pricing\.compare\.close/.test(pricing));
  const layout = read('apps/marketing-web/src/components/SiteLayout.tsx');
  ok('CTA', 'closing band: the primary is the same size as its secondary', /<AccountAction size="lg" \/>/.test(layout));
  ok('CTA', 'in-product primary uses → (↗ only for external links)', !/ArrowUpRight/.test(layout));
  const detail = read('apps/marketing-web/src/pages/UniversityDetail.tsx');
  ok('DETAIL', 'detail page suppresses the site band (one closing action)', /useNoClosingCta\(\)/.test(detail));
  ok('DETAIL', 'gallery capped at five with a per-count composition', /\.slice\(0, 5\)/.test(detail) && /hg-uni-gal--n\$\{gallery\.length\}/.test(detail));
  ok('DETAIL', 'facts are said once (why-points suppress repeats below)', /const said = new Set/.test(detail));

  // Design system: V24 CSS names tokens, not pixel sizes.
  const v24css = [['apps/marketing-web/src/styles/site.css', 'v24.css'], ['apps/student-web/src/styles/app.css', 'v24.css']];
  const literal = v24css.flatMap(([f, from]) => [...layer(f, from).matchAll(/font-size:\s*[\d.]+px/g)].map((m) => `${f}: ${m[0]}`));
  ok('TOKENS', 'V24 stylesheets set no literal font sizes', literal.length === 0, literal.slice(0, 3).join('; '));
  ok('TOKENS', 'type roles are generated (--hg-type-display … caption)', ['display', 'h1', 'h2', 'h3', 'body', 'small', 'caption'].every((r) => read('packages/design-tokens/tokens.css').includes(`--hg-type-${r}:`)));

  // Localization: every V24 key in all 33 markets, same placeholders as English, never English-identical.
  const patches = ['scripts/i18n/v24/keys-ko-en.json'].map((p) => JSON.parse(read(p)));
  const keys = patches.flatMap((p) => Object.entries(p).flatMap(([ns, ks]) => Object.keys(ks).map((k) => [ns, k])));
  const ph = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
  const bad = [];
  for (const [ns, k] of keys) {
    const en = bundle('en', ns)[k];
    for (const l of MARKET_LOCALES) {
      const v = bundle(l, ns)[k];
      if (!v) bad.push(`${l}:${k} missing`);
      else if (ph(v) !== ph(en)) bad.push(`${l}:${k} placeholders`);
      else if (l !== 'en' && v === en) bad.push(`${l}:${k} = English`);
      else if (v.length > Math.max(60, en.length * 2.6)) bad.push(`${l}:${k} length ${v.length}`);
    }
  }
  ok('L10N', `${keys.length} V24 keys × ${MARKET_LOCALES.length} markets: present, placeholders intact, no English leakage, sane length`, bad.length === 0, bad.slice(0, 4).join('; ') || `${keys.length * MARKET_LOCALES.length} strings`);

  // Media.
  const records = JSON.parse(read('server/app/data/university_content.json')).records;
  const yon = records['yonsei-university'].media;
  ok('MEDIA', 'Yonsei leads with the Sinchon campus; no Mirae photograph is shown unlabelled', /20230624|underwood/i.test(yon.hero.asset) && ![yon.hero, ...yon.gallery].some((a) => /mirae|wonju/i.test(a.asset)));
  ok('MEDIA', 'Kwangwoon no longer leads with an ice rink', !/rink|skat/i.test(JSON.stringify(records['kwangwoon-university'].media.hero)) && records['kwangwoon-university'].media.hero.asset !== JSON.parse(read('docs/qa/v24/photo-review/university_content.before-swaps.json')).records['kwangwoon-university'].media.hero.asset);
  const cov = node(['scripts/qa/v24/media-coverage.mjs', '--check']);
  const sum = (cov.stdout.match(/^\{.*\}$/m) || ['{}'])[0];
  ok('MEDIA', 'coverage CSV: 425 rows, every file present, rights metadata on every photo, no cross-university asset, every fallback has a logged search', /EXIT=0/.test(cov.stdout), sum);

  // V23 invariants that V24 touched files near.
  const app = read('packages/ui/src/app.tsx');
  ok('V32', 'no test sign-in in web or native (feature removed)', !/VITE_DEMO_LOGINS|devaccess/.test(app) && !/TEST_LOGIN|TestAccountSignIn/.test(read('packages/mobile-ui/src/bootstrap/LoginScreen.tsx')));
  ok('V23', 'server env still fails closed (default production)', /production/.test(read('server/app/core/config.py')) && /_normalise_env/.test(read('server/app/core/config.py')));
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
  ok('DIRECTORY', '425 institution detail routes answer 200', items.length === 425 && codes.every((c) => c === 200), `${codes.filter((c) => c === 200).length}/${items.length}`);
  const q = spawnSync('psql', ['-h', 'localhost', '-U', 'hangyul', '-d', 'hangyul_univ', '-Atc',
    "select count(*) from users where email like 'native-%@example.com' or email like 'qa-v22-%@example.com' or email like 'v21pay+%@demo.hangyul.kr' or email like 'e2e-%@example.com'"],
  { env: { ...process.env, PGPASSWORD: 'hangyul_dev' }, encoding: 'utf8' });
  ok('HYGIENE', 'no gate-created account remains in the demo data (purge runs after every release check)', q.stdout.trim() === '0', `${q.stdout.trim() || q.stderr.trim()} left`);
}

/* ============================================================================================= rendered */
async function renderedPart() {
  console.log('\n[rendered]');
  const cta = node(['scripts/qa/v24/cta-contrast.mjs', '--json', 'docs/qa/v24/logs/cta-contrast.json']);
  ok('CTA', 'tangerine fill → white text and icon, every state, all four products', /EXIT=0/.test(cta.stdout), (cta.stdout.match(/CTA rule: [^\n]+/) || [''])[0]);
  const selfTest = node(['scripts/qa/v24/cta-contrast.mjs', '--self-test']);
  ok('CTA', 'the contrast check catches a planted violation (positive control)', /caught/.test(selfTest.stdout));

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));

  // Home.
  await p.goto(`${MK}/?lang=ko`, { waitUntil: 'networkidle' });
  const hero = await p.locator('.kn-hero [data-cta="primary"], .kn-hero .kn-btn--primary').first().getAttribute('href');
  ok('HOME', 'hero primary leads to /start (signed out)', /\/start/.test(hero ?? ''), hero);
  const browse = p.locator('.kn-btn--browse');
  await browse.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  const bb = await browse.boundingBox();
  const bs = await browse.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, border: c.borderTopWidth + ' ' + c.borderTopColor }; });
  ok('HOME', '"대학 전체 보기": ≥48 px tall, unfilled, visible border, → /universities', bb.height >= 48 && /255, 255, 255/.test(bs.bg) && parseFloat(bs.border) >= 1 && /\/universities$/.test(await browse.getAttribute('href') ?? ''), `${Math.round(bb.height)}px ${bs.border}`);
  const filledHome = await p.evaluate(() => [...document.querySelectorAll('main a, main button')].filter((e) => { const c = getComputedStyle(e).backgroundColor.match(/\d+/g)?.map(Number) ?? []; return c[0] > 180 && c[1] > 50 && c[1] < 110 && c[2] < 40; }).map((e) => e.textContent.trim()));
  ok('HOME', 'filled tangerine controls in the page body are only 유학 준비 actions and the recommended plan', filledHome.every((x) => /유학 준비|올인원/.test(x)), filledHome.join(' · '));
  // Pricing disclosure, by keyboard.
  const sum = p.locator('.kn-compare__toggle');
  await sum.scrollIntoViewIfNeeded(); await sum.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const opened = await sum.getAttribute('aria-expanded');
  const matrixVisible = await p.locator('#plan-compare .kn-compare__body').isVisible();
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('PRICING', 'comparison opens and closes by keyboard; aria-expanded follows', opened === 'true' && matrixVisible && (await sum.getAttribute('aria-expanded')) === 'false');
  const sb = await sum.boundingBox();
  ok('PRICING', 'the disclosure is a contained control (≥48 px, not full-width at desktop)', sb.height >= 48 && sb.width < 700, `${Math.round(sb.width)}×${Math.round(sb.height)}`);

  // Directory.
  await p.goto(`${MK}/universities?lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.mk-unicard');
  const cards = await p.evaluate(() => [...document.querySelectorAll('.mk-unicard')].slice(0, 24).map((c) => ({
    facts: [...c.querySelectorAll('.mk-unicard__body > *')].length,
    creditOutside: !!c.querySelector('.mk-unicard__body .hg-uni-credit'),
    bottom: Math.round(c.querySelector('.mk-unicard__visual').getBoundingClientRect().height),
    img: [...c.querySelectorAll('img')].every((i) => !i.complete || i.naturalWidth > 0),
  })));
  ok('DIRECTORY', 'cards carry name · other-script name · region/type only — no credit line under the picture', cards.every((c) => !c.creditOutside && c.facts <= 3), `${cards.length} cards`);
  ok('DIRECTORY', 'every card image on the first screens loads', cards.every((c) => c.img));
  ok('DIRECTORY', 'card pictures share one height (aligned rows)', new Set(cards.map((c) => c.bottom)).size === 1);

  // Detail pages: the 14 majors + a sample of changed and identity-only ones.
  const sample = ['seoul-national-university', 'yonsei-university', 'korea-university', 'kaist', 'sungkyunkwan-university', 'hanyang-university', 'sogang-university', 'kyung-hee-university', 'chung-ang-university', 'ewha-womans-university', 'pusan-national-university', 'kyungpook-national-university', 'pohang-university-of-science-and-technology', 'hankuk-university-of-foreign-studies', 'kwangwoon-university', 'inst-2640'];
  const det = [];
  for (const s of sample) {
    const r = await p.goto(`${MK}/universities/${s}?lang=ko`, { waitUntil: 'networkidle' });
    if (r?.status() >= 400) { det.push({ s, status: r.status() }); continue; }
    for (let y = 0; y < 8; y += 1) { await p.mouse.wheel(0, 900); await p.waitForTimeout(60); }
    await p.waitForTimeout(500);
    det.push(await p.evaluate((slug) => {
      const tiles = [...document.querySelectorAll('.hg-uni-gal > li')].map((li) => li.getBoundingClientRect());
      const rows = [...new Set(tiles.map((t) => Math.round(t.top)))];
      const lastRow = tiles.filter((t) => Math.round(t.top) === rows[rows.length - 1]);
      const gal = document.querySelector('.hg-uni-gal');
      const orphan = !!gal && tiles.length > 1 && lastRow.length === 1 && lastRow[0].width < gal.getBoundingClientRect().width * 0.6 && rows.length > 1 && !tiles.some((t) => t.height > lastRow[0].height * 1.5 && Math.round(t.top) < Math.round(lastRow[0].top) && t.bottom >= lastRow[0].bottom - 2);
      return {
        s: slug, closing: document.querySelectorAll('.hg-uni-cta .kn-btn--primary').length, band: document.querySelectorAll('.kn-cta').length,
        orphan, broken: [...document.querySelectorAll('main img, article img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.split('/').pop()),
      };
    }, s));
  }
  ok('DETAIL', `${sample.length} detail pages: one closing action and no second CTA band`, det.every((d) => d.closing === 1 && d.band === 0), det.filter((d) => d.closing !== 1 || d.band).map((d) => d.s).join(' ') || 'all');
  ok('DETAIL', 'no orphan tile in any gallery', det.every((d) => !d.orphan), det.filter((d) => d.orphan).map((d) => d.s).join(' '));
  ok('DETAIL', 'no broken image on any sampled detail page', det.every((d) => !d.broken?.length), det.filter((d) => d.broken?.length).map((d) => `${d.s}:${d.broken[0]}`).join(' '));

  // Phone overflow in long-word locales.
  const over = [];
  for (const loc of ['ko', 'de', 'ru', 'my', 'vi']) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c.addInitScript((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* */ } }, loc);
    const q = await c.newPage();
    for (const r of ['/', '/universities', '/universities/yonsei-university']) {
      await q.goto(`${MK}${r}?lang=${loc}`, { waitUntil: 'networkidle' });
      const w = await q.evaluate(() => document.documentElement.scrollWidth);
      if (w > 392) over.push(`${loc}${r}:${w}`);
    }
    await c.close();
  }
  ok('MOBILE', 'no horizontal overflow at 390 px (ko/de/ru/my/vi × home, directory, detail)', over.length === 0, over.join(' '));

  // Agency strip: empty stages are not offered as filters; counts still equal rows (V22/V23 gates check parity).
  const a = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ap = await a.newPage();
  await ap.goto(`${AG}/login?demo=${encodeURIComponent('counselor@lotus.demo.hangyul.kr')}&lang=ko`, { waitUntil: 'networkidle' });
  await ap.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await ap.goto(`${AG}/students?lang=ko`, { waitUntil: 'networkidle' });
  await ap.waitForSelector('li[data-stage] .hg-strip__count', { timeout: 15000 }).catch(() => {});
  const strip = await ap.evaluate(() => [...document.querySelectorAll('li[data-stage]')].map((l) => ({ n: Number(l.querySelector('.hg-strip__count')?.textContent.replace(/\D/g, '') || -1), button: !!l.querySelector('button') })));
  ok('AGENCY', 'empty stages are shown but not clickable; non-empty ones are', strip.length > 0 && strip.every((s) => (s.n === 0 ? !s.button : s.button)), strip.map((s) => `${s.n}${s.button ? '' : '·'}`).join(' '));
  const chips = await ap.evaluate(() => [...new Set([...document.querySelectorAll('td .badge')].map((b) => [...b.classList].find((c) => c.startsWith('bg-')) ?? ''))]);
  ok('AGENCY', 'stage chips use neutral / outcome colours only (no tangerine "primary" tint)', !chips.includes('bg-primary-transparent'), chips.join(' '));
  await a.close();

  // University: analytics bars drill down; status chips neutral for in-progress states.
  const u = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const up = await u.newPage();
  await up.goto(`${UN}/login?demo=${encodeURIComponent('admin@pusan.univ.demo.hangyul.kr')}&lang=ko`, { waitUntil: 'networkidle' });
  await up.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await up.goto(`${UN}/analytics?lang=ko`, { waitUntil: 'networkidle' }); await up.waitForTimeout(1200);
  const drill = await up.evaluate(() => ({ links: document.querySelectorAll('main a[href*="/applicants"], main a[href*="?"], main a[href*="/cohorts"]').length, donut: document.querySelectorAll('[class*="donut"], [class*="pie"]').length }));
  ok('UNIVERSITY', 'analytics: drill-down links present, no donut/pie', drill.links >= 10 && drill.donut === 0, `${drill.links} links`);
  await up.goto(`${UN}/?lang=ko`, { waitUntil: 'networkidle' }); await up.waitForTimeout(800);
  const uchips = await up.evaluate(() => [...new Set([...document.querySelectorAll('.uv7-status')].map((b) => [...b.classList].find((c) => c.startsWith('bg-')) ?? ''))]);
  ok('UNIVERSITY', 'status chips: no tangerine/purple tint for in-progress states', !uchips.some((c) => /primary|purple/.test(c)), uchips.join(' '));
  await u.close();

  ok('RUNTIME', 'no uncaught page error on the marketing walk', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
}

if (PART === 'static' || PART === 'all') staticPart();
if (PART === 'api' || PART === 'all') await apiPart();
if (PART === 'rendered' || PART === 'all') await renderedPart();
console.log(`\nqa:v24 ${PART} — ${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`EXIT=${fail ? 1 : 0}`);
process.exit(fail ? 1 : 0);
