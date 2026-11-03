// V24 — docs/qa/v24/UNIVERSITY_MEDIA_COVERAGE.csv: one row per institution, the columns the V24 brief asks for (Part J).
//
//   node scripts/qa/v24/media-coverage.mjs [--check]
//
// Reads the served API (what customers get) and the content record, classifies each institution's primary visual,
// and compares it with V23's row. Counts are printed, never inferred: fallback is reported as its own number.
//   CAMPUS_PHOTO         a rights-cleared photograph of this institution's campus (Commons or a licensed source)
//   OFFICIAL_PHOTO       a photograph the institution itself publishes under terms that allow this use
//   OFFICIAL_VIDEO       the poster of the institution's verified official film (served by YouTube, not rehosted)
//   LOGO                 the institution's own servable mark in the identity composition
//   IDENTITY             the designed fallback: the name in both scripts and the province mark — no image of a campus
// --check exits 1 on a missing file, a cross-university asset, a photo without rights metadata, or a fallback row
// without a logged search attempt.
import fs from 'node:fs';
import path from 'node:path';

import { loadAll, tierOf } from '../v23/university-visual-coverage.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const CHECK = process.argv.includes('--check');
const OUT = path.join(ROOT, 'docs/qa/v24/UNIVERSITY_MEDIA_COVERAGE.csv');
const APPS = ['apps/marketing-web/public', 'apps/student-web/public'];
const read = (p, d) => (fs.existsSync(path.join(ROOT, p)) ? JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) : d);
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const v23 = new Map(fs.readFileSync(path.join(ROOT, 'docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')))
  .map((c) => [c[0], c[5]]));
const V23_TYPE = { A_CAMPUS_PHOTO: 'CAMPUS_PHOTO', C_OFFICIAL_VIDEO: 'OFFICIAL_VIDEO', D_LOGO_IDENTITY: 'LOGO', E_NAME_IDENTITY: 'IDENTITY' };
const weak = new Set(read('docs/qa/v24/photo-review/weak.json', []));
const swaps = read('docs/qa/v24/photo-review/applied-swaps.json', []);
const imports = read('docs/qa/v24/photo-review/import-log.json', []).filter((x) => x.result === 'APPLIED');
// The research log: every D/E institution's attempts, source by source (written by the V24 media research).
const attempts = read('server/app/data/raw/v24_media_candidates.json', { records: [] });
const attemptBySlug = new Map((Array.isArray(attempts.records) ? attempts.records : []).map((r) => [r.slug, r]));
// A fallback counts as researched only when every route left a logged attempt (Commons, Openverse, KOGL, 공유마당).
const attemptOf = (slug) => {
  const r = attemptBySlug.get(slug);
  if (!r?.attempts?.length) return null;
  const routes = [...new Set(r.attempts.map((a) => a.route))];
  return { routes, summary: `${r.attempts.length} logged queries over ${routes.join(', ')}; ${r.candidates?.length ?? 0} candidates` };
};

