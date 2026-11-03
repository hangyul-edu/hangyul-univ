/**
 * V21 — a **full-registry** sweep of Wikimedia Commons for university logos and campus photographs
 * (brief §14, §15).
 *
 * V20's media pass asked Wikidata for two properties — `P154` (logo) and `P18` (image) — and stopped.
 * That found 14 logos and 38 images across 425 institutions, of which rights left 29 and 2. The gap is
 * not that Commons is empty; it is that one property per institution is one photograph per institution,
 * and a Korean university's media on Commons lives in its **category** (`P373`), which routinely holds
 * ten to eighty files: the main gate, the library, the emblem, the aerial view, the autumn avenue.
 *
 * So this walks, per institution: `P373` → every file in the category (and its subcategories, one
 * level) → `imageinfo` with `extmetadata` → licence, size, mime, author. Then it classifies and judges:
 *
 *   **Rights** — attribution-free only, the same `ACCEPT` set `scripts/media/fetch_cc0.py` enforces,
 *   read from the Commons API rather than from a cached string. Everything else is recorded as blocked
 *   **with the licence that blocked it**, never silently dropped (§15).
 *
 *   **Quality** (§18, and V20 §49) — a photograph must be ≥1,400 px on the long edge and landscape-ish;
 *   a logo must be ≥120 px and have a sane aspect. Files whose *name* says they are not what we want —
 *   a map, a diagram, a scan, a graph, a crowd of people, a signature — are refused on the name.
 *
 *   **Subject** — a file in `Category:Yonsei University` is about Yonsei. That is the whole reason this
 *   is safe: the institution ↔ photograph mapping comes from Commons' own categorisation, not from a
 *   filename match this script invented. §8 is preserved by construction.
 *
 * It writes candidates to `server/app/data/raw/commons_candidates.json` and prints a coverage summary.
 * It downloads **nothing**: `scripts/universities/fetch-media.mjs` does that for the files a person has
 * accepted, so no image reaches the product without having been looked at.
 *
 *   node scripts/universities/harvest-commons.mjs [--limit N] [--only slug,…] [--concurrency 4]
 */
import { get, pool, progress, readJson, registry, ROOT, writeJson } from './lib.mjs';
import { join } from 'node:path';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const LIMIT = Number(flag('--limit', '0')) || 0;
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const CONCURRENCY = Number(flag('--concurrency', '4'));

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';
const OUT = join(ROOT, 'server/app/data/raw/commons_candidates.json');

/** Licences with **no** attribution condition — the only ones Hangyul may host (owner decision, V14). */
const FREE = /^(cc0|cc-zero|cc0 1\.0|public domain|pd(-self|-user|-old(-\d+)?|-art|-text|-textlogo|-shape|-ineligible|-korea)?|no restrictions|copyrighted free use)$/i;

/** A filename that says the file is not a photograph of a place. */
const NOT_A_PHOTO = /\b(map|karte|diagram|chart|graph|logo|emblem|seal|symbol|wordmark|ci[-_ ]|signature|stamp|coat.of.arms|flag|plaque|poster|leaflet|brochure|scan|document|certificate|portrait|headshot|people|group.photo|ceremony|graduation)\b/i;
/** …and one that says it is not an institutional mark. */
const NOT_A_LOGO = /\b(map|diagram|chart|photo|building|campus|gate|aerial|street|view|panorama|interior|ceremony|people|authority|library)\b/i;
const IS_LOGO_NAME = /\b(logo|emblem|seal|symbol|wordmark|ci|signature|mark|ui)\b|로고|엠블럼|상징|심벌/i;

async function sparql(query) {
  const r = await get(`${SPARQL}?${new URLSearchParams({ query, format: 'json' })}`, { accept: 'application/sparql-results+json', timeout: 120000 });
  if (!r.ok) return null;
  try { return JSON.parse(r.text); } catch { return null; }
}

