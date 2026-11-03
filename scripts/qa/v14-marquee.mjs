/**
 * Marquee continuity gate (V14, brief Part 7).
 *
 * A screenshot cannot prove that a loop is seamless — the seam is one frame per iteration and lands wherever
 * the clock happens to be. This samples a live row **continuously for longer than one full cycle** and checks
 * four things that a tear would break, at the two widths the brief names.
 *
 *   geometry     the two groups measure the same width, and the animated distance is exactly one group.
 *                This is the root cause of the V13 defect: a track with its own `gap` made `-50%` land half a
 *                gap short, so every iteration jumped backwards by half a gap. Measured, not eyeballed.
 *   coverage     no viewport-wide blank region: at every sample, crests cover the row from edge to edge.
 *   continuity   the track's own transform never moves backwards by more than the step it should, so the
 *                iteration boundary is invisible rather than a jump.
 *   seam         the crest after the last crest of group A is the first crest of group A again, which is what
 *                makes the belt read as infinite rather than as a list played twice.
 *
 * It also asserts the three rows' directions and that reduced motion stops the belt completely.
 *
 *   node scripts/qa/v14-marquee.mjs                 # 390 and 1440
 *   WIDTHS=1440 CYCLES=1.4 node scripts/qa/v14-marquee.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = (process.env.WIDTHS ?? '390,1440').split(',').map(Number);
/** How much of a full animation cycle to watch. Over 1.0 so at least one iteration boundary is crossed. */
const CYCLES = Number(process.env.CYCLES ?? 1.15);
const SAMPLE_MS = 100;

const problems = [];
const note = (s) => console.log(`  ${s}`);

const browser = await chromium.launch();

