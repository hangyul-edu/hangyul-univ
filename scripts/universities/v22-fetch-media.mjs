/**
 * V22 — choose and download each institution's hero, up to six gallery photographs and a logo from the
 * wide Commons sweep, recording rights per file (brief step A, B).
 *
 * Choice is by rule so it is reproducible, and it is **stable**: a hero V21 chose (and a person
 * reviewed on the contact sheet) stays the hero when it is still a valid candidate; a human `null` in
 * `curated/commons-selected.json` still means "nothing from Commons for this institution"; the
 * hand-placed entries in `curated/media.json` are not touched. New institutions take the top-ranked
 * hero-grade candidate (campus vocabulary → direct tie → free licence → width).
 *
 * Rights: the servable classes only. A photograph under CC BY / CC BY-SA is downloaded only when the
 * file names an author (the credit needs one), and its credit entry carries author, licence, licence
 * URL and source URL. A logo is downloaded only in the no-credit class, because the logo slot renders
 * no credit. Every photograph is **resized, never cropped** (Commons' own scaled rendition at ≤2400 px,
 * then 640/1200/2400 derivatives), so what Hangyul serves is the photographer's picture at a smaller
 * size.
 *
 * Output: files under `apps/{marketing-web,student-web}/public/media[/unilogo]`, entries in
 * `apps/marketing-web/src/media/credits.json`, and `scripts/universities/curated/v22-media-picked.json`
 * (the per-institution choice, with licence), which `v22-apply.mjs` folds into the content record.
 *
 *   node scripts/universities/v22-fetch-media.mjs [--only slug,…] [--dry] [--gallery 6] [--limit N]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, pool, readJson, registry, ROOT, TODAY, writeJson } from './lib.mjs';
import { ATTRIBUTION, FREE } from './v22-licences.mjs';
import { subjectOk } from './v22-subject.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const LIMIT = Number(flag('--limit', '0')) || 0;
const GALLERY = Number(flag('--gallery', '4'));
const DRY = ARG.includes('--dry');

const CANDIDATES = join(ROOT, 'server/app/data/raw/v22_commons_candidates.json');
const CREDITS = join(ROOT, 'apps/marketing-web/src/media/credits.json');
const SELECTED = join(ROOT, 'scripts/universities/curated/commons-selected.json');
const V21_PICKED = join(ROOT, 'scripts/universities/curated/commons-picked.json');
const CURATED_MEDIA = join(ROOT, 'scripts/universities/curated/media.json');
const OUT = join(ROOT, 'scripts/universities/curated/v22-media-picked.json');
const MEDIA_DIRS = ['apps/marketing-web/public/media', 'apps/student-web/public/media'];
const LOGO_DIRS = MEDIA_DIRS.map((d) => `${d}/unilogo`);
const WIDTHS_ALL = [640, 1200, 2400];
const TMP = join(process.env.CLAUDE_SCRATCHPAD ?? '/tmp/claude-0/-root-hangyul-univ/5641a8a5-1041-42db-8879-23a3f0fb4f56/scratchpad', 'v22-downloads');
mkdirSync(TMP, { recursive: true });
for (const d of [...MEDIA_DIRS, ...LOGO_DIRS]) mkdirSync(join(ROOT, d), { recursive: true });

const licenceUrl = (name) => {
  const m = /^cc[- ]by([- ]sa)?[- ](\d(?:\.\d)?)/i.exec(name);
  if (m) return `https://creativecommons.org/licenses/by${m[1] ? '-sa' : ''}/${m[2]}/`;
  if (/^cc0|cc-zero/i.test(name)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/public domain|^pd|no restrictions|copyrighted free use/i.test(name)) return 'https://commons.wikimedia.org/wiki/Commons:Licensing';
  if (/kogl/i.test(name)) return 'https://www.kogl.or.kr/info/license.do';
  if (/^attribution$/i.test(name)) return 'https://commons.wikimedia.org/wiki/Template:Attribution';
  return 'https://commons.wikimedia.org/wiki/Commons:Licensing';
};
function assetSlug(instSlug, title) {
  const stem = title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
  return `${instSlug}--${stem || 'campus'}`.slice(0, 90);
}
/** Commons' own scaled rendition at ≤ `w` px (a resize, by Commons), or the original when it is smaller. */
/**
 * Commons serves hot-linked thumbnails only at its standard widths (20…960, 1280, 1920, 3840 — https://w.wiki/GHai,
 * T414805). 3840 is the smallest standard size ≥ our 2400 derivative, so a wider original is fetched at 3840 and
 * anything narrower is fetched as the original (a thumbnail wider than the original is refused).
 */
