/**
 * V10 design-error sweep (brief Part 17) — the defect classes a screenshot review misses or reports
 * inconsistently, checked by measurement instead:
 *
 *   uneven card heights · inconsistent button heights · mixed border radii · elements overflowing their parent
 *   · text clipped by `overflow: hidden` without an ellipsis · interactive targets under 44 px · headings that
 *   skip a level · images with no intrinsic size (layout shift) · controls with no visible focus ring
 *   · content hidden behind the fixed header.
 *
 *   node scripts/qa/v10-design-errors.mjs [app] [width,width,…]
 *
 * `app` is marketing | student | agency | hq | university | all (default marketing). Console apps sign in
 * through Demo access first. The container-scoped rules follow the app: Koreanasha bands on the public site,
 * YNEX cards and tables in the consoles.
 */
import { chromium } from 'playwright';

const APPS = {
  marketing: { base: 'http://localhost:3100', scope: '.kn-band, .kn-hero', cards: '.kn-cards, .ed-work__grid', btn: '.kn-btn',
    routes: ['/', '/universities', '/universities/pusan-national-university', '/students', '/guides', '/how-it-works', '/trust'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', scope: '.hg-content', cards: '.hg-grid, .hg-cards', btn: '.hg-btn',
    routes: ['/', '/explore', '/compare', '/budget', '/applications', '/documents', '/essays', '/visa', '/housing', '/arrival', '/profile'] },
  agency: { base: 'http://localhost:3102', login: 'manager@lotus.demo.hangyul.kr', scope: '.yx-main, .hg-content', cards: '.row', btn: '.hg-btn',
    routes: ['/', '/students', '/documents', '/essays', '/applications', '/submissions', '/messages', '/performance', '/team', '/templates', '/vendors', '/services', '/payments', '/audit', '/universities', '/tasks', '/pipeline', '/settings'] },
  hq: { base: 'http://localhost:3102', login: 'ops@demo.hangyul.kr', scope: '.yx-main, .hg-content', cards: '.row', btn: '.hg-btn',
    routes: ['/hq', '/hq/agencies', '/hq/sources', '/hq/readiness', '/hq/assignments'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', scope: '.yx-main, .hg-content', cards: '.row', btn: '.hg-btn',
    routes: ['/', '/applicants', '/offers', '/documents', '/analytics', '/cohorts', '/programs', '/rules', '/scholarships', '/agencies', '/partnership', '/messages', '/exports', '/settings'] },
};

const APP = process.argv[2] ?? 'marketing';
const WIDTHS = (process.argv[3] ?? '1440,1024,768,390').split(',').map(Number);
const names = APP === 'all' ? Object.keys(APPS) : [APP];

const browser = await chromium.launch();
let total = 0;

for (const name of names) {
 const app = APPS[name];
 if (!app) { console.error(`unknown app ${name}`); process.exit(2); }
 const { base: BASE, routes: ROUTES } = app;
 for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  const page = await ctx.newPage();
  if (app.login) {
    await page.goto(`${BASE}/login?demo=${encodeURIComponent(app.login)}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.evaluate(async () => {
      for (const im of document.images) if (im.loading === 'lazy') im.loading = 'eager';
      await new Promise((r) => { let y = 0; const s = setInterval(() => { y += innerHeight; scrollTo(0, y); if (y > document.body.scrollHeight) { clearInterval(s); scrollTo(0, 0); r(); } }, 50); });
    });
    await page.waitForTimeout(600);

    const issues = await page.evaluate(({ scope, cards, btn }) => {
      const out = [];
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      // Visually-hidden text (the `hg-sr-only` pattern: a 1 px box with `clip`) exists to be clipped — it is
      // there for screen readers, so it is never a layout defect.
      const srOnly = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) return true;
        const cs = getComputedStyle(el);
        return cs.clip !== 'auto' || (cs.clipPath !== 'none' && cs.clipPath.includes('inset(50%'));
      };
      const name = (el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')}`;

      // 1. Cards in the same row must be the same height.
      for (const row of document.querySelectorAll(cards)) {
        const kids = [...row.children].filter(vis);
        const byTop = new Map();
        for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top); byTop.set(t, [...(byTop.get(t) ?? []), k]); }
        for (const [, group] of byTop) {
          if (group.length < 2) continue;
          const hs = group.map((g) => Math.round(g.getBoundingClientRect().height));
          if (Math.max(...hs) - Math.min(...hs) > 2) out.push(`uneven card heights in ${name(row)}: ${hs.join(' / ')}`);
        }
      }

      // 2. One button scale per page region: collect the distinct heights of primary-looking controls.
      const btnH = new Set();
      for (const b of document.querySelectorAll(btn)) if (vis(b)) btnH.add(Math.round(b.getBoundingClientRect().height));
      if (btnH.size > 4) out.push(`${btnH.size} distinct ${btn} heights: ${[...btnH].sort((a, b) => a - b).join(', ')}`);

      // 3. Touch targets.
      for (const el of document.querySelectorAll('a[href], button')) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 24 && el.closest('.kn-header, .kn-hero, .kn-cta, .app-header, .hg-topbar')) out.push(`target ${Math.round(r.height)}px tall: ${name(el)} "${(el.textContent || '').trim().slice(0, 24)}"`);
      }

      // 4. Anything wider than its parent (the classic cause of a horizontal scrollbar).
      for (const el of document.querySelectorAll(scope.split(', ').map((x) => `${x} *`).join(', '))) {
        if (!vis(el)) continue;
        const p = el.parentElement;
        if (!p) continue;
        const ps = getComputedStyle(p);
        if (ps.overflowX !== 'visible') continue;
        // `display: contents` generates no box, so its rect is 0×0 and any child "overflows" it. The same is
        // true of a zero-width measuring wrapper (Recharts' ResponsiveContainer renders one by design).
        if (ps.display === 'contents') continue;
        if (p.getBoundingClientRect().width < 1) continue;
        // A Bootstrap `.row` (and anything else using negative gutter margins) is wider than its parent on
        // purpose; that is a layout technique, not an overflow defect.
        const cs = getComputedStyle(el);
        if (parseFloat(cs.marginLeft) < 0 || parseFloat(cs.marginRight) < 0) continue;
        // 8 px, not 1: sub-pixel rounding and a charting library's own legend offset (Recharts places its
        // legend a few px outside the plot area, with overflow visible, clipping nothing) are not defects.
        // Real ones in this codebase were 28 px.
        const over = el.getBoundingClientRect().width - p.getBoundingClientRect().width;
        if (over > 8) out.push(`overflows parent by ${Math.round(over)}px: ${name(el)} in ${name(p)}`);
      }

      // 5. Clipped text without an ellipsis.
      for (const el of document.querySelectorAll(scope.split(', ').flatMap((x) => ['p', 'h1', 'h2', 'h3'].map((t) => `${x} ${t}`)).join(', '))) {
        if (!vis(el) || srOnly(el)) continue;
        const cs = getComputedStyle(el);
        // `-webkit-line-clamp` is a deliberate N-line truncation that renders its own ellipsis, so it is not a
        // clipped-text defect — only `overflow: hidden` with no ellipsis of any kind is.
        const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
        if (!clamped && cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && el.scrollHeight - el.clientHeight > 4) out.push(`text clipped: ${name(el)} "${(el.textContent || '').trim().slice(0, 30)}"`);
      }

      // 6. Heading levels must not skip.
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => +h.tagName[1]);
      for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) out.push(`heading jumps h${levels[i - 1]} → h${levels[i]}`);

      // 7. Images without intrinsic dimensions shift the layout as they load.
      for (const im of document.querySelectorAll(scope.split(', ').map((x) => `${x} img`).join(', '))) {
        if (!im.getAttribute('width') && !getComputedStyle(im).aspectRatio.includes('/')) out.push(`no intrinsic size: img ${(im.currentSrc || im.src).split('/').pop()}`);
      }

      // 8. Content hidden under the fixed pill header on load.
      const hdr = document.querySelector('.kn-header');
      if (hdr) {
        const hb = hdr.getBoundingClientRect().bottom;
        for (const h of document.querySelectorAll('h1')) {
          const r = h.getBoundingClientRect();
          if (r.top < hb && r.bottom > 0 && r.top > -200) out.push(`h1 under the fixed header (top ${Math.round(r.top)} < ${Math.round(hb)})`);
        }
      }
      // 9. A control clipped out of an ancestor that cannot be scrolled to reach it — i.e. unreachable.
      //    Check 4 cannot see this: it skips any parent whose `overflow-x` is not `visible`, which is exactly
      //    the case here. The pill header clips to its own border-radius, so at 320 px the burger sat 55 px
      //    outside it, fully rendered and fully unclickable, with no page overflow to give it away.
      for (const el of document.querySelectorAll('a[href], button, [role="button"], input, select, summary')) {
        if (!vis(el) || srOnly(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        // Reachability is per axis, and it ends at the first ancestor that scrolls on that axis: a tab strip
        // with `overflow-x: auto` can bring its last tab into view, so neither it nor any clipping box further
        // up hides that tab. Only a clip with no scroll anywhere below it makes a control unreachable.
        let liveX = true;
        let liveY = true;
        for (let p = el.parentElement; p && p !== document.body && (liveX || liveY); p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (p.scrollWidth - p.clientWidth > 2) liveX = false;
          if (p.scrollHeight - p.clientHeight > 2) liveY = false;
          const clipsX = ps.overflowX === 'hidden' || ps.overflowX === 'clip';
          const clipsY = ps.overflowY === 'hidden' || ps.overflowY === 'clip';
          if (!clipsX && !clipsY) continue;
          const pr = p.getBoundingClientRect();
          if (pr.width < 1 || pr.height < 1) continue;
          // 4 px of tolerance: a control deliberately bled to the edge of a rounded card is not unreachable.
          const outX = liveX && clipsX && (r.right - pr.right > 4 || pr.left - r.left > 4);
          const outY = liveY && clipsY && (r.bottom - pr.bottom > 4 || pr.top - r.top > 4);
          if (outX || outY) out.push(`control clipped out of reach: ${name(el)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" outside ${name(p)}`);
        }
      }

      return [...new Set(out)];
    }, { scope: app.scope, cards: app.cards, btn: app.btn });

    // 10. The first tab stop must be visibly indicated — by a ring, OR by the element itself changing
    //    (a skip link that slides into view on focus is indicated by appearing; demanding an outline as well
    //    would be the checker inventing a rule). Measured by focusing, then blurring, and comparing.
    await page.keyboard.press('Tab');
    const focusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      if ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none') return null;
      const a = el.getBoundingClientRect();
      const before = { bg: cs.backgroundColor, op: cs.opacity };
      el.blur();
      const b = el.getBoundingClientRect();
      const cs2 = getComputedStyle(el);
      const moved = Math.abs(a.top - b.top) > 2 || Math.abs(a.left - b.left) > 2
        || Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2;
      const repainted = before.bg !== cs2.backgroundColor || before.op !== cs2.opacity;
      el.focus();
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
      return (moved || repainted) ? null : `no visible focus indication on ${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0] || '(no class)'} "${label}"`;
    });
    if (focusRing) issues.push(focusRing);

    if (issues.length) {
      total += issues.length;
      console.log(`\n${name}${route} @${width}`);
      for (const i of issues) console.log(`  · ${i}`);
    }
  }
  await ctx.close();
 }
}
await browser.close();
console.log(`\n${total} design issue(s)`);
