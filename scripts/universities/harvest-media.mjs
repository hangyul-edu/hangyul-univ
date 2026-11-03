/**
 * V20 — university logos and photographs, with the rights decided **before** anything is stored
 * (brief §7, §9, §42, §49).
 *
 * This replaces the one thing V17 got wrong about media. Its enrichment wrote the Commons URL of any
 * logo whose licence was "reusable", including CC BY-SA, and the page rendered that URL **hot-linked
 * from upload.wikimedia.org with no credit** (§213.2). Three separate problems in one line: five
 * institutions were serving an attribution-required image without attribution, the hero's largest asset
 * depended on a third party's uptime, and the licence gate could not see any of it because it inspects
 * `credits.json` and `public/`.
 *
 * What this does instead, per institution:
 *
 *   1. re-reads the file's licence from the **Commons API**, not from the cached string;
 *   2. classifies it: attribution-free → servable, anything else → recorded as blocked, with the licence
 *      that blocked it, and never written to a field a page can render (§7);
 *   3. applies the quality gate (§49): a minimum size, a sane aspect ratio, and a refusal for the files
 *      whose names say they are not a logo — `Authority.jpg` was being served as Hansung University's
 *      mark;
 *   4. downloads what survives into `each app's `public/media/unilogo/``, so it is Hangyul's file on Hangyul's
 *      origin with explicit dimensions, and records `local_path`, `media_source`,
 *      `license_or_permission`, `official_asset` and `attribution_requirement` beside it (§42).
 *
 * It also folds the V17 Wikidata facts into the canonical record, so there is one content document
 * rather than two the renderer has to join.
 *
 *   node scripts/universities/harvest-media.mjs [--no-download] [--only slug,…]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { content, enrichment, get, pool, progress, registry, ROOT, saveContent, TODAY } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const DOWNLOAD = !ARG.includes('--no-download');

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
/** Attribution-free only. Same set as `scripts/media/fetch_cc0.py`, for the same owner decision. */
const FREE = /^(cc0|cc-zero|cc0 1\.0|public domain|pd(-self|-user|-old(-\d+)?|-art|-textlogo|-shape|-ineligible)?|no restrictions)$/i;
/** A file whose own name says it is not an institutional mark. §49's cheapest check. */
const NOT_A_LOGO = /authority|signature|stamp|seal_of_approval|map|diagram|chart|photo|building|campus|gate|aerial|street/i;

const LOGO_DIRS = ['apps/marketing-web/public/media/unilogo', 'apps/student-web/public/media/unilogo'];

