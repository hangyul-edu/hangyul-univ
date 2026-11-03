/**
 * V20 — the university content coverage audit (brief §4, §44).
 *
 * One command, one truth: it reads the committed registry, the content record produced by the research
 * pipeline and the servable media manifest, and reports what each of the 425 institutions actually has.
 * It never asks the running API, so it answers the same way in CI, on a laptop and in the release gate.
 *
 * It writes `docs/qa/v20/UNIVERSITY_CONTENT_COVERAGE.csv` with the columns the brief names, and prints the
 * coverage table that §4 asks for — including the zeros, which are the whole point of running it.
 *
 *   node scripts/universities/audit-content.mjs [--quiet]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const readIf = (p, fallback) => (existsSync(join(ROOT, p)) ? read(p) : fallback);

export const REGISTRY = 'server/app/data/korean_institutions.json';
export const CONTENT = 'server/app/data/university_content.json';
export const CREDITS = 'apps/marketing-web/src/media/credits.json';

/** The four tiers of §19, in the order the product resolves them. */
export const TIERS = ['A_LICENSED_PHOTO', 'B_OFFICIAL_VIDEO', 'C_LOGO', 'D_IDENTITY'];

export function load() {
  const registry = read(REGISTRY);
  const content = readIf(CONTENT, { records: {} }).records ?? {};
  const credits = read(CREDITS);
  const servable = new Set(
    credits.filter((c) => ['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION',
      'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED'].includes(c.rights_status)).map((c) => c.slug),
  );
  return { registry, institutions: registry.institutions, content, credits, servable };
}

/** One institution's content state — the single function every V20 gate and page-side resolver agrees with. */
export function stateOf(inst, content, servable) {
  const c = content[inst.slug] ?? {};
  const media = c.media ?? {};
  const gallery = (media.gallery ?? []).filter((m) => servable.has(m.asset));
  const hero = media.hero && servable.has(media.hero.asset) ? media.hero : null;
  const yt = c.youtube ?? {};
  // Only a **reviewed** philosophy counts as coverage. A captured source string is research, not content,
  // and the page will not render it — counting it here would report a number the product does not show.
  const philosophy = c.education_philosophy?.verification_status === 'HANGYUL_REVIEWED';
  const motto = !!(c.motto?.ko || c.motto?.en);
  const logo = !!c.logo?.url;
  const tier = hero ? 'A_LICENSED_PHOTO' : yt.video_id ? 'B_OFFICIAL_VIDEO' : logo ? 'C_LOGO' : 'D_IDENTITY';
  const blocking = [];
  if (!hero) blocking.push((media.blocked ?? []).some((b) => b.slot !== 'logo') ? 'photography found but rights-blocked' : 'no photograph of this institution under a licence Hangyul may serve');
  if (!philosophy && !motto) blocking.push(c.philosophy_url ? 'philosophy page found, statement not yet reviewed' : 'no sourced education philosophy');
  if (!yt.channel_id) blocking.push('no verified official channel');
  if (!logo) blocking.push('no logo under a licence Hangyul may serve');
  return {
    slug: inst.slug,
    name_ko: inst.name_ko,
    name_en: inst.name_en ?? c.name_en ?? '',
    logo,
    hero,
    gallery,
    media_rights_verified: hero || gallery.length ? 'yes' : ((media.blocked ?? []).length ? 'blocked' : 'none found'),
    overview: !!(c.founded_year || c.city_ko),
    history: !!c.history_summary,
    education_philosophy: philosophy,
    motto,
    academic_strengths: Array.isArray(c.academic_strengths) && c.academic_strengths.length > 0,
    international_office: !!c.international_office_url,
    international_admissions: !!c.international_admissions_url,
    dormitory: !!c.dormitory_url,
    city_life: !!inst.region,
    official_youtube: !!yt.channel_id,
    official_intro_video: !!yt.video_id,
    website: !!(inst.website_url || c.website_url),
    source_count: (Object.keys(inst.sources ?? {}).length) + (c.wikidata_id ? 1 : 0) + (c.official_site?.status === 'OK' ? 1 : 0),
    verified_at: c.verified_at ?? inst.last_verified ?? '',
    tier,
    blocking,
  };
}

