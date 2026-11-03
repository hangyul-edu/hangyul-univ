// Checks that every selector a CSS prune removed is genuinely unable to match anything (REPORT §69.12).
//
// Two weaker tests were tried first and are worth recording. Comparing capture phases is useless here: two runs
// of identical code differ on ~37 console views, because the dev server injects CSS through JavaScript and a
// screenshot can land before a chunk applies. Injecting the removed rules back and diffing screenshots is
// closer, but the injected copy sits last in the cascade and outranks the position it used to hold, so it
// reports differences that the removal never caused.
//
// Asking the DOM whether a selector matches is exact, and it is the test that found the one real mistake: a
// rule written as a `:is()` list of four alternatives, three dead and one live, which the pruner treated as a
// conjunction and deleted — handing `text-transform: capitalize` back to live headings.
//
// Usage: node scripts/qa/v10-removed-css-probe.mjs <before> <after> [<before> <after> ...]
// Each pair is one stylesheet as it was and as it now is; the removed selectors are the difference.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import postcss from 'postcss';

// postcss cannot read `//` comments or `@use`; blanking them keeps the line count and the rules intact.
const deScss = (src) => src.split('\n')
  .map((l) => (/^\s*@(use|forward)\b/.test(l) ? '' : l.replace(/(^|[\s{;])\/\/.*$/, '$1')))
  .join('\n');

// Each selector is kept with the declarations it carried, so a hit can be judged on effect, not on identity.
const rulesOf = (file) => {
  const out = new Map();
  postcss.parse(deScss(readFileSync(file, 'utf8'))).walkRules((r) => {
    if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
    const decls = r.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value]);
    r.selectors.forEach((s) => out.set(s, decls));
  });
  return out;
};

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) throw new Error('give before/after file pairs');
const sels = new Map();
for (let i = 0; i < args.length; i += 2) {
  const before = rulesOf(args[i]);
  const after = rulesOf(args[i + 1]);
  for (const [s, decls] of before) if (!after.has(s)) sels.set(s, decls);
}
// Pseudo-elements and interaction states are unreachable at rest; what is left is the structural part.
const strip = (s) => s.replace(/::[a-z-]+(\([^)]*\))?/g, '').replace(/:(hover|focus|focus-visible|active|visited|disabled|checked|not\([^)]*\))/g, '').trim();

const BASE = { marketing: 'http://localhost:3100', student: 'http://localhost:3101', agency: 'http://localhost:3102', university: 'http://localhost:3103' };
const PERSONA = { student: 'min.ji@student.demo.hangyul.kr', agency: 'counselor@seoulpath.demo.hangyul.kr', university: 'admissions@pusan.univ.demo.hangyul.kr' };
const ROUTES = {
  marketing: ['/', '/guides', '/services', '/students', '/how-it-works', '/trust', '/universities'],
  student: ['/', '/explore', '/documents'],
  agency: ['/', '/students', '/messages', '/pipeline', '/documents'],
  university: ['/', '/analytics', '/cohorts', '/applicants'],
};
const WIDTHS = [1440, 390];

const hits = new Map();
const browser = await chromium.launch();
for (const [app, routes] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (PERSONA[app]) {
    await page.goto(`${BASE[app]}/login?demo=${encodeURIComponent(PERSONA[app])}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1800);
  }
  for (const route of routes) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE[app] + route, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(900);
      // Open the mobile menu so offcanvas selectors are reachable too.
      await page.evaluate(() => document.querySelector('.kn-burger')?.click()).catch(() => {});
      // A selector that still matches is only a defect if the declarations it carried are gone from the
      // element too. They usually are not: a prune may rewrite a selector rather than delete it (PurgeCSS
      // trims dead alternatives out of an `:is()` list), and then the same declaration arrives under a
      // different name. Comparing the computed value against what the removed rule declared separates the two.
      const probeList = [...sels].map(([s, decls]) => [strip(s), s, decls]).filter(([t]) => t);
      const found = await page.evaluate((list) => list.flatMap(([structural, raw, decls]) => {
        let el;
        try { el = document.querySelector(structural); } catch { return []; }
        if (!el) return [];
        const cs = getComputedStyle(el);
        // `lost` means the element no longer shows what the removed rule asked for. Values are compared as the
        // browser resolves them, so `none` vs `none` agrees however each was written.
        const lost = decls.filter(([prop, value]) => {
          const now = cs.getPropertyValue(prop).trim();
          const want = String(value).replace(/\s*!important\s*$/, '').trim();
          return now !== '' && want !== '' && now !== want;
        }).map(([prop, value]) => `${prop}: ${value} → ${cs.getPropertyValue(prop).trim()}`);
        return [[raw, lost]];
      }), probeList);
      for (const [f, lost] of found) {
        const prev = hits.get(f);
        hits.set(f, { where: prev?.where ?? `${app}${route} @${w}`, lost: prev?.lost?.length ? prev.lost : lost });
      }
    }
  }
  await ctx.close();
}
await browser.close();

const lostHits = [...hits].filter(([, v]) => v.lost.length > 0);
console.log(`${sels.size} removed selectors · ${hits.size} still match an element · ${lostHits.length} lost their effect`);
for (const [s, v] of hits) {
  const verdict = v.lost.length ? `EFFECT LOST  ${v.lost.join(', ')}` : 'effect still delivered by another rule';
  console.log(`  STILL MATCHES ${s}   (${v.where}) — ${verdict}`);
}
// Only a lost effect is a defect; a rewritten selector that still delivers its declarations is not.
process.exitCode = lostHits.length === 0 ? 0 : 1;
