/**
 * V22 — the coverage table, one row per institution, all 425 (brief step F, G).
 *
 * Reads the registry, the content record and the credits manifest — never the running API — and writes
 * `docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv` with exactly the columns the V22 brief names. It also
 * asserts the three invariants §8/§3 care about and that every served asset exists on disk in both apps:
 *
 *   • an institution's hero is never also in its gallery;
 *   • no asset is served under two institutions;
 *   • no city/region photograph is attached to an institution as its own.
 *
 *   node scripts/universities/v22-coverage.mjs [--content path] [--credits path] [--no-write] [--quiet]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, REGISTRY_PATH, ROOT, TODAY } from './lib.mjs';
import { SERVABLE } from './v22-licences.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const CONTENT = flag('--content', join(ROOT, 'server/app/data/university_content.json'));
const CREDITS = flag('--credits', join(ROOT, 'apps/marketing-web/src/media/credits.json'));
const WRITE = !ARG.includes('--no-write');
const QUIET = ARG.includes('--quiet');

const insts = readJson(REGISTRY_PATH).institutions;
const content = readJson(CONTENT, { records: {} }).records ?? {};
const credits = new Map(readJson(CREDITS, []).map((c) => [c.slug, c]));
const NO_CREDIT_LOGO = new Set(['CC0_PUBLIC_DOMAIN', 'HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION']);

const servable = (m) => m && credits.has(m.asset) && SERVABLE.has(credits.get(m.asset).rights_status);
const onDisk = (m) => ['apps/marketing-web/public/media', 'apps/student-web/public/media'].every((d) => existsSync(join(ROOT, d, `${m.asset}-1200.jpg`)));

export function rowOf(inst) {
  const c = content[inst.slug] ?? {};
  const media = c.media ?? {};
  const hero = servable(media.hero) ? media.hero : null;
  const gallery = (media.gallery ?? []).filter(servable);
  const logo = !!c.logo?.url && NO_CREDIT_LOGO.has(c.logo.rights_status);
  const yt = c.youtube ?? {};
  const reviewed = c.education_philosophy?.verification_status === 'HANGYUL_REVIEWED';
  const sourced = (c.philosophy_candidate?.statements?.length ?? 0) > 0 || c.education_philosophy?.verification_status === 'SOURCE_CAPTURED';
  const motto = !!(c.motto?.ko || c.motto?.en);
  const identityKinds = new Set((c.philosophy_candidate?.statements ?? []).map((s) => s.kind));
  const identity = motto ? 'motto' : ['vision', 'mission', 'talent_profile', 'core_values', 'identity'].some((k) => identityKinds.has(k)) ? 'vision-sourced-unreviewed' : c.founding_body ? 'founding-body' : 'no';
  const licences = [];
  if (hero) licences.push(`hero: ${hero.license_or_permission}`);
  if (gallery.length) {
    const byL = {};
    for (const g of gallery) byL[g.license_or_permission] = (byL[g.license_or_permission] ?? 0) + 1;
    licences.push(`gallery: ${Object.entries(byL).map(([k, v]) => `${k} ×${v}`).join(', ')}`);
  }
  if (logo) licences.push(`logo: ${c.logo.licence}`);
  const blockedPhotos = (media.blocked ?? []).filter((b) => b.slot !== 'logo');
  if (!hero && blockedPhotos.length) licences.push(`blocked: ${[...new Set(blockedPhotos.map((b) => b.licence))].slice(0, 3).join(', ')}`);
  const site = c.official_site?.status === 'OK' ? 'yes' : c.official_site?.status === 'ROBOTS_DISALLOWED' ? 'robots-disallowed' : c.official_site?.status === 'NO_WEBSITE' ? 'no-website' : c.official_site?.status ? 'unreachable' : (inst.website_url || c.website_url) ? 'unverified' : 'no-website';

  const blocking = [];
  if (!hero) blocking.push(blockedPhotos.length ? 'photograph found on Commons but rights-blocked (NC/ND/no author)' : (c.wikidata_id ? 'no photograph of this institution under a licence Hangyul may serve' : 'no Wikidata item / Commons category — nothing to search'));
  if (!logo) blocking.push((media.blocked ?? []).some((b) => b.slot === 'logo') ? 'logo found but attribution-bearing licence (logo slot renders no credit)' : 'no logo under a no-credit licence');
  if (!reviewed) blocking.push(sourced ? 'philosophy statement sourced, awaiting Hangyul review' : c.philosophy_url ? 'philosophy page located, no extractable statement (image/JS content)' : site === 'yes' ? 'no philosophy page found on the official site' : `official site ${site}`);
  if (!yt.channel_id) blocking.push(c.youtube_candidates?.links?.length ? 'channel linked from own site but its title does not name the institution' : site === 'yes' ? 'no YouTube link on the pages read' : `no channel evidence (site ${site})`);
  else if (!yt.video_id) blocking.push('verified channel has no introduction film by title');
  if (!c.international_office_url) blocking.push(site === 'yes' ? 'no international office link found' : 'international office: site not readable');

  return {
    university: inst.name_en || c.name_en || inst.name_ko,
    slug: inst.slug,
    logo: logo ? 'yes' : 'no',
    hero_image: hero ? hero.asset : 'no',
    gallery_count: gallery.length,
    media_licence: licences.join('; ') || 'none',
    official_site: site,
    international_office: c.international_office_url ? 'yes' : 'no',
    admissions_page: c.international_admissions_url ? 'yes' : 'no',
    education_philosophy: reviewed ? 'reviewed' : sourced ? 'sourced-unreviewed' : 'no',
    academic_identity: identity,
    dormitory: c.dormitory_url ? 'yes' : 'no',
    official_youtube: yt.channel_id ? 'yes' : 'no',
    intro_video: yt.video_id ? 'yes' : 'no',
    verification_date: c.verified_at ?? inst.last_verified ?? TODAY,
    blocking_reason: blocking.join('; '),
    _hero: hero, _gallery: gallery, _reviewed: reviewed, _sourced: sourced, _motto: motto,
  };
}

const rows = insts.map(rowOf);
const n = rows.length;
const count = (f) => rows.filter(f).length;

/* --------------------------------------------------------------------------------------- invariants */
const problems = [];
const owner = new Map();
for (const [slug, r] of Object.entries(content)) {
  const hero = r.media?.hero;
  const gal = r.media?.gallery ?? [];
  if (hero && gal.some((g) => g.asset === hero.asset)) problems.push(`${slug}: hero also in gallery`);
  for (const m of [hero, ...gal].filter(Boolean)) {
    if (m.university_id && m.university_id !== slug) problems.push(`${slug}: asset ${m.asset} claims university_id ${m.university_id}`);
    if (owner.has(m.asset) && owner.get(m.asset) !== slug) problems.push(`${m.asset}: served under ${owner.get(m.asset)} and ${slug}`);
    owner.set(m.asset, slug);
    if (m.kind === 'CITY' || m.kind === 'REGION_FALLBACK') problems.push(`${slug}: city/region photograph attached as the institution's own`);
    if (!servable(m)) problems.push(`${slug}: ${m.asset} is not servable per credits.json`);
    else if (!onDisk(m)) problems.push(`${slug}: ${m.asset} missing on disk`);
    const cr = credits.get(m.asset);
    if (cr?.attribution_required) { const a = m.attribution_requirement; if (!a?.author || !a?.license || !a?.license_url || !a?.source_url) problems.push(`${slug}: ${m.asset} credit incomplete`); }
    if (cr && cr.university_slug && cr.university_slug !== slug) problems.push(`${slug}: ${m.asset} credit says it belongs to ${cr.university_slug}`);
  }
  if (r.youtube && !['own-site', 'wikidata:P2397'].includes(r.youtube.verified_via)) problems.push(`${slug}: channel without verification route`);
  if (r.youtube?.video_id && !r.youtube.channel_id) problems.push(`${slug}: video without channel`);
  if (r.philosophy_candidate && r.philosophy_candidate.verification_status !== 'SOURCED_UNREVIEWED') problems.push(`${slug}: philosophy_candidate wrong status`);
  if (r.logo?.url && !NO_CREDIT_LOGO.has(r.logo.rights_status)) problems.push(`${slug}: logo in a credit-bearing class`);
  if (r.logo?.local_path && !existsSync(join(ROOT, 'apps/marketing-web/public', r.logo.local_path))) problems.push(`${slug}: logo missing on disk`);
}