/** The honest four-way status of §45. */
export function statusOf(s) {
  const text = (s.education_philosophy || s.motto) && s.international_office && s.overview;
  const visual = s.logo && (s.hero || s.official_intro_video);
  if (text && visual) return 'FULLY_ENRICHED';
  if (text || (s.overview && s.international_admissions)) return 'TEXT_COMPLETE_MEDIA_LIMITED';
  if (s.media_rights_verified === 'blocked') return 'RIGHTS_BLOCKED';
  return 'OFFICIAL_DATA_LIMITED';
}

function main() {
  const { institutions, content, servable } = load();
  const rows = institutions.map((i) => stateOf(i, content, servable));
  const n = rows.length;
  const count = (f) => rows.filter(f).length;
  const pct = (k) => `${k}/${n} (${Math.round((k / n) * 100)}%)`;

  const table = [
    ['TOTAL UNIVERSITIES', String(n)],
    ['LOGO COVERAGE', pct(count((r) => r.logo))],
    ['HERO IMAGE COVERAGE', pct(count((r) => r.hero))],
    // V21 — `gallery` no longer includes the hero (it listed the hero as its own first item until the
    // detail page was found showing the same photograph twice), so "2+" counts total photographs:
    // the hero plus anything else. The figure means the same thing it always claimed to.
    ['TWO OR MORE PHOTOGRAPHS', pct(count((r) => (r.hero ? 1 : 0) + r.gallery.length > 1))],
    ['OFFICIAL WEBSITE COVERAGE', pct(count((r) => r.website))],
    ['PHILOSOPHY, HANGYUL-REVIEWED', pct(count((r) => r.education_philosophy))],
    ['MOTTO, REGISTRY-ASSERTED', pct(count((r) => r.motto))],
    ['INTERNATIONAL-OFFICE COVERAGE', pct(count((r) => r.international_office))],
    ['INTERNATIONAL-ADMISSIONS COVERAGE', pct(count((r) => r.international_admissions))],
    ['OFFICIAL YOUTUBE COVERAGE', pct(count((r) => r.official_youtube))],
    ['OFFICIAL INTRO-VIDEO COVERAGE', pct(count((r) => r.official_intro_video))],
    ['CAMPUS / CITY COVERAGE', pct(count((r) => r.city_life))],
    ['DORMITORY COVERAGE', pct(count((r) => r.dormitory))],
  ];
  if (!process.argv.includes('--quiet')) {
    console.log('\nV21 university content coverage\n');
    for (const [k, v] of table) console.log(`  ${k.padEnd(34)} ${v}`);
    const byTier = Object.fromEntries(TIERS.map((t) => [t, count((r) => r.tier === t)]));
    console.log('\n  discovery visual tier:', Object.entries(byTier).map(([k, v]) => `${k} ${v}`).join(' · '));
    const byStatus = {};
    for (const r of rows) { const s = statusOf(r); byStatus[s] = (byStatus[s] ?? 0) + 1; }
    console.log('  status:', Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(' · '), '\n');
  }

  const head = 'university,slug,logo,hero_media,gallery_count,media_rights_verified,overview,history,education_philosophy,academic_strengths,international_office,dormitory,city_life,official_youtube,official_intro_video,source_count,verified_at,status,blocking_reason';
  const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
  const body = rows.map((r) => [
    r.name_en || r.name_ko, r.slug, r.logo ? 'yes' : 'no', r.hero ? r.hero.asset : 'no', r.gallery.length,
    r.media_rights_verified, r.overview ? 'yes' : 'no', r.history ? 'yes' : 'no',
    r.education_philosophy ? 'yes' : 'no', r.academic_strengths ? 'yes' : 'no',
    r.international_office ? 'yes' : 'no', r.dormitory ? 'yes' : 'no', r.city_life ? 'yes' : 'no',
    r.official_youtube ? 'yes' : 'no', r.official_intro_video ? 'yes' : 'no',
    r.source_count, r.verified_at, statusOf(r), r.blocking.join('; '),
  ].map(esc).join(','));
  for (const v of ['v20', 'v21']) {
    mkdirSync(join(ROOT, `docs/qa/${v}`), { recursive: true });
    writeFileSync(join(ROOT, `docs/qa/${v}/UNIVERSITY_CONTENT_COVERAGE.csv`), `${head}\n${body.join('\n')}\n`);
  }
  if (!process.argv.includes('--quiet')) console.log('  → docs/qa/v21/UNIVERSITY_CONTENT_COVERAGE.csv (and v20, kept in step)\n');
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
