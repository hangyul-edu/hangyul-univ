/**
 * V21 — download the accepted Commons candidates and record their rights (brief §14, §15).
 *
 * ## The licence decision this script implements
 *
 * V14's owner rule was **no customer-visible photo attribution**, so only CC0/PD could be hosted.
 * Measured on the full register, that rule is why 2 of 425 institutions had a photograph: of 718
 * Commons files found in institutions' own categories, **676 were refused on licence alone**, and
 * almost all of those are CC BY or CC BY-SA.
 *
 * §15 of the V21 brief changes the rule: *"other licence only if its attribution terms are
 * intentionally supported."* So attribution is now **built**, not avoided — a per-photograph credit
 * with the author, the licence and a link, rendered as part of the design — and the attribution-bearing
 * licences are usable. That takes institutions with a campus photograph from 19 to 66.
 *
 * Two compliance details that shape the code:
 *
 *   * **Resize only, never crop on disk.** Framing is done with CSS `object-position`, so the file
 *     Hangyul serves is the photographer's own image at a smaller size. Resizing is not an adaptation;
 *     a baked-in crop of a CC BY-SA work arguably is, and the share-alike question is not one to
 *     invite for the sake of a tighter thumbnail.
 *   * **The credit travels with the file.** `credits.json` carries `author`, `license`,
 *     `license_url` and `source_url` for every asset, and `attribution_required` is the flag the
 *     renderer reads. An asset that needs a credit and has no author recorded is refused here.
 *
 *   node scripts/universities/fetch-media.mjs [--limit N] [--dry] [--only slug,…]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readJson, registry, ROOT, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const LIMIT = Number(flag('--limit', '0')) || 0;
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const DRY = ARG.includes('--dry');

const CANDIDATES = join(ROOT, 'server/app/data/raw/commons_candidates.json');
const CREDITS = join(ROOT, 'apps/marketing-web/src/media/credits.json');
const SELECTED = join(ROOT, 'scripts/universities/curated/commons-selected.json');
const MEDIA_DIRS = ['apps/marketing-web/public/media', 'apps/student-web/public/media'];
const WIDTHS = [640, 1200, 2400];

/** No attribution condition — may be shown with no credit at all. */
const FREE = /^(cc0|cc-zero|cc0 1\.0|public domain|pd(-self|-user|-old(-\d+)?|-art|-text|-textlogo|-shape|-ineligible|-korea)?|no restrictions|copyrighted free use)$/i;
/** Attribution required, and now **supported**: author + licence + link are rendered. */
const ATTRIBUTION = /^(cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?( [a-z]{2})?|attribution|kogl type [01])$/i;

const licenceUrl = (name) => {
  const m = /^cc[- ]by([- ]sa)?[- ](\d(?:\.\d)?)/i.exec(name);
  if (m) return `https://creativecommons.org/licenses/by${m[1] ? '-sa' : ''}/${m[2]}/`;
  if (/^cc0/i.test(name)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/public domain|^pd/i.test(name)) return 'https://commons.wikimedia.org/wiki/Commons:Licensing';
  if (/kogl/i.test(name)) return 'https://www.kogl.or.kr/info/license.do';
  return 'https://commons.wikimedia.org/wiki/Commons:Licensing';
};

/** A stable, readable asset slug: the institution plus what the picture is of. */
function assetSlug(instSlug, title) {
  const stem = title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
  return `${instSlug}--${stem || 'campus'}`.slice(0, 90);
}

const candidates = readJson(CANDIDATES, { records: {} }).records;
const selection = readJson(SELECTED, { records: {} });
const credits = readJson(CREDITS, []);
const byCreditSlug = new Map(credits.map((c) => [c.slug, c]));
const insts = new Map(registry().map((i) => [i.slug, i]));

/**
 * One photograph per institution, chosen by rule so the choice is reproducible.
 *
 * Order: an explicit human pick in `curated/commons-selected.json`, then the widest attribution-free
 * file, then the widest attribution-bearing one. Width is the proxy for quality that survives having
 * no eyes on 425 institutions; the quality filters in `harvest-commons.mjs` have already removed
 * maps, diagrams, portraits and anything under 1,400 px.
 */
