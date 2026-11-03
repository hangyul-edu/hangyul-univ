/**
 * V20 — merge the hand-written, source-checked editorial layer into the content record (brief §23, §25).
 *
 * The crawler captures *source material*; it does not write. §25 asks for the university's own
 * 건학이념 / 교육이념 researched **and then** a concise Hangyul interpretation in student-facing language,
 * and §23 is explicit that the result must not read as generated. Neither is a job for a regex, so the
 * paraphrases live in `curated/philosophy.json`, written against pages this pipeline fetched and a person
 * read, and this script merges them in at `verification_status: 'HANGYUL_REVIEWED'` — the only status the
 * public page will render prose from.
 *
 * It also promotes the small number of **registry-asserted mottos** (Wikidata P1451, on the institution's
 * own item). Those are the institution's own words carried by an authoritative registry, so they render as
 * a short attributed quotation rather than as Hangyul's description — the V17 behaviour, kept.
 *
 *   node scripts/universities/apply-curated.mjs
 */
import { join } from 'node:path';

import { content, enrichment, readJson, registry, ROOT, saveContent } from './lib.mjs';

const curated = readJson(join(ROOT, 'scripts/universities/curated/philosophy.json'), { records: {} }).records;
const curatedMedia = readJson(join(ROOT, 'scripts/universities/curated/media.json'), { records: {} }).records;
//: V21 — the 43 institutions whose own Commons category yielded a usable campus photograph, chosen by
//: `fetch-media.mjs` and reviewed by a person in `curated/commons-selected.json`. Hand-curated entries
//: in `media.json` win, because those were placed deliberately.
const commonsPicked = readJson(join(ROOT, 'scripts/universities/curated/commons-picked.json'), { records: {} }).records;
const credits = new Map(readJson(join(ROOT, 'apps/marketing-web/src/media/credits.json'), []).map((c) => [c.slug, c]));
//: What may be served. V21 adds `ATTRIBUTION_SUPPORTED`: an attribution-bearing licence is usable
//: **because the credit is now rendered** (brief §15), not because the condition was waived. An asset
//: in this class without an author and a licence URL is refused by `qa:v14`.
const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION',
  'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);
const doc = content();
const enr = enrichment();
const insts = new Map(registry().map((i) => [i.slug, i]));

let reviewed = 0;
let asserted = 0;
let unknown = 0;

for (const [slug, c] of Object.entries(curated)) {
  if (slug.startsWith('_')) continue;
  if (!insts.has(slug)) { console.warn(`  ! ${slug} is not in the registry — skipped`); unknown += 1; continue; }
  const rec = (doc.records[slug] ??= {});
  rec.education_philosophy = {
    heading: c.heading,
    statement: c.statement,
    summary_ko: c.summary_ko,
    summary_en: c.summary_en,
    source_url: c.source_url,
    verified_at: c.verified_at,
    verification_status: 'HANGYUL_REVIEWED',
  };
  reviewed += 1;
}

// ------------------------------------------------- the institution ↔ photograph mapping, rights-checked
let withHero = 0;
let refusedMedia = 0;
// The Commons harvest, folded in first so a hand-curated entry below can override it.
let fromCommons = 0;
for (const [slug, p] of Object.entries(commonsPicked)) {
  if (!insts.has(slug) || curatedMedia[slug]) continue;
  const credit = credits.get(p.asset);
  if (!credit || !SERVABLE.has(credit.rights_status)) continue;
  const rec = (doc.records[slug] ??= {});
  const asset = {
    asset: p.asset,
    university_id: slug,
    kind: 'CAMPUS',
    license_or_permission: credit.license,
    rights_status: credit.rights_status,
    media_source: credit.source_url,
    official_asset: false,
    // The renderer reads this to decide whether to draw a credit. It is the licence's own condition,
    // carried with the file rather than looked up at render time.
    attribution_requirement: credit.attribution_required
      ? { author: credit.author, license: credit.license, license_url: credit.license_url, source_url: credit.source_url }
      : null,
    local_path: `media/${p.asset}`,
    // No per-asset focal point has been chosen for a harvested file, and `50% 50%` is the honest
    // default: these are wide campus views whose subject is the middle of the frame.
    focal_x: 50, focal_y: 50,
    alt_key: 'v21.media.alt.campus',
    width: credit.width, height: credit.height,
  };
  rec.media = { ...(rec.media ?? {}), hero: asset, gallery: [asset] };
  fromCommons += 1;
}

for (const [slug, m] of Object.entries(curatedMedia)) {
  if (slug.startsWith('_')) continue;
  if (!insts.has(slug)) { console.warn(`  ! ${slug} is not in the registry — skipped`); unknown += 1; continue; }
  const rec = (doc.records[slug] ??= {});
  const ok = (asset) => {
    const credit = credits.get(asset);
    // The manifest is the authority on rights, not this file: a licence re-classified in `credits.json`
    // has to be able to pull the photograph off the page without anyone remembering to edit two places.
    if (!credit || !SERVABLE.has(credit.rights_status)) { refusedMedia += 1; return false; }
    return true;
  };
  const gallery = (m.gallery ?? []).filter(ok).map((asset) => ({ asset, university_id: slug, ...m.assets[asset] }));
  const hero = m.hero && ok(m.hero) ? { asset: m.hero, university_id: slug, ...m.assets[m.hero] } : null;
  rec.media = { ...(rec.media ?? {}), ...(hero ? { hero } : {}), ...(gallery.length ? { gallery } : {}) };
  if (hero) withHero += 1;
}

for (const [slug, e] of Object.entries(enr)) {
  const motto = e.motto;
  if (!motto || !(motto.ko || motto.en)) continue;
  const rec = doc.records[slug];
  if (!rec || rec.education_philosophy?.verification_status === 'HANGYUL_REVIEWED') continue;
  rec.motto = { ko: motto.ko, en: motto.en, source_url: e.source_url, verified_at: motto.verified_at, verification_status: 'REGISTRY_ASSERTED' };
  asserted += 1;
}

saveContent(doc);
console.log(`V20 curated editorial merge`);
console.log(`  education philosophy, Hangyul-reviewed   ${reviewed}`);
console.log(`  mottos, registry-asserted                ${asserted}`);
console.log(`  institutions with a hero photograph      ${withHero + fromCommons}  (${fromCommons} from the Commons sweep)`);
if (refusedMedia) console.log(`  assets refused on rights                 ${refusedMedia}`);
if (unknown) console.log(`  entries dropped (unknown slug)           ${unknown}`);
console.log('  → server/app/data/university_content.json\n');