const { items } = await loadAll();
const owners = new Map();
for (const i of items) {
  const m = i.enrichment?.media;
  for (const a of [m?.hero, ...(m?.gallery ?? [])].filter(Boolean)) owners.set(a.media_source ?? a.asset, new Set([...(owners.get(a.media_source ?? a.asset) ?? []), i.slug]));
}
const rows = [];
const problems = [];
for (const i of items) {
  const e = i.enrichment ?? {};
  const tier = tierOf(i);
  const hero = e.media?.hero ?? null;
  const type = tier === 'A_CAMPUS_PHOTO' ? (hero.official_asset ? 'OFFICIAL_PHOTO' : 'CAMPUS_PHOTO') : V23_TYPE[tier];
  const issues = [];
  let url = '', owner = '', license = '', verified = '';
  if (hero && tier === 'A_CAMPUS_PHOTO') {
    url = hero.media_source; owner = hero.source_owner ?? hero.attribution_requirement?.author ?? (hero.official_asset ? i.name_en : '');
    license = hero.license_or_permission; verified = hero.verified_at ?? '';
    for (const a of [hero, ...(e.media.gallery ?? [])]) {
      for (const app of APPS) for (const w of [640, 1200]) if (!fs.existsSync(path.join(ROOT, app, `${a.local_path}-${w}.jpg`))) issues.push(`missing ${app}/${a.local_path}-${w}.jpg`);
      if ((owners.get(a.media_source ?? a.asset)?.size ?? 0) > 1) issues.push(`shared: ${[...owners.get(a.media_source ?? a.asset)].join('|')}`);
      if (!a.license_or_permission || !/^https?:/.test(a.media_source ?? '')) issues.push(`no rights metadata on ${a.asset}`);
      if (a.rights_status === 'ATTRIBUTION_SUPPORTED' && !a.attribution_requirement?.author) issues.push(`no author on ${a.asset}`);
    }
  } else if (tier === 'C_OFFICIAL_VIDEO') {
    url = `https://www.youtube.com/watch?v=${e.youtube.video_id}`; owner = e.youtube.channel_title ?? e.youtube.channel_url ?? '';
    license = 'official channel — poster served by YouTube, not rehosted'; verified = e.youtube.verified_at ?? '';
  } else if (tier === 'D_LOGO_IDENTITY') {
    url = e.logo.media_source ?? e.logo.url ?? ''; owner = i.name_en ?? i.name_ko; license = e.logo.license_or_permission ?? ''; verified = e.logo.verified_at ?? '';
  }
  const v23type = V23_TYPE[v23.get(i.slug)] ?? '';
  const swap = swaps.find((s) => s.slug === i.slug && s.action === 'hero_swap');
  const imp = imports.filter((x) => x.slug === i.slug);
  const reasons = [];
  if (v23type && v23type !== type) reasons.push(`${v23type}→${type}`);
  if (swap) reasons.push(`hero swapped to a stronger gallery photo (${swap.to})`);
  if (imp.length) reasons.push(imp.map((x) => x.why || `${x.role} added: ${x.title}`).join('; '));
  const at = attemptOf(i.slug);
  if (type === 'IDENTITY' || type === 'LOGO') {
    if (!at) issues.push('fallback without a logged search attempt');
    else reasons.push(`fallback after search: ${at.summary ?? at.outcome ?? 'see v24_media_candidates.json'}`);
  }
  if (issues.length) problems.push(`${i.slug}: ${[...new Set(issues)].join('; ')}`);
  rows.push({
    slug: i.slug, name_ko: i.name_ko, name_en: i.name_en ?? '', region: i.region,
    primary_visual_type: type, primary_visual_url: url, source_owner: owner, license, verified_at: verified,
    quality_score: hero?.quality_score ?? (hero ? (weak.has(i.slug) && !swap && !imp.some((x) => x.role === 'hero') ? 'weak' : 'pass') : ''),
    has_real_photo: hero ? 'yes' : 'no', has_official_film: e.youtube?.video_id ? 'yes' : 'no',
    has_logo: e.logo?.url ? 'yes' : 'no', gallery_count: e.media?.gallery?.length ?? 0,
    focal_x: hero?.focal_x ?? '', focal_y: hero?.focal_y ?? '',
    v23_visual_type: v23type, v24_visual_type: type, changed_reason: reasons.join(' | '), issues: [...new Set(issues)].join('; '),
  });
}
const cols = Object.keys(rows[0]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, [cols.join(','), ...rows.map((r) => cols.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
const n = (t) => rows.filter((r) => r.primary_visual_type === t).length;
const summary = {
  rows: rows.length, campus_photographs: n('CAMPUS_PHOTO'), official_photographic: n('OFFICIAL_PHOTO'),
  official_video_led: n('OFFICIAL_VIDEO'), logo_led: n('LOGO'), identity_fallback: n('IDENTITY'),
  with_real_photo_anywhere: rows.filter((r) => r.has_real_photo === 'yes').length,
  weak_primary_photos_remaining: rows.filter((r) => r.quality_score === 'weak').length,
  changed_since_v23: rows.filter((r) => r.changed_reason && !r.changed_reason.startsWith('fallback after')).length,
  defects: problems.length,
};
console.log(JSON.stringify(summary));
for (const p of problems.slice(0, 30)) console.log('  ✗', p);
if (CHECK && (rows.length !== 425 || problems.length)) { console.log('EXIT=1'); process.exit(1); }
console.log('EXIT=0');
