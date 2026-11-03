/**
 * V16 gate — the defects of this pass, asserted so they cannot come back silently (brief Part 36).
 *
 * The premise of V16's audit is that `qa:v15` was green while the pricing section had a line in it that
 * looked like a CSS bug and the student header had a badge floating off its button. That is not a gap in
 * rigour, it is a gap in *what was asked*: a gate that measures reading order and card width cannot see a
 * 2 px ink rule or a 3 px clip. So every check here is one of two kinds —
 *
 *   **a measurement of something rendered** (is the panel's painted top inside every ancestor's clip rect?
 *   is the badge's centre within 2 px of the button's corner?), or
 *   **a fact about the shipped bytes** (is a secret key in a tracked file? is a test-account email in a
 *   production bundle?).
 *
 * Neither kind can be satisfied by a component that merely exists.
 *
 *   npm run qa:v16
 *   SKIP_BUILD=1 npm run qa:v16        # skip the production-build suppression check (~2 min)
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = process.env.MARKETING ?? 'http://localhost:3100';
const S = process.env.STUDENT ?? 'http://localhost:3101';
const A = process.env.AGENCY ?? 'http://localhost:3102';
const U = process.env.UNIVERSITY ?? 'http://localhost:3103';
const API = process.env.API ?? 'http://localhost:8001';
const PW = 'Hangyul!2026';

const problems = [];
const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => { problems.push(s); console.log(`  ✗ ${s}`); };
const head = (s) => console.log(`\n=== ${s} ===`);
/** A check that cannot run, with the reason. Louder than silence and not a pass. */
const skipped = [];
const skip = (s) => { skipped.push(s); console.log(`  – ${s}`); };

const browser = await chromium.launch();

/**
 * `page.evaluate`, retried once through a navigation.
 *
 * This gate runs against the **development** stack, which is the point — it measures what the owner is
 * looking at. The cost is that Vite can full-reload a page mid-measurement when a watched file changes, and
 * the evaluate then dies with "execution context was destroyed". That is the harness, not the product, and
 * a gate that reports a Vite reload as a product defect is a gate nobody will trust.
 */
async function measure(page, fn, arg) {
  try {
    return await page.evaluate(fn, arg);
  } catch (e) {
    if (!/context was destroyed|Target closed|navigation/i.test(String(e.message))) throw e;
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);
    return page.evaluate(fn, arg);
  }
}

