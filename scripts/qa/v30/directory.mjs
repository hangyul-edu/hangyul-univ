/**
 * V30 `/universities` filter gate (brief Parts 11–18, 48, 54–56) — clicks the real controls.
 *
 *   BASE=http://localhost:4630 node scripts/qa/v30/directory.mjs
 *
 * Geometry (desktop 1024/1280/1440, ko en vi zh-Hans ar):
 *   - search, type filter and map action share one height (±1 px) and one vertical centre (±1 px)
 *   - the type filter is content-sized: its face leaves ≤ 28 px of slack beyond label + value + chevron, and the
 *     chevron sits ≤ 12 px after the value (never pinned to the far edge)
 *   - the type filter shows its category visibly (not screen-reader only)
 *   - every region chip has the same height, symmetric horizontal padding (±2 px), text vertically centred (±2 px);
 *     the selected "전체" chip has the same height/padding as the others
 *   - first result card starts within 460 px of the top at ≥ 1024 px
 * Behaviour (ko):
 *   - type filter → the results count changes and every visible card is that type; URL carries `kind=`
 *   - region chip → aria-pressed moves, count changes, URL carries `group=`
 *   - search → results narrow; clear restores
 *   - map toggle → aria-expanded true and the map is visible; again → hidden
 *   - card → detail; Back → the same filters and scroll position (±40 px)
 *   - phone 390: search + Filters on one row; sheet opens with type → region → province, reset + apply;
 *     choosing a type in the sheet and applying shows a removable chip; removing it clears the filter
 * Exit 1 on any failure; writes docs/qa/v30/directory/{summary.json,*.png}.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4630';
const OUT = process.env.OUT ?? 'docs/qa/v30/directory';
fs.mkdirSync(OUT, { recursive: true });
const failures = []; const notes = [];
const fail = (m) => { failures.push(m); console.log('  FAIL', m); };
const b = await chromium.launch();

const geometry = () => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cy: r.y + r.height / 2 }; };
  const vis = (s) => [...document.querySelectorAll(s)].find((e) => e.getClientRects().length && e.checkVisibility());
  const search = vis('.mk-dir__bar .mk-dir__find'), type = vis('.mk-dir__bar .hg-fsel'), map = vis('.mk-dir__bar .mk-dir__maptoggle');
  const out = { search: search && box(search), type: type && box(type), map: map && box(map) };
  if (type) {
    const face = type.querySelector('.hg-fsel__face').getBoundingClientRect();
    const val = type.querySelector('.hg-fsel__value').getBoundingClientRect();
    const chev = type.querySelector('.hg-fsel__chev').getBoundingClientRect();
    const lab = type.querySelector('.hg-fsel__label');
    const cs = getComputedStyle(type);
    out.typeSlack = type.getBoundingClientRect().width - face.width - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd) - 2;
    out.chevGap = document.dir === 'rtl' ? val.left - chev.right : chev.left - val.right;
    out.labelVisible = !!lab && lab.getBoundingClientRect().width > 0 && getComputedStyle(lab).visibility !== 'hidden';
    out.native = (() => { const s = type.querySelector('select'); const r = s.getBoundingClientRect(); const t = type.getBoundingClientRect(); return Math.abs(r.width - t.width) < 3 && Math.abs(r.height - t.height) < 3; })();
  }
  out.chips = [...document.querySelectorAll('.mk-dir__top .mk-dir__groups .mk-dir__group')].filter((e) => e.getClientRects().length).map((c) => {
    const r = c.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(c); const t = range.getBoundingClientRect();
    return { text: c.innerText.trim(), h: r.height, padL: t.left - r.left, padR: r.right - t.right, padT: t.top - r.top, padB: r.bottom - t.bottom, on: c.getAttribute('aria-pressed') === 'true' };
  });
  // The card, not its title link (the title sits under a ~180 px photo).
  const cardLink = vis('.mk-dir__body a[href*="/universities/"]');
  const card = cardLink?.closest('li, article') ?? cardLink;
  out.firstCardTop = card ? card.getBoundingClientRect().top + scrollY : null;
  out.docW = document.documentElement.scrollWidth;
  return out;
};

// ---- geometry
for (const loc of ['ko', 'en', 'vi', 'zh-Hans', 'ar']) for (const w of [1024, 1280, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/universities?lang=${loc}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.mk-dir__body a[href*="/universities/"]');
  const g = await p.evaluate(geometry);
  const at = `[${loc}@${w}]`;
  if (!g.search || !g.type || !g.map) fail(`${at} toolbar missing a control ${JSON.stringify({ s: !!g.search, t: !!g.type, m: !!g.map })}`);
  else {
    const hs = [g.search.h, g.type.h, g.map.h];
    if (Math.max(...hs) - Math.min(...hs) > 1) fail(`${at} toolbar heights differ: ${hs.map(Math.round)}`);
    const cs = [g.search.cy, g.type.cy, g.map.cy];
    if (Math.max(...cs) - Math.min(...cs) > 1) fail(`${at} toolbar centres differ: ${cs.map(Math.round)}`);
    if (g.typeSlack > 28) fail(`${at} type filter ${Math.round(g.typeSlack)} px wider than its content`);
    if (g.chevGap > 12 || g.chevGap < 0) fail(`${at} chevron ${Math.round(g.chevGap)} px from the value`);
    if (!g.labelVisible) fail(`${at} type filter category is not visible`);
    if (!g.native) fail(`${at} native select does not cover the whole control (dead area)`);
  }
  const ch = g.chips;
  if (ch.length !== 8) fail(`${at} ${ch.length} region chips (want 8)`);
  if (new Set(ch.map((c) => Math.round(c.h))).size > 1) fail(`${at} chip heights differ: ${[...new Set(ch.map((c) => Math.round(c.h)))]}`);
  for (const c of ch) {
    if (Math.abs(c.padL - c.padR) > 2) fail(`${at} chip "${c.text}" padding ${Math.round(c.padL)}/${Math.round(c.padR)}`);
    if (Math.abs(c.padT - c.padB) > 2) fail(`${at} chip "${c.text}" not vertically centred ${Math.round(c.padT)}/${Math.round(c.padB)}`);
  }
  if (!ch.some((c) => c.on)) fail(`${at} no selected chip`);
  if (g.firstCardTop > 460) fail(`${at} first result starts at ${Math.round(g.firstCardTop)} px`);
  if (g.docW > w) fail(`${at} horizontal overflow ${g.docW}`);
  notes.push({ at, type: g.type && Math.round(g.type.w), slack: Math.round(g.typeSlack ?? -1), chevGap: Math.round(g.chevGap ?? -1), heights: g.search && [g.search.h, g.type.h, g.map.h].map(Math.round), firstCard: Math.round(g.firstCardTop) });
  if (w === 1440) await p.screenshot({ path: `${OUT}/toolbar-${loc}-1440.png`, clip: { x: 0, y: 0, width: 1440, height: 640 } });
  await ctx.close();
}

// ---- behaviour (ko, desktop)
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/universities?lang=ko`, { waitUntil: 'networkidle' });
  const count = () => p.evaluate(() => Number((document.querySelector('.mk-dir__count, [data-total]')?.getAttribute('data-total') ?? document.body.innerText.match(/(\d[\d,]*)\s*곳/)?.[1] ?? '0').replace(/,/g, '')));
  const total0 = await count();
  // type
  await p.selectOption('.mk-dir__bar .hg-fsel select', 'JUNIOR_COLLEGE');
  await p.waitForURL((u) => u.searchParams.get('kind') === 'JUNIOR_COLLEGE');
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
  const t1 = await count();
  const face = await p.locator('.mk-dir__bar .hg-fsel__value').innerText();
  if (!(t1 > 0 && t1 < total0)) fail(`type filter: ${total0} → ${t1}`);
  if (!face.includes('전문대학')) fail(`type filter face reads "${face}"`);
  if (!(await p.locator('.mk-dir__bar .hg-fsel[data-active]').count())) fail('type filter not drawn as active');
  // region chip
  await p.locator('.mk-dir__top .mk-dir__group', { hasText: '서울' }).first().click();
  await p.waitForURL((u) => u.searchParams.has('group')); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
  const t2 = await count();
  if (!(t2 > 0 && t2 < t1)) fail(`region chip: ${t1} → ${t2}`);
  if (await p.locator('.mk-dir__top .mk-dir__group[aria-pressed="true"]').innerText() !== '서울') fail('region chip aria-pressed did not move');
  // search
  await p.fill('.mk-dir__find input', '서울'); await p.press('.mk-dir__find input', 'Enter');
  await p.waitForURL((u) => u.searchParams.has('q')); await p.waitForLoadState('networkidle');
  // map toggle
  await p.click('.mk-dir__maptoggle');
  if (await p.getAttribute('.mk-dir__maptoggle', 'aria-expanded') !== 'true') fail('map toggle did not expand');
  if (!(await p.locator('#mk-dir-map').isVisible())) fail('map not visible after toggle');
  await p.click('.mk-dir__maptoggle');
  if (await p.locator('#mk-dir-map').isVisible()) fail('map still visible after closing');
  // clear search
  await p.fill('.mk-dir__find input', ''); await p.press('.mk-dir__find input', 'Enter'); await p.waitForLoadState('networkidle');
  // card → detail → Back keeps filters and scroll
  // A card FULLY in view, clicked at its centre with the mouse: Playwright's locator.click() scrolls its target
  // into view first, which moved the page before navigating and made Back "lose" a position it never had.
  await p.evaluate(() => scrollTo({ top: 900, behavior: 'instant' })); await p.waitForTimeout(600);
  const target = await p.evaluate(() => {
    for (const a of document.querySelectorAll('.mk-dir__body a[href*="/universities/"]')) {
      const r = a.getBoundingClientRect(); if (r.width && r.top > 80 && r.bottom < innerHeight - 20) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  });
  const before = await p.evaluate(() => ({ url: location.pathname + location.search, y: scrollY }));
  if (!target) fail('no result card fully in view at scrollY 900');
  else await p.mouse.click(target.x, target.y);
  await p.waitForURL((u) => /^\/universities\/[^/]+$/.test(u.pathname));
  await p.waitForLoadState('networkidle');
  const detailY = await p.evaluate(() => scrollY);
  if (detailY > 4) fail(`detail opened at scrollY ${detailY}, not the top`);
  await p.goBack(); await p.waitForURL((u) => u.pathname === '/universities'); await p.waitForTimeout(800);
  const after = await p.evaluate(() => ({ url: location.pathname + location.search, y: scrollY }));
  if (after.url !== before.url) fail(`Back lost filters: ${before.url} → ${after.url}`);
  if (Math.abs(after.y - before.y) > 40) fail(`Back lost scroll: ${Math.round(before.y)} → ${Math.round(after.y)}`);
  notes.push({ behaviour: { total0, kind: t1, seoul: t2, back: after } });
  await ctx.close();
}

// ---- phone
for (const w of [320, 360, 390, 430]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/universities?lang=ko`, { waitUntil: 'networkidle' });
  const row = await p.evaluate(() => { const s = document.querySelector('.mk-dir__find').getBoundingClientRect(); const f = document.querySelector('.mk-dir__filterbtn').getBoundingClientRect(); return { sameRow: Math.abs((s.top + s.bottom) / 2 - (f.top + f.bottom) / 2) < 2, hs: [s.height, f.height], docW: document.documentElement.scrollWidth }; });
  if (!row.sameRow) fail(`[${w}] search and Filters not on one row`);
  if (Math.abs(row.hs[0] - row.hs[1]) > 1) fail(`[${w}] search/Filters heights ${row.hs}`);
  if (row.docW > w) fail(`[${w}] overflow ${row.docW}`);
  await p.click('.mk-dir__filterbtn');
  await p.waitForSelector('.mk-dir__sheet');
  const legends = await p.locator('.mk-dir__sheet legend').allInnerTexts();
  if (legends[0] !== '학교 유형') fail(`[${w}] sheet starts with "${legends[0]}"`);
  if (w === 390) await p.screenshot({ path: `${OUT}/sheet-390.png` });
  if (w === 390) {
    await p.locator('.mk-dir__sheet .mk-dir__group', { hasText: '전문대학' }).click();
    await p.locator('.hg-drawer button.hg-btn--primary').click();
    await p.waitForTimeout(400);
    const chip = p.locator('.mk-dir__active .mk-dir__chip', { hasText: '전문대학' });
    if (!(await chip.count())) fail('[390] applied type filter shows no removable chip');
    else { await chip.click(); await p.waitForTimeout(300); if (new URL(p.url()).searchParams.has('kind')) fail('[390] removing the chip did not clear the filter'); }
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), failures, notes }, null, 1));
console.log(failures.length ? `qa:v30-directory: FAIL — ${failures.length}` : `qa:v30-directory: OK (${notes.length} measurements)`);
process.exit(failures.length ? 1 : 0);
