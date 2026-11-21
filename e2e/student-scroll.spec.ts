/**
 * 261119 owner requirement 5 — "every Student page scrolls" (PDF p2: the 학업계획서 editor that could not scroll).
 *
 * For every Student route, at 320 / 390 / 768 / 1440, in Design Preview (synthetic fixtures, no API):
 *
 *   1. make the page taller than the viewport if it is not already (the essay editor gets a long draft typed into
 *      it; other pages get a spacer at the top of their content, so their real last element is pushed down);
 *   2. find the element that actually scrolls (the document, or a nested scroller if the page has one);
 *   3. scroll to the bottom the way a person does — keyboard End, then the mouse wheel over the middle of the page —
 *      and require that it moved;
 *   4. assert the page's last meaningful element is fully in view, above the fixed tab bar, and is the topmost
 *      element at its centre (nothing covers it); and that the page's primary action can be brought into view and
 *      is not covered;
 *   5. assert there is no page-level horizontal overflow.
 *
 * Needs a Design Preview build of the student app (`VITE_ENABLE_DESIGN_PREVIEW=1`):
 *
 *   HG_E2E_STUDENT_PREVIEW=http://localhost:4712 npx playwright test -c e2e/standalone.config.ts student-scroll
 *
 * `HG_SCROLL_OUT=<dir>` writes `scroll-results.json` and screenshots of the essay editor scrolled to the bottom.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { URLS } from './helpers';

const S = process.env.HG_E2E_STUDENT_PREVIEW ?? URLS.student;
const OUT = process.env.HG_SCROLL_OUT;
const VIEWPORTS = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
/** A DRAFT essay in the preview fixtures — the editable 학업계획서-style editor of the owner's screenshot. */
const ESSAY = '/essays/15d2d4d4-abaf-485c-9bad-a9b08f6eebe2';

/** Signed-in routes (Design Preview, paid variant) and the three public auth screens. */
const ROUTES: { path: string; auth?: false }[] = [
  ...['/', '/match', '/explore', '/explore?tab=all', '/explore?tab=saved', '/universities/pusan-national-university', '/compare', '/budget',
    '/applications', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', '/documents', '/essays', ESSAY,
    '/essays/b180b72a-e7b9-4ac3-a91a-6df3eac7bf35', '/tasks', '/messages', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d', '/notifications', '/visa', '/housing', '/arrival', '/help',
    '/scholarships', '/services', '/support', '/profile', '/settings', '/more', '/family'].map((path) => ({ path })),
  ...['/login', '/register', '/forgot'].map((path) => ({ path, auth: false as const })),
];

type Result = {
  route: string; viewport: string; ok: boolean; problems: string[];
  scroller: string; scrolled: number; maxScroll: number; injected: number; last: string | null; primary: string | null; hOverflow: number;
};
const results: Result[] = [];
/** Appended as each route finishes (a failed test restarts the worker, so nothing is kept for an `afterAll`). */
function record(r: Result) {
  results.push(r);
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  const f = join(OUT, 'scroll-results.json');
  const prev: Result[] = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as { results: Result[] }).results : [];
  const all = [...prev.filter((x) => !(x.route === r.route && x.viewport === r.viewport)), r];
  writeFileSync(f, JSON.stringify({ total: all.length, failed: all.filter((x) => !x.ok).length, results: all }, null, 2));
}

const LONG_ESSAY = Array.from({ length: 28 }, (_, i) =>
  `Paragraph ${i + 1}. I want to study business administration in Korea because the courses connect marketing with the export industries I grew up around. ` +
  'In my first year I will complete the Korean language sequence and reach TOPIK level 5, and after graduation I plan to work for a company that trades between our two countries.',
).join('\n\n');