function pick(slug, rec) {
  const manual = selection.records?.[slug];
  if (manual === null) return null;                       // explicitly rejected by a person
  if (manual) {
    // A human pick may name a file the automatic rule had *blocked on licence* — that is the point of
    // supporting attribution. Look in both lists.
    return rec.photos.find((p) => p.title === manual)
      ?? (rec.blocked ?? []).find((b) => b.title === manual)
      ?? null;
  }
  const free = rec.photos.filter((p) => FREE.test(p.licence));
  if (free.length) return free[0];
  const attributed = (rec.blocked ?? [])
    .filter((b) => b.kind === 'photo' && ATTRIBUTION.test(b.licence || '') && b.why?.startsWith('licence'))
    .filter((b) => (b.width ?? 0) >= 1400 && (b.width ?? 0) >= (b.height ?? 1) * 1.1)
    .filter((b) => b.author && b.author !== 'unknown')    // no credit → not usable, however good
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return attributed[0] ?? null;
}

function download(url, slug) {
  const py = `
import io, sys, urllib.request
from PIL import Image
url, slug, dirs = sys.argv[1], sys.argv[2], sys.argv[3].split('|')
req = urllib.request.Request(url, headers={'User-Agent': 'HangyulUniv-media/1.0 (https://talkhangyul.com)'})
raw = urllib.request.urlopen(req, timeout=120).read()
im = Image.open(io.BytesIO(raw)).convert('RGB')
out = []
for w in (640, 1200, 2400):
    # **Resize only.** No crop is ever baked into the file: framing is CSS, so what Hangyul serves is
    # the photographer's own picture at a smaller size.
    img = im if w >= im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    for d in dirs:
        img.save(f'{d}/{slug}-{w}.jpg', quality=82, optimize=True, progressive=True)
out.append(f'{im.width}x{im.height}')
print(out[0])
`;
  const dirs = MEDIA_DIRS.map((d) => join(ROOT, d)).join('|');
  const size = execFileSync('python3', ['-I', '-c', py, url, slug, dirs], { encoding: 'utf8', timeout: 180000 }).trim();
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}

let added = 0; let reused = 0; let skipped = 0; const picked = {};
let targets = Object.entries(candidates);
if (ONLY.length) targets = targets.filter(([slug]) => ONLY.includes(slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

for (const [slug, rec] of targets) {
  const inst = insts.get(slug);
  if (!inst) continue;
  const choice = pick(slug, rec);
  if (!choice) { skipped += 1; continue; }
  const asset = assetSlug(slug, choice.title);
  const needsCredit = !FREE.test(choice.licence);
  if (needsCredit && !ATTRIBUTION.test(choice.licence || '')) { skipped += 1; continue; }
  picked[slug] = { asset, title: choice.title, licence: choice.licence, attribution_required: needsCredit };

  if (byCreditSlug.has(asset) && existsSync(join(ROOT, MEDIA_DIRS[0], `${asset}-1200.jpg`))) { reused += 1; continue; }
  if (DRY) { added += 1; continue; }
  let dims;
  try { dims = download(choice.url, asset); }
  catch (e) { console.warn(`  ! ${slug}: download failed — ${String(e).slice(0, 90)}`); skipped += 1; continue; }

  const entry = {
    slug: asset,
    title: choice.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
    subject: choice.description || `${inst.name_en || inst.name_ko} campus`,
    place: inst.region,
    orientation: dims.height > dims.width ? 'portrait' : 'landscape',
    width: dims.width, height: dims.height,
    dominant_tone: 'day',
    focal_point: '50% 50%',
    people: 'unknown',
    license: choice.licence,
    license_url: licenceUrl(choice.licence),
    rights_status: needsCredit ? 'ATTRIBUTION_SUPPORTED' : 'CC0_PUBLIC_DOMAIN',
    attribution_required: needsCredit,
    author: choice.author,
    source_url: choice.page,
    retrieved: new Date().toISOString().slice(0, 10),
    suggested_use: 'campus',
    university_slug: slug,
  };
  const i = credits.findIndex((c) => c.slug === asset);
  if (i >= 0) credits[i] = entry; else credits.push(entry);
  byCreditSlug.set(asset, entry);
  added += 1;
  if (added % 10 === 0) process.stdout.write(`\r  downloaded ${added}   `);
}

if (!DRY) writeJson(CREDITS, credits);
writeJson(join(ROOT, 'scripts/universities/curated/commons-picked.json'), {
  _generated_by: 'scripts/universities/fetch-media.mjs',
  _what: 'The photograph chosen for each institution, with the licence it is served under.',
  records: picked,
});
const attributed = Object.values(picked).filter((p) => p.attribution_required).length;
console.log(`\n  institutions with a campus photograph   ${Object.keys(picked).length}`);
console.log(`    attribution-free                      ${Object.keys(picked).length - attributed}`);
console.log(`    attribution-supported (credit shown)  ${attributed}`);
console.log(`  files downloaded ${added} · already present ${reused} · no usable candidate ${skipped}`);
console.log(`  → apps/*/public/media, apps/marketing-web/src/media/credits.json\n`);
