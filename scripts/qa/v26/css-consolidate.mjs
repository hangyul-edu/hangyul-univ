// V26 — CSS archaeology removal (REPORT §338/§347, RC-03).
//   node scripts/qa/v26/css-consolidate.mjs [--dry]
//
// Every pass since V6 added `vN.css` last in the cascade instead of editing the rule's owner. This turns each app's
// version-named stylesheets into purpose-named canonical files under `src/styles/`:
//   1. MERGE   — the files of one group are concatenated in their existing load order, so the cascade is unchanged; each
//                source keeps its own comments under a one-line provenance marker.
//   2. DEDUPE  — inside one merged file, a declaration is deleted when a LATER rule with the identical selector list,
//                property, importance and at-rule context exists in the same file: it can never apply. Duplicates inside a
//                single rule are kept (they are deliberate fallbacks, e.g. `height: 100vh; height: 100dvh`).
//   3. REWIRE  — imports are pointed at the new files and the old files are deleted.
// Lazily loaded files stay lazily loaded (their own group), so a page never pays for another page's CSS.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const DRY = process.argv.includes('--dry');
const A = (app, f) => path.join(ROOT, 'apps', app, 'src', f);

// group → [sources in load order], plus which files import the group (relative import specifiers are recomputed).
const PLAN = {
  'marketing-web': [
    { out: 'styles/base.css', title: 'Marketing base — page chrome and the shared marketing vocabulary (formerly styles.css + v6.css).', from: ['styles.css', 'v6.css'] },
    { out: 'styles/site.css', title: 'Site-wide compositions loaded by SiteLayout: header, footer, CTA system, directory cards (formerly v23 + v24 + v25).', from: ['v23.css', 'v24.css', 'v25.css'] },
    { out: 'styles/home.css', title: 'Home page: university crest band, pricing (formerly v11 + v15; loaded by pages/Home).', from: ['v11.css', 'v15.css'] },
    { out: 'styles/start.css', title: 'The public eligibility check /start (formerly v17; loaded by pages/Start).', from: ['v17.css'] },
    { out: 'styles/directory.css', title: 'University directory, region map and the legal documents (formerly v12; loaded per page).', from: ['v12.css'] },
    { out: 'styles/university.css', title: 'Public university pages — directory cards and detail (formerly v20; loaded per page).', from: ['v20.css'] },
  ],
  'student-web': [
    { out: 'styles/app.css', title: 'Student app — every screen-level composition, in the order the passes added them (formerly styles.css + v2 … v25).',
      from: ['styles.css', 'v2.css', 'v4.css', 'v7.css', 'v9.css', 'v15.css', 'v16.css', 'v22.css', 'v24.css', 'v25.css'] },
  ],
  'agency-web': [
    { out: 'styles/base.css', title: 'Agency console base — before the shared white console surface (formerly styles.css + ynex-agency.css).', from: ['styles.css', 'ynex-agency.css'] },
    { out: 'styles/screens.css', title: 'Agency console screens — Today, students, workspace, review, operations, HQ (formerly v8 … v25).',
      from: ['v8.css', 'v8-ops.css', 'v8-secondary.css', 'v8-hq.css', 'v9.css', 'v15.css', 'v22.css', 'v25.css'] },
  ],
  'university-web': [
    { out: 'styles/base.css', title: 'University console base — before the shared white console surface (formerly styles.css + ynex-university.css).', from: ['styles.css', 'ynex-university.css'] },
    { out: 'styles/screens.css', title: 'University console screens — applicants, review, analytics, cohorts (formerly v8 … v25).',
      from: ['v8-university.css', 'v9-university.css', 'v15.css', 'v22-university.css', 'v25.css'] },
  ],
};

function contextOf(node) {
  const parts = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') parts.unshift(`@${p.name} ${p.params}`);
  return parts.join(' | ');
}
const norm = (s) => s.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).sort().join(', ');

/** Removes declarations shadowed later in the same file. Returns { css, removed }. */
export function dedupe(css) {
  const root = postcss.parse(css);
  const decls = [];
  root.walkRules((r) => {
    if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
    const ctx = contextOf(r);
    const sel = norm(r.selector);
    r.each((d) => { if (d.type === 'decl') decls.push({ d, rule: r, key: `${ctx}§${sel}§${d.prop}§${d.important ? 1 : 0}` }); });
  });
  const last = new Map();
  decls.forEach((x, i) => last.set(x.key, i));
  let removed = 0;
  decls.forEach((x, i) => {
    const j = last.get(x.key);
    if (j > i && decls[j].rule !== x.rule) { x.d.remove(); removed += 1; }
  });
  // Rules left with no declarations (and no nested content) go too.
  root.walkRules((r) => { if (!r.nodes?.some((n) => n.type !== 'comment')) r.remove(); });
  return { css: root.toString(), removed };
}