for (const width of WIDTHS) {
  console.log(`\n=== ${width}px ===`);
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await page.locator('.kn-crests').scrollIntoViewIfNeeded();
  // Every crest decoded before anything is measured: a row still loading is narrower than it will be, and
  // that alone would make the geometry check wrong in both directions.
  await page.waitForFunction(() => [...document.querySelectorAll('.kn-crest__img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  await page.waitForTimeout(300);

  const rows = await page.locator('.kn-crests .kn-marquee').count();
  if (rows !== 3) problems.push(`${width}: ${rows} marquee rows, expected 3 (brief Part 7)`);
  else note(`rows: 3`);

  // ---- directions: left, right, left
  const dirs = await page.$$eval('.kn-crests .kn-marquee__track',
    (ts) => ts.map((t) => (getComputedStyle(t).animationDirection === 'reverse' ? 'right' : 'left')));
  const wantDirs = ['left', 'right', 'left'];
  if (dirs.join() !== wantDirs.join()) problems.push(`${width}: directions ${dirs.join('/')}, expected ${wantDirs.join('/')}`);
  else note(`directions: ${dirs.join(' · ')}`);

  const durations = await page.$$eval('.kn-crests .kn-marquee__track', (ts) => ts.map((t) => getComputedStyle(t).animationDuration));
  note(`durations: ${durations.join(' · ')}`);

  // ---- geometry, per row
  const geo = await page.$$eval('.kn-crests .kn-marquee', (ms) => ms.map((m) => {
    const groups = [...m.querySelectorAll('.kn-marquee__group')];
    const [a, b] = groups.map((g) => g.getBoundingClientRect().width);
    const track = m.querySelector('.kn-marquee__track');
    return {
      groups: groups.length,
      a, b,
      track: track.getBoundingClientRect().width,
      trackGap: getComputedStyle(track).columnGap,
      viewport: m.getBoundingClientRect().width,
    };
  }));
  geo.forEach((g, i) => {
    if (g.groups !== 2) problems.push(`${width} row ${i + 1}: ${g.groups} groups, expected exactly 2`);
    const delta = Math.abs(g.a - g.b);
    if (delta > 0.5) problems.push(`${width} row ${i + 1}: groups differ by ${delta.toFixed(2)}px (${g.a.toFixed(1)} vs ${g.b.toFixed(1)}) — the clone is not identical`);
    // The whole bug in one assertion: -50% of the track must equal one group.
    const half = g.track / 2;
    const off = Math.abs(half - g.a);
    if (off > 0.5) problems.push(`${width} row ${i + 1}: -50% travels ${half.toFixed(2)}px but a group is ${g.a.toFixed(2)}px (off by ${off.toFixed(2)}px) — the loop will tear once per iteration`);
    if (g.trackGap !== 'normal' && parseFloat(g.trackGap) > 0) {
      problems.push(`${width} row ${i + 1}: the track has column-gap ${g.trackGap}; the gap belongs on the group, or -50% lands half a gap short`);
    }
    if (g.a < g.viewport) problems.push(`${width} row ${i + 1}: a group (${g.a.toFixed(0)}px) is narrower than the row (${g.viewport.toFixed(0)}px) — a blank gap will cross the screen`);
    note(`row ${i + 1}: group ${g.a.toFixed(1)}px = track/2 ${half.toFixed(1)}px, viewport ${g.viewport.toFixed(0)}px`);
  });

  // ---- continuous sampling over more than one cycle
  const seconds = Math.max(...durations.map((d) => parseFloat(d)));
  const samples = Math.ceil((seconds * CYCLES * 1000) / SAMPLE_MS);
  note(`sampling ${samples} frames over ${(seconds * CYCLES).toFixed(1)}s (cycle ${seconds}s)`);

  const series = await page.evaluate(async ({ n, every }) => {
    const rows = [...document.querySelectorAll('.kn-crests .kn-marquee')];
    const out = rows.map(() => []);
    for (let s = 0; s < n; s++) {
      rows.forEach((m, i) => {
        const box = m.getBoundingClientRect();
        const track = m.querySelector('.kn-marquee__track');
        const mx = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
        // Widest horizontal run inside the row that no crest covers.
        const spans = [...m.querySelectorAll('.kn-crest')]
          .map((c) => c.getBoundingClientRect())
          .filter((r) => r.right > box.left && r.left < box.right)
          .map((r) => [Math.max(r.left, box.left), Math.min(r.right, box.right)])
          .sort((p, q) => p[0] - q[0]);
        let cursor = box.left;
        let gap = 0;
        for (const [l, r] of spans) {
          if (l > cursor) gap = Math.max(gap, l - cursor);
          cursor = Math.max(cursor, r);
        }
        gap = Math.max(gap, box.right - cursor);
        out[i].push({ x: mx, gap });
      });
      await new Promise((r) => setTimeout(r, every));
    }
    return out;
  }, { n: samples, every: SAMPLE_MS });

  series.forEach((row, i) => {
    const worstGap = Math.max(...row.map((s) => s.gap));
    // A crest is at most ~140px wide plus a 40px gap; anything beyond that is a hole, and anything approaching
    // the viewport width is the "viewport-wide blank region" the brief rules out.
    const limit = 200;
    if (worstGap > limit) problems.push(`${width} row ${i + 1}: a ${worstGap.toFixed(0)}px blank gap appeared mid-loop (limit ${limit}px)`);

    // Continuity: between two samples the track moves by one step; at the iteration boundary it wraps by
    // exactly one group. Any OTHER backwards jump is a tear.
    const g = geo[i].a;
    let jumps = 0;
    for (let k = 1; k < row.length; k++) {
      let d = row[k].x - row[k - 1].x;
      // Unwrap the legitimate boundary wrap in either direction.
      if (Math.abs(d + g) < g * 0.25) d += g;
      if (Math.abs(d - g) < g * 0.25) d -= g;
      if (Math.abs(d) > g * 0.25) jumps += 1;
    }
    if (jumps) problems.push(`${width} row ${i + 1}: ${jumps} discontinuous jump(s) in ${row.length} samples`);
    note(`row ${i + 1}: worst blank ${worstGap.toFixed(0)}px, ${jumps} discontinuity`);
  });

  // ---- seam: group B's first crest must continue group A's last
  const seam = await page.$$eval('.kn-crests .kn-marquee', (ms) => ms.map((m) => {
    const [a, b] = [...m.querySelectorAll('.kn-marquee__group')];
    const names = (g) => [...g.querySelectorAll('.kn-crest__img')].map((i) => i.closest('a')?.dataset.university ?? i.alt);
    const A = names(a), B = names(b);
    return { same: A.length === B.length && A.every((v, i) => v === B[i]), first: A[0], last: A[A.length - 1], bFirst: B[0] };
  }));
  seam.forEach((s, i) => {
    if (!s.same) problems.push(`${width} row ${i + 1}: group B is not an exact clone of group A`);
    if (s.last === s.bFirst) problems.push(`${width} row ${i + 1}: "${s.last}" is adjacent to itself across the seam`);
  });
  if (!problems.length) note('seam: group B clones group A, no adjacent duplicate at the joint');

  // ---- accessibility: each university reachable once
  const a11y = await page.evaluate(() => {
    const first = document.querySelector('.kn-crests .kn-marquee__group');
    const all = [...document.querySelectorAll('.kn-crests .kn-crest')];
    const reachable = all.filter((c) => !c.closest('[aria-hidden="true"]') && !c.closest('[inert]'));
    return { total: all.length, reachable: reachable.length, perRowFirstGroup: first.querySelectorAll('.kn-crest').length };
  });
  note(`crests rendered ${a11y.total}, reachable by keyboard ${a11y.reachable}`);

  await ctx.close();
}

// ---- reduced motion stops it completely
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await page.locator('.kn-crests').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const tracks = [...document.querySelectorAll('.kn-crests .kn-marquee__track')];
    const moving = tracks.filter((t) => getComputedStyle(t).animationName !== 'none').length;
    const visible = [...document.querySelectorAll('.kn-crests .kn-crest')].filter((c) => c.getBoundingClientRect().width > 0).length;
    const dupVisible = [...document.querySelectorAll('.kn-crests .kn-crest')]
      .filter((c) => c.getBoundingClientRect().width > 0 && (c.closest('[aria-hidden="true"]') || c.closest('[data-kn-dup]'))).length;
    return { moving, visible, dupVisible };
  });
  console.log(`\n=== prefers-reduced-motion ===`);
  note(`animated tracks: ${r.moving} (expected 0)`);
  note(`crests shown: ${r.visible}, of which duplicates: ${r.dupVisible} (expected 0)`);
  if (r.moving) problems.push(`reduced motion: ${r.moving} track(s) still animating`);
  if (r.dupVisible) problems.push(`reduced motion: ${r.dupVisible} duplicate crest(s) visible — each university must appear once`);
  if (r.visible !== 23) problems.push(`reduced motion: ${r.visible} crests shown, expected the 23 unique marks`);
  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.error(`\nMarquee continuity: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\nMarquee continuity: OK — 3 rows × ${WIDTHS.length} width(s), sampled past one full cycle, no seam, no blank region, reduced motion static.`);
