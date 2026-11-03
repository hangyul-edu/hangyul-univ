/**
 * Image licence gate (V14, brief Parts 2, 35 and 58).
 *
 * The owner's production state is no customer-visible photo attribution. That is only honest if nothing we
 * serve *requires* attribution, so this is a static check with no browser: every asset in the manifest is
 * classified, every slot is checked against that classification, and every served file is checked to belong
 * to an asset that may be served.
 *
 * It fails on four things:
 *
 *   1. a manifest entry whose rights are `ATTRIBUTION_REQUIRED` or `UNKNOWN` still has files in a `public/`
 *      directory — the brief forbids shipping either;
 *   2. a slot in `slots.ts`, or a slug hard-coded in a page, points at such an asset;
 *   3. a manifest entry is missing the rights metadata itself (`rights_status`, licence, source, date);
 *   4. customer-facing attribution plumbing has come back: a `photoCredit` prop, a `/credits` route, a
 *      "사진:" / "Photo:" / "Source:" caption.
 *
 *   node scripts/qa/v14-media-licence.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/**
 * **V21 changes this set, and the reason is an owner decision, not a relaxation.**
 *
 * V14's rule was "no customer-visible photo attribution", so only attribution-free licences could be
 * hosted. Measured across the whole register that rule is why 2 of 425 institutions had a
 * photograph: 676 of 718 Commons files in institutions' own categories were refused on licence
 * alone (REPORT §228.1). The V21 brief §15 permits an attribution-bearing licence *"if its
 * attribution terms are intentionally supported"*, so Hangyul now renders a credit — author,
 * licence by name, link to the source — beside every photograph that needs one.
 *
 * The gate did not get weaker. It gained §4 below: an `ATTRIBUTION_SUPPORTED` asset must carry a
 * complete credit **and** the component that draws it must still exist and still be used. An asset
 * that needs a credit and cannot be credited is refused exactly as before.
 */
const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION',
  'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);
const NEEDS_CREDIT = new Set(['ATTRIBUTION_SUPPORTED']);
const PUBLIC_DIRS = [
  'apps/marketing-web/public/media',
  'apps/student-web/public/media',
  'apps/agency-web/public/media',
  'apps/university-web/public/media',
];
/** Source roots searched for revived attribution plumbing. */
const SRC_ROOTS = ['apps/marketing-web/src', 'apps/student-web/src', 'packages/koreanasha-ui/src', 'packages/ui/src'];

const problems = [];

// ---- 1. the manifest
const credits = JSON.parse(read('apps/marketing-web/src/media/credits.json'));
const byStatus = {};
for (const c of credits) {
  byStatus[c.rights_status] = (byStatus[c.rights_status] ?? 0) + 1;
  // Brief Part 57: owner/source, rights, licence, date acquired, asset path, permitted usage — internally,
  // for every asset. An owner-supplied photograph has no external source URL and never will; what it must
  // have instead is the written note recording the authorisation, so the provenance is auditable either way.
  const required = ['rights_status', 'license', 'retrieved', 'author',
    c.rights_status === 'HANGYUL_OWNED' || c.rights_status === 'OWNER_AUTHORISED' ? 'license_note' : 'source_url'];
  for (const field of required) {
    if (!c[field]) problems.push(`${c.slug}: missing internal rights metadata "${field}" (brief Part 57)`);
  }
  if (c.rights_status && !SERVABLE.has(c.rights_status) && c.attribution_required !== true) {
    problems.push(`${c.slug}: ${c.rights_status} but attribution_required is not true`);
  }
  // V21 §4 — a credited asset must have something to credit *with*.
  if (NEEDS_CREDIT.has(c.rights_status)) {
    if (c.attribution_required !== true) problems.push(`${c.slug}: ATTRIBUTION_SUPPORTED but attribution_required is not true`);
    for (const field of ['author', 'license', 'license_url', 'source_url']) {
      if (!c[field] || c[field] === 'unknown') problems.push(`${c.slug}: served with a credit but has no ${field}`);
    }
  }
}
const servable = new Set(credits.filter((c) => SERVABLE.has(c.rights_status)).map((c) => c.slug));
const blocked = new Set(credits.filter((c) => !SERVABLE.has(c.rights_status)).map((c) => c.slug));
console.log('rights classification:', Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`servable ${servable.size}, blocked ${blocked.size}`);