async function signIn(page, base, email) {
  await page.goto(`${base}/login?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
}

/* ------------------------------------------------------------------ 1. pricing: no ink rule, no clipping */
head('pricing — one shared hairline, and the recommended panel never clips');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${M}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pricing');

  for (const w of [390, 768, 1024, 1440, 1728]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.waitForTimeout(320);
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(420);

    // -- the ink rule. `::before` on Premium was a 2px black bar; nothing in the section may paint a dark
    //    horizontal rule any more. Checked as computed style, so a re-introduction in any stylesheet fails.
    const dark = await measure(page, () => {
      const near = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return false;
        const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x));
        return parseFloat(a) > 0.5 && r < 90 && g < 90 && b < 90; };
      const out = [];
      for (const el of document.querySelectorAll('#pricing .kn-plan, #pricing .kn-plan *')) {
        for (const pe of ['::before', '::after']) {
          const cs = getComputedStyle(el, pe);
          if (cs.content === 'none') continue;
          const h = parseFloat(cs.height) || 0;
          const wd = parseFloat(cs.width) || 0;
          if (h > 0 && h <= 6 && wd > 40 && near(cs.backgroundColor)) out.push(`${el.className}${pe}`);
        }
        // A *rule* is a lone horizontal edge. An outlined button has four dark edges and is a box — the
        // Premium CTA's ink outline is a deliberate tier marker (REPORT §132.1) and must not trip this.
        const cs = getComputedStyle(el);
        const w = (side) => parseFloat(cs[`border${side}Width`]) || 0;
        const alone = w('Top') > 0 && w('Bottom') === 0 && w('Left') === 0 && w('Right') === 0;
        if (alone && near(cs.borderTopColor)) out.push(`${el.className} border-top`);
      }
      return out;
    });
    if (dark.length) bad(`${w}px: a dark horizontal rule is still drawn in the pricing section — ${dark.join(', ')}`);

    // -- clipping. Not "does an ancestor have overflow:hidden" but "is the painted panel inside every
    //    ancestor's clip rect", measured at rest and while hovered.
    const probe = async (hovered) => measure(page, (hov) => {
      const body = document.querySelector('.kn-plan[data-recommended] .kn-plan__body');
      if (!body) return null;
      if (hov) body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const r = body.getBoundingClientRect();
      const clippers = [];
      let n = body.parentElement;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const clips = cs.clipPath !== 'none' || (cs.overflow !== 'visible' && cs.overflow !== 'clip visible')
          || cs.overflowY === 'hidden' || cs.overflowY === 'clip' || cs.contain.includes('paint');
        if (clips) {
          const b = n.getBoundingClientRect();
          clippers.push({ cls: String(n.className).slice(0, 48), top: b.top, bottom: b.bottom, why: cs.clipPath !== 'none' ? 'clip-path' : cs.overflow });
        }
        n = n.parentElement;
      }
      const grid = body.closest('.kn-plans').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, clippers, headTop: r.top - grid.top, headBottom: grid.bottom - r.bottom };
    }, hovered);

    const rest = await probe(false);
    await page.locator('.kn-plan[data-recommended] .kn-plan__body').hover();
    await page.waitForTimeout(420);
    // `.hover()` may scroll, so the lift is measured **against the grid**, which moves with the panel.
    // Comparing viewport `top` before and after was measuring the scroll, not the hover.
    const hover = await probe(true);
    if (!rest || !hover) { bad(`${w}px: the recommended plan panel was not found`); continue; }
    for (const [label, m] of [['rest', rest], ['hover', hover]]) {
      const cut = m.clippers.filter((c) => m.top < c.top - 0.5 || m.bottom > c.bottom + 0.5);
      if (cut.length) bad(`${w}px ${label}: the panel is clipped by ${cut.map((c) => `${c.cls} (${c.why})`).join(', ')}`);
    }
    // Headroom only exists in the three-across layout; stacked, the panel is an ordinary block.
    if (w >= 1024 && rest.headTop < 8) bad(`${w}px: only ${Math.round(rest.headTop)}px of headroom above the recommended panel`);
    const lift = rest.headTop - hover.headTop;
    if (lift < 1.5 || lift > 5) bad(`${w}px: hover moves the panel ${lift.toFixed(1)}px — expected 2–4px`);
    if (!problems.length || problems.every((p) => !p.startsWith(`${w}px`))) {
      ok(`${String(w).padStart(4)}px · no dark rule · 0 clippers · hover ${lift.toFixed(1)}px · headroom ${Math.round(rest.headTop)}/${Math.round(rest.headBottom)}px`);
    }
    await page.mouse.move(2, 2);
  }

  // -- the comparison still opens, still has no cell borders, and still has exactly one selected tab on a phone.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await page.click('.kn-compare__toggle');
  await page.waitForTimeout(600);
  const matrix = await measure(page, () => {
    const cells = [...document.querySelectorAll('.kn-matrix td, .kn-matrix tbody th')];
    const bordered = cells.filter((c) => ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(getComputedStyle(c)[`border${s}Width`]) > 0));
    const names = document.querySelectorAll('.kn-matrix tbody th[scope=row]');
    const nameWeight = names.length ? getComputedStyle(names[0]).fontWeight : '0';
    const groupSize = document.querySelector('.kn-matrix__grouprow th') ? parseFloat(getComputedStyle(document.querySelector('.kn-matrix__grouprow th')).fontSize) : 0;
    const rowH = names.length ? names[0].getBoundingClientRect().height : 0;
    const tint = document.querySelector('.kn-matrix__hi');
    return { bordered: bordered.length, nameWeight: Number(nameWeight), groupSize, rowH, tinted: !!tint, rows: names.length };
  });
  if (matrix.bordered) bad(`the comparison matrix has ${matrix.bordered} bordered cells — the spreadsheet grid is back`);
  else ok('comparison matrix: 0 cell borders');
  if (matrix.rows < 10) bad(`the comparison matrix has only ${matrix.rows} rows`);
  // Hierarchy: the service name must be heavier than the area label is big — i.e. the three levels exist.
  if (matrix.nameWeight < 500) bad(`service names are weight ${matrix.nameWeight} — no stronger than body text`);
  else ok(`service names at weight ${matrix.nameWeight}, area labels at ${matrix.groupSize}px, rows ${Math.round(matrix.rowH)}px`);
  if (!matrix.tinted) bad('the recommended column tint is gone');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const tabs = await page.$$eval('.kn-matrix-m__tabs [role=tab]', (els) => els.map((e) => e.getAttribute('aria-selected')));
  if (tabs.filter((x) => x === 'true').length !== 1) bad('the phone comparison does not have exactly one selected plan');
  else ok(`390px: plan tablist with ${tabs.length} tabs, 1 selected — no horizontal table`);
  await page.close();
}

/* ------------------------------------------------------------------------------- 2. the student header */
head('student header — the badge is attached to the bell, at every count, and the controls line up');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(page, S, 'student@demo.hangyul.kr');
  await page.waitForTimeout(1200);

  /*
   * The unread count is **stubbed**, for two reasons. The brief (Part 32) asks for 0 / 1 / 9 / many, and
   * the seed has one number; and a gate that reads live notifications stops being repeatable the moment it
   * — or a person — marks them read. Intercepting the one endpoint the bell reads tests exactly what is
   * under test here: how a count is drawn.
   */
  const stub = async (unread) => {
    await page.unroute('**/api/v1/notifications**').catch(() => undefined);
    await page.route('**/api/v1/notifications**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const items = Array.from({ length: Math.min(unread, 3) }, (_, i) => ({
        id: `stub-${i}`, title_key: 'x', text: `알림 ${i + 1}`, params: {}, read: false,
        at: new Date().toISOString(), link: '/',
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread, items }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hg-bell', { timeout: 20_000 });
    await page.waitForTimeout(900);
  };

  const measure = () => page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const wrap = document.querySelector('.hg-bell');
    if (!wrap) return null;
    const btn = wrap.querySelector('.hg-btn');
    const count = wrap.querySelector('.hg-bell__count');
    const account = document.querySelector('.hg-account');
    // Measured on the *controls*, not on `Popover`'s anchor wrappers. The first version of this used `>`
    // and matched nothing, so an empty list passed the height check while the locale control was shipping
    // 6 px shorter than the bell beside it. A gate that can pass vacuously is not a gate.
    const tools = [...document.querySelectorAll('.hg-snav__tools .hg-btn')].map(r);
    return {
      btn: r(btn), account: account ? r(account) : null, tools,
      hasTools: !!document.querySelector('.hg-snav__tools'),
      label: btn.getAttribute('aria-label'),
      count: count ? { ...r(count), ring: getComputedStyle(count).boxShadow, text: count.textContent,
                       radius: parseFloat(getComputedStyle(count).borderRadius) } : null,
      overlapping: (() => {
        const boxes = [...document.querySelectorAll('.hg-snav__inner > *')].map(r).filter((b) => b.w > 0);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5) return true;
        }
        return false;
      })(),
    };
  });

  for (const w of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 950 });

    // ---- 0 unread: a bell and nothing else. A badge that can show zero is a badge nobody reads.
    await stub(0);
    let m = await measure();
    if (!m) { bad(`${w}px: no notification control in the student header`); continue; }
    if (m.count) bad(`${w}px: a badge is drawn with 0 unread`);
    if (m.btn.w < 34 || m.btn.w > 44) bad(`${w}px: the bell button is ${Math.round(m.btn.w)}px — outside the 36–40px target`);
    if (Math.abs(m.btn.w - m.btn.h) > 1) bad(`${w}px: the bell button is ${Math.round(m.btn.w)}×${Math.round(m.btn.h)} — not square`);
    if (m.overlapping) bad(`${w}px: two header controls overlap`);
    if (!m.hasTools) bad(`${w}px: the header's control group (.hg-snav__tools) is missing — its spacing and sizing rules match nothing`);
    const hs = m.tools.map((t) => Math.round(t.h)).filter((h) => h > 0);
    if (hs.length < 2) bad(`${w}px: ${hs.length} control(s) measured in the header group — expected the locale control and the bell`);
    else if (Math.max(...hs) - Math.min(...hs) > 1) bad(`${w}px: header tool heights differ (${hs.join(', ')})`);
    if (m.account && w >= 1024 && Math.abs(m.account.h - m.btn.h) > 2) {
      bad(`${w}px: the account control is ${Math.round(m.account.h)}px but the icon buttons are ${Math.round(m.btn.h)}px`);
    }

    // ---- 1, 9 and 120 unread: a disc at the corner, with a ring, never a wide pill.
    for (const [n, want] of [[1, '1'], [9, '9'], [120, '99+']]) {
      await stub(n);
      m = await measure();
      if (!m?.count) { bad(`${w}px: ${n} unread but no badge is drawn`); continue; }
      const c = m.count;
      if (c.text !== want) bad(`${w}px: ${n} unread renders "${c.text}", expected "${want}"`);
      if (c.h > 18 || c.h < 13) bad(`${w}px: the badge is ${Math.round(c.h)}px tall — outside 14–17px`);
      if (n < 100 && Math.abs(c.w - c.h) > 1.5) bad(`${w}px: the badge is ${Math.round(c.w)}×${Math.round(c.h)} — a lozenge, not a disc`);
      if (c.w > 26) bad(`${w}px: the badge is ${Math.round(c.w)}px wide — a wide pill`);
      if (c.radius < c.h / 2 - 0.5) bad(`${w}px: the badge is not fully rounded`);
      // Attached: inside the button's box, at its top-right corner.
      const insideX = c.x >= m.btn.x - 3 && c.r <= m.btn.r + 3;
      const insideY = c.y >= m.btn.y - 3 && c.b <= m.btn.b;
      if (!insideX || !insideY) bad(`${w}px: the ${n}-unread badge is outside the bell button's box — it is floating`);
      else if (Math.abs(c.r - m.btn.r) > 5 || Math.abs(c.y - m.btn.y) > 5) {
        bad(`${w}px: the ${n}-unread badge is not anchored to the button's top-right corner`);
      }
      if (!c.ring || c.ring === 'none') bad(`${w}px: the badge has no ring separating it from the header`);
      if (!String(m.label).includes(String(n))) bad(`${w}px: the button's accessible name does not carry the count (${m.label})`);
      if (m.overlapping) bad(`${w}px: the ${n}-unread badge makes two header controls overlap`);
    }
    ok(`${String(w).padStart(4)}px · button ${Math.round(m.btn.w)}px · 0 → no badge · 1 / 9 / 99+ as a ${Math.round(m.count.h)}px disc at the corner · no overlap`);
  }

  // -- the popover opens aligned to the bell and inside the viewport, and unread rows are not filled cards.
  await page.setViewportSize({ width: 1440, height: 950 });
  await stub(3);
  await page.click('.hg-bell .hg-btn');
  await page.waitForTimeout(500);
  const pop = await page.evaluate(() => {
    const panel = document.querySelector('.hg-notif-panel');
    if (!panel) return null;
    const p = panel.getBoundingClientRect();
    const btn = document.querySelector('.hg-bell .hg-btn').getBoundingClientRect();
    const unread = document.querySelector('.hg-notif[data-unread="true"]');
    const bell = document.querySelector('.hg-bell');
    return {
      inside: p.left >= -1 && p.right <= window.innerWidth + 1 && p.top >= -1,
      rightGap: Math.abs(p.right - btn.right),
      topGap: p.top - btn.bottom,
      unreadBg: unread ? getComputedStyle(unread).backgroundColor : null,
      dot: unread ? getComputedStyle(unread.querySelector('.hg-notif__mark')).backgroundColor : null,
      open: bell.hasAttribute('data-open'),
      btnBg: getComputedStyle(document.querySelector('.hg-bell .hg-btn')).backgroundColor,
    };
  });
  if (!pop) bad('the notification popover did not open');
  else {
    if (!pop.inside) bad('the notification popover is outside the viewport');
    if (pop.rightGap > 24) bad(`the popover is ${Math.round(pop.rightGap)}px off the bell's right edge`);
    if (pop.topGap < 0 || pop.topGap > 24) bad(`the popover's top offset from the bell is ${Math.round(pop.topGap)}px`);
    if (!pop.open) bad('the bell button does not carry an open state while its popover is open');
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(pop.btnBg)) bad('the open bell button has no visible state');
    // Orange exists only where it carries meaning: the dot, not the button.
    if (/255,\s*(10[0-9]|[5-9][0-9])/.test(pop.btnBg)) bad('the open bell button is orange — orange means "unread" here');
    const filled = pop.unreadBg && !/rgba\(0, 0, 0, 0\)|transparent/.test(pop.unreadBg);
    if (filled) bad(`unread rows are filled (${pop.unreadBg}) — a coloured card, not a dot`);
    if (!pop.dot || /rgba\(0, 0, 0, 0\)/.test(pop.dot)) bad('unread rows have no dot');
    ok(`popover: right gap ${Math.round(pop.rightGap)}px, top gap ${Math.round(pop.topGap)}px, neutral open state, unread marked by a dot`);
  }

  /*
   * Marking everything read empties the badge **on the click**, and no stale count comes back.
   *
   * Both sides are stubbed, and the stub changes its answer when the mutation arrives — so this measures
   * the component's own behaviour (optimistic update, then reconciliation) rather than whatever the seeded
   * account happens to have unread, which an earlier run may already have cleared.
   */
  let serverUnread = 4;
  let readAllCalls = 0;
  await page.unroute('**/api/v1/notifications**').catch(() => undefined);
  await page.route('**/api/v1/notifications**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.url().includes('read-all')) {
      readAllCalls += 1;
      serverUnread = 0;
      // Slow, on purpose: the badge must be empty before this resolves, or it is not optimistic.
      await new Promise((r) => setTimeout(r, 900));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (req.method() !== 'GET') return route.continue();
    const items = Array.from({ length: Math.min(serverUnread, 3) }, (_, i) => ({
      id: `stub-${i}`, title_key: 'x', text: `알림 ${i + 1}`, params: {}, read: false,
      at: new Date().toISOString(), link: '/',
    }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread: serverUnread, items }) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hg-bell__count', { timeout: 20_000 });
  await page.click('.hg-bell .hg-btn');
  await page.waitForTimeout(400);
  const markAll = page.locator('.hg-notif__head button');
  if (!(await markAll.count())) bad('the popover offers no 모두 읽음 while there are unread notifications');
  else {
    await markAll.first().click();
    await page.waitForTimeout(200);
    if ((await page.$$('.hg-bell__count')).length) bad('the unread badge is still drawn immediately after 모두 읽음 — the update is not optimistic');
    // A second click must not issue a second request.
    if (await markAll.count()) await markAll.first().click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    if ((await page.$$('.hg-bell__count')).length) bad('the unread badge came back after the refetch — a stale count');
    if (readAllCalls > 1) bad(`모두 읽음 issued ${readAllCalls} requests — the guard does not hold`);
    if (!problems.some((x) => x.includes('모두 읽음') || x.includes('stale count'))) {
      ok(`mark-all-read: badge cleared on the click, ${readAllCalls} request issued, still clear after the refetch`);
    }
  }
  await page.unroute('**/api/v1/notifications**').catch(() => undefined);
  await page.close();
}