const status = (r) => {
  const text = (r._reviewed || r._motto) && r.international_office === 'yes';
  const visual = r.logo === 'yes' && (r._hero || r.intro_video === 'yes');
  if (text && visual) return 'FULLY_ENRICHED';
  if (text || (r.admissions_page === 'yes' && r.official_site === 'yes')) return 'TEXT_COMPLETE_MEDIA_LIMITED';
  if (!r._hero && /blocked/.test(r.media_licence)) return 'RIGHTS_BLOCKED';
  return 'OFFICIAL_DATA_LIMITED';
};

export const summary = {
  total: n,
  logo: count((r) => r.logo === 'yes'),
  hero: count((r) => r._hero),
  gallery_gt0: count((r) => r.gallery_count > 0),
  photos_2plus: count((r) => (r._hero ? 1 : 0) + r.gallery_count >= 2),
  rights_verified: count((r) => r._hero || r.gallery_count > 0),
  official_site_ok: count((r) => r.official_site === 'yes'),
  international_office: count((r) => r.international_office === 'yes'),
  admissions: count((r) => r.admissions_page === 'yes'),
  dormitory: count((r) => r.dormitory === 'yes'),
  philosophy_reviewed: count((r) => r._reviewed),
  philosophy_sourced_unreviewed: count((r) => !r._reviewed && r._sourced),
  motto: count((r) => r._motto),
  academic_identity: count((r) => r.academic_identity !== 'no'),
  youtube: count((r) => r.official_youtube === 'yes'),
  intro_video: count((r) => r.intro_video === 'yes'),
  wikidata: count((r) => !!content[r.slug]?.wikidata_id),
  founded_year: count((r) => !!content[r.slug]?.founded_year),
  founding_body: count((r) => !!content[r.slug]?.founding_body),
  status: rows.reduce((acc, r) => { const s = status(r); acc[s] = (acc[s] ?? 0) + 1; return acc; }, {}),
  blocking: rows.flatMap((r) => r.blocking_reason.split('; ').filter(Boolean)).reduce((acc, b) => { acc[b] = (acc[b] ?? 0) + 1; return acc; }, {}),
  invariant_problems: problems,
};

