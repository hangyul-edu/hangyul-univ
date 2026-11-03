/**
 * The four things the final V14 polish pass fixed, asserted so they cannot come back (continuation brief,
 * "NEW REGRESSION CHECKS"). None of these judges whether the result is beautiful — that is what the
 * screenshots in `docs/qa/v14/logo-crop-fix/` and `docs/qa/v14/compose/` are for, and it belongs to a person.
 *
 *   1  No university logo is cut off at the top or the bottom.
 *   2  The university CTA on white has a border a reader can actually see.
 *   3  Nothing the reveal system touches is hidden when it cannot arm (no IntersectionObserver).
 *   4  `prefers-reduced-motion: reduce` gives a complete, still page.
 *
 * Check 1 is the one with history. `--c-scale` is an optical correction clamped to 0.88–1.10, and it used to
 * multiply the row height directly — so the clamp's own ceiling put eleven crests at 110 % of a row that has
 * `overflow: hidden`, and they were sliced top and bottom. The fix divides by `--kn-crest-fit`; this measures
 * the outcome rather than the CSS, so any future way of reintroducing the slice is caught too.
 *
 * Checks 3 and 4 exist because the failure mode of a scroll-reveal is not "the animation looks wrong", it is
 * "the content is invisible" — which is exactly what a CDN animation library does when it does not load.
 *
 *   node scripts/qa/v14-polish.mjs
 *   BASE=http://localhost:4720 node scripts/qa/v14-polish.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = (process.env.WIDTHS ?? '390,768,1440').split(',').map(Number);

/** WCAG 1.4.11's floor for the boundary of a user-interface component. */
const CONTROL_EDGE_MIN = 3;
/** Sub-pixel rounding in `getBoundingClientRect`; anything beyond this is a real slice. */
const CLIP_EPS = 0.5;

const problems = [];
const ok = (s) => console.log(`  ✓ ${s}`);

const rgb = (v) => (v.match(/rgba?\(([^)]+)\)/)?.[1] ?? '').split(',').map(Number).slice(0, 3);
function contrast(a, b) {
  const L = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const [x, y] = [L(a), L(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const scrollThrough = async (p) => {
  await p.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await p.waitForTimeout(600);
};

const browser = await chromium.launch();

/* ------------------------------------------------------------------ 1 + 2, at every width */
for (const width of WIDTHS) {
  console.log(`\n=== ${width}px ===`);
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await scrollThrough(p);

  // ---- 1. logo clipping
  const crests = await p.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const c of document.querySelectorAll('.kn-crest')) {
      const img = c.querySelector('img');
      if (!img) continue;
      const file = (img.getAttribute('src') || '').split('/').pop();
      if (seen.has(file)) continue;
      seen.add(file);
      const cb = c.getBoundingClientRect();
      const ib = img.getBoundingClientRect();
      // The row, not just the slot: `.kn-marquee` is what actually has `overflow: hidden`.
      const row = c.closest('.kn-marquee')?.getBoundingClientRect() ?? cb;
      out.push({
        file,
        overSlotTop: +(cb.top - ib.top).toFixed(2), overSlotBottom: +(ib.bottom - cb.bottom).toFixed(2),
        overRowTop: +(row.top - ib.top).toFixed(2), overRowBottom: +(ib.bottom - row.bottom).toFixed(2),
      });
    }
    return out;
  });
  if (!crests.length) problems.push(`${width}: no university crests found at all`);
  const clipped = crests.filter((c) => Math.max(c.overRowTop, c.overRowBottom, c.overSlotTop, c.overSlotBottom) > CLIP_EPS);
  if (clipped.length) {
    for (const c of clipped) {
      problems.push(`${width}: ${c.file} is cut off — ${Math.max(c.overRowTop, c.overSlotTop).toFixed(1)}px past the top, ${Math.max(c.overRowBottom, c.overSlotBottom).toFixed(1)}px past the bottom`);
    }
  } else ok(`${crests.length} university logos, none cut off at the top or bottom`);

  // ---- 2. the light-surface CTA reads as a control
  const cta = await p.evaluate(() => {
    const el = document.querySelector('.kn-crests__foot .kn-btn, .kn-btn--outline');
    if (!el) return null;
    const cs = getComputedStyle(el);
    let behind = 'rgb(255, 255, 255)';
    for (let e = el.parentElement; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { behind = c; break; }
    }
    return {
      border: cs.borderTopColor, width: parseFloat(cs.borderTopWidth), bg: cs.backgroundColor,
      color: cs.color, behind, height: Math.round(el.getBoundingClientRect().height),
      label: el.innerText.trim(), pointer: cs.pointerEvents,
    };
  });
  if (!cta) {
    problems.push(`${width}: the university section has no call to action`);
  } else {
    const edge = contrast(rgb(cta.border), rgb(cta.behind));
    const fill = contrast(rgb(cta.bg), rgb(cta.behind));
    const best = Math.max(edge, fill);
    if (!(cta.width >= 1)) problems.push(`${width}: the university CTA has no border (${cta.width}px)`);
    if (best < CONTROL_EDGE_MIN) {
      problems.push(`${width}: the university CTA is ${best.toFixed(2)}:1 against its surface, needs ${CONTROL_EDGE_MIN}:1 — "${cta.label}" does not read as a control`);
    } else ok(`university CTA "${cta.label}": ${cta.width}px border at ${edge.toFixed(2)}:1, label ${contrast(rgb(cta.color), rgb(cta.bg)).toFixed(1)}:1, ${cta.height}px tall`);
    if (cta.height < 44) problems.push(`${width}: the university CTA is ${cta.height}px tall, below the 44px touch target`);
    // A reveal must never gate an action: a delayed entrance is fine, an unclickable button is not.
    if (cta.pointer === 'none') problems.push(`${width}: the university CTA has pointer-events: none — a reveal is delaying clickability`);
  }
  await ctx.close();
}