const report = [];
// `--shared`: the shared package stylesheets. university.css is deduplicated within itself; console.css (the V6 blue console,
// applied only under html[data-product]/[data-surface] = the two consoles) loses every declaration that console-v22.css —
// imported by both consoles after it — redeclares for the same selector and context: on every page where console.css
// applies, console-v22.css applies later and wins.
if (process.argv.includes('--shared')) {
  const U = path.join(ROOT, 'packages/ui/src/styles');
  const uni = dedupe(fs.readFileSync(path.join(U, 'university.css'), 'utf8'));
  report.push(`packages/ui university.css — ${uni.removed} shadowed declarations removed`);
  const later = postcss.parse(fs.readFileSync(path.join(U, 'console-v22.css'), 'utf8'));
  const keys = new Set();
  later.walkRules((r) => { const ctx = contextOf(r); const sel = norm(r.selector); r.each((d) => { if (d.type === 'decl') keys.add(`${ctx}§${sel}§${d.prop}§${d.important ? 1 : 0}`); }); });
  const early = postcss.parse(fs.readFileSync(path.join(U, 'console.css'), 'utf8'));
  let n = 0;
  early.walkRules((r) => { const ctx = contextOf(r); const sel = norm(r.selector); r.each((d) => { if (d.type === 'decl' && keys.has(`${ctx}§${sel}§${d.prop}§${d.important ? 1 : 0}`)) { d.remove(); n += 1; } }); });
  early.walkRules((r) => { if (!r.nodes?.some((x) => x.type !== 'comment')) r.remove(); });
  report.push(`packages/ui console.css — ${n} declarations removed (always overridden by console-v22.css)`);
  if (!DRY) { fs.writeFileSync(path.join(U, 'university.css'), uni.css); fs.writeFileSync(path.join(U, 'console.css'), early.toString()); }
  console.log(report.join('\n'));
  process.exit(0);
}
for (const [app, groups] of Object.entries(PLAN)) {
  const src = path.join(ROOT, 'apps', app, 'src');
  const tsx = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) tsx.push(p); } };
  walk(src);
  for (const g of groups) {
    const parts = g.from.map((f) => `/* ── from ${f} ${'─'.repeat(Math.max(4, 100 - f.length))} */\n${fs.readFileSync(A(app, f), 'utf8').trim()}\n`);
    const merged = `/* ${g.title}\n   V26 (REPORT §347): one canonical file instead of version layers; the order inside is the original cascade order.\n   Declarations a later rule with the same selector and context always overrode were removed (scripts/qa/v26/css-consolidate.mjs). */\n\n${parts.join('\n')}`;
    const { css, removed } = dedupe(merged);
    report.push(`${app}/${g.out}: ${g.from.join(' + ')} — ${removed} shadowed declarations removed`);
    if (DRY) continue;
    fs.mkdirSync(path.dirname(A(app, g.out)), { recursive: true });
    fs.writeFileSync(A(app, g.out), css);
    // Rewire every import of the group's sources: the FIRST import in a file becomes the group import, the rest go.
    for (const file of tsx) {
      let code = fs.readFileSync(file, 'utf8');
      let changed = false; let placed = false;
      for (const f of g.from) {
        const spec = path.relative(path.dirname(file), A(app, f)).replace(/\\/g, '/');
        const rel = spec.startsWith('.') ? spec : `./${spec}`;
        const re = new RegExp(`^import '${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}';\\n`, 'm');
        if (!re.test(code)) continue;
        const target = path.relative(path.dirname(file), A(app, g.out)).replace(/\\/g, '/');
        code = code.replace(re, placed ? '' : `import '${target.startsWith('.') ? target : `./${target}`}';\n`);
        placed = true; changed = true;
      }
      if (changed) fs.writeFileSync(file, code);
    }
    for (const f of g.from) fs.unlinkSync(A(app, f));
  }
}
console.log(report.join('\n'));
