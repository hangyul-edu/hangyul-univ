// V23 — one row per institution: the primary visual every directory tile and detail hero resolves to, where it came
// from, under what licence, and whether it is intact. Reads the **served** API (what customers get), applies the same
// tier order as `resolveUniversityVisual` in @hangyul/utils, and checks the evidence behind each tier:
//
//   A_CAMPUS_PHOTO     the institution's own rights-cleared photograph — local files exist at every served width,
//                      the media record names this institution, the asset is not used by any other institution
//   C_OFFICIAL_VIDEO   the poster of the verified official film (YouTube serves it; --remote checks it answers)
//   D_LOGO_IDENTITY    the institution's own servable mark in the identity composition
//   E_NAME_IDENTITY    the designed full-name identity composition (name in both scripts, province mark, city)
//
// The brief's tier B (official non-campus photograph) is not separated in the data, so it is counted under A.
//
//   node scripts/qa/v23/university-visual-coverage.mjs [--api http://localhost:8001] [--remote] [--check]
// Writes docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv. With --check, exits 1 unless every row is intentional and intact.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const ARG = process.argv.slice(2);
const API = (ARG.includes('--api') ? ARG[ARG.indexOf('--api') + 1] : 'http://localhost:8001') + '/api/v1';
const REMOTE = ARG.includes('--remote');
const CHECK = ARG.includes('--check');
const OUT = path.join(ROOT, 'docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv');
const SERVABLE_LOGO = new Set(['CC0_PUBLIC_DOMAIN', 'HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION']);
const APPS = ['apps/marketing-web/public', 'apps/student-web/public'];

export async function loadAll(api = API) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const r = await fetch(`${api}/directory/institutions?page_size=200&page=${page}`);
    if (!r.ok) throw new Error(`directory page ${page}: HTTP ${r.status}`);
    const d = await r.json();
    items.push(...d.items);
    if (items.length >= d.total || !d.items.length) return { items, total: d.total };
  }
}