/* ------------------------------------------------------------------------------- 3. the student hero */
head('student home — words left, photograph right, no photo credit');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(page, S, 'student@demo.hangyul.kr');
  await page.waitForTimeout(1800);
  for (const w of [390, 768, 1024, 1440, 1728]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 950 });
    await page.goto(`${S}/?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sh-band, .hg-strip', { timeout: 20000 });
    await page.waitForTimeout(900);
    if (!(await page.locator('.sh-band').count())) {
      // V22 removed the photo band on purpose (docs/qa/v22/STUDENT_UX.md): a plain greeting, the journey strip, no
      // photograph and therefore no credit. The intent of this section — a quiet home that never scrolls sideways
      // and never shows a stock photo credit — is asserted against that surface instead.
      const v = await page.evaluate(() => {
        const h = document.querySelector('main h1, h1');
        return {
          titleSize: h ? parseFloat(getComputedStyle(h).fontSize) : 0,
          strip: !!document.querySelector('.hg-strip'),
          credit: !!document.querySelector('.sh-band__credit, .hg-photo__credit, figcaption'),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      if (!v.titleSize) bad(`${w}px: no greeting heading on the student home`);
      else if (v.titleSize > 44) bad(`${w}px: the greeting is ${Math.round(v.titleSize)}px — too large for a greeting`);
      if (!v.strip) bad(`${w}px: the journey strip is missing from the student home`);
      if (v.credit) bad(`${w}px: a photo credit is rendered on the student home although the band is gone`);
      if (v.overflowX) bad(`${w}px: the student home scrolls horizontally`);
      if (v.titleSize && v.titleSize <= 44 && v.strip && !v.credit && !v.overflowX) ok(`${String(w).padStart(4)}px · V22 home: greeting ${Math.round(v.titleSize)}px, journey strip, no photo band, no sideways scroll`);
      continue;
    }
    const m = await page.evaluate(() => {
      const band = document.querySelector('.sh-band').getBoundingClientRect();
      const text = document.querySelector('.sh-band__text').getBoundingClientRect();
      const title = document.querySelector('.sh-band .sh-head__title');
      const tiles = [...document.querySelectorAll('.st7-tiles li button')].map((b) => b.getBoundingClientRect().height);
      return {
        bandLeft: band.left, bandWidth: band.width, bandHeight: band.height,
        textLeft: text.left, textRight: text.right,
        titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
        credit: !!document.querySelector('.sh-band__credit'),
        creditText: /사진\s*:|Photo\s*:|Source\s*:/.test(document.querySelector('.sh-band').innerText),
        tileH: tiles.length ? Math.max(...tiles) : 0,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    // The text must start in the left third and must not run past the band's midpoint on desktop.
    const startFrac = (m.textLeft - m.bandLeft) / m.bandWidth;
    if (startFrac > 0.12) bad(`${w}px: the hero copy starts ${Math.round(startFrac * 100)}% across the band — it is not on the left`);
    if (w >= 1024) {
      const endFrac = (m.textRight - m.bandLeft) / m.bandWidth;
      if (endFrac > 0.72) bad(`${w}px: the hero copy runs to ${Math.round(endFrac * 100)}% of the band — it covers the image's focal side`);
    }
    if (m.credit || m.creditText) bad(`${w}px: a photo credit is rendered over the student home band`);
    if (m.titleSize > 44) bad(`${w}px: the greeting is ${Math.round(m.titleSize)}px — too large for a greeting`);
    if (m.tileH > 76) bad(`${w}px: the journey tiles are ${Math.round(m.tileH)}px tall — still six cards`);
    if (m.overflowX) bad(`${w}px: the student home scrolls horizontally`);
    ok(`${String(w).padStart(4)}px · copy at ${Math.round(startFrac * 100)}%–${Math.round(((m.textRight - m.bandLeft) / m.bandWidth) * 100)}% · greeting ${Math.round(m.titleSize)}px · rail ${Math.round(m.tileH)}px · no credit`);
  }
  await page.close();
}

