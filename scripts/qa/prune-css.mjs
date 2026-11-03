// V8 design-system cleanup: removes selectors whose classes are referenced nowhere in the given source roots.
// Usage: node scripts/qa/prune-css.mjs <css...> -- <src roots...>   (dry run unless PRUNE=1)
// V10: `.scss` inputs are accepted too. postcss cannot parse `//` comments or `@use`, so an SCSS file
// is parsed from a copy with those blanked out — line for line, so every rule keeps its real line number — and
// the edits are then applied to the original by line, which is what keeps the file's comments intact.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const cssFiles = argv.slice(0, sep);
const roots = argv.slice(sep + 1);
const walk = (d) => statSync(d).isFile() ? [d] : readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : /\.(tsx?|mjs|html)$/.test(f) ? [p] : []; });
const src = roots.flatMap(walk).map((f) => readFileSync(f, 'utf8')).join('\n');
const used = (c) => {
  if (src.includes(c)) return true;
  const base = c.split('--')[0];
  return base !== c && src.includes(`${base}--`);
};
// A compound selector needs every class it names, so one dead class kills it. The arguments of `:is()`,
// `:where()` and `:matches()` are the exception: they are alternatives, and the selector still applies as long
// as one of them is live. V10 learned this the hard way: the rule that stops the Eduan template capitalizing
// headings listed four alternatives, three of which died with the V7 hero while the fourth still renders on
// every home page. Treating that list as a conjunction deleted the rule and handed `text-transform:
// capitalize` back to the Trust counters (REPORT §69.12).
//
// Careful with examples in this file: `used()` greps the source roots, and this script is inside one of them,
// so a class name written in a comment here would mark that class live everywhere. Do not name classes here.
const deadSelector = (sel) => {
  const names = (s) => [...s.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  // The split below reads one level of parentheses. A nested functional pseudo-class would be parsed wrongly,
  // and the wrong direction is deletion, so anything that deep is kept and left for a human.
  if (/:(?:is|where|matches|any)\([^()]*\(/.test(sel)) return false;
  const lists = [];
  const outside = sel.replace(/:(?:is|where|matches|any)\(([^()]*)\)/g, (_, args) => { lists.push(args); return ' '; });
  if (names(outside).some((c) => !used(c))) return true;
  // A list is dead only when every alternative in it is.
  for (const args of lists) {
    const alts = args.split(',').map((a) => a.trim()).filter(Boolean);
    if (alts.length > 0 && alts.every((a) => names(a).length > 0 && names(a).some((c) => !used(c)))) return true;
  }
  return names(sel).length > 0 && lists.length === 0 && names(sel).some((c) => !used(c));
};
// Blank out what postcss cannot read, without changing the line count.
const deScss = (src) => src
  .split('\n')
  .map((l) => (/^\s*@(use|forward)\b/.test(l) ? '' : l.replace(/(^|[\s{;])\/\/.*$/, '$1')))
  .join('\n');

// An SCSS rule may span lines, so each edit is recorded against the original file's line range.
function pruneScss(f, before) {
  const root = postcss.parse(deScss(before));
  const lines = before.split('\n');
  const drop = new Set();
  let removed = 0;
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    const keep = rule.selectors.filter((s) => !deadSelector(s));
    if (keep.length === rule.selectors.length) return;
    removed += rule.selectors.length - keep.length;
    const a = rule.source.start.line - 1;
    const b = rule.source.end.line - 1;
    if (keep.length === 0) {
      for (let i = a; i <= b; i++) drop.add(i);
      // A `// ---` banner or comment line directly above a removed rule described only that rule.
      for (let i = a - 1; i >= 0 && /^\s*\/\//.test(lines[i]); i--) drop.add(i);
    } else {
      // Keep the surviving selectors; the declarations stay where they are.
      const head = lines[a].slice(0, lines[a].indexOf('{'));
      lines[a] = lines[a].replace(head, `${keep.join(', ')} `);
    }
  });
  let out = lines.filter((_, i) => !drop.has(i)).join('\n');
  // An at-rule left with nothing in it, and the runs of blank lines the removals leave behind.
  out = out.replace(/@media[^{]*\{\s*\}\n?/g, '').replace(/\n{3,}/g, '\n\n');
  return { out, removed };
}

let total = 0;
for (const f of cssFiles) {
  const before = readFileSync(f, 'utf8');
  if (f.endsWith('.scss')) {
    const { out, removed } = pruneScss(f, before);
    total += removed;
    console.log(`${f}: ${removed} selectors, ${before.length} → ${out.length} bytes`);
    if (process.env.PRUNE === '1') writeFileSync(f, out);
    continue;
  }
  const root = postcss.parse(before);
  let removed = 0;
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    const keep = rule.selectors.filter((s) => !deadSelector(s));
    if (keep.length === rule.selectors.length) return;
    removed += rule.selectors.length - keep.length;
    if (keep.length === 0) rule.remove(); else rule.selectors = keep;
  });
  root.walkAtRules((at) => { if (at.nodes && at.nodes.length === 0) at.remove(); });
  const after = root.toString();
  total += removed;
  console.log(`${f}: ${removed} selectors, ${before.length} → ${after.length} bytes`);
  if (process.env.PRUNE === '1') writeFileSync(f, after);
}
console.log('total selectors', total, process.env.PRUNE === '1' ? '(written)' : '(dry run)');
