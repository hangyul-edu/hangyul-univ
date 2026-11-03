// V27 homepage crest gate (REPORT §361, brief §7). Needs marketing on 3100 (BASE to override).
//   node scripts/qa/v27/marquee.mjs
// For EVERY crest in the three rows: accessible name = the university's name in the page language; href = its canonical
// public page with ?lang= preserved; clicking it lands on that page in that language. Plus: duplicates are inert and
// out of the tab order, keyboard focus is visible, pointer + hover affordance, ≥ 44 px target at 390 px, the rows pause
// on hover, and under prefers-reduced-motion the grid is static and still clickable. Exit 1 on any failure.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const LANG = process.env.LANG_CHECK ?? 'vi';
const crests = JSON.parse(readFileSync(new URL('../../../apps/marketing-web/src/media/universities.json', import.meta.url), 'utf8'));
const fails = [];
const fail = (m) => { fails.push(m); console.log(`  ✗ ${m}`); };
const b = await chromium.launch();

async function home(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: opts.width ?? 1280, height: 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=${LANG}`, { waitUntil: 'networkidle' });
  return { ctx, p };
}

// 1. names, hrefs, duplicates, affordance
{
  const { ctx, p } = await home();
  const live = await p.$$eval('a.kn-crest', (as) => as.map((a) => ({
    href: a.getAttribute('href'), name: a.getAttribute('aria-label') || a.querySelector('img')?.getAttribute('alt') || a.textContent, tab: a.tabIndex,
    hidden: !!a.closest('[aria-hidden="true"]'), inert: !!a.closest('[inert]'), cursor: getComputedStyle(a).cursor,
  })));
  const real = live.filter((x) => !x.hidden);
  if (real.length !== crests.length) fail(`expected ${crests.length} focusable crests, found ${real.length}`);
  // V30: this line used to require duplicates to be `inert` — which is exactly what made 5 of 6 visible crests
  // unclickable (inert is skipped by hit-testing). The invariant is now: a hidden copy is out of the tab order, and
  // it is NOT inert. scripts/qa/v30/marquee.mjs tests the pointer side instance by instance.
  if (live.some((x) => x.hidden && x.tab >= 0)) fail('a duplicated crest is aria-hidden but still in the tab order');
  if (live.some((x) => x.inert)) fail('a crest copy is inert — a pointer passes straight through it (V30)');
  for (const c of crests) {
    const hit = real.find((x) => x.href?.startsWith(`/universities/${c.slug}`));
    if (!hit) { fail(`${c.slug}: no crest link`); continue; }
    if (!hit.href.includes(`lang=${LANG}`)) fail(`${c.slug}: href drops ?lang= (${hit.href})`);
    if (!hit.name?.trim()) fail(`${c.slug}: no accessible name`);
    if (hit.cursor !== 'pointer') fail(`${c.slug}: cursor is ${hit.cursor}`);
  }
  // keyboard focus reaches a crest and draws a ring
  let ring = null;
  for (let i = 0; i < 60 && !ring; i++) {
    await p.keyboard.press('Tab');
    ring = await p.evaluate(() => {
      const a = document.activeElement;
      if (!a?.classList.contains('kn-crest')) return null;
      const cs = getComputedStyle(a);
      return { outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, paused: getComputedStyle(a.closest('.kn-marquee').querySelector('.kn-marquee__track')).animationPlayState };
    });
  }
  if (!ring) fail('keyboard focus never reaches a crest');
  else {
    if (!ring.outline) fail('focused crest draws no visible outline');
    if (ring.paused !== 'paused') fail('row does not pause while a crest has focus');
  }
  // hover affordance + pause
  await p.locator('.kn-marquee').first().scrollIntoViewIfNeeded();
  const pt = await p.evaluate(() => {
    const a = [...document.querySelectorAll('.kn-marquee a.kn-crest')].find((x) => { const r = x.getBoundingClientRect(); return r.left > 100 && r.right < innerWidth - 100 && r.top > 0 && r.bottom < innerHeight; });
    if (!a) return null;
    a.setAttribute('data-probe', '1');
    const r = a.getBoundingClientRect();
    // V30: the hover response lives on the crest IMAGE (lift + the row receding), so the link's hit area never moves
    // under the pointer. Compare the image's transform/opacity, not the anchor's.
    const img = a.querySelector('img'); const cs = getComputedStyle(img);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, before: `${cs.transform}|${cs.opacity}` };
  });
  if (!pt) fail('no crest inside the viewport to hover');
  else {
    await p.mouse.move(pt.x, pt.y);
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => { const a = document.querySelector('[data-probe]'); const cs = getComputedStyle(a.querySelector('img')); return { t: `${cs.transform}|${cs.opacity}`, paused: getComputedStyle(a.closest('.kn-marquee').querySelector('.kn-marquee__track')).animationPlayState }; });
    if (after.t === pt.before) fail('hover changes nothing on the crest');
    if (after.paused !== 'paused') fail('row does not pause on hover');
  }
  await ctx.close();
}

// 2. every crest navigates to its page in the same language (click, then back)
{
  const { ctx, p } = await home();
  for (const c of crests) {
    const link = p.locator(`a.kn-crest[href^="/universities/${c.slug}"]`).first();
    // The row moves; a coordinate click races it. A click event on the link element itself is what a tap delivers.
    await link.evaluate((a) => a.click());
    await p.waitForURL((u) => u.pathname === `/universities/${c.slug}`, { timeout: 15000 }).catch(() => {});
    const u = new URL(p.url());
    if (u.pathname !== `/universities/${c.slug}`) { fail(`${c.slug}: click landed on ${u.pathname}`); continue; }
    if (u.searchParams.get('lang') !== LANG) fail(`${c.slug}: language lost (${u.search})`);
    const h1 = await p.locator('h1').first().textContent({ timeout: 15000 }).catch(() => '');
    if (!h1?.trim()) fail(`${c.slug}: detail page has no heading`);
    await p.goBack({ waitUntil: 'networkidle' });
    await p.waitForSelector('a.kn-crest', { timeout: 15000 });
  }
  console.log(`  clicked ${crests.length} crests`);
  await ctx.close();
}

// 3. phone target size
{
  const { ctx, p } = await home({ width: 390 });
  const small = await p.$$eval('a.kn-crest', (as) => as.filter((a) => !a.closest('[aria-hidden="true"]')).map((a) => a.getBoundingClientRect())
    .filter((r) => r.height < 44 || r.width < 44).length);
  if (small) fail(`${small} crest(s) under 44 px at 390 px`);
  await ctx.close();
}

// 4. reduced motion: static grid, still clickable
{
  const { ctx, p } = await home({ reduced: true });
  const moving = await p.$$eval('.kn-marquee__track', (ts) => ts.filter((t) => getComputedStyle(t).animationName !== 'none' && getComputedStyle(t).animationPlayState === 'running').length);
  if (moving) fail(`${moving} row(s) still animate under prefers-reduced-motion`);
  const c = crests[crests.length - 1];
  await p.locator(`a.kn-crest[href^="/universities/${c.slug}"]`).first().click({ timeout: 10000 });
  await p.waitForURL((u) => u.pathname === `/universities/${c.slug}`, { timeout: 15000 }).catch(() => {});
  if (new URL(p.url()).pathname !== `/universities/${c.slug}`) fail('reduced-motion crest is not clickable');
  await ctx.close();
}

await b.close();
console.log(`marquee v27: ${fails.length ? `FAIL (${fails.length})` : 'OK'} — ${crests.length} crests, lang=${LANG}`);
process.exit(fails.length ? 1 : 0);