function scaledUrl(url, title, width, w = 3840) {
  url = url.split('?')[0];                       // the API appends utm_* tracking to the original's URL
  if (!width || width <= w) return url;
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/.exec(url);
  if (!m) return url;
  const name = m[4];
  const ext = /\.(png|jpe?g|webp)$/i.test(name) ? '' : '.jpg';
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${name}/${w}px-${name}${ext}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastFailure = '';
async function fetchBytes(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await sleep(400);                           // rate-polite: upload.wikimedia.org answered 429 to a burst
      const res = await fetch(url, { headers: { 'User-Agent': 'HangyulUniv-media/1.0 (https://talkhangyul.com; support@talkhangyul.com)' }, redirect: 'follow' });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      lastFailure = `HTTP ${res.status} ${url.slice(0, 90)}`;
      if (res.status === 429 || res.status >= 500) await sleep(10000 * (attempt + 1));
      else return null;
    } catch (e) { lastFailure = String(e).slice(0, 80); await sleep(3000); }
  }
  return null;
}

const PY_PHOTO = `
import sys
from PIL import Image
src, slug, dirs, use = sys.argv[1], sys.argv[2], sys.argv[3].split('|'), sys.argv[4]
im = Image.open(src)
im.load()
if im.mode not in ('RGB',):
    bg = Image.new('RGB', im.size, (255, 255, 255))
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        bg.paste(im.convert('RGBA'), mask=im.convert('RGBA').split()[-1])
    else:
        bg.paste(im.convert('RGB'))
    im = bg
for w in (640, 1200, 2400):
    # Resize only. No crop is ever baked into the file: framing is CSS.
    img = im if w >= im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    # The hero is above the fold at full width; a gallery tile is never drawn larger than ~600 CSS px,
    # so its 2400 rendition can be lighter without a visible cost.
    q = 82 if use == 'campus-hero' else (74 if w == 2400 else 80)
    for d in dirs:
        img.save(f'{d}/{slug}-{w}.jpg', quality=q, optimize=True, progressive=True)
print(f'{im.width}x{im.height}')
`;
const PY_LOGO = `
import sys
from PIL import Image
src, outs = sys.argv[1], sys.argv[2].split('|')
im = Image.open(src).convert('RGBA')
w, h = im.size
if max(w, h) > 640:
    s = 640 / max(w, h); im = im.resize((max(1, round(w*s)), max(1, round(h*s))), Image.LANCZOS)
for o in outs: im.save(o, 'PNG', optimize=True)
print(f'{im.width}x{im.height}')
`;

function savePhoto(buf, asset, use) {
  const tmp = join(TMP, `${asset}.bin`);
  writeFileSync(tmp, buf);
  const dirs = MEDIA_DIRS.map((d) => join(ROOT, d)).join('|');
  const size = execFileSync('python3', ['-I', '-c', PY_PHOTO, tmp, asset, dirs, use], { encoding: 'utf8', timeout: 180000 }).trim();
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}
function saveLogo(buf, slug, mime) {
  const ext = mime === 'image/svg+xml' ? 'svg' : 'png';
  const outs = LOGO_DIRS.map((d) => join(ROOT, d, `${slug}.${ext}`));
  if (ext === 'svg') { for (const o of outs) writeFileSync(o, buf); return { path: `media/unilogo/${slug}.svg` }; }
  const tmp = join(TMP, `${slug}-logo.bin`);
  writeFileSync(tmp, buf);
  execFileSync('python3', ['-I', '-c', PY_LOGO, tmp, outs.join('|')], { encoding: 'utf8', timeout: 90000 });
  return { path: `media/unilogo/${slug}.png` };
}

/* ------------------------------------------------------------------------------------------ choose */

const candidates = readJson(CANDIDATES, { records: {} }).records;
const selection = readJson(SELECTED, { records: {} }).records ?? {};
const v21 = readJson(V21_PICKED, { records: {} }).records ?? {};
const curatedMedia = readJson(CURATED_MEDIA, { records: {} }).records ?? {};
const credits = readJson(CREDITS, []);
const byCredit = new Map(credits.map((c) => [c.slug, c]));
const doc = content();
const insts = new Map(registry().map((i) => [i.slug, i]));
const prior = readJson(OUT, { records: {} }).records ?? {};

