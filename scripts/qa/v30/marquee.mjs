/**
 * V30 marquee interaction gate — `npm run qa:v30-marquee` (brief Parts 9, 10, 49).
 *
 * The V14 gate (`v14-marquee-details.mjs`) passed for sixteen passes while five of every six visible crests
 * were dead, because it read hrefs from the DOM and *filtered `[inert]` out first*: it only measured the copies
 * that worked. This gate measures what a visitor meets: every crest instance that is actually on screen, at
 * several points of the loop, hit-tested and clicked at its real visible centre.
 *
 * Per locale (ko en vi zh-Hans ar) × width (1440, 390):
 *   1. pause all three rows at 0 / 25 / 50 / 75 % of their own loop;
 *   2. enumerate every rendered crest instance whose box intersects the visible row;
 *   3. for each: the href is `/universities/<its own slug>` + the locale policy (ko: no `?lang`, else `?lang=<l>`);
 *      `data-university`, href slug and the canonical manifest agree; never `#`, `/universities` or empty;
 *   4. hit-test: `elementFromPoint` at the visible centre AND at four inset points of the artwork resolves to
 *      this very anchor (catches inert copies, overlays, masks, z-index, pointer-events);
 *   5. hitbox: the anchor's rect covers the whole artwork rect and spans ≥ 90 % of the slot pitch;
 *   6. a REAL `page.mouse.click()` at the visible centre; a capture-phase listener records which anchor received
 *      the click and cancels it, so ~100 instance clicks don't cost ~100 navigations.
 * Then per locale, for each of the 23 universities, one real unintercepted click → URL, locale, page heading,
 * scroll at top, API record exists; Back returns home.
 * Reduced motion (ko + ar, 1440 + 390): exactly 23 crests visible, every one hit-tests and clicks to its page.
 * Keyboard/a11y: exactly 23 crest links are tabbable; no tabbable element inside an aria-hidden subtree;
 * every canonical link has an accessible name that contains the university name.
 *
 * Exits 1 on any failure. Writes docs/qa/v30/marquee/{instances.json,summary.json,*.png}.
 *
 *   BASE=http://localhost:4630 node scripts/qa/v30/marquee.mjs     (production preview — see scripts/qa/v30/serve.sh)
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4630';
const OUT = process.env.OUT ?? 'docs/qa/v30/marquee';
const LOCALES = (process.env.LOCALES ?? 'ko,en,vi,zh-Hans,ar').split(',');
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const FRACS = [0, 0.25, 0.5, 0.75];
const manifest = JSON.parse(fs.readFileSync('apps/marketing-web/src/media/universities.json', 'utf8'));
const bySlug = new Map(manifest.map((m) => [m.slug, m]));
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => { failures.push(msg); if (failures.length <= 40) console.log('  FAIL', msg); };
const expectedSearch = (loc) => (loc === 'ko' ? '' : `?lang=${loc}`);
const instances = [];
const destinations = [];

// 0. Data: every manifest crest names a real register record. The page heading uses the register's names,
// which can differ from the crest's display alias (카이스트 → 한국과학기술원), so expected names come from the API.
const names = new Map();
for (const m of manifest) {
  if (!m.slug || !m.registry_id) fail(`manifest ${m.file}: missing slug/registry_id`);
  const r = await fetch(`${BASE}/api/v1/directory/institutions/${m.slug}`);
  if (r.status !== 200) { fail(`manifest ${m.file}: /directory/institutions/${m.slug} → ${r.status}`); continue; }
  const rec = await r.json();
  names.set(m.slug, [m.name_ko, m.name_en, rec.name_ko, rec.name_en].filter(Boolean));
}

const browser = await chromium.launch();

async function openHome(ctx, loc) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`[${loc}] page error: ${e.message}`));
  // Always enter with an explicit ?lang= (the test browser is en-US, so a bare `/` would be English); links then
  // follow the site's policy: the default `ko` carries no parameter, every other locale carries `?lang=`.
  await page.goto(`${BASE}/?lang=${loc}`, { waitUntil: 'networkidle' });
  await page.locator('.kn-crests').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.kn-crest__img')].every((i) => i.complete));
  await page.evaluate(() => {
    // Real click, cancelled before the router sees it — recorded per click.
    window.__clicked = [];
    window.addEventListener('click', (e) => {
      if (!window.__intercept) return;
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      window.__clicked.push(a ? { href: a.getAttribute('href'), slug: a.dataset.university ?? null } : null);
      e.preventDefault(); e.stopPropagation();
    }, true);
  });
  return page;
}

const pauseAt = (page, frac) => page.evaluate((f) => document.querySelectorAll('.kn-marquee__track').forEach((t) => {
  for (const a of t.getAnimations()) { a.pause(); a.currentTime = f * a.effect.getComputedTiming().duration; }
}), frac);

/** Every crest instance whose box is inside the row's visible window, with geometry and hit-test results. */
const survey = (page) => page.evaluate(() => [...document.querySelectorAll('.kn-crests .kn-marquee')].flatMap((row, ri) => {
  const rr = row.getBoundingClientRect();
  const all = [...row.querySelectorAll('a.kn-crest, .kn-crest')];
  return all.map((a, idx) => {
    const r = a.getBoundingClientRect();
    const img = a.querySelector('img'); const ir = img?.getBoundingClientRect();
    if (!ir || ir.width === 0) return null;
    // "Visible": at least half the artwork is inside the row window (the mask fades the outer 5 %).
    const visW = Math.min(ir.right, rr.right) - Math.max(ir.left, rr.left);
    if (visW < ir.width * 0.5 || ir.bottom < 0 || ir.top > innerHeight) return null;
    const cx = (Math.max(ir.left, rr.left) + Math.min(ir.right, rr.right)) / 2, cy = ir.top + ir.height / 2;
    const hitAt = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === a || a.contains(h)); };
    const insetX = Math.min(6, ir.width / 4), insetY = Math.min(6, ir.height / 4);
    const pts = [[cx, cy], [Math.max(ir.left, rr.left) + insetX, ir.top + insetY], [Math.min(ir.right, rr.right) - insetX, ir.top + insetY],
      [Math.max(ir.left, rr.left) + insetX, ir.bottom - insetY], [Math.min(ir.right, rr.right) - insetX, ir.bottom - insetY]];
    const hits = pts.map(([x, y]) => hitAt(x, y));
    const gapHalf = parseFloat(getComputedStyle(a).paddingInlineStart) || 0;
    return {
      row: ri + 1, instance: idx, tag: a.tagName, slug: a.dataset.university ?? null, href: a.getAttribute('href'),
      ariaHidden: a.getAttribute('aria-hidden'), tabIndex: a.tabIndex, label: a.getAttribute('aria-label'),
      inert: !!a.closest('[inert]'), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      art: { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height) },
      covers: r.left <= ir.left + 0.5 && r.right >= ir.right - 0.5 && r.top <= ir.top + 0.5 && r.bottom >= ir.bottom - 0.5,
      slotRatio: (r.width) / (ir.width + 2 * gapHalf || 1), hits, click: { x: cx, y: cy },
    };
  }).filter(Boolean);
}));