if (!QUIET) {
  console.log('\nV22 university content coverage\n');
  for (const [k, v] of Object.entries(summary)) if (typeof v === 'number') console.log(`  ${k.padEnd(32)} ${String(v).padStart(4)} / ${n}  (${Math.round((v / n) * 100)}%)`);
  console.log('\n  status:', Object.entries(summary.status).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('\n  blocking reasons:');
  for (const [k, v] of Object.entries(summary.blocking).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
  console.log(`\n  invariants: ${problems.length ? `${problems.length} PROBLEM(S)` : 'OK'}`);
  for (const p of problems.slice(0, 20)) console.log(`    ! ${p}`);
}

if (WRITE) {
  const head = 'university,slug,logo,hero_image,gallery_count,media_licence,official_site,international_office,admissions_page,education_philosophy,academic_identity,dormitory,official_youtube,intro_video,verification_date,blocking_reason';
  const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
  const body = rows.map((r) => head.split(',').map((k) => esc(r[k])).join(','));
  mkdirSync(join(ROOT, 'docs/qa/v22'), { recursive: true });
  writeFileSync(join(ROOT, 'docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv'), `${head}\n${body.join('\n')}\n`);
  if (!QUIET) console.log('\n  → docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv\n');
}
if (ARG.includes('--json')) console.log(JSON.stringify(summary, null, 1));
if (problems.length) process.exitCode = 1;