async function commons(params) {
  const url = `${COMMONS}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const r = await get(url, { accept: 'application/json' });
  if (!r.ok) return null;
  try { return JSON.parse(r.text); } catch { return null; }
}

/** Licence, author and true pixel size, from the API rather than from whatever we cached last year. */
async function fileInfo(title) {
  const d = await commons({ action: 'query', prop: 'imageinfo', titles: title, iiprop: 'url|extmetadata|size|mime' });
  const page = d?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const ext = info.extmetadata ?? {};
  const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').trim();
  return {
    url: info.url, mime: info.mime, width: info.width, height: info.height,
    licence: strip(ext.LicenseShortName) || strip(ext.License) || 'unknown',
    author: strip(ext.Artist) || 'unknown',
    descriptionUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

function judge(title, info) {
  if (!info) return { ok: false, why: 'no imageinfo' };
  if (!FREE.test(info.licence)) return { ok: false, why: `licence ${info.licence} requires attribution` };
  if (NOT_A_LOGO.test(title)) return { ok: false, why: `file name "${title.replace(/^File:/, '')}" is not an institutional mark` };
  if (!info.width || !info.height) return { ok: false, why: 'no dimensions' };
  if (Math.max(info.width, info.height) < 120) return { ok: false, why: `too small (${info.width}×${info.height})` };
  const ratio = info.width / info.height;
  if (ratio < 0.18 || ratio > 8) return { ok: false, why: `aspect ratio ${ratio.toFixed(2)} is not a logo` };
  if (!/^image\/(png|jpeg|svg\+xml|gif|webp)$/.test(info.mime ?? '')) return { ok: false, why: `mime ${info.mime}` };
  return { ok: true };
}

/**
 * Download once, flatten onto white only where the source has no alpha, and write a 2× bitmap.
 * §9: preserve the mark's real geometry — no circular crop, no stretch, no forced padding. The stored
 * width and height are the file's own, and the page reserves space from them.
 */
function download(url, slug, mime) {
  const ext = mime === 'image/svg+xml' ? 'svg' : 'png';
  const outs = LOGO_DIRS.map((d) => join(ROOT, d, `${slug}.${ext}`));
  for (const d of LOGO_DIRS) mkdirSync(join(ROOT, d), { recursive: true });
  if (outs.every(existsSync)) return { path: `media/unilogo/${slug}.${ext}`, ext };
  const py = `
import io, sys, urllib.request
from PIL import Image
url, outs, ext = sys.argv[1], sys.argv[2].split('|'), sys.argv[3]
req = urllib.request.Request(url, headers={'User-Agent': 'HangyulUniv-media/1.0 (https://talkhangyul.com)'})
raw = urllib.request.urlopen(req, timeout=60).read()
if ext == 'svg':
    for o in outs: open(o, 'wb').write(raw)
else:
    im = Image.open(io.BytesIO(raw))
    im = im.convert('RGBA')
    # Cap the long edge at 640: a mark is never drawn larger than ~200 CSS px, and 2x of that is plenty.
    w, h = im.size
    if max(w, h) > 640:
        s = 640 / max(w, h); im = im.resize((max(1, round(w*s)), max(1, round(h*s))), Image.LANCZOS)
    for o in outs: im.save(o, 'PNG', optimize=True)
print(im.size if ext != 'svg' else '')
`;
  execFileSync('python3', ['-I', '-c', py, url, outs.join('|'), ext], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 });
  return { path: `media/unilogo/${slug}.${ext}`, ext };
}

const insts = registry();
const enr = enrichment();
const doc = content();

let targets = insts;
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));

// ---------------------------------------------------------------- 1. fold the Wikidata facts in
let folded = 0;
for (const inst of targets) {
  const e = enr[inst.slug];
  if (!e) continue;
  const rec = (doc.records[inst.slug] ??= {});
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '') rec[k] = v; };
  put('wikidata_id', e.wikidata_id);
  put('source_url', e.source_url);
  put('verified_at', e.verified_at ?? TODAY);
  put('name_en', e.name_en);
  put('website_url', inst.website_url ?? e.website_url);
  put('founded_year', e.founded_year);
  put('student_count', e.student_count);
  put('city_ko', e.city_ko);
  put('lat', e.lat); put('lon', e.lon);
  folded += 1;
}

// ---------------------------------------------- 2. the owner's own crests, which outrank everything
//
// `apps/marketing-web/public/media/universities` holds 23 marks from the owner's original Koreanasha
// drop (`template-koreanasha/assets/img/university`) — OWNER_AUTHORISED, already transparent, already
// audited for bbox fill and stray geometry by `scripts/media/normalize_crests.py`, and already joined to
// registry slugs by `build_marquee_manifest.py`. V17 never connected them to the university pages: the
// homepage band drew them and the detail page hot-linked a Commons file instead. They take precedence
// over any Commons candidate, because they are licensed to us, locally hosted and better artwork.
const crests = JSON.parse(readFileSync(join(ROOT, 'apps/marketing-web/src/media/universities.json'), 'utf8'));
let owned = 0;
for (const crest of crests) {
  if (!crest.slug) continue;
  if (ONLY.length && !ONLY.includes(crest.slug)) continue;
  const rec = (doc.records[crest.slug] ??= {});
  rec.logo = {
    url: `/media/universities/${crest.file}`,
    local_path: `media/universities/${crest.file}`,
    licence: 'Owner-supplied — Hangyul asset library (Koreanasha drop)',
    // The manifest's numbers are the mark's *aspect*, normalised to a 100-unit height, which is exactly
    // what a renderer needs to reserve the right box without distorting the geometry (§9).
    width: crest.width, height: crest.height,
    source: 'hangyul-asset-library',
    media_source: 'template-koreanasha/assets/img/university',
    license_or_permission: 'Owner-supplied — Hangyul asset library',
    official_asset: true,
    attribution_requirement: null,
    rights_status: 'OWNER_AUTHORISED',
    verified_at: TODAY,
    verification_status: 'REGISTRY_ASSERTED',
  };
  owned += 1;
}
console.log(`  owner-authorised crests wired     ${owned}`);

// ---------------------------------------------------------------- 3. logos from Commons, rights first
// An institution with an owner-authorised crest is settled; only the rest go back to Commons. Keyed off
// the crest manifest rather than off `rec.logo`, so a re-run re-checks a Commons licence rather than
// trusting whatever a previous run left behind.
const crested = new Set(crests.map((c) => c.slug).filter(Boolean));
const withLogo = targets.filter((i) => (enr[i.slug] ?? {}).logo?.file && !crested.has(i.slug));
console.log(`V20 media harvest — ${folded} Wikidata records folded in; ${withLogo.length} logo candidates to re-check`);
let done = 0;
const judged = await pool(withLogo, 4, async (inst) => {
  const cand = enr[inst.slug].logo;
  const title = cand.file.replace(/^file:/i, 'File:').replace(/ /g, '_');
  const info = await fileInfo(title);
  const verdict = judge(title, info);
  progress(++done, withLogo.length, 'logos');
  return { slug: inst.slug, title, info, verdict };
});

const blocked = [];
let served = 0;
for (const j of judged) {
  if (!j?.slug) continue;
  const rec = (doc.records[j.slug] ??= {});
  if (!j.verdict.ok) {
    delete rec.logo;
    (rec.media ??= {}).blocked = [...((rec.media.blocked ?? []).filter((b) => b.slot !== 'logo')), { slot: 'logo', file: j.title, licence: j.info?.licence ?? 'unknown', why: j.verdict.why }];
    blocked.push(`${j.slug}: ${j.verdict.why}`);
    continue;
  }
  let local = null;
  if (DOWNLOAD) {
    try { local = download(j.info.url, j.slug, j.info.mime); }
    catch (e) { blocked.push(`${j.slug}: download failed — ${String(e).slice(0, 80)}`); continue; }
  }
  rec.logo = {
    url: local ? `/${local.path}` : j.info.url,
    local_path: local?.path,
    licence: j.info.licence,
    width: j.info.width, height: j.info.height,
    source: 'wikimedia-commons',
    media_source: j.info.descriptionUrl,
    license_or_permission: j.info.licence,
    official_asset: false,
    attribution_requirement: null,
    rights_status: 'CC0_PUBLIC_DOMAIN',
    source_url: j.info.descriptionUrl,
    verified_at: TODAY,
    verification_status: 'REGISTRY_ASSERTED',
  };
  if (rec.media?.blocked) rec.media.blocked = rec.media.blocked.filter((b) => b.slot !== 'logo');
  served += 1;
}

saveContent(doc);
console.log(`\n  logos servable and locally hosted  ${served}`);
console.log(`  logos refused                      ${blocked.length}`);
for (const b of blocked) console.log(`    · ${b}`);
console.log('  → server/app/data/university_content.json\n');
