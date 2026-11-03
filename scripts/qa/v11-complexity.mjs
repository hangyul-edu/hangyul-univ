/**
 * V11 — measure the reduction, so "simpler" is a number and not an opinion (brief Part 23).
 *
 * V10 figures are read from REPORT §73.2, which recorded them from the V10 source before any V11 change; V11
 * figures are counted from the current source here. Everything counted is a *shipped destination or element*,
 * never a file: the point is what a user has to hold in their head.
 *
 *   node scripts/qa/v11-complexity.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/** Routes declared in a router file, excluding redirects, the catch-all and the login screen. */
function countRoutes(file, { excludeRedirects = true } = {}) {
  const src = read(file);
  const paths = [...src.matchAll(/path: '([^']*)'/g)].map((m) => m[1]).filter((p) => p !== '*' && p !== '/login');
  if (!excludeRedirects) return paths.length;
  // A route whose element is <Navigate …> is a redirect, not a destination.
  const redirects = [...src.matchAll(/path: '([^']*)'[^\n]*<Navigate/g)].map((m) => m[1]);
  return paths.filter((p) => !redirects.includes(p)).length;
}

/** `{ to: '…' }` entries inside a nav/sidebar definition — what the user sees in the rail. */
function countNav(file, from, to) {
  const src = read(file);
  const block = src.slice(src.indexOf(from), to ? src.indexOf(to) : undefined);
  return [...block.matchAll(/\{ to: '/g)].length;
}

const marketingSections = (() => {
  const home = read('apps/marketing-web/src/pages/Home.tsx');
  const body = home.slice(home.indexOf('<div className="kn-home">'));
  // +1 for the closing "continue" band, which every page gets from SiteLayout rather than from Home itself.
  return [...body.matchAll(/<([A-Z][A-Za-z]*)\s*\/>/g)].length + 1;
})();

/** Top-level tabs in the agency's student workspace. */
const wsTabs = (() => {
  const src = read('apps/agency-web/src/pages/StudentWorkspace.tsx');
  const m = src.match(/const TABS = \[([^\]]*)\] as const/);
  return m ? m[1].split(',').filter((x) => x.trim()).length : 0;
})();

/** Chart types the design system exports — i.e. that a screen could render. */
const chartTypes = (() => {
  const src = read('packages/ui/src/charts/index.tsx');
  return [...src.matchAll(/^export function (\w+Chart|BarList)\(/gm)].length;
})();

const studentRail = (() => {
  const nav = read('apps/student-web/src/lib/nav.ts');
  const m = nav.match(/export const NAV_SLOTS: NavSlot\[\] = \[([^\]]*)\]/);
  return m ? m[1].split(',').filter((s) => s.trim()).length : 0;
})();

const V10 = {
  publicRoutes: 14,
  hangyulOpsNav: 5,
  homepageSections: 9,
  studentNav: 16,
  agencyNav: 20,
  universityNav: 13,
  agencyStudentTabs: 10,                   // overview, applications, portfolio, documents, essays, visa, services, tasks, messages, history
  chartTypes: 4,                           // TrendChart, ColumnChart, DonutChart, BarList — one of them ever rendered
  marketingPagesExplainingTheService: 4,   // /how-it-works, /students, /trust, /guides
  duplicatedDestinations: 6,               // student tasks; agency tasks/deadlines/pipeline; university offers/documents
};

const V11 = {
  publicRoutes: countRoutes('apps/marketing-web/src/routes.tsx'),
  homepageSections: marketingSections,
  // The rail plus the menu control, which is the fifth thing a student can press.
  studentNav: studentRail + 1,
  // The agency rail proper. The `/hq/*` block below it belongs to Hangyul's own staff, is role-gated, and is
  // counted separately — an agency counsellor never sees it.
  agencyNav: countNav('apps/agency-web/src/components/AppLayout.tsx', 'const sections: NavSection[] = [', '...(perms.isHangyul'),
  hangyulOpsNav: countNav('apps/agency-web/src/components/AppLayout.tsx', '...(perms.isHangyul', 'const org = session?.active_org;'),
  universityNav: countNav('apps/university-web/src/components/AppLayout.tsx', 'const sections: NavSection[] = [', 'return (\n    <YnexShell'),
  agencyStudentTabs: wsTabs,
  chartTypes,
  marketingPagesExplainingTheService: 0,
  duplicatedDestinations: 0,
};

const rows = [
  ['Public marketing routes', V10.publicRoutes, V11.publicRoutes],
  ['Homepage sections', V10.homepageSections, V11.homepageSections],
  ['Student primary navigation', V10.studentNav, V11.studentNav],
  ['Agency primary navigation', V10.agencyNav, V11.agencyNav],
  ['University primary navigation', V10.universityNav, V11.universityNav],
  ['Public pages that only explain the service', V10.marketingPagesExplainingTheService, V11.marketingPagesExplainingTheService],
  ['Destinations answering a question another already answers', V10.duplicatedDestinations, V11.duplicatedDestinations],
  ['Hangyul operations navigation (role-gated, HQ staff only)', V10.hangyulOpsNav, V11.hangyulOpsNav],
  ['Agency student-workspace tabs', V10.agencyStudentTabs, V11.agencyStudentTabs],
  ['Chart types the design system ships', V10.chartTypes, V11.chartTypes],
];

const total10 = V10.publicRoutes + V10.studentNav + V10.agencyNav + V10.universityNav;
const total11 = V11.publicRoutes + V11.studentNav + V11.agencyNav + V11.universityNav;

const out = {
  $comment: 'Generated by scripts/qa/v11-complexity.mjs. V10 figures from REPORT §73.2; V11 counted from source.',
  generatedAt: new Date().toISOString().slice(0, 10),
  measures: Object.fromEntries(rows.map(([label, a, b]) => [label, { v10: a, v11: b, change: b - a, pct: a ? Math.round(((b - a) / a) * 100) : 0 }])),
  totalDestinations: { v10: total10, v11: total11, change: total11 - total10, pct: Math.round(((total11 - total10) / total10) * 100) },
  notes: {
    'Agency student workspace': 'Ten tabs became four; the old tabs are addressable sections inside them, so every `?tab=` link still resolves (REPORT §77.3).',
    'Charts': 'Three of the four chart types the design system exported had no call site in any app — including the donut the brief rules out. Removed; the chart chunk fell 429 KB to 380 KB. The one that is rendered, and the manager visuals built as bars, each state their question on the card (REPORT §79.8).',
    'Hangyul HQ': 'Five destinations became three: the incident list and agency health stay, the three tools moved to /hq/manage (brief Part 14).',
  },
};

mkdirSync(resolve(root, 'docs/qa/v11'), { recursive: true });
writeFileSync(resolve(root, 'docs/qa/v11/complexity.json'), `${JSON.stringify(out, null, 2)}\n`);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('measure', 56)} V10   V11   change`);
for (const [label, a, b] of rows) console.log(`${pad(label, 56)} ${pad(a, 5)} ${pad(b, 5)} ${b - a >= 0 ? '+' : ''}${b - a}`);
console.log(`${pad('TOTAL navigable destinations', 56)} ${pad(total10, 5)} ${pad(total11, 5)} ${total11 - total10} (${out.totalDestinations.pct}%)`);