async function open(page: Page, path: string, auth: boolean) {
  await page.goto(`${S}${path}${path.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'domcontentloaded' });
  if (auth) await page.locator('main#main').waitFor({ state: 'attached', timeout: 30_000 });
  else await page.locator('[data-auth-form]').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Marks the last meaningful element and the primary action; returns how tall a spacer is needed. */
async function prepare(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('main#main') ?? document.querySelector('[data-auth-form] main') ?? document.querySelector('[data-auth-form]') ?? document.body;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!(r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none')) return false;
      if (el.closest('[aria-hidden="true"], .hg-sr-only, .hg-preview-badge, .hg-tabbar, dialog:not([open])')) return false;
      // Inside a closed <details> (other than its summary) nothing is painted, although it still reports a box.
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (a.tagName === 'DETAILS' && !(a as HTMLDetailsElement).open && !el.closest('summary')?.parentElement?.isSameNode(a)) return false;
      }
      return true;
    };
    const candidates = [...root.querySelectorAll('p, li, h1, h2, h3, a, button, input, textarea, select, label, td, dd, figcaption, summary')]
      .filter((el) => visible(el) && (el.textContent?.trim() || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)));
    // The element whose bottom edge is lowest in the document is what the reader must be able to reach.
    const docY = (el: Element) => el.getBoundingClientRect().bottom + window.scrollY;
    const last = candidates.sort((a, b) => docY(b) - docY(a))[0] ?? null;
    document.querySelectorAll('[data-scroll-last],[data-scroll-primary]').forEach((e) => { e.removeAttribute('data-scroll-last'); e.removeAttribute('data-scroll-primary'); });
    last?.setAttribute('data-scroll-last', '');
    const primary = [...root.querySelectorAll('.hg-btn--primary, button[type="submit"]')].filter(visible).pop() ?? null;
    primary?.setAttribute('data-scroll-primary', '');
    const describe = (el: Element | null) => el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"` : null;
    return { need: Math.max(0, window.innerHeight * 1.5 - document.documentElement.scrollHeight), last: describe(last), primary: describe(primary) };
  });
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const last = document.querySelector('[data-scroll-last]');
    // The nearest ancestor that scrolls, else the document.
    let scroller: Element | null = last?.parentElement ?? null;
    while (scroller && scroller !== document.body) {
      const cs = getComputedStyle(scroller);
      if (/(auto|scroll)/.test(cs.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) break;
      scroller = scroller.parentElement;
    }
    const doc = !scroller || scroller === document.body;
    const se = document.scrollingElement!;
    return {
      scroller: doc ? 'document' : `${scroller!.tagName.toLowerCase()}.${String(scroller!.className).split(' ')[0]}`,
      top: doc ? se.scrollTop : scroller!.scrollTop,
      max: doc ? se.scrollHeight - se.clientHeight : scroller!.scrollHeight - scroller!.clientHeight,
      hOverflow: se.scrollWidth - se.clientWidth,
    };
  });
}

async function scrollToBottom(page: Page) {
  // Keyboard first (End on the page), then the wheel over the middle of the viewport, as a person would.
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
  await page.keyboard.press('End');
  await page.waitForTimeout(200);
  const vp = page.viewportSize()!;
  // The page first (wheel over the middle of the viewport), then — if the last element lives in a nested scroller,
  // such as the sticky filter rail — over that scroller, which is what a reader does with a side panel.
  const wheelUntilStill = async (x: number, y: number, read: () => Promise<number>) => {
    let prev = -1;
    for (let i = 0; i < 80; i += 1) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(60);
      const now = await read();
      if (now === prev) break;
      prev = now;
    }
  };
  await wheelUntilStill(vp.width / 2, vp.height / 2, () => page.evaluate(() => document.scrollingElement!.scrollTop));
  const nested = await page.evaluate(() => {
    let s: Element | null = document.querySelector('[data-scroll-last]')?.parentElement ?? null;
    while (s && s !== document.body) {
      const cs = getComputedStyle(s);
      if (/(auto|scroll)/.test(cs.overflowY) && s.scrollHeight > s.clientHeight + 1) break;
      s = s.parentElement;
    }
    if (!s || s === document.body) return null;
    s.setAttribute('data-scroll-nested', '');
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200) };
  });
  if (nested) await wheelUntilStill(nested.x, nested.y, () => page.evaluate(() => document.querySelector('[data-scroll-nested]')!.scrollTop));
  await page.waitForTimeout(250);
}