const servablePhoto = (p) => (FREE.test(p.licence) || (ATTRIBUTION.test(p.licence) && p.author && p.author !== 'unknown')) && subjectOk(p).ok;

function choose(slug, rec) {
  const out = { hero: null, gallery: [], logo: null, why: null };
  if (curatedMedia[slug]) { out.why = 'hand-curated in curated/media.json — untouched'; return out; }
  if (selection[slug] === null) { out.why = 'a person rejected every automatic Commons pick for this institution (V21 contact sheet)'; return out; }
  const photos = (rec.photos ?? []).filter(servablePhoto);
  const byTitle = new Map(photos.map((p) => [p.title, p]));
  let hero = null;
  if (selection[slug] && byTitle.has(selection[slug])) hero = byTitle.get(selection[slug]);
  else if (v21[slug]?.title && byTitle.has(v21[slug].title)) hero = byTitle.get(v21[slug].title);
  else hero = photos.find((p) => p.hero_grade) ?? null;
  // A V21 hero whose file the wide sweep no longer lists (renamed/deleted on Commons) is kept as-is in the
  // content record by v22-apply; here we just do not choose a replacement for it.
  if (!hero && v21[slug]?.title) out.why = 'V21 hero kept (file not re-listed by the V22 sweep)';
  out.hero = hero;
  const rest = photos.filter((p) => p.title !== hero?.title);
  // Gallery: hero-grade first, then the rest, never the hero itself; near-duplicate stems are allowed
  // (different shots of one series), identical titles are not.
  rest.sort((a, b) => Number(b.hero_grade) - Number(a.hero_grade));
  out.gallery = rest.slice(0, GALLERY);
  // Logo: keep whatever the content record already serves (owner crest, V21 PD logo); else top candidate.
  const existing = doc.records[slug]?.logo;
  if (!existing?.url) out.logo = (rec.logos ?? []).find((l) => FREE.test(l.licence)) ?? null;
  return out;
}

