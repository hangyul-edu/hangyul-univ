#!/usr/bin/env node
/**
 * Catalogue parity — Marketing and Student must show the same universities from the same database (owner requirement
 * 3, 2026-11-19).
 *
 * For every institution the Marketing site lists — its DB snapshot (apps/marketing-web/public/data/public) and/or the
 * live public directory API (`/api/v1/directory/institutions…`) — the Student-facing catalogue
 * (`/api/v1/universities`, `/api/v1/universities/{slug}`) must carry the same institution under the same slug, with
 * the same facts:
 *
 *   slug · name_ko · name_en (or "no English name recorded") · institution kind · establishment · region ·
 *   official website · international admissions link · IEQAS certification · registry `verified_at` ·
 *   certification check date
 *
 * The field mapping is the ingestion's own (server/app/services/catalog_ingest/normalize.py): directory
 * `institution_type` = University `institution_kind`; directory `establishment` = University `institution_type`;
 * `ieqas.excellent|certified` = `certification_status` EXCELLENT|CERTIFIED.
 *
 *   node scripts/qa/catalog-parity.mjs                                   # local API (127.0.0.1:8011), else the connected one
 *   node scripts/qa/catalog-parity.mjs --api https://app.univ.talkhangyul.com
 *   options: --marketing snapshot|api|both (default both) · --details all|none|<n> · --json <file>
 *
 * Read-only by design. `GET /universities/{slug}` records a `university_viewed` analytics event, so detail checks
 * (website, admissions link, certification date) run for every institution only against a local API; against any
 * other origin they are off unless `--details` asks for them. Exit 0 = PASS, 1 = FAIL (including an empty Student
 * catalogue — reported, never a crash), 2 = no API reachable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SNAPSHOT = join(ROOT, 'apps/marketing-web/public/data/public');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };

const CANDIDATES = opt('api', null) ? [opt('api')] : ['http://127.0.0.1:8011', 'https://app.univ.talkhangyul.com'];
const MODE = opt('marketing', 'both');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

async function get(origin, path) {
  const r = await fetch(`${origin}/api/v1${path}`, { headers: { accept: 'application/json', 'ngrok-skip-browser-warning': '1' }, signal: AbortSignal.timeout(30_000) });
  const json = (r.headers.get('content-type') ?? '').includes('application/json');
  if (!r.ok || !json) { const e = new Error(`GET ${path} -> ${r.status}${json ? '' : ' (not JSON)'}`); e.status = r.status; throw e; }
  return r.json();
}

async function pick() {
  for (const origin of CANDIDATES) {
    try { await get(origin, '/directory/regions'); return origin.replace(/\/$/, ''); } catch { console.log(`(no public API at ${origin})`); }
  }
  return null;
}

async function pages(origin, path, size = 200) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await get(origin, `${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=${size}`);
    out.push(...res.items);
    if (out.length >= res.total || !res.items.length) return { items: out, total: res.total, catalog: res.catalog };
  }
}

async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

/** Same URL for a reader: scheme-insensitive host, no trailing slash, no default index. */
const url = (u) => {
  if (!u) return null;
  try {
    const x = new URL(String(u).trim());
    return `${x.hostname.toLowerCase().replace(/^www\./, '')}${x.pathname.replace(/\/(index\.(html?|do|jsp|php))?$/i, '')}${x.search}`;
  } catch { return String(u).trim(); }
};
const day = (d) => (d ? String(d).slice(0, 10) : null);
const cert = (m) => (m.ieqas?.excellent ? 'EXCELLENT' : m.ieqas?.certified ? 'CERTIFIED' : 'NONE');
const studentCert = (s) => (['EXCELLENT', 'CERTIFIED'].includes(s.certification_status) ? s.certification_status : 'NONE');
const intlAdmissions = (d) => d?.enrichment?.international_admissions_url ?? d?.enrichment?.intl?.links?.international_admissions?.url ?? null;

/** Compare one Marketing record with its Student counterpart. Returns [field, marketing, student][] of mismatches. */
function diff(m, s, md, sd) {
  const out = [];
  const eq = (field, a, b) => { if ((a ?? null) !== (b ?? null)) out.push([field, a ?? null, b ?? null]); };
  eq('name_ko', m.name_ko, s.name_ko);
  if (m.name_en) eq('name_en', m.name_en, s.name_en);
  else if (s.name_en_recorded === true) out.push(['name_en', null, `${s.name_en} (recorded)`]);
  eq('institution_kind', m.institution_type, s.institution_kind ?? s.institution_type);
  if (m.establishment && s.institution_type && ['NATIONAL', 'PUBLIC', 'PRIVATE'].includes(s.institution_type)) eq('establishment', m.establishment, s.institution_type);
  eq('region', m.region, s.region);
  eq('certification', cert(m), studentCert(s));
  eq('verified_at', day(m.last_verified), day(s.verified_at));
  if (md && sd) {
    eq('website_url', url(md.website_url), url(sd.website_url));
    eq('international_admissions_url', url(intlAdmissions(md)), url(sd.international_admissions_url));
    if (cert(m) !== 'NONE') eq('certification_verified_at', day(md.sources?.international?.checked), day(sd.certification_verified_at));
  }
  return out;
}

const origin = await pick();
if (!origin) { console.error(`FAIL  no public API reachable at ${CANDIDATES.join(' or ')}`); process.exit(2); }
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(origin);
const DETAILS = opt('details', local ? 'all' : 'none');
console.log(`API ${origin} · marketing source: ${MODE} · details: ${DETAILS}${!local && DETAILS === 'none' ? ' (remote origin: detail calls are not made — they record analytics events)' : ''}\n`);

