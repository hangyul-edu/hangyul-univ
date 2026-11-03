/**
 * V19 — frame-accurate traces of the homepage's editorial entrances (REPORT §192).
 *
 * V18 retuned the editorial duration tokens and added a gate over their values, but nobody watched the
 * result; "calm, cinematic, deliberate" was an intention, not a finding. This measures the thing a visitor
 * actually experiences.
 *
 * Two notes on method, both of which the first draft of this script got wrong:
 *
 *  - **Measure the animated node.** `SectionHead`'s `<Reveal>` wraps the heading, so the heading's own
 *    computed opacity is always 1 and a trace of it reports a page with no animation at all. The script
 *    walks up from the selector to the first ancestor whose `transition-property` actually includes
 *    opacity, which is the element the CSS is moving.
 *  - **Start before React does.** The hero arms and plays on mount, so a recorder installed after
 *    `domcontentloaded` has already missed it. The recorder is injected with `addInitScript` and begins at
 *    document start.
 *
 * What is being judged, rather than the duration token:
 *
 *   dead    how long the element is still invisible *after* it is on screen — what reads as "broken"
 *   settle  when it reaches rest; against a normal trackpad flick (~1000 px/s) anything past ~1.2 s has
 *           finished off-screen, which is the owner's "content appearing after the user already passed it"
 *   travel  how far it moves, in px
 */
import { chromium } from '@playwright/test';

const TARGETS = [
  ['hero headline', '.kn-hero__title', false],
  ['hero lede', '.kn-hero__lede', false],
  ['hero actions', '.kn-hero__actions', false],
  ['services heading', '#services .kn-head__title', true],
  ['services lede', '#services .kn-head__lede', true],
  ['pricing cards', '#pricing .kn-plan', true],
  ['service photo (media)', '#services .kn-mediarow__media .kn-reveal', true],
  ['service row text', '#services .kn-mediarow__title', true],
  ['university marquee', '.kn-marquee', true],
  ['pricing heading', '#pricing .kn-head__title', true],
  ['faq heading', '#faq .kn-head__title', true],
  ['closing cta', '.kn-cta__title', true],
];

const RECORDER = `
window.__hgTrace = (sel, ms) => new Promise((resolve) => {
  const start = performance.now();
  // The animated node is not the one the selector names, and which one it is depends on the variant.
  // SectionHead's <Reveal variant="rise"> *wraps* the heading, so the wrapper moves and the heading's own
  // opacity is always 1. A <Reveal variant="stagger"> is the opposite: the container stays at opacity 1 by
  // design and its direct children are what the CSS animates (\`[data-reveal='stagger'] > *\`). Resolving
  // this by "walk up to the first ancestor with an opacity transition" lands on the stagger container and
  // reports a page with no animation on it, which is what the first run of this script claimed.
  const find = () => {
    const seed = document.querySelector(sel);
    if (!seed) return null;
    const wrap = seed.closest('.kn-reveal');
    if (!wrap) return seed;
    if (wrap.getAttribute('data-reveal') !== 'stagger') return wrap;
    // Stagger: the child on this branch, or the first child if the selector *is* the container.
    let child = seed === wrap ? wrap.firstElementChild : seed;
    while (child && child.parentElement !== wrap) child = child.parentElement;
    return child || wrap;
  };
  const samples = [];
  let enteredAt = null;
  const tick = () => {
    const t = performance.now() - start;
    const el = find();
    if (el) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const inView = r.top < window.innerHeight && r.bottom > 0;
      if (inView && enteredAt === null) enteredAt = t;
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
      samples.push({ t, o: Number(cs.opacity), ty: Math.round(m.m42), inView });
    }
    if (t > ms) return resolve({ samples, enteredAt });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
await ctx.addInitScript(RECORDER);
const page = await ctx.newPage();

console.log('element'.padEnd(20), 'dead'.padStart(6), 'settle'.padStart(8), 'travel'.padStart(7), '  opacity over 1.6s after entry');

for (const [name, sel, below] of TARGETS) {
  await page.goto('http://localhost:3100/?lang=ko', { waitUntil: 'commit' });

  let trace;
  if (below) {
    await page.waitForSelector(sel, { state: 'attached', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // Park it just below the fold, start recording, then bring it in the way a reader's scroll would.
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - window.innerHeight - 40, behavior: 'instant' });
    }, sel);
    await page.waitForTimeout(400);
    trace = await page.evaluate(async ({ s, ms }) => {
      const p = window.__hgTrace(s, ms);
      setTimeout(() => window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: 'instant' }), 150);
      return p;
    }, { s: sel, ms: 2400 });
  } else {
    // The hero plays on mount; the recorder is already installed, so just start it immediately.
    trace = await page.evaluate(({ s, ms }) => window.__hgTrace(s, ms), { s: sel, ms: 2600 });
  }

  if (!trace || !trace.samples.length) { console.log(name.padEnd(20), '  (not found)'); continue; }
  const { samples, enteredAt } = trace;
  const visible = samples.filter((x) => x.inView);
  const moved = visible.find((x) => x.o > 0.02);
  const settled = visible.find((x) => x.o >= 0.99 && Math.abs(x.ty) <= 1);
  const travel = Math.max(0, ...samples.map((x) => Math.abs(x.ty)));
  const base = enteredAt ?? 0;
  const curve = Array.from({ length: 10 }, (_, i) => {
    const want = base + i * 160;
    const s = samples.reduce((a, b) => (Math.abs(b.t - want) < Math.abs(a.t - want) ? b : a));
    return '▁▂▃▄▅▆▇█'[Math.min(7, Math.max(0, Math.round(s.o * 7)))];
  }).join('');

  console.log(
    name.padEnd(20),
    String(moved ? Math.round(moved.t - base) : '-').padStart(6),
    String(settled ? Math.round(settled.t - base) : '>2400').padStart(8),
    String(travel).padStart(7),
    '  ' + curve,
  );
}
await browser.close();
