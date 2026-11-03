// V26 — measures the Hangyul-owned CSS cascade per web app (not the vendored template sources).
//   node scripts/qa/v26/css-metrics.mjs [--json out.json]
// For each app the stylesheets are read in the order the app loads them (main.tsx imports, then route-level imports).
// "Shadowed" = a declaration that a later rule with the identical selector, property, importance and at-rule context
// always overrides — it can never apply, so it is dead weight left by a later layer patching an earlier one.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const rel = (p) => path.relative(ROOT, p);

// Resolve the CSS imports of a TS/TSX file in source order (package specifiers mapped to their files).
const PKG = {
  '@hangyul/ui/styles.css': 'packages/ui/src/styles/index.css',
  '@hangyul/ui/console-v22.css': 'packages/ui/src/styles/console-v22.css',
};
function cssImports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of src.matchAll(/^import\s+['"]([^'"]+\.css)['"];?/gm)) {
    const spec = m[1];
    if (spec.startsWith('.')) out.push(path.resolve(path.dirname(file), spec));
    else if (PKG[spec]) out.push(path.join(ROOT, PKG[spec]));
  }
  return out;
}
// packages/ui index.css is a list of @import — expand it.
function expand(file) {
  const src = fs.readFileSync(file, 'utf8');
  const imports = [...src.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    .map((s) => (s === '@hangyul/design-tokens/tokens.css' ? path.join(ROOT, 'packages/design-tokens/tokens.css') : s.startsWith('.') ? path.resolve(path.dirname(file), s) : null))
    .filter(Boolean);
  return imports.length ? [...imports.flatMap(expand), file] : [file];
}
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); } else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}
function appOrder(app) {
  const src = path.join(ROOT, 'apps', app, 'src');
  const main = path.join(src, 'main.tsx');
  const order = [];
  const add = (f) => { for (const x of expand(f)) if (!order.includes(x)) order.push(x); };
  cssImports(main).forEach(add);
  for (const f of walk(src).sort()) if (f !== main) cssImports(f).forEach(add);
  return order;
}

function contextOf(node) {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') parts.unshift(`@${p.name} ${p.params}`);
  return parts.join(' | ');
}
const norm = (s) => s.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).sort().join(', ');

export function measure(files) {
  const seen = new Map(); // key -> {file, decl}
  const m = { files: files.length, versionFiles: 0, rules: 0, decls: 0, important: 0, literalColor: 0, literalFontSize: 0,
    shadowed: 0, shadowedByFile: {}, perFile: {} };
  for (const f of files) {
    if (/\/v\d+[^/]*\.css$/.test(f)) m.versionFiles += 1;
    const root = postcss.parse(fs.readFileSync(f, 'utf8'), { from: f });
    const pf = (m.perFile[rel(f)] = { rules: 0, decls: 0, important: 0, shadowed: 0 });
    root.walkRules((r) => {
      if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
      m.rules += 1; pf.rules += 1;
      const ctx = contextOf(r);
      r.walkDecls((d) => {
        if (d.parent !== r) return;
        m.decls += 1; pf.decls += 1;
        if (d.important) { m.important += 1; pf.important += 1; }
        if (!d.prop.startsWith('--') && /#[0-9a-f]{3,8}\b|\brgba?\(/i.test(d.value) && !/var\(/.test(d.value)) m.literalColor += 1;
        if (d.prop === 'font-size' && /\d(px|rem)/.test(d.value) && !/var\(/.test(d.value)) m.literalFontSize += 1;
        for (const sel of r.selector.split(',').map((s) => s.trim())) {
          const key = `${ctx}§${norm(sel)}§${d.prop}§${d.important ? 1 : 0}`;
          const prev = seen.get(key);
          if (prev && !prev.counted) {
            prev.counted = true; m.shadowed += 1;
            m.perFile[prev.file].shadowed += 1;
            m.shadowedByFile[`${prev.file} → ${rel(f)}`] = (m.shadowedByFile[`${prev.file} → ${rel(f)}`] ?? 0) + 1;
          }
          seen.set(key, { file: rel(f), counted: false });
        }
      });
    });
  }
  return m;
}

const APPS = ['marketing-web', 'student-web', 'agency-web', 'university-web'];
const report = {};
for (const app of APPS) {
  const files = appOrder(app);
  report[app] = { order: files.map(rel), ...measure(files) };
}
const jsonAt = process.argv.indexOf('--json');
if (jsonAt > 0) fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(report, null, 2));
console.log('app             files  vfiles  rules  decls  !imp  litColor  litFont  shadowed');
for (const [app, m] of Object.entries(report)) {
  console.log(`${app.padEnd(15)} ${String(m.files).padStart(5)} ${String(m.versionFiles).padStart(7)} ${String(m.rules).padStart(6)} ${String(m.decls).padStart(6)} ${String(m.important).padStart(5)} ${String(m.literalColor).padStart(9)} ${String(m.literalFontSize).padStart(8)} ${String(m.shadowed).padStart(9)}`);
}
