/**
 * V11 — confirm a dead-CSS candidate two independent ways before anything is deleted (brief Part 16).
 *
 * `v11-dead-css.mjs` asks the browser "did this selector match on any route I visited?". That alone is not
 * enough to delete a rule: a selector can be real and only match in a state the sweep never reached — a modal,
 * an error, an empty list, a hover. So a rule is only reported here when **both** are true:
 *
 *   1. it matched nothing in the DOM sweep, and
 *   2. none of its class names appears anywhere in the app's TSX/TS source.
 *
 * (2) is what rules out the unreached-state case: if no component can ever produce the class, no state can.
 *
 *   node scripts/qa/v11-dead-css-confirm.mjs <sweep-output.txt> <source-dir...>
 *
 * Pass every directory whose components can appear on those routes: the app's own src, and each shared
 * package's src. (Writing the glob for those inside this block comment would close it early.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [sweepFile, ...srcDirs] = process.argv.slice(2);

/** Every .ts/.tsx file under a directory, concatenated — class names are matched as plain substrings. */
function sources(dir) {
  let out = '';
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out += sources(p);
    else if (/\.(tsx?|mdx?)$/.test(e)) out += readFileSync(p, 'utf8');
  }
  return out;
}

// Every source directory the app can render from — its own, AND the shared packages. Scanning only the app
// reports shared classes (`hg-tabbar`, `hg-chip`) as dead when the rule styles a component from `packages/ui`,
// which is how four live locale-conditional tab-bar rules were nearly deleted.
const src = srcDirs.map(sources).join('');
const lines = readFileSync(sweepFile, 'utf8').split('\n').filter((l) => /^\s{2}\S+\.s?css:\d+\s/.test(l));

const confirmed = [];
const keep = [];
for (const line of lines) {
  const m = line.match(/^\s{2}(\S+):(\d+)\s+(.*)$/);
  if (!m) continue;
  const [, file, lineNo, selector] = m;
  const classes = [...selector.matchAll(/\.([A-Za-z][\w-]*)/g)].map((x) => x[1]);
  if (classes.length === 0) { keep.push([selector, 'no class name']); continue; }
  // The rule is only dead if EVERY class in it is absent from the source. One live class keeps it.
  const absent = classes.filter((c) => !src.includes(c));
  if (absent.length === classes.length) confirmed.push({ file, line: Number(lineNo), selector, classes });
  else keep.push([selector, `still referenced: ${classes.filter((c) => src.includes(c)).join(', ')}`]);
}

console.log(`${lines.length} DOM-sweep candidates · ${confirmed.length} confirmed dead (absent from source too) · ${keep.length} kept\n`);
const byFile = {};
for (const c of confirmed) (byFile[c.file] ??= []).push(c);
for (const [f, rows] of Object.entries(byFile)) {
  console.log(`${f} — ${rows.length}`);
  for (const r of rows) console.log(`  :${r.line}  ${r.selector}`);
}