/* -------------------------------------------------------------- 4. no invisible controls on any student page */
head('student — no control painted the same colour as its own background');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(page, S, 'student@demo.hangyul.kr');
  const ROUTES = ['/', '/explore', '/applications', '/documents', '/essays', '/visa', '/housing', '/arrival',
    '/services', '/messages', '/notifications', '/profile', '/settings', '/more', '/tasks', '/support'];
  let checked = 0;
  for (const r of ROUTES) {
    await page.goto(`${S}${r}?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const invisible = await page.evaluate(() => {
      const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); return m ? m[1].split(',').map(parseFloat) : null; };
      const out = [];
      for (const el of document.querySelectorAll('.hg-btn, button, a.hg-btn')) {
        const cs = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        if (b.width < 8 || b.height < 8 || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        // Only controls that have a *label to lose*. A switch or an icon-only button draws itself with
        // borders and background; `color` equal to `background-color` on one of those means nothing.
        if (!el.textContent.trim()) continue;
        const fg = rgb(cs.color);
        // Walk up for the first non-transparent background actually behind the label.
        let bg = null, n = el;
        while (n && !bg) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && (c[3] === undefined || c[3] > 0.6)) bg = c; n = n.parentElement; }
        if (!fg || !bg) continue;
        const lum = (c) => { const [r, g, bl] = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
        const l1 = lum(fg), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 1.6) out.push(`"${el.textContent.trim().slice(0, 24)}" ${cs.color} on ${cs.backgroundColor}`);
      }
      return out;
    });
    checked++;
    if (invisible.length) bad(`${r}: ${invisible.length} control(s) with no contrast against their own background — ${invisible.join(' | ')}`);
  }
  ok(`${checked} student routes: every button's label has contrast against the surface behind it`);
  await page.close();
}

/* ------------------------------------------------------------------- 5. console test login, and its gating */
head('console test login — one click in, and absent when the flag is off');
for (const [name, base, landing, expectRole] of [
  ['agency', A, 'Agency Today', 'counselor@lotus.demo.hangyul.kr'],
  ['university', U, 'University Overview', 'admin@pusan.univ.demo.hangyul.kr'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hg-testlogin', { timeout: 20_000 }).catch(() => undefined);
  const present = await page.$('.hg-testlogin button.hg-btn');
  if (!present) { bad(`${name}: no test-account control on the login screen`); await ctx.close(); continue; }

  // Visually secondary: it must not be the filled primary button.
  const ranks = await page.evaluate(() => {
    const primary = document.querySelector('form button[type=submit]');
    const test = document.querySelector('.hg-testlogin button.hg-btn');
    const g = (e) => ({ bg: getComputedStyle(e).backgroundColor, cls: e.className });
    return { primary: g(primary), test: g(test), order: primary.compareDocumentPosition(test) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before' };
  });
  if (ranks.test.bg === ranks.primary.bg) bad(`${name}: the test-account button looks identical to the primary sign-in button`);
  if (ranks.order !== 'after') bad(`${name}: the test-account button is above the normal sign-in form`);
  if (/dev|demo|fixture|sample/i.test(await page.textContent('.hg-testlogin'))) {
    bad(`${name}: the test-login block uses engineering language (DEV/DEMO/FIXTURE/SAMPLE)`);
  }

  /*
   * **Is it actually styled?** This block shipped for most of V16 with none of its CSS applied — the rules
   * were written into a command that short-circuited before the heredoc ran, and nothing noticed, because
   * the earlier checks here only looked at colour, order and wording. So the divider was a stray word, the
   * hint was left-aligned, and the role disclosure was a browser-default bulleted list of narrow buttons,
   * which is three persona cards by another name. Presence is not a design; these measure the shape.
   */
  // The role list only exists once the disclosure is open, so open it before measuring.
  const disclosure = page.locator('.hg-testlogin__more');
  if (await disclosure.count()) { await disclosure.click(); await page.waitForTimeout(300); }
  const shape = await page.evaluate(() => {
    const or = document.querySelector('.hg-testlogin__or');
    const hint = document.querySelector('.hg-testlogin__hint');
    const roles = document.querySelector('.hg-testlogin__roles');
    const line = or ? getComputedStyle(or, '::before') : null;
    return {
      dividerRule: line ? (line.content !== 'none' && parseFloat(line.height) > 0) : false,
      hintCentred: hint ? getComputedStyle(hint).textAlign === 'center' : null,
      rolesExist: !!roles,
      rolesMarker: roles ? getComputedStyle(roles).listStyleType : null,
      rolesIndent: roles ? parseFloat(getComputedStyle(roles).paddingInlineStart) : null,
    };
  });
  if (!shape.dividerRule) bad(`${name}: the 또는 divider has no rules either side — the block is unstyled`);
  if (shape.hintCentred === false) bad(`${name}: the test-login hint is not centred under its button`);
  if (shape.rolesExist) {
    if (shape.rolesMarker !== 'none') bad(`${name}: the role disclosure renders list markers (${shape.rolesMarker})`);
    if (shape.rolesIndent > 2) bad(`${name}: the role disclosure keeps the browser's ${shape.rolesIndent}px list indent`);
  }

  const before = Date.now();
  await page.click('.hg-testlogin button.hg-btn');
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  } catch {
    bad(`${name}: the test-account button did not sign in`);
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    path: location.pathname,
    chrome: document.querySelector('.hg-shell') ? document.querySelector('.hg-shell').innerText.slice(0, 4000) : '',
  }));
  if (after.path !== '/') bad(`${name}: test sign-in landed on ${after.path}, not ${landing}`);
  // Brief Part 8: no test vocabulary anywhere in the signed-in console.
  const leak = /\b(demo|test account|development account|fixture|sample user)\b/i.exec(after.chrome);
  if (leak) bad(`${name}: the signed-in console shows "${leak[0]}" in its chrome`);
  ok(`${name}: one click → ${after.path} in ${Math.round((Date.now() - before) / 1000)}s as ${expectRole}, no test vocabulary after login`);
  await ctx.close();
}

/* ------------------------------------------------------------------------- 6. payment config and secrets */
head('payment — the right merchant configuration, and no secret anywhere it can be read');
{
  // Straight at the API with a seeded student's token. The browser keeps its access token in memory, so a
  // `fetch(..., {credentials:'include'})` from a page would be unauthenticated — and a gate that silently
  // measures a 401 is worse than one that does not run.
  const tok = await fetch(`${API}/api/v1/auth/demo-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.new@demo.hangyul.kr', client: 'student' }),
  }).then((r) => r.json()).then((j) => j.access_token).catch(() => null);
  if (!tok) bad('could not sign in a seeded student against the API');
  else {
    const auth = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
    const cfg = await fetch(`${API}/api/v1/me/payments/config`, { headers: auth }).then((r) => r.json());
    if (cfg.provider !== 'toss') bad(`the payment provider is "${cfg.provider}", not toss`);
    if (!cfg.one_time?.configured) bad('the one-time Toss merchant configuration is not configured');
    // The 결제창 MID is still the 결제창 MID; which route *buys* is asserted just below.
    if (!/^HANGYUL$/i.test(cfg.one_time?.mid ?? '')) bad(`the one-time configuration uses MID "${cfg.one_time?.mid}" — expected HANGYUL`);
    /*
     * **Rewritten in V21.** This asserted that no `bill_*` configuration could buy a plan, which was
     * right when every `bill_*` MID on the account was a Korean 자동결제 product. `bill_talkoab1` is a
     * foreign-card key-in MID that settles USD and is the only configuration that can charge an
     * overseas card at all (REPORT §229.3, §236.3), so V21 wired it to plan purchase deliberately.
     * What is still worth guarding is that **exactly one** route buys a plan.
     */
    const wired = ((cfg.one_time?.used_by_plan_purchase ? 1 : 0)
      + (cfg.billing ?? []).filter((b) => b.used_by_plan_purchase).length);
    if (wired !== 1) bad(`plan purchase must have exactly one route, found ${wired}`);
    if ((cfg.billing ?? []).some((b) => b.mid && !String(b.mid).startsWith('bill_'))) bad('a non-billing MID is listed as a billing configuration');
    const cfgText = JSON.stringify(cfg);
    if (/_sk_/.test(cfgText)) bad('a secret key is served by /me/payments/config');
    if (/_ck_/.test(cfgText)) bad('a client key is served by /me/payments/config — it belongs with an order');
    ok(`provider toss (${cfg.env}) · one-time MID ${cfg.one_time?.mid} · ${(cfg.billing ?? []).length} billing MIDs, none reachable from the purchase`);

    /*
     * **V17 changed what this block can prove, and that is worth stating rather than hiding.**
     *
     * The plans are priced in USD now and the supplied test MID holds KRW (REPORT §152, §161), so the
     * server refuses to open an order at all — `503 CURRENCY_NOT_CONTRACTED`, by design, because a silent
     * won order at today's rate is a charge nobody quoted. Everything below that needed an order therefore
     * cannot run against the live sandbox any more.
     *
     * So this gate asserts what *is* true at the HTTP boundary — the refusal, and that the refusal leaks
     * nothing — and the order-shaped contract it used to assert moved to `server/tests/test_v16_payments.py`,
     * which declares the contract present in a fixture and exercises the same twelve properties. The one
     * thing no unit test can replace is that the real secret authenticates against Toss; that was verified
     * under V16 (§142, with the 결제창 screenshot) and is **skipped** here, named, until the contract lands.
     */
    const cfgUsd = cfg.currency ?? 'USD';
    const made = await fetch(`${API}/api/v1/me/orders`, {
      method: 'POST', headers: auth, body: JSON.stringify({ product_code: 'ALL_IN_ONE' }),
    });
    const order = await made.json();
    const t = JSON.stringify(order);
    if (/_sk_/.test(t)) bad('POST /me/orders returned a secret key to the browser');
    if (/bill_talk/.test(t)) bad('POST /me/orders returned a billing MID to the browser');

    if (made.status === 201) {
      // The contract exists: the full V16 order contract applies, in whatever currency was quoted.
      const minor = order.checkout?.amount?.value;
      if (!order.checkout?.client_key?.startsWith('test_ck_') && !order.checkout?.client_key?.startsWith('live_ck_')) {
        bad('POST /me/orders did not return a one-time client key');
      }
      if (typeof minor !== 'number' || minor <= 0) bad(`the order amount is ${minor}, not a priced figure`);
      if (order.checkout?.amount?.currency !== cfgUsd) bad(`the order is in ${order.checkout?.amount?.currency}, not the advertised ${cfgUsd}`);
      if (order.status !== 'PENDING') bad(`a new Toss order is "${order.status}", not PENDING — nothing may be paid before approval`);
      if (!/\/services\/payment\/success$/.test(order.checkout?.success_url ?? '')) bad("the success URL is not the student app's payment return route");
      if (!/^https:\/\/js\.tosspayments\.com\/v2\//.test(order.checkout?.sdk ?? '')) bad(`the SDK is "${order.checkout?.sdk}" — expected the v2 SDK`);
      const idOk = order.order_id && order.order_id.length >= 6 && order.order_id.length <= 64 && /^[A-Za-z0-9\-_=]+$/.test(order.order_id);
      if (!idOk) bad(`order id "${order.order_id}" is not a valid Toss orderId`);
      ok(`order ${String(order.order_id).slice(0, 8)} · PENDING · ${minor} ${order.checkout?.amount?.currency} · v2 SDK · client key only · success/fail URLs set`);

      // A browser that lies about the amount must be refused *before* the provider is called.
      const lied = await fetch(`${API}/api/v1/me/payments/toss/confirm`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ payment_key: 'test_forged_key', order_id: order.order_id, amount: 1000 }),
      });
      if (lied.status !== 409) bad(`confirming with a forged amount answered ${lied.status}, expected 409`);
      else ok('a forged amount is refused with 409 before the provider is ever called');

      const after = await fetch(`${API}/api/v1/me/services`, { headers: auth }).then((r) => r.json());
      if ((after.owned ?? []).length) bad('a plan is active after a refused confirmation');
      else ok('the refused confirmation activated nothing');

      // The live credentials actually authenticate. A wrong secret answers UNAUTHORIZED_KEY; a right one
      // answers a *business* error about the payment. That difference is the whole check.
      const real = await fetch(`${API}/api/v1/me/payments/toss/confirm`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ payment_key: 'tviva_does_not_exist_0000', order_id: order.order_id, amount: order.checkout.amount.value }),
      });
      const detail = await real.json().then((j) => j.detail).catch(() => null);
      const code = typeof detail === 'object' ? detail?.code : String(detail);
      if (real.status === 503) bad('Toss is not configured on the server');
      else if (/UNAUTHORIZED_KEY|INVALID_API_KEY/.test(String(code))) bad(`the Toss secret key is rejected by the provider (${code})`);
      else ok(`live Toss test API reachable and authenticated — it answered "${code}" for a non-existent payment`);
    } else if (made.status === 503 && order.detail?.code === 'CURRENCY_NOT_CONTRACTED') {
      if (JSON.stringify(order).includes('KRW')) bad('the refusal offers KRW as a fallback currency');
      else ok(`no order opens in ${cfgUsd}: 503 CURRENCY_NOT_CONTRACTED, and no fallback currency`);
      const after = await fetch(`${API}/api/v1/me/services`, { headers: auth }).then((r) => r.json());
      if (after.payment?.pending_order_id) bad('a refused checkout left a PENDING order behind');
      else ok('the refusal created nothing');
      skip(`the order contract and the live-credential check need an order, and ${cfgUsd} is not contracted — `
        + 'asserted instead by server/tests/test_v16_payments.py (12 tests); the live secret was last '
        + 'verified under V16 (REPORT §142)');
    } else {
      bad(`POST /me/orders answered ${made.status} ${JSON.stringify(order.detail ?? order).slice(0, 160)}`);
    }
  }
}

/* ------------------------------------------------------------------------------ 7. secrets in the repo */
head('secrets — zero matches in tracked files');
{
  /*
   * **The scanner does not contain the secrets.** A gate that greps for a literal secret key is itself a
   * tracked file containing that secret key — it fails its own check, and worse, it publishes the values to
   * everyone who reads the repository. So what is stored here is a SHA-256 of each value, and the scan
   * hashes every secret-shaped token it finds and compares digests.
   *
   * Twelve digests: four secret keys, four security keys and four client keys. The client keys are
   * public-facing by design, but the product hands them out from the server with an order (REPORT §135), so
   * one appearing in a tracked file means a second source of truth about which merchant is in use.
   */
  const FINGERPRINTS = new Map([
    ['baf318c8a55f451205acd0a1733c94a684df4a792c8024a256a3477d15769a42', 'domestic billing secret key'],
    ['2e8723a45f31ee4b7539179047eee21a5a3b49768e408b84da7fcdc1eabd3dd0', 'foreign billing secret key'],
    ['2cf6f0fa33777e100e6840bcf5ddf45726c426fb59aaa07d44469ff7ba1829a3', 'easy-pay billing secret key'],
    ['e7df459c3655b8d676ece1073f2eee05ebf9f5630e39f9d9937ca4b192edce28', 'one-time secret key'],
    ['5a567af0020ebc3143f47883a82e1849eba482d0b23322d12d852f0da62581e6', 'domestic billing security key'],
    ['7f460e902e29f580aadf61ab74673ef2afc7aeb6d3842a8335a7e56ec2960085', 'foreign billing security key'],
    ['8bfd30c5e9b6a4f95db622f859e622ee0aa270f97cd4b05412c494728db2baf2', 'easy-pay billing security key'],
    ['ce5ebf00a13f1f9b333131e3a981e2c976bec182a4b0fe5b830d28a15525b406', 'one-time security key'],
    ['dddeb5d0de0d0526553656cd252c8c8af065e85f602b3fcf078f605eeca51ede', 'domestic billing client key'],
    ['4103cc8b0e04024711f4ebbe334b3941a255505ed212e4a8519be62f2a5b43f1', 'foreign billing client key'],
    ['9046e71b473f596e77721b5c540f65d0dc7c2d57d3443c2c07d6404248edadbd', 'easy-pay billing client key'],
    ['eecfddca7daee7f94723b1dc939764fdd1ee9d85f6d29c0daf8804cb0abd7240', 'one-time client key'],
  ]);
  const SKIP = new Set(['node_modules', '.git', 'dist', '.venv', 'var', '__pycache__', '.ruff_cache',
    'playwright-report', 'test-results', 'qa-screenshots', '.expo', 'docs', '.expo-export-check']);
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = join(dir, e.name);
      // server/.env is the one place these values are allowed to be, and it is gitignored.
      if (p === join(ROOT, 'server/.env')) continue;
      if (e.isDirectory()) walk(p);
      else { try { if (statSync(p).size < 4_000_000) files.push(p); } catch { /* vanished */ } }
    }
  };
  walk(ROOT);
  const hits = [];
  let scanned = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    for (const tok of text.match(/[A-Za-z0-9_]{24,80}/g) ?? []) {
      const what = FINGERPRINTS.get(createHash('sha256').update(tok).digest('hex'));
      if (what) hits.push(`${f.replace(ROOT + '/', '')} contains the ${what}`);
    }
  }
  if (hits.length) [...new Set(hits)].forEach((h) => bad(h));
  else ok(`${scanned} tracked files scanned against 12 secret / security / client key fingerprints — 0 matches`);
  if (!readFileSync(join(ROOT, '.gitignore'), 'utf8').includes('server/.env')) bad('server/.env is not gitignored');
  else ok('server/.env is gitignored');

  /*
   * And nothing anywhere *stores* card data.
   *
   * **Rewritten in V21.** This used to fail if a card field was *declared* anywhere, which was right
   * while the card never touched this server: the 결제창 took it. V21 ships Hangyul's own card form
   * (REPORT §236.4), so the fields are declared on purpose, and the old rule had become a statement
   * that the product must not exist. What it was actually protecting — that card data is transient
   * and never written down — is now checked directly, in three parts:
   *
   *   1. A CVC is forbidden **outright**, anywhere: this merchant configuration does not need one and
   *      so nothing here is allowed to ask for one.
   *   2. A card field in a persistence layer — a model or a migration — is forbidden.
   *   3. Everywhere else, a card field may appear only in the known transient path. A sixth file is a
   *      finding, because it means the card reached somewhere nobody decided it should.
   */
  const CVC = /\b(card_cvc|cardCvc|\bcvc\b|\bcvv\b|securityCode)\s*[:=]\s*[^=]/i;
  const CARD = /(card_number|cardNumber|expiry_month|expiryMonth|expiry_year|card_expiry)\s*[:=]\s*[^=]/;
  const CARD_PATH = new Set([
    'apps/student-web/src/components/CardForm.tsx',
    'apps/student-web/src/pages/Services.tsx',
    'packages/types/src/index.ts',
    'server/app/api/v1/student.py',
    'server/app/services/foreign_card.py',
  ]);
  // "Product" excludes test code: a spec that pays with a sandbox card is exercising the path, not
  // shipping it. That card numbers do not appear in test code either is `qa:v21-security`'s job.
  const product = files.filter((f) => /\.(tsx?|py)$/.test(f)
    && !/\.test\.|\.spec\.|\/tests?\/|\/e2e\//.test(f));
  const rel = (f) => f.replace(ROOT + '/', '');

  const cvc = product.filter((f) => CVC.test(readFileSync(f, 'utf8')));
  if (cvc.length) bad(`a CVC field is declared in ${cvc.map(rel).join(', ')} — this configuration never asks for one`);
  else ok('no CVC or security code is asked for anywhere');

  const persisted = product
    .filter((f) => /server\/(app\/models|alembic)\//.test(f))
    .filter((f) => CARD.test(readFileSync(f, 'utf8')));
  if (persisted.length) bad(`a card field reaches persistence in ${persisted.map(rel).join(', ')}`);
  else ok('no card number or expiry is declared in a model or a migration');

  const stray = product.filter((f) => CARD.test(readFileSync(f, 'utf8'))).map(rel)
    .filter((f) => !CARD_PATH.has(f));
  if (stray.length) bad(`a card field appears outside the transient card path: ${stray.join(', ')}`);
  else ok(`card fields appear only in the ${CARD_PATH.size} files of the transient card path`);
}

/* ---------------------------------------------------- 8. a production build has no test-login UI at all */
if (process.env.SKIP_BUILD === '1') {
  head('production suppression — SKIP_BUILD=1, not run');
} else {
  head('production build — the test-login UI and its accounts are not in the bundle');
  const out = mkdtempSync(join(tmpdir(), 'hg-v16-'));
  try {
    for (const app of ['agency-web', 'university-web']) {
      execFileSync('npx', ['vite', 'build', '--outDir', join(out, app), '--emptyOutDir'], {
        cwd: join(ROOT, 'apps', app),
        env: { ...process.env, NODE_ENV: 'production', VITE_DEMO_LOGINS: '' },
        stdio: 'pipe', timeout: 600_000,
      });
      const js = [];
      const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|css)$/.test(e.name)) js.push(p); } };
      walk(join(out, app));
      const text = js.map((f) => readFileSync(f, 'utf8')).join('\n');
      const found = [];
      if (/demo\.hangyul\.kr/.test(text)) found.push('a seeded demo account address');
      if (/hg-testlogin/.test(text)) found.push('the test-login markup');
      if (/테스트 계정으로 로그인|Sign in with test account/.test(text)) found.push('the test-login label');
      if (/DEMO_PERSONAS/.test(text)) found.push('the persona list');
      if (found.length) bad(`${app} production build still contains ${found.join(', ')}`);
      else ok(`${app}: ${js.length} emitted files, 0 test-login strings, 0 demo account addresses`);
    }
  } catch (e) {
    bad(`production build check could not run: ${String(e.message).slice(0, 200)}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/* ----------------------------------------------------------------------------------------------- done */
await browser.close();
console.log('');
if (problems.length) {
  console.log(`V16 gate: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(skipped.length ? `V16 gate: OK, with ${skipped.length} check(s) skipped\n` + skipped.map((x) => `  – ${x}`).join('\n') : 'V16 gate: OK');
void existsSync;