/* ------------------------------------------------------------------ 3. the reveal's own script never runs */
{
  // Marketing is a client-rendered app, so switching JavaScript off produces no document at all — there is
  // nothing to assert about, and a check that passes because it found zero elements is worse than no check.
  // The failure this is really guarding is narrower and far more likely: **the page renders, and the thing
  // that was supposed to reveal it does not run.** That is what a CDN animation library does when it 404s,
  // and the reason `Reveal`'s resting state is visible rather than hidden. It is reproduced here by taking
  // `IntersectionObserver` away before any application code sees it.
  console.log('\n=== IntersectionObserver missing (the reveal cannot arm) ===');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { get: () => undefined, configurable: true });
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await scrollThrough(p);
  const r = await p.evaluate(() => {
    const reveals = [...document.querySelectorAll('.kn-reveal')];
    return {
      total: reveals.length,
      armed: reveals.filter((el) => el.classList.contains('kn-reveal--armed')).length,
      faded: reveals.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
        .map((el) => `${el.className.toString().slice(0, 40)} @ ${getComputedStyle(el).opacity}`),
      headingText: document.querySelector('#services-title')?.textContent?.trim().slice(0, 24) ?? null,
    };
  });
  if (!r.total) {
    problems.push('IO-missing: the homepage rendered no reveal elements at all — the page itself did not come up');
  } else if (r.faded.length) {
    for (const f of r.faded) problems.push(`IO-missing: content stayed hidden — ${f}`);
  } else if (r.armed) {
    problems.push(`IO-missing: ${r.armed} reveal(s) armed without an observer to un-arm them`);
  } else {
    ok(`${r.total} reveals, 0 armed, 0 hidden — the page is simply the finished page (e.g. "${r.headingText}")`);
  }
  await ctx.close();
}

/* ------------------------------------------------------------------ 4. reduced motion */
{
  console.log('\n=== prefers-reduced-motion: reduce ===');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await scrollThrough(p);
  const r = await p.evaluate(() => {
    const reveals = [...document.querySelectorAll('.kn-reveal')];
    const hidden = reveals.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
      .map((el) => el.className.toString().slice(0, 40));
    const moved = reveals.filter((el) => {
      const t = getComputedStyle(el).transform;
      return t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
    }).map((el) => el.className.toString().slice(0, 40));
    const armed = reveals.filter((el) => el.classList.contains('kn-reveal--armed')).length;
    const animated = [...document.querySelectorAll('.kn-marquee__track')]
      .filter((el) => getComputedStyle(el).animationName !== 'none').length;
    return { total: reveals.length, hidden, moved, armed, animated };
  });
  if (r.hidden.length) for (const h of r.hidden) problems.push(`reduced motion: content left faded — ${h}`);
  if (r.moved.length) for (const m of r.moved) problems.push(`reduced motion: content left translated — ${m}`);
  if (r.armed) problems.push(`reduced motion: ${r.armed} reveal(s) were armed anyway`);
  if (r.animated) problems.push(`reduced motion: ${r.animated} marquee track(s) still animating`);
  if (!r.hidden.length && !r.moved.length && !r.armed && !r.animated) {
    ok(`${r.total} reveals, 0 armed, 0 faded, 0 translated, 0 marquee tracks animating — a complete still page`);
  }
  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.error(`\nPolish gate: ${problems.length} problem(s)\n`);
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nPolish gate: OK — no logo is cut off, the light-surface CTA reads as a control, and the page is complete both with motion off and with the reveal unable to arm.');