export function tierOf(inst) {
  const e = inst.enrichment ?? {};
  if (e.media?.hero) return 'A_CAMPUS_PHOTO';
  if (e.youtube?.video_id) return 'C_OFFICIAL_VIDEO';
  if (e.logo?.url && SERVABLE_LOGO.has(e.logo.rights_status)) return 'D_LOGO_IDENTITY';
  return 'E_NAME_IDENTITY';
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const { items, total } = await loadAll();
  // Provenance the card API does not carry: the content record (film verification) and the credits ledger (the exact
  // Commons file and the date it was retrieved, for the few V21 heroes whose record only says "Wikimedia Commons").
  const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/app/data/university_content.json'), 'utf8')).records;
  const creditsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/marketing-web/src/media/credits.json'), 'utf8'));
  const credits = new Map((Array.isArray(creditsRaw) ? creditsRaw : creditsRaw.items ?? creditsRaw.assets ?? Object.values(creditsRaw)).filter((x) => x?.slug).map((x) => [x.slug, x]));
  // Which institutions use each photographic asset (hero + gallery) — a shared asset is a cross-university image.
  const owners = new Map();
  for (const i of items) {
    const m = i.enrichment?.media;
    for (const a of [m?.hero, ...(m?.gallery ?? [])].filter(Boolean)) {
      owners.set(a.asset, new Set([...(owners.get(a.asset) ?? []), i.slug]));
    }
  }
  const rows = [];
  const problems = [];
  for (const i of items) {
    const e = i.enrichment ?? {};
    const tier = tierOf(i);
    const hero = e.media?.hero ?? null;
    const issues = [];
    let source_url = '', source_type = '', license = '', license_url = '', attribution = 'no', verified_at = '', local_path = '';
    if (tier === 'A_CAMPUS_PHOTO') {
      const credit = credits.get(hero.asset);
      source_url = /^https?:/.test(hero.media_source ?? '') ? hero.media_source : (credit?.source_url ?? hero.media_source);
      source_type = hero.official_asset ? 'official' : 'wikimedia_commons';
      license = hero.license_or_permission; license_url = hero.attribution_requirement?.license_url ?? credit?.license_url ?? '';
      attribution = hero.attribution_requirement ? 'yes' : 'no'; verified_at = hero.verified_at ?? credit?.retrieved ?? ''; local_path = hero.local_path;
      if (!/^https?:/.test(source_url ?? '')) issues.push('no source URL');
      if (hero.university_id && hero.university_id !== i.slug) issues.push(`media names ${hero.university_id}`);
      if (hero.kind && hero.kind !== 'CAMPUS') issues.push(`kind ${hero.kind}`);
      if ((owners.get(hero.asset)?.size ?? 0) > 1) issues.push(`asset shared with ${[...owners.get(hero.asset)].filter((s) => s !== i.slug).join('|')}`);
      for (const app of APPS) for (const w of [640, 1200]) {
        if (!fs.existsSync(path.join(ROOT, app, `${hero.local_path}-${w}.jpg`))) issues.push(`missing ${app}/${hero.local_path}-${w}.jpg`);
      }
      if (hero.rights_status === 'ATTRIBUTION_SUPPORTED' && !hero.attribution_requirement?.author) issues.push('attribution licence without author');
    } else if (tier === 'C_OFFICIAL_VIDEO') {
      source_url = `https://www.youtube.com/watch?v=${e.youtube.video_id}`; source_type = 'official_youtube';
      const yt = records[i.slug]?.youtube ?? {};
      license = `official channel ${yt.channel_url ?? e.youtube.channel_url} (verified via ${yt.verified_via ?? '?'}: ${yt.source_url ?? ''}); poster served by YouTube, not rehosted`;
      verified_at = yt.verified_at ?? e.youtube.verified_at ?? '';
      if (!verified_at) issues.push('film without verification date');
      if (REMOTE) {
        const r = await fetch(`https://i.ytimg.com/vi/${e.youtube.video_id}/hqdefault.jpg`, { method: 'HEAD' }).catch(() => null);
        if (!r?.ok) issues.push(`poster HTTP ${r?.status ?? 'error'}`);
      }
    } else if (tier === 'D_LOGO_IDENTITY') {
      source_url = e.logo.media_source ?? e.logo.source ?? ''; source_type = 'logo';
      license = e.logo.license_or_permission ?? e.logo.licence ?? ''; verified_at = e.logo.verified_at ?? ''; local_path = e.logo.local_path ?? '';
      if (e.logo.local_path) for (const app of APPS) if (!fs.existsSync(path.join(ROOT, app, e.logo.local_path))) issues.push(`missing ${app}/${e.logo.local_path}`);
    } else {
      source_type = 'registry_identity'; source_url = 'https://www.academyinfo.go.kr/'; license = 'registry facts (name, region) — no image';
      verified_at = i.last_verified ?? '';
      if (!i.name_ko) issues.push('no Korean name');
    }
    const mark = path.join(ROOT, 'apps/marketing-web/public/media/region-mark', `${i.region}.svg`);
    if ((tier === 'D_LOGO_IDENTITY' || tier === 'E_NAME_IDENTITY') && !fs.existsSync(mark)) issues.push(`no region mark for ${i.region}`);
    if (issues.length) problems.push(`${i.slug}: ${issues.join('; ')}`);
    rows.push({
      university_id: i.slug, name_ko: i.name_ko, name_en: i.name_en ?? '', region: i.region, institution_type: i.institution_type,
      primary_visual_tier: tier, source_url, source_type, license, license_url, attribution_required: attribution, verified_at, local_path,
      logo: e.logo?.url && SERVABLE_LOGO.has(e.logo.rights_status) ? 'yes' : 'no', official_video: e.youtube?.video_id ? 'yes' : 'no',
      gallery_count: e.media?.gallery?.length ?? 0, broken: issues.length ? 'yes' : 'no', cross_university: issues.some((x) => x.includes('shared') || x.includes('names')) ? 'yes' : 'no',
      issues: issues.join('; '), status: issues.length ? 'DEFECT' : 'INTENTIONAL',
    });
  }
  const cols = Object.keys(rows[0]);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, [cols.join(','), ...rows.map((r) => cols.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
  const count = (t) => rows.filter((r) => r.primary_visual_tier === t).length;
  const summary = {
    total, rows: rows.length,
    A_CAMPUS_PHOTO: count('A_CAMPUS_PHOTO'), C_OFFICIAL_VIDEO: count('C_OFFICIAL_VIDEO'),
    D_LOGO_IDENTITY: count('D_LOGO_IDENTITY'), E_NAME_IDENTITY: count('E_NAME_IDENTITY'),
    intentional: rows.filter((r) => r.status === 'INTENTIONAL').length, broken: rows.filter((r) => r.broken === 'yes').length,
    cross_university: rows.filter((r) => r.cross_university === 'yes').length,
  };
  console.log(JSON.stringify(summary));
  for (const p of problems.slice(0, 20)) console.log('  ✗', p);
  if (CHECK && (summary.rows !== 425 || summary.broken || summary.cross_university || summary.intentional !== summary.rows)) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