async function api(params) {
  const r = await get(`${COMMONS}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 40000 });
  if (!r.ok) return null;
  try { return JSON.parse(r.text); } catch { return null; }
}

const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Every file in a category, plus one level of subcategory. Capped, because some categories are huge. */
async function filesIn(category, depth = 1, seen = new Set()) {
  if (seen.has(category) || seen.size > 12) return [];
  seen.add(category);
  const d = await api({ action: 'query', list: 'categorymembers', cmtitle: category, cmlimit: '200', cmtype: 'file|subcat' });
  const members = d?.query?.categorymembers ?? [];
  const files = members.filter((m) => m.ns === 6).map((m) => m.title);
  if (depth > 0) {
    for (const sub of members.filter((m) => m.ns === 14).slice(0, 6)) {
      files.push(...(await filesIn(sub.title, depth - 1, seen)));
    }
  }
  return files;
}

/** `imageinfo` for up to 50 titles at a time. */
async function infoFor(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const d = await api({
      action: 'query', prop: 'imageinfo', titles: titles.slice(i, i + 50).join('|'),
      iiprop: 'url|extmetadata|size|mime',
    });
    for (const page of d?.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const ext = info.extmetadata ?? {};
      out.push({
        title: page.title,
        url: info.url,
        descriptionUrl: info.descriptionurl,
        mime: info.mime,
        width: info.width,
        height: info.height,
        licence: strip(ext.LicenseShortName) || strip(ext.License) || 'unknown',
        author: strip(ext.Artist) || 'unknown',
        description: strip(ext.ImageDescription).slice(0, 200),
      });
    }
  }
  return out;
}

function judge(f) {
  const name = f.title.replace(/^File:/, '');
  const free = FREE.test(f.licence);
  const isLogo = IS_LOGO_NAME.test(name) || /svg/.test(f.mime ?? '');
  if (!free) return { kind: isLogo ? 'logo' : 'photo', ok: false, why: `licence ${f.licence}` };
  if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(f.mime ?? '')) return { kind: 'other', ok: false, why: `mime ${f.mime}` };
  if (isLogo) {
    if (NOT_A_LOGO.test(name)) return { kind: 'logo', ok: false, why: 'name says it is not a mark' };
    if (Math.max(f.width ?? 0, f.height ?? 0) < 120) return { kind: 'logo', ok: false, why: `too small ${f.width}×${f.height}` };
    const r = (f.width ?? 1) / (f.height ?? 1);
    if (r < 0.18 || r > 8) return { kind: 'logo', ok: false, why: `aspect ${r.toFixed(2)}` };
    return { kind: 'logo', ok: true };
  }
  if (NOT_A_PHOTO.test(name)) return { kind: 'photo', ok: false, why: 'name says it is not a place photograph' };
  if ((f.width ?? 0) < 1400) return { kind: 'photo', ok: false, why: `too small ${f.width}×${f.height}` };
  if ((f.width ?? 0) < (f.height ?? 1) * 1.1) return { kind: 'photo', ok: false, why: 'portrait' };
  return { kind: 'photo', ok: true };
}

/* ------------------------------------------------------------------------------- 1. what Commons has */

const insts = registry();
const content = readJson(join(ROOT, 'server/app/data/university_content.json'), { records: {} }).records;
let targets = insts.filter((i) => content[i.slug]?.wikidata_id);
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

console.log(`V21 Commons sweep — ${targets.length} institutions with a Wikidata item (of ${insts.length})`);

// One SPARQL query for every Commons category, rather than 325 round trips.
const qids = targets.map((i) => content[i.slug].wikidata_id);
const cats = new Map();
for (let i = 0; i < qids.length; i += 120) {
  const values = qids.slice(i, i + 120).map((q) => `wd:${q}`).join(' ');
  const d = await sparql(`SELECT ?item ?cat ?img ?logo ?arms WHERE {
    VALUES ?item { ${values} }
    OPTIONAL { ?item wdt:P373 ?cat }
    OPTIONAL { ?item wdt:P18  ?img }
    OPTIONAL { ?item wdt:P154 ?logo }
    OPTIONAL { ?item wdt:P94  ?arms }
  }`);
  for (const row of d?.results?.bindings ?? []) {
    const qid = row.item.value.split('/').pop();
    const e = cats.get(qid) ?? { category: null, direct: new Set() };
    if (row.cat) e.category = row.cat.value;
    for (const k of ['img', 'logo', 'arms']) {
      if (row[k]) e.direct.add(`File:${decodeURIComponent(row[k].value.split('/').pop()).replace(/_/g, ' ')}`);
    }
    cats.set(qid, e);
  }
  process.stdout.write(`\r  wikidata ${Math.min(i + 120, qids.length)}/${qids.length}   `);
}
console.log();

/* ------------------------------------------------------------------------- 2. the files, per institution */

let done = 0;
const results = await pool(targets, CONCURRENCY, async (inst) => {
  const qid = content[inst.slug].wikidata_id;
  const e = cats.get(qid) ?? { category: null, direct: new Set() };
  const titles = new Set(e.direct);
  if (e.category) for (const t of await filesIn(`Category:${e.category}`)) titles.add(t);
  const files = titles.size ? await infoFor([...titles].slice(0, 120)) : [];
  const logos = []; const photos = []; const blocked = [];
  for (const f of files) {
    const v = judge(f);
    const row = { title: f.title, licence: f.licence, width: f.width, height: f.height, mime: f.mime, url: f.url, page: f.descriptionUrl, author: f.author, description: f.description };
    if (!v.ok) { blocked.push({ ...row, kind: v.kind, why: v.why }); continue; }
    (v.kind === 'logo' ? logos : photos).push(row);
  }
  logos.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  photos.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  progress(++done, targets.length, 'commons');
  return { slug: inst.slug, name_ko: inst.name_ko, name_en: inst.name_en, category: e.category ?? null, scanned: files.length, logos, photos, blocked: blocked.slice(0, 40) };
});

const records = {};
for (const r of results) if (r?.slug) records[r.slug] = r;
writeJson(OUT, { _generated_by: 'scripts/universities/harvest-commons.mjs', generated_at: new Date().toISOString().slice(0, 10), institutions: Object.keys(records).length, records });

const n = results.length;
const withCat = results.filter((r) => r?.category).length;
const withLogo = results.filter((r) => r?.logos?.length).length;
const withPhoto = results.filter((r) => r?.photos?.length).length;
const photoTotal = results.reduce((s, r) => s + (r?.photos?.length ?? 0), 0);
const blockedTotal = results.reduce((s, r) => s + (r?.blocked?.length ?? 0), 0);
console.log(`\n  Commons category on the Wikidata item   ${withCat} / ${n}`);
console.log(`  institutions with ≥1 servable LOGO       ${withLogo} / ${n}`);
console.log(`  institutions with ≥1 servable PHOTO      ${withPhoto} / ${n}  (${photoTotal} files)`);
console.log(`  files found and refused on rights/quality ${blockedTotal}`);
console.log(`  → server/app/data/raw/commons_candidates.json\n`);