/** In view, above the tab bar, and the topmost element at its centre. */
async function reachable(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: true, why: 'none' };
    const r = el.getBoundingClientRect();
    const bar = document.querySelector('.hg-tabbar');
    // An overlay (drawer, modal, sheet) sits above the tab bar; only page content has to clear it.
    const inOverlay = !!el.closest('.hg-drawer, .hg-modal, .hg-locale__sheet, [role="dialog"]');
    const barTop = !inOverlay && bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : window.innerHeight;
    const bottom = Math.min(window.innerHeight, barTop);
    const header = inOverlay ? null : document.querySelector('.hg-snav');
    const top = header ? header.getBoundingClientRect().bottom : 0;
    if (r.bottom > bottom + 1) return { ok: false, why: `bottom ${Math.round(r.bottom)} > visible ${Math.round(bottom)}` };
    if (r.top < top - 1 && r.height < bottom - top) return { ok: false, why: `top ${Math.round(r.top)} under the header (${Math.round(top)})` };
    const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 40), 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, top + 1), bottom - 1);
    const hit = document.elementFromPoint(x, y);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) return { ok: false, why: `covered by ${hit.tagName.toLowerCase()}.${String(hit.className).split(' ')[0]}` };
    return { ok: true, why: '' };
  }, selector);
}