// ------------------------------------------------------------------------------------------------ Marketing side
const sources = [];
if (MODE === 'snapshot' || MODE === 'both') {
  const index = JSON.parse(readFileSync(join(SNAPSHOT, 'institutions.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(SNAPSHOT, 'manifest.json'), 'utf8'));
  const detail = (slug) => { try { return JSON.parse(readFileSync(join(SNAPSHOT, 'institutions', `${slug}.json`), 'utf8')); } catch { return null; } };
  sources.push({ name: `snapshot (${manifest.origin ?? 'database'}, ${manifest.generated_at ?? 'generated_at unknown'})`, items: index.items, detail: async (s) => detail(s) });
}
if (MODE === 'api' || MODE === 'both') {
  const live = await pages(origin, '/directory/institutions?order=ko');
  sources.push({ name: 'live directory API', items: live.items, detail: async (s) => get(origin, `/directory/institutions/${s}`).catch(() => null) });
}

// ------------------------------------------------------------------------------------------------ Student side
let student;
try {
  student = await pages(origin, '/universities', 100);
} catch (e) {
  check('Student catalogue reachable (/api/v1/universities)', false, e.message);
}
if (student) {
  const n = student.items.length;
  check('Student catalogue is not empty (/api/v1/universities)', n > 0,
    n ? `${n} universities${student.catalog ? `, catalog ${JSON.stringify(student.catalog)}` : ''}`
      : `0 universities${student.catalog ? ` (catalog ${JSON.stringify(student.catalog)})` : ''} — the Student app shows an empty 대학 찾기 while Marketing lists ${sources[0]?.items.length ?? '?'}; the catalogue unification (every active Institution a University with the same slug) is not in this database yet`);
}

const report = { origin, generated_at: new Date().toISOString(), sources: [] };
const sBySlug = new Map((student?.items ?? []).map((u) => [u.slug, u]));
const sDetail = new Map();
const wanted = (slugs) => (DETAILS === 'all' ? slugs : DETAILS === 'none' ? [] : slugs.slice(0, Number(DETAILS) || 0));

for (const src of sources) {
  const slugs = src.items.map((m) => m.slug);
  const missing = slugs.filter((s) => !sBySlug.has(s));
  const extra = [...sBySlug.keys()].filter((s) => !slugs.includes(s));
  if (student?.items.length) {
    check(`${src.name}: every Marketing institution exists in the Student catalogue under the same slug`, missing.length === 0,
      `${slugs.length - missing.length}/${slugs.length}${missing.length ? `; missing e.g. ${missing.slice(0, 5).join(', ')}` : ''}`);
    check(`${src.name}: the Student catalogue lists no university Marketing does not`, extra.length === 0,
      extra.length ? `${extra.length} extra, e.g. ${extra.slice(0, 5).join(', ')} (demo/fixture rows must not reach students)` : `${sBySlug.size} = ${slugs.length}`);
  }
  const both = slugs.filter((s) => sBySlug.has(s));
  const detailSlugs = new Set(wanted(both));
  const mDetail = new Map();
  await pool([...detailSlugs], 6, async (s) => {
    mDetail.set(s, await src.detail(s));
    if (!sDetail.has(s)) sDetail.set(s, await get(origin, `/universities/${s}`).catch(() => null));
  });
  const byField = new Map();
  for (const m of src.items) {
    const s = sBySlug.get(m.slug);
    if (!s) continue;
    for (const [field, a, b] of diff(m, s, mDetail.get(m.slug), sDetail.get(m.slug))) {
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field).push({ slug: m.slug, marketing: a, student: b });
    }
  }
  const fields = ['name_ko', 'name_en', 'institution_kind', 'establishment', 'region', 'certification', 'verified_at',
    ...(detailSlugs.size ? ['website_url', 'international_admissions_url', 'certification_verified_at'] : [])];
  for (const f of fields) {
    const bad = byField.get(f) ?? [];
    const of = ['website_url', 'international_admissions_url', 'certification_verified_at'].includes(f) ? detailSlugs.size : both.length;
    if (!of) continue;
    check(`${src.name}: ${f} identical`, bad.length === 0,
      `${of - bad.length}/${of}${bad.length ? `; e.g. ${bad.slice(0, 3).map((x) => `${x.slug}: ${JSON.stringify(x.marketing)} ≠ ${JSON.stringify(x.student)}`).join(' | ')}` : ''}`);
  }
  report.sources.push({ name: src.name, institutions: slugs.length, missing_in_student: missing, extra_in_student: extra,
    mismatches: Object.fromEntries(byField), details_checked: detailSlugs.size });
}

if (sources.length === 2) {
  // The snapshot and the live directory are the same database at two moments: a difference means the snapshot is stale.
  const [a, b] = sources;
  const key = (m) => JSON.stringify([m.slug, m.name_ko, m.name_en, m.institution_type, m.establishment, m.region, m.website_url, cert(m), m.last_verified]);
  const live = new Set(b.items.map(key));
  const stale = a.items.filter((m) => !live.has(key(m)));
  check('snapshot = live directory (Marketing fallback is current)', stale.length === 0 && a.items.length === b.items.length,
    `${a.items.length} vs ${b.items.length}${stale.length ? `; ${stale.length} differ, e.g. ${stale.slice(0, 3).map((m) => m.slug).join(', ')} — refresh with PUBLIC_DATA_SOURCE=api or scripts/public-data/export.py` : ''}`);
}

report.results = results;
const out = opt('json', null);
if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? 'FAIL' : 'PASS'} catalog-parity — ${results.length - failed}/${results.length} checks${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
