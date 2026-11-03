// V26 (REPORT §348) — remove, at source, the marketing rules the production build has been purging since V7.
//
// Until V26 the shared Vite config purged `apps/marketing-web/src/styles.css` and `src/v6.css` *by file path* at build
// time (PurgeCSS, same options as the licensed template adapters). The V26 consolidation merged those files into
// `src/styles/base.css`; the path no longer matched, the purge silently stopped, and the production entry stylesheet grew
// 249 → 276 KB — rules nobody had seen in production for nineteen releases shipped again. Dev had always served them.
//
// The fix is one source of truth: apply exactly the build's PurgeCSS options (imported from packages/config/vite.ts) to
// base.css once, write the result, and retire the path rule. Then dev and production serve the same app layer.
//
//   node scripts/qa/v26/prune-marketing-base.mjs            # dry run: counts + removed selectors → docs/qa/v26/evidence/
//   node scripts/qa/v26/prune-marketing-base.mjs --apply    # write base.css (a copy of the original is kept beside the list)
//   node scripts/qa/v26/prune-marketing-base.mjs --probe    # DOM test on the running marketing dev server: every removed
//                                                           # selector must match nothing on every route at 1440 and 390
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { purgeCSSPlugin } from '@fullhuman/postcss-purgecss';
import { templatePurgeOptions } from '../../../packages/config/vite.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const FILE = path.join(ROOT, 'apps/marketing-web/src/styles/base.css');
const WORK = path.join(ROOT, 'docs/qa/v26/evidence');
const COPY = path.join(WORK, 'base.before-prune.css');
const LIST = path.join(WORK, 'base.pruned-selectors.txt');
const apply = process.argv.includes('--apply'); const probe = process.argv.includes('--probe');

const selectorsOf = (css) => { const out = []; postcss.parse(css).walkRules((r) => { if (!r.parent || r.parent.type !== 'atrule' || !/keyframes/.test(r.parent.name)) out.push(r.selector); }); return out; };

// Rules PurgeCSS drops by mistake and that must stay: its `:where(a, b, c)` handling needs *every* alternative to be
// used, so one tag that no marketing page renders (`blockquote`) killed the RTL bidi rule for all the others. The same
// conjunction mistake V10 met in `:is()` (REPORT §69.12). Kept in source; the build no longer purges this file.
const KEEP = [/^\[dir='rtl'\] :where\(/];
if (!probe) {
  const before = fs.readFileSync(FILE, 'utf8');
  const result = await postcss([purgeCSSPlugin(templatePurgeOptions)]).process(before, { from: FILE, to: FILE, map: false });
  const kept = new Set(selectorsOf(result.css));
  const removed = selectorsOf(before).filter((s) => !kept.has(s) && !KEEP.some((re) => re.test(s)));
  const removedSet = new Set(removed);
  // Apply the removal to the original tree (not PurgeCSS's output) so comments, provenance markers and formatting stay.
  const root = postcss.parse(before, { from: FILE });
  root.walkRules((r) => { if (removedSet.has(r.selector) && !(r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name))) r.remove(); });
  root.walkAtRules((at) => { if (/^(media|supports|container|layer)$/.test(at.name) && at.nodes && at.nodes.every((n) => n.type === 'comment')) at.remove(); });
  const after = root.toString().replace(/\n{3,}/g, '\n\n');
  const rulesBefore = selectorsOf(before).length, rulesAfter = selectorsOf(after).length;
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(LIST, removed.join('\n') + '\n');
  console.log(`base.css: ${rulesBefore} rules → ${rulesAfter} · removed ${removed.length} selectors (kept on purpose: ${selectorsOf(before).filter((s) => KEEP.some((re) => re.test(s))).length}) · ${(before.length / 1024).toFixed(1)} KB → ${(after.length / 1024).toFixed(1)} KB · list: ${path.relative(ROOT, LIST)}`);
  if (apply) { if (!fs.existsSync(COPY)) fs.writeFileSync(COPY, before); fs.writeFileSync(FILE, after); console.log(`written ${path.relative(ROOT, FILE)} (original kept at ${path.relative(ROOT, COPY)})`); }
  else console.log('dry run — pass --apply to write');
} else {
  const { chromium } = await import('@playwright/test');
  const removed = fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean);
  // Each comma-separated alternative is tested on its own: a list is live if any alternative matches.
  const splitTop = (sel) => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  const alts = [...new Set(removed.flatMap(splitTop))];
  const ROUTES = ['/', '/universities', '/universities/yonsei-university', '/universities/pusan-national-university', '/universities/kaya-university', '/universities/inst-2640', '/universities/seoul-national-university', '/start', '/legal/terms', '/legal/privacy', '/services', '/pricing', '/about', '/agencies', '/universities-partners'];
  const browser = await chromium.launch(); const hits = new Map();
  for (const w of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' }); const p = await ctx.newPage();
    for (const r of ROUTES) {
      const res = await p.goto(`http://localhost:3100${r}?lang=ko`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
      if (!res || res.status() >= 400) continue;
      await p.waitForTimeout(300);
      const matched = await p.evaluate((sels) => sels.filter((s) => { try { return document.querySelector(s.replace(/::?(before|after|placeholder|marker)\b/g, '').replace(/:(hover|focus|focus-visible|focus-within|active|visited)\b/g, '')) !== null; } catch { return false; } }), alts);
      for (const m of matched) hits.set(m, [...(hits.get(m) || []), `${r}@${w}`]);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`probe: ${alts.length} removed selector alternatives × ${ROUTES.length} routes × 2 widths — ${hits.size} still match an element`);
  for (const [s, where] of hits) console.log(`  LIVE  ${s}  ←  ${where.slice(0, 4).join(' ')}`);
  process.exit(hits.size ? 1 : 0);
}