// ---- 2. nothing blocked is served
for (const dir of PUBLIC_DIRS) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const f of readdirSync(join(ROOT, dir))) {
    const slug = f.replace(/-\d+\.(jpg|jpeg|png|webp|avif)$/, '');
    if (blocked.has(slug)) problems.push(`${dir}/${f}: ${slug} is attribution-required or unknown and must not be served`);
  }
}

// ---- 3. every referenced slug is servable
const slots = read('apps/marketing-web/src/media/slots.ts');
for (const m of slots.matchAll(/'([a-z0-9-]{6,})'/g)) {
  const slug = m[1];
  if (blocked.has(slug)) problems.push(`slots.ts points at ${slug}, which may not be served`);
}
for (const file of ['apps/marketing-web/src/pages/home/v11.tsx', 'apps/student-web/src/components/HomeBand.tsx']) {
  if (!existsSync(join(ROOT, file))) continue;
  for (const m of read(file).matchAll(/'([a-z0-9-]{6,})'/g)) {
    if (blocked.has(m[1])) problems.push(`${file} references ${m[1]}, which may not be served`);
  }
}

// ---- 4. the attribution plumbing that must NOT come back, and the one that must be there
//
// **V21 inverts half of this check.** V14 forbade all credit UI, because at that time every asset was
// attribution-free and a credit could only be a leftover. V21 serves attribution-bearing photographs
// *with* a credit (brief §15), so the gate now requires the credit component to exist and be used,
// and still forbids the shapes that were removed — a free-text "사진:" caption, a translated
// credit-label prop, a `/credits` page. The difference between the two is that one is a designed,
// per-asset credit driven by `attribution_requirement`, and the others were prose glued under a
// photograph.
const CREDIT_COMPONENT = 'packages/ui/src/university.tsx';
if (existsSync(join(ROOT, CREDIT_COMPONENT))) {
  const src = read(CREDIT_COMPONENT);
  if (!/export function PhotoCredit/.test(src)) {
    problems.push('the PhotoCredit component is gone, but attribution-bearing assets are being served');
  }
  if (!/attribution_requirement/.test(src)) {
    problems.push('PhotoCredit no longer reads attribution_requirement');
  }
} else {
  problems.push(`${CREDIT_COMPONENT} is missing`);
}
const credited = credits.filter((c) => c.rights_status === 'ATTRIBUTION_SUPPORTED');
if (credited.length) {
  const detail = read('apps/marketing-web/src/pages/UniversityDetail.tsx');
  if (!/PhotoCredit/.test(detail)) {
    problems.push(`${credited.length} credited asset(s) are served but the detail page renders no credit`);
  }
}
console.log(`credited assets ${credited.length} — PhotoCredit present and used`);

const REVIVED = [
  [/photoCredit|photo_credit|creditUrl/, 'a photo-credit prop'],
  [/kn-hero__credit/, 'the hero credit element'],
  // V16: the student home band used to render `사진: {author} · {licence}` from a *translated* prop, so the
  // caption never appeared literally in source and this gate could not see it. The element and the prop are
  // gone; these two patterns are what would bring either back.
  [/sh-band__credit/, 'the student home band credit element'],
  [/creditLabel/, 'a credit-label prop'],
  [/['"`]사진\s*:/, 'a "사진:" caption'],
  [/['"`]사진\s*출처/, 'a "사진 출처" caption'],
  [/['"`]Photo\s*:|['"`]Photo by/, 'a "Photo:" caption'],
  [/>\s*(Source|Credit)\s*:/, 'a "Source:"/"Credit:" caption'],
];
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|s?css)$/.test(e.name)) out.push(p);
  }
  return out;
};
for (const root of SRC_ROOTS) {
  if (!existsSync(join(ROOT, root))) continue;
  for (const f of walk(root)) {
    const body = read(f);
    for (const [re, what] of REVIVED) {
      // A comment explaining why the thing was removed is not the thing. Strip comment lines before matching.
      const code = body.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      if (re.test(code)) problems.push(`${f}: ${what} is back on a customer surface`);
    }
  }
}
if (existsSync(join(ROOT, 'apps/marketing-web/src/pages/Credits.tsx'))) {
  problems.push('apps/marketing-web/src/pages/Credits.tsx exists — the /credits page is retired (brief Part 3)');
}

if (problems.length) {
  console.error(`\nImage licence gate: ${problems.length} problem(s)\n`);
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\nImage licence gate: OK — ${servable.size} servable asset(s), ${credited.length} credited, 0 rights-blocked file served.`);