for (const loc of LOCALES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 } });
    const page = await openHome(ctx, loc);
    for (const frac of FRACS) {
      await pauseAt(page, frac);
      await page.waitForTimeout(120);
      const list = await survey(page);
      if (list.length < 3 * (w < 768 ? 2 : 6)) fail(`[${loc}@${w} ${frac * 100}%] only ${list.length} visible crests — survey broken?`);
      await page.evaluate(() => { window.__intercept = true; window.__clicked = []; });
      for (const it of list) {
        const where = `[${loc}@${w} ${frac * 100}%] row ${it.row} #${it.instance} ${it.slug}`;
        const m = bySlug.get(it.slug);
        if (it.tag !== 'A' || !it.href) fail(`${where}: not a link`);
        if (!m) fail(`${where}: data-university "${it.slug}" not in the canonical manifest`);
        const want = `/universities/${it.slug}${expectedSearch(loc)}`;
        if (it.href !== want) fail(`${where}: href ${it.href} ≠ ${want}`);
        if (/^#|^\/universities\/?(\?|$)/.test(it.href ?? '#')) fail(`${where}: fallback destination ${it.href}`);
        if (it.inert) fail(`${where}: inert (pointer passes through)`);
        if (!it.hits[0]) fail(`${where}: visible centre does not hit its own link (overlay / inert / pointer-events)`);
        if (it.hits.filter(Boolean).length < 5) fail(`${where}: ${5 - it.hits.filter(Boolean).length}/5 artwork points dead`);
        if (!it.covers) fail(`${where}: link rect does not cover the artwork`);
        if (it.slotRatio < 0.9) fail(`${where}: hitbox spans ${(it.slotRatio * 100).toFixed(0)} % of the slot`);
        const before = await page.evaluate(() => window.__clicked.length);
        await page.mouse.click(it.click.x, it.click.y);
        const got = await page.evaluate((n) => window.__clicked[n] ?? 'none', before);
        it.clickResult = got === 'none' ? 'NO_CLICK' : got === null ? 'NOT_A_LINK' : got.slug === it.slug ? 'OK' : `WRONG:${got.slug}`;
        it.localeResult = it.href === want ? 'OK' : 'LOST';
        if (it.clickResult !== 'OK') fail(`${where}: real click → ${it.clickResult}`);
        instances.push({ locale: loc, width: w, loop: frac, ...it });
      }
      await page.evaluate(() => { window.__intercept = false; });
      if (w === 1440 && (loc === 'ko' || loc === 'ar')) {
        const box = await page.locator('.kn-crests').boundingBox();
        await page.screenshot({ path: `${OUT}/marquee-${loc}-${w}-${frac * 100}.png`, clip: box });
      }
      // Hover must not shift the hitbox; the row pauses under the pointer.
    }

    // Keyboard / accessibility tree.
    const a11y = await page.evaluate(() => {
      const crests = [...document.querySelectorAll('.kn-crests a.kn-crest')];
      const tabbable = crests.filter((a) => a.tabIndex >= 0 && !a.closest('[aria-hidden="true"]'));
      const hiddenTabbable = [...document.querySelectorAll('.kn-crests [aria-hidden="true"] a, .kn-crests a[aria-hidden="true"]')].filter((a) => a.tabIndex >= 0);
      return { total: crests.length, tabbable: tabbable.length, slugs: new Set(tabbable.map((a) => a.dataset.university)).size,
        hiddenTabbable: hiddenTabbable.length, unlabelled: tabbable.filter((a) => !(a.getAttribute('aria-label') ?? '').trim()).map((a) => a.dataset.university),
        labels: tabbable.map((a) => [a.dataset.university, a.getAttribute('aria-label')]) };
    });
    if (a11y.tabbable !== manifest.length || a11y.slugs !== manifest.length) fail(`[${loc}@${w}] ${a11y.tabbable} tabbable crest links / ${a11y.slugs} universities (want ${manifest.length} each)`);
    if (a11y.hiddenTabbable) fail(`[${loc}@${w}] ${a11y.hiddenTabbable} tabbable links inside aria-hidden`);
    if (a11y.unlabelled.length) fail(`[${loc}@${w}] unlabelled: ${a11y.unlabelled.join(',')}`);
    for (const [slug, label] of a11y.labels) {
      const m = bySlug.get(slug); const name = loc === 'ko' ? m?.name_ko : m?.name_en;
      if (!label?.includes(name)) fail(`[${loc}@${w}] ${slug}: label "${label}" lacks "${name}"`);
      if (/logo|crest|image|로고|\d+$/i.test(label?.replace(name, '') ?? '')) fail(`[${loc}@${w}] ${slug}: meaningless label "${label}"`);
    }

    // Real navigations — once per university per locale (desktop), at a non-zero loop position.
    if (w === WIDTHS[0]) {
      for (const m of manifest) {
        await pauseAt(page, 0.4);
        // Click whichever instance of this university is visibly on screen (canonical or repeat).
        const target = (await survey(page)).find((x) => x.slug === m.slug && x.hits[0]);
        const res = { locale: loc, slug: m.slug, instance: target?.instance ?? null };
        if (!target) {
          // Not on screen at 40 %: scroll the loop until it is.
          let found = null;
          for (const f of [0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9]) {
            await pauseAt(page, f); found = (await survey(page)).find((x) => x.slug === m.slug && x.hits[0]); if (found) break;
          }
          if (!found) { fail(`[${loc}] ${m.slug}: never visible on screen`); continue; }
          res.instance = found.instance; res.click = found.click;
        } else res.click = target.click;
        await page.mouse.click(res.click.x, res.click.y);
        try { await page.waitForURL((u) => u.pathname === `/universities/${m.slug}`, { timeout: 8000 }); } catch { /* checked below */ }
        await page.waitForLoadState('networkidle');
        // The detail route is lazy: the URL changes a moment before its heading replaces the home page's.
        await page.waitForFunction((n) => [...document.querySelectorAll('h1')].some((h) => n.some((x) => h.innerText.includes(x))),
          names.get(m.slug) ?? [m.name_ko], { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(150);
        const at = await page.evaluate(() => ({ path: location.pathname, search: location.search, y: Math.round(scrollY),
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          h1: document.querySelector('h1')?.innerText.trim() ?? '', err: !!document.querySelector('[data-state="error"], .hg-error, .mk-404') }));
        res.lang = at.lang; res.dir = at.dir;
        if (at.lang !== loc) fail(`[${loc}] ${m.slug}: detail page rendered in "${at.lang}"`);
        if (loc === 'ar' && at.dir !== 'rtl') fail(`[ar] ${m.slug}: detail page not RTL`);
        res.url = at.path + at.search; res.h1 = at.h1; res.scrollY = at.y;
        res.ok = at.path === `/universities/${m.slug}` && at.search === expectedSearch(loc) && !at.err
          && (names.get(m.slug) ?? []).some((n) => at.h1.includes(n)) && at.y < 4;
        if (!res.ok) fail(`[${loc}] ${m.slug}: → ${res.url} h1="${at.h1}" scrollY=${at.y}`);
        destinations.push(res);
        await page.goBack(); await page.waitForURL((u) => u.pathname === '/');
        await page.locator('.kn-crests').scrollIntoViewIfNeeded();
      }
    }
    await ctx.close();
  }
}

// Reduced motion: the static grid — exactly one of each, every one live.
for (const loc of ['ko', 'ar']) for (const w of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, reducedMotion: 'reduce' });
  const page = await openHome(ctx, loc);
  await page.waitForTimeout(200);
  const list = await survey(page);
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  if (docW > w) fail(`[reduced ${loc}@${w}] page overflows: ${docW}px`);
  const slugs = new Set(list.map((x) => x.slug));
  // The static grid may extend below the fold — scroll each row into view and re-survey to count all.
  const total = await page.evaluate(() => [...document.querySelectorAll('.kn-crests a.kn-crest')].filter((a) => a.checkVisibility()).length);
  if (total !== manifest.length) fail(`[reduced ${loc}@${w}] ${total} crests displayed (want ${manifest.length}, no duplicates)`);
  await page.evaluate(() => { window.__intercept = true; });
  for (let row = 1; row <= 3; row++) {
    await page.locator('.kn-crests .kn-marquee').nth(row - 1).scrollIntoViewIfNeeded();
    for (const it of (await survey(page)).filter((x) => x.row === row)) {
      const where = `[reduced ${loc}@${w}] row ${row} ${it.slug}`;
      if (!it.hits[0] || !it.covers) fail(`${where}: not hittable`);
      if (it.href !== `/universities/${it.slug}${expectedSearch(loc)}`) fail(`${where}: href ${it.href}`);
      const before = await page.evaluate(() => window.__clicked.length);
      await page.mouse.click(it.click.x, it.click.y);
      const got = await page.evaluate((n) => window.__clicked[n] ?? 'none', before);
      if (got?.slug !== it.slug) fail(`${where}: real click → ${JSON.stringify(got)}`);
      slugs.add(it.slug);
      instances.push({ locale: loc, width: w, loop: 'reduced-motion', ...it, clickResult: got?.slug === it.slug ? 'OK' : 'FAIL' });
    }
  }
  if (slugs.size !== manifest.length) fail(`[reduced ${loc}@${w}] reached ${slugs.size}/${manifest.length} universities`);
  if (w === 1440) await page.screenshot({ path: `${OUT}/marquee-reduced-${loc}-${w}.png`, clip: await page.locator('.kn-crests').boundingBox() });
  await ctx.close();
}
await browser.close();

const animated = instances.filter((i) => i.loop !== 'reduced-motion');
const summary = {
  base: BASE, at: new Date().toISOString(), locales: LOCALES, widths: WIDTHS, loopPositions: FRACS,
  manifest: manifest.length,
  instancesTested: animated.length, instanceClicksOk: animated.filter((i) => i.clickResult === 'OK').length,
  repeatInstancesTested: animated.filter((i) => i.ariaHidden === 'true').length,
  reducedMotionTested: instances.length - animated.length,
  destinations: destinations.length, destinationsOk: destinations.filter((d) => d.ok).length,
  failures: failures.length,
};
fs.writeFileSync(`${OUT}/instances.json`, JSON.stringify(instances, null, 1));
fs.writeFileSync(`${OUT}/destinations.json`, JSON.stringify(destinations, null, 1));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ ...summary, failureList: failures }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(failures.length ? `qa:v30-marquee: FAIL — ${failures.length} problems` : 'qa:v30-marquee: OK');
process.exit(failures.length ? 1 : 0);