test.describe('every Student page scrolls to its end', () => {
  test.describe.configure({ timeout: 600_000 });


  for (const vp of VIEWPORTS) {
    test(`${vp.width}×${vp.height}`, async ({ browser }) => {
      const failures: string[] = [];
      for (const { path, auth } of ROUTES) {
        const signedIn = auth !== false;
        const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', ...(vp.width < 768 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
        if (signedIn) await ctx.addInitScript(() => { try { sessionStorage.setItem('hg.designPreview', 'paid'); } catch { /* ignore */ } });
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
        const res: Result = { route: path, viewport: `${vp.width}x${vp.height}`, ok: true, problems: [], scroller: '', scrolled: 0, maxScroll: 0, injected: 0, last: null, primary: null, hOverflow: 0 };
        try {
          await open(page, path, signedIn);
          if (signedIn && new URL(page.url()).pathname === '/login') {
            test.skip(true, 'this build has no Design Preview (VITE_ENABLE_DESIGN_PREVIEW=1)');
          }
          if (path === ESSAY) {
            // The owner's screenshot: a long draft must not trap the reader inside the editor.
            const ta = page.locator('textarea.sw-text--edit');
            expect(await ta.count(), 'the DRAFT essay opens in the editor').toBe(1);
            await ta.fill(LONG_ESSAY);
            await page.waitForTimeout(300);
            // The editor grows with the text: no inner scroller.
            const inner = await ta.evaluate((el) => el.scrollHeight - el.clientHeight);
            if (inner > 4) res.problems.push(`the editor scrolls inside itself (${inner}px)`);
          }
          const prep = await prepare(page);
          res.last = prep.last; res.primary = prep.primary;
          if (prep.need > 0) {
            // Push the real content down: a spacer *before* it, inside the page's own content column.
            res.injected = Math.round(prep.need);
            await page.evaluate((h) => {
              const host = document.querySelector('main#main > *') ?? document.querySelector('[data-auth-form] main > *') ?? document.querySelector('[data-auth-form] > *');
              const spacer = document.createElement('div');
              spacer.setAttribute('data-scroll-spacer', '');
              spacer.style.cssText = `block-size:${h}px;inline-size:1px`;
              host?.parentElement?.insertBefore(spacer, host);
            }, prep.need);
          }
          // Start from the top: a page may open scrolled (a chat thread opens at its newest message), and the test is that
          // a person can travel from the top to the end.
          await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); for (const el of document.querySelectorAll('main *')) if ((el as HTMLElement).scrollTop) (el as HTMLElement).scrollTop = 0; });
          await page.waitForTimeout(100);
          const before = await measure(page);
          await scrollToBottom(page);
          const after = await measure(page);
          res.scroller = after.scroller; res.scrolled = Math.round(after.top - before.top); res.maxScroll = Math.round(after.max); res.hOverflow = after.hOverflow;
          if (after.max > 0 && after.top < after.max - 2) res.problems.push(`did not reach the end (${Math.round(after.top)}/${Math.round(after.max)})`);
          if (after.max > 0 && res.scrolled <= 0) res.problems.push('End + wheel did not scroll');
          const last = await reachable(page, '[data-scroll-last]');
          if (!last.ok) res.problems.push(`last element not reachable: ${last.why}`);
          if (prep.primary) {
            await page.locator('[data-scroll-primary]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.waitForTimeout(150);
            const p = await reachable(page, '[data-scroll-primary]');
            if (!p.ok) res.problems.push(`primary action not clickable: ${p.why}`);
          }
          if (after.hOverflow > 1) res.problems.push(`horizontal overflow ${after.hOverflow}px`);
          if (path === ESSAY && OUT && (vp.width === 390 || vp.width === 1440)) {
            await scrollToBottom(page);
            mkdirSync(OUT, { recursive: true });
            await page.screenshot({ path: join(OUT, `essay-editor-${vp.width}-bottom.png`) });
            await page.evaluate(() => window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight / 2 - window.innerHeight / 2)));
            await page.waitForTimeout(200);
            await page.screenshot({ path: join(OUT, `essay-editor-${vp.width}-middle.png`) });
          }
          if (errors.length) res.problems.push(`page error: ${errors[0]}`);
        } catch (e) {
          if ((e as Error).message?.includes('Design Preview')) throw e;
          res.problems.push(`error: ${(e as Error).message.split('\n')[0].slice(0, 160)}`);
        }
        res.ok = res.problems.length === 0;
        record(res);
        if (!res.ok) failures.push(`${path}: ${res.problems.join('; ')}`);
        await ctx.close();
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }

  test('a drawer body scrolls and its footer stays reachable (Explore filters, 320 and 390)', async ({ browser }) => {
    for (const vp of VIEWPORTS.slice(0, 2)) {
      const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', isMobile: true, hasTouch: true });
      await ctx.addInitScript(() => { try { sessionStorage.setItem('hg.designPreview', 'paid'); } catch { /* ignore */ } });
      const page = await ctx.newPage();
      await open(page, '/explore?tab=all', true);
      await page.locator('.sx-filter-btn').click();
      const body = page.locator('.hg-drawer__body');
      await body.waitFor();
      await page.locator('.hg-drawer details summary').first().click().catch(() => undefined);
      const m = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
      await body.hover();
      for (let i = 0; i < 30; i += 1) await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
      const atEnd = await body.evaluate((el) => el.scrollTop >= el.scrollHeight - el.clientHeight - 2);
      expect(atEnd, `drawer body ${m.sh}/${m.ch} must scroll to its end`).toBe(true);
      const foot = await reachable(page, '.hg-drawer__foot .hg-btn--primary');
      expect(foot.ok, foot.why).toBe(true);
      record({ route: '/explore?tab=all [filter drawer]', viewport: `${vp.width}x${vp.height}`, ok: atEnd && foot.ok, problems: [], scroller: 'div.hg-drawer__body', scrolled: m.sh - m.ch, maxScroll: m.sh - m.ch, injected: 0, last: null, primary: 'drawer footer', hOverflow: 0 });
      await ctx.close();
    }
  });
});
