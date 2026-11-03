// V11: the V10 dead-CSS detector, generalised to the authenticated consoles (brief Part 16 — "find CSS that
// still influences the current UI accidentally; the UI should not be the sum of ten redesigns").
//
// It asks the browser "does this selector match anything, on any route, at any width?" rather than grepping the
// source, so a rule kept alive only by a class name appearing in a dead file is still reported. It never writes.
//
//   BASE=http://localhost:3101 LOGIN=student@demo.hangyul.kr \
//   ROUTES=/,/explore,/applications node scripts/qa/v11-dead-css.mjs <css...>
//
// A reported selector is a *candidate*: a rule may legitimately match only in a state these routes cannot reach
// (an error, an empty list, a modal). Every removal below was checked by hand before it was made.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import postcss from 'postcss';

const FILES = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const LOGIN = process.env.LOGIN ?? '';
const ROUTES = (process.env.ROUTES ?? '/,/universities,/credits,/privacy,/terms').split(',');
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);

// Selector text → something `querySelectorAll` can answer. Pseudo-elements and interaction/state pseudo-classes
// are unreachable at rest, so they are stripped; what remains is the structural part the rule needs.
const structural = (sel) => sel
  .replace(/::[a-z-]+(\([^)]*\))?/g, '')
  .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|disabled|checked|placeholder|placeholder-shown|first-line|first-letter|backdrop|selection|-webkit-[a-z-]+)(\([^)]*\))?/g, '')
  .trim();

// postcss parses CSS, not SCSS: `//` comments and `@use` are syntax errors. Neither style file in this repo
// nests with `&`, so dropping those two constructs is enough to parse them — and a rule nested inside another
// gets its ancestors' selectors prepended below, which is the part that actually affects what it matches.
const deScss = (src) => src
  .split('\n')
  .filter((l) => !/^\s*@(use|forward)\b/.test(l))
  .map((l) => l.replace(/(^|[\s{;])\/\/.*$/, '$1'))
  .join('\n');

const full = (rule) => {
  let sels = rule.selectors;
  for (let p = rule.parent; p && p.type === 'rule'; p = p.parent) sels = p.selectors.flatMap((a) => sels.map((b) => `${a} ${b}`));
  return sels;
};

const wanted = new Map();   // structural selector → {file, line, raw}
for (const f of FILES) {
  const src = deScss(readFileSync(f, 'utf8'));
  postcss.parse(src).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    for (const raw of full(rule)) {
      if (/^(:root|html|body|\*|from|to|[0-9])/.test(raw.trim())) continue;
      const s = structural(raw);
      if (!s || !/[.#[]/.test(s)) continue;             // element-only selectors are not what we are pruning
      if (s.includes('&')) continue;                     // unresolved SCSS nesting
      if (!wanted.has(s)) wanted.set(s, { file: f, line: rule.source?.start?.line ?? 0, raw });
    }
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();
if (LOGIN) {
  await page.goto(`${BASE}/login?demo=${encodeURIComponent(LOGIN)}`);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
}
const matched = new Set();
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);   // queries resolve; a skeleton's selectors are not the ones we want
    // Open whichever menu this surface has, so its selectors are reachable; a closed menu is still in the DOM.
    await page.evaluate(() => (document.querySelector('.kn-burger') ?? document.querySelector('.hg-burger'))?.click()).catch(() => {});
    const hits = await page.evaluate((sels) => sels.filter((s) => { try { return document.querySelector(s) !== null; } catch { return true; } }), [...wanted.keys()]);
    for (const h of hits) matched.add(h);
  }
}
await browser.close();

const dead = [...wanted.entries()].filter(([s]) => !matched.has(s));
console.log(`${wanted.size} selectors checked · ${matched.size} matched · ${dead.length} matched nothing`);
for (const [s, m] of dead) console.log(`  ${m.file}:${m.line}  ${m.raw}`);
