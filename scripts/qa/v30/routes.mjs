/**
 * V30 route inventory (brief Part 24) — generated from the four routers, never remembered.
 *
 *   node scripts/qa/v30/routes.mjs          → docs/qa/v30/ROUTE_INVENTORY.{json,md}
 *   node scripts/qa/v30/routes.mjs --check  → exit 1 if a router declares a path the inventory does not cover
 *
 * Every `path:` in each router is read with a regex, classified (public / student / agency / university / auth /
 * settings / detail / edge), and its `:params` resolved against the dev database for the persona that signs in
 * to that product, so the visual crawl opens real pages rather than 404s. Redirect-only paths (`<Navigate>`) and
 * the dev-only `__dev` tools are listed but not crawled.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const env = fs.readFileSync('server/.env', 'utf8');
const pw = env.match(/postgresql[^:]*:\/\/[^:]+:([^@]+)@/)?.[1];
const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-U', 'hangyul', 'hangyul_univ', '-Atc', q], { env: { ...process.env, PGPASSWORD: pw } }).toString().trim().split('\n')[0] ?? '';

export const PERSONAS = {
  student: 'student@demo.hangyul.kr',
  agency: 'counselor@lotus.demo.hangyul.kr',
  university: 'admin@pusan.univ.demo.hangyul.kr',
};
const uid = (email) => sql(`select id from users where email='${email}'`);
const S = uid(PERSONAS.student), A = uid(PERSONAS.agency), U = uid(PERSONAS.university);
const agencyOrg = sql(`select organization_id from organization_members where user_id='${A}' limit 1`) || sql(`select agency_org_id from applications where agency_org_id is not null limit 1`);

const params = {
  student: {
    ':slug': 'yonsei-university',
    ':id@applications': sql(`select id from applications where student_user_id='${S}' order by updated_at desc limit 1`),
    ':id@essays': sql(`select id from essays where owner_user_id='${S}' order by updated_at desc limit 1`),
    ':id@messages': sql(`select conversation_id from conversation_participants where user_id='${S}' limit 1`),
    ':token': null,
  },
  agency: {
    ':slug': 'yonsei-university',
    ':id@students': '5e2ed4ec-c7a0-4c60-b0da-4905983e030e',
    ':id@applications': sql(`select id from applications where agency_org_id='${agencyOrg}' order by updated_at desc limit 1`),
    ':id@essays': sql(`select e.id from essays e join applications a on a.id=e.application_id where a.agency_org_id='${agencyOrg}' order by e.updated_at desc limit 1`),
    ':id@messages': sql(`select conversation_id from conversation_participants where user_id='${A}' limit 1`),
  },
  university: {
    ':id@applications': sql(`select a.id from applications a join universities u on u.id=a.university_id where u.slug like 'pusan-national%' and a.submitted_at is not null order by a.updated_at desc limit 1`),
    ':id@messages': sql(`select conversation_id from conversation_participants where user_id='${U}' limit 1`),
    ':tab': 'retention',
  },
  marketing: { ':slug': 'yonsei-university' },
};

const ROUTERS = {
  marketing: 'apps/marketing-web/src/routes.tsx',
  student: 'apps/student-web/src/router.tsx',
  agency: 'apps/agency-web/src/router.tsx',
  university: 'apps/university-web/src/router.tsx',
};
const PORT = { marketing: 3100, student: 3101, agency: 3102, university: 3103 };

function classify(product, path) {
  if (/login|register|forgot|start$|eligibility|onboarding/.test(path) && product !== 'marketing') return 'auth';
  if (path === '*' ) return 'edge';
  if (/settings|profile|team|templates|manage|audit/.test(path)) return 'settings';
  if (/:/.test(path)) return 'detail';
  if (product === 'marketing') return 'public';
  return product;
}

const inventory = [];
for (const [product, file] of Object.entries(ROUTERS)) {
  const src = fs.readFileSync(file, 'utf8');
  // A path followed (within the same route object) by a <Navigate> is a redirect, not a screen.
  const re = /(path: '([^']*)'|index: true)([^\n]*)/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[2] ?? '';
    const rest = m[3] + src.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const redirect = /<Navigate\b/.test(rest.split(/path: '|index: true/)[0]);
    if (m[1] === 'index: true' || raw === '/') { if (!inventory.some((r) => r.product === product && r.path === '/')) inventory.push({ product, path: '/', kind: product === 'marketing' ? 'public' : product }); continue; }
    let path = raw.startsWith('/') ? raw : `/${raw}`;
    if (raw === '__dev' || raw === '/__dev') { inventory.push({ product, path, kind: 'dev-only', crawl: false }); continue; }
    if (raw === 'guides/*') { inventory.push({ product, path, kind: 'redirect', crawl: false }); continue; }
    if (raw === '*') { inventory.push({ product, path: '/__v30-not-a-page', declared: '*', kind: 'edge' }); continue; }
    if (redirect) { inventory.push({ product, path, kind: 'redirect', crawl: false }); continue; }
    const kind = classify(product, path);
    let url = path;
    for (const p of path.match(/:[a-z]+/g) ?? []) {
      const key = params[product][`${p}@${path.split('/')[1]}`] !== undefined ? `${p}@${path.split('/')[1]}` : p;
      const v = params[product][key];
      if (!v) { url = null; break; }
      url = url.replace(p, v);
    }
    if (inventory.some((r) => r.product === product && r.path === path)) continue;
    inventory.push({ product, path, kind, url, crawl: url !== null, ...(url === null ? { why: 'no fixture for parameter' } : {}) });
  }
}
// Sign-in screens are crawled signed-out.
for (const r of inventory) if (r.kind === 'auth') r.signedOut = true;
for (const r of inventory) if (r.crawl !== false && r.url === undefined) r.url = r.path;
for (const r of inventory) r.base = `http://127.0.0.1:${PORT[r.product]}`;

if (process.argv.includes('--check')) {
  const missing = inventory.filter((r) => r.crawl !== false && !r.url);
  console.log(missing.length ? `routes: ${missing.length} unresolved` : `routes: ${inventory.length} declared, ${inventory.filter((r) => r.crawl !== false).length} crawlable`);
  process.exit(0);
}
fs.mkdirSync('docs/qa/v30', { recursive: true });
fs.writeFileSync('docs/qa/v30/ROUTE_INVENTORY.json', JSON.stringify({ generated: new Date().toISOString(), personas: PERSONAS, routes: inventory }, null, 1));
const md = ['# V30 route inventory', '', `Generated by \`node scripts/qa/v30/routes.mjs\` from the four routers (${new Date().toISOString().slice(0, 10)}). Parameters resolved against the dev DB for the signed-in persona.`, '',
  '| Product | Path | Kind | Crawled URL |', '|---|---|---|---|',
  ...inventory.map((r) => `| ${r.product} | \`${r.path}\` | ${r.kind} | ${r.crawl === false ? `— (${r.kind})` : r.url ? `\`${r.url}\`` : `— ${r.why}`} |`)];
fs.writeFileSync('docs/qa/v30/ROUTE_INVENTORY.md', md.join('\n') + '\n');
const by = {}; for (const r of inventory) by[`${r.product}/${r.kind}`] = (by[`${r.product}/${r.kind}`] ?? 0) + 1;
console.log(inventory.length, 'routes;', inventory.filter((r) => r.crawl !== false && r.url).length, 'crawlable', by);
console.log('unresolved:', inventory.filter((r) => r.crawl !== false && !r.url).map((r) => `${r.product}${r.path}`).join(' ') || 'none');
