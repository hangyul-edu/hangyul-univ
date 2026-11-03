// V10: dead-CSS detection against the real DOM, not against a source grep.
// `prune-css.mjs` (V8) asks "is this class name a substring of any source file?", which keeps every rule a
// superseded-but-still-present component mentions. This asks the browser "does this selector match anything on
// any route, at any width, in any state we can reach?" — and prints candidates for review. It never writes.
// Usage: node scripts/qa/v10-dead-css.mjs <css-or-scss...>
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import postcss from 'postcss';

const FILES = process.argv.slice(2);
const BASE = 'http://127.0.0.1:3100';
const ROUTES = ['/', '/universities', '/how-it-works', '/services', '/guides', '/costs', '/about', '/contact', '/trust', '/privacy', '/terms'];
const WIDTHS = [1440, 390];

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
const matched = new Set();
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' }).catch(() => {});
    // Open the mobile menu so its selectors are reachable, then measure; a closed menu is still in the DOM.
    await page.evaluate(() => document.querySelector('.kn-burger')?.click()).catch(() => {});
    const hits = await page.evaluate((sels) => sels.filter((s) => { try { return document.querySelector(s) !== null; } catch { return true; } }), [...wanted.keys()]);
    for (const h of hits) matched.add(h);
  }
}
await browser.close();

const dead = [...wanted.entries()].filter(([s]) => !matched.has(s));
console.log(`${wanted.size} selectors checked · ${matched.size} matched · ${dead.length} matched nothing`);
for (const [s, m] of dead) console.log(`  ${m.file}:${m.line}  ${m.raw}`);