let targets = Object.entries(candidates).filter(([slug]) => insts.has(slug));
if (ONLY.length) targets = targets.filter(([slug]) => ONLY.includes(slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

const picked = ONLY.length || LIMIT ? { ...prior } : {};
let downloaded = 0; let reused = 0; let failed = 0;

async function ensurePhoto(slug, p, use) {
  const inst = insts.get(slug);
  const asset = assetSlug(slug, p.title);
  const needsCredit = !FREE.test(p.licence);
  const entryBase = {
    slug: asset,
    title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
    subject: p.description || `${inst.name_en || inst.name_ko} campus`,
    place: inst.region,
    license: p.licence,
    license_url: licenceUrl(p.licence),
    rights_status: needsCredit ? 'ATTRIBUTION_SUPPORTED' : 'CC0_PUBLIC_DOMAIN',
    attribution_required: needsCredit,
    author: p.author,
    source_url: p.page,
    retrieved: TODAY,
    suggested_use: use,
    university_slug: slug,
    found_via: p.via,
  };
  const existing = byCredit.get(asset);
  if (existing && existsSync(join(ROOT, MEDIA_DIRS[0], `${asset}-1200.jpg`)) && existsSync(join(ROOT, MEDIA_DIRS[1], `${asset}-1200.jpg`))) {
    reused += 1;
    // Refresh the licence fields from today's API read; keep the stored dimensions.
    Object.assign(existing, { license: entryBase.license, license_url: entryBase.license_url, rights_status: entryBase.rights_status, attribution_required: needsCredit, author: p.author, source_url: p.page, university_slug: slug });
    return { asset, title: p.title, licence: p.licence, rights: existing.rights_status, attribution_required: needsCredit, width: existing.width, height: existing.height };
  }
  if (DRY) return { asset, title: p.title, licence: p.licence, rights: entryBase.rights_status, attribution_required: needsCredit, width: p.width, height: p.height, dry: true };
  const buf = await fetchBytes(scaledUrl(p.url, p.title, p.width));
  if (!buf) { failed += 1; console.warn(`  ! ${slug}: ${lastFailure}`); return null; }
  let dims;
  try { dims = savePhoto(buf, asset, use); } catch (e) { failed += 1; console.warn(`  ! ${slug}: ${String(e).slice(0, 100)}`); return null; }
  const entry = { ...entryBase, orientation: dims.height > dims.width ? 'portrait' : 'landscape', width: dims.width, height: dims.height, dominant_tone: 'day', focal_point: '50% 50%', people: 'unknown' };
  const i = credits.findIndex((c) => c.slug === asset);
  if (i >= 0) credits[i] = { ...credits[i], ...entry }; else credits.push(entry);
  byCredit.set(asset, entry);
  downloaded += 1;
  return { asset, title: p.title, licence: p.licence, rights: entry.rights_status, attribution_required: needsCredit, width: dims.width, height: dims.height };
}

let n = 0;
await pool(targets, 2, async ([slug, rec]) => {
  const c = choose(slug, rec);
  const row = { why: c.why ?? undefined };
  if (c.hero) row.hero = await ensurePhoto(slug, c.hero, 'campus-hero');
  const gallery = [];
  for (const p of c.gallery) { const g = await ensurePhoto(slug, p, 'campus-gallery'); if (g) gallery.push(g); }
  if (gallery.length) row.gallery = gallery;
  if (c.logo) {
    const l = c.logo;
    if (DRY) row.logo = { title: l.title, licence: l.licence, dry: true };
    else {
      const buf = await fetchBytes(l.url.split('?')[0]);
      if (buf) {
        try {
          const saved = saveLogo(buf, slug, l.mime);
          row.logo = { title: l.title, licence: l.licence, local_path: saved.path, width: l.width, height: l.height, source_url: l.page, author: l.author, via: l.via };
          downloaded += 1;
        } catch (e) { failed += 1; console.warn(`  ! ${slug} logo: ${String(e).slice(0, 100)}`); }
      } else failed += 1;
    }
  }
  if (row.hero || row.gallery || row.logo || row.why) picked[slug] = row;
  n += 1;
  if (n % 20 === 0) process.stdout.write(`\r  institutions ${n}/${targets.length} · files ${downloaded} new, ${reused} present, ${failed} failed   `);
});
console.log();

// Prune: a V22 asset (one this script credited, marked by `found_via`) that today's rules no longer choose is
// removed from the manifest and from disk, so a tightened subject rule cannot leave an orphan behind.
let pruned = 0;
if (!DRY && !ONLY.length && !LIMIT) {
  const chosen = new Set(Object.values(picked).flatMap((r) => [r.hero?.asset, ...(r.gallery ?? []).map((g) => g.asset)]).filter(Boolean));
  for (let i = credits.length - 1; i >= 0; i -= 1) {
    const c = credits[i];
    if (!c.found_via || chosen.has(c.slug)) continue;
    credits.splice(i, 1);
    for (const d of MEDIA_DIRS) for (const w of WIDTHS_ALL) { const f = join(ROOT, d, `${c.slug}-${w}.jpg`); if (existsSync(f)) unlinkSync(f); }
    pruned += 1;
  }
}
if (!DRY) writeJson(CREDITS, credits);
writeJson(OUT, {
  _generated_by: 'scripts/universities/v22-fetch-media.mjs',
  _what: 'V22 — the hero, gallery (≤6, never the hero) and logo chosen per institution from the wide Commons sweep, with the licence each is served under.',
  generated_at: TODAY,
  records: picked,
});
const rows = Object.values(picked);
console.log(`  institutions with a hero                 ${rows.filter((r) => r.hero).length}`);
console.log(`  institutions with ≥1 gallery photograph  ${rows.filter((r) => r.gallery?.length).length}`);
console.log(`  gallery photographs total                ${rows.reduce((s, r) => s + (r.gallery?.length ?? 0), 0)}`);
console.log(`  new logos                                ${rows.filter((r) => r.logo).length}`);
console.log(`  credited (attribution-supported) assets  ${rows.flatMap((r) => [r.hero, ...(r.gallery ?? [])]).filter((a) => a?.attribution_required).length}`);
console.log(`  files downloaded ${downloaded} · already present ${reused} · failed ${failed} · pruned ${pruned}`);
console.log(`  → apps/*/public/media, credits.json, curated/v22-media-picked.json\n`);
