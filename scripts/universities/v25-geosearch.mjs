/**
 * V25 — the route V22–V24 never tried: photographs *geotagged on the campus itself*.
 *
 * V22 searched Commons by category, V24 widened that to aliases, parent/sub-categories, full-text and Openverse.
 * All of those find a file only if someone *named* it after the institution. Many campus photographs on Commons
 * are named after a building ("Main hall", "본관 전경", "20190412_101530.jpg") and carry only a coordinate.
 * This script asks Commons for files whose coordinates fall inside a radius of the campus.
 *
 *   node scripts/universities/v25-geosearch.mjs [--only slug,slug] [--radius 700]
 *
 * Coordinates: Wikidata P625 as already stored on the content record; for an institution with none, OSM
 * Nominatim is asked once for an `amenity=university|college` object under the Korean name (usage policy:
 * ≤ 1 request/second, identifying UA, results cached in the output so a re-run asks nothing again).
 *
 * Nothing here is applied. Output: server/app/data/raw/v25_geo_candidates.json — per institution, the
 * coordinate and its source, every file found with distance, size, licence and author, and a verdict
 * (CANDIDATE or the reason it was refused). A person views every CANDIDATE before anything is imported
 * (scripts/universities/v24-import-picked.py preview/apply).
 */
import { join } from 'node:path';
import { ROOT, get, readJson, writeJson, registry } from './lib.mjs';
import { FREE, ATTRIBUTION, NC_ND } from './v22-licences.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', '')?.split(',').filter(Boolean);
const RADIUS = Number(opt('--radius', '700'));
const OUT = join(ROOT, 'server/app/data/raw/v25_geo_candidates.json');
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const content = readJson(join(ROOT, 'server/app/data/university_content.json')).records;
const prev = readJson(OUT, { records: {} });
const reg = registry();
const csv = readJson(join(ROOT, 'docs/qa/v25/_coverage_before.json'), null);

/* every source file already used by any institution — a geotag near a shared boundary must not be reused */
const used = new Map();
for (const [slug, rec] of Object.entries(content)) {
  const m = rec.media ?? {};
  for (const e of [m.hero, ...(m.gallery ?? [])]) if (e?.media_source) used.set(decodeURIComponent(e.media_source).replace(/ /g, '_'), slug);
}

/* names of every institution, for "this file is titled after a different institution" */
const norm = (s) => (s ?? '').toLowerCase().replace(/[\s_\-.·'’"“”()（）,]/g, '');
const owner = new Map();
for (const i of reg) {
  const en = content[i.slug]?.name_en ?? csv?.[i.slug]?.name_en;
  for (const n of [i.name_ko, i.name_ko.replace(/대학교$/, '대'), en].filter((x) => x && x.length >= 4)) {
    const k = norm(n);
    owner.set(k, owner.has(k) && owner.get(k) !== i.slug ? null : i.slug);
  }
}
const ownerKeys = [...owner.keys()].sort((a, b) => b.length - a.length);
const titledAfter = (t) => { const s = norm(t); for (const k of ownerKeys) if (s.includes(k)) return owner.get(k); return undefined; };

/* subjects that are never "the campus": refuse on the title before anyone spends a look on them */
const NOT_CAMPUS = /\b(station|apartment|apt|church|temple|hospital|bus|train|subway|metro|car|truck|food|meal|dish|restaurant|cafe|shop|market|bridge|road|street|highway|interchange|tunnel|map|logo|seal|emblem|signature|portrait|selfie|concert|protest|rally|election|cat|dog|bird|flower|insect|plant|tree|mushroom|stamp|coin|ticket|screenshot|document|poster|plaque|tomb|grave)\b|역$|역_|아파트|교회|성당|병원|버스|지하철|식당|시장|도로|터널|고속|나들목|교차로|무덤|묘/i;

async function api(params) {
  for (let a = 0; a < 5; a += 1) {
    const r = await get(`${COMMONS}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 45000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    if (r.status === 429 || r.status === 0 || r.status >= 500) await sleep(2000 * (a + 1)); else return null;
  }
  return null;
}

async function geocode(nameKo) {
  const r = await get(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: nameKo, countrycodes: 'kr', format: 'jsonv2', limit: '5' })}`, { accept: 'application/json', timeout: 20000 });
  await sleep(1100);
  if (!r.ok) return null;
  const hits = JSON.parse(r.text).filter((h) => ['university', 'college', 'school'].includes(h.type) || h.category === 'amenity');
  const h = hits.find((x) => (x.name ?? x.display_name).includes(nameKo)) ?? null;
  return h ? { lat: Number(h.lat), lon: Number(h.lon), source: `osm:${h.osm_type}/${h.osm_id}`, label: h.display_name } : null;
}

const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const records = prev.records;
const queue = reg.filter((i) => (ONLY?.length ? ONLY.includes(i.slug) : csv?.[i.slug]?.has_real_photo !== 'yes'));
console.log(`queue ${queue.length}, radius ${RADIUS} m`);
let n = 0;
for (const inst of queue) {
  n += 1;
  const rec = content[inst.slug] ?? {};
  let coord = records[inst.slug]?.coord ?? null;
  if (!coord && rec.lat && rec.lon) coord = { lat: rec.lat, lon: rec.lon, source: 'wikidata:P625' };
  if (!coord) coord = (await geocode(inst.name_ko)) ?? { lat: null, lon: null, source: 'none: no Wikidata P625 and no OSM university object under the Korean name' };
  const out = { slug: inst.slug, name_ko: inst.name_ko, coord, radius_m: RADIUS, searched_at: new Date().toISOString().slice(0, 10), files: [] };
  if (coord.lat != null) {
    const g = await api({ action: 'query', list: 'geosearch', gscoord: `${coord.lat}|${coord.lon}`, gsradius: String(RADIUS), gsnamespace: '6', gslimit: '100' });
    const hits = g?.query?.geosearch ?? [];
    for (let i = 0; i < hits.length; i += 40) {
      const batch = hits.slice(i, i + 40);
      const d = await api({ action: 'query', titles: batch.map((h) => h.title).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480' });
      const byTitle = new Map((d?.query?.pages ?? []).map((p) => [p.title, p]));
      for (const h of batch) {
        const p = byTitle.get(h.title); const ii = p?.imageinfo?.[0];
        const md = ii?.extmetadata ?? {};
        const licence = strip(md.LicenseShortName); const author = strip(md.Artist);
        const f = { title: h.title, dist: Math.round(h.dist), width: ii?.width, height: ii?.height, mime: ii?.mime, licence, author,
          thumb: ii?.thumburl, source_url: ii?.descriptionurl };
        const key = (ii?.descriptionurl ?? '').replace(/ /g, '_');
        const other = titledAfter(h.title);
        if (!ii) f.verdict = 'no imageinfo';
        else if (!/jpeg|png|webp/.test(ii.mime)) f.verdict = `not a photograph (${ii.mime})`;
        else if (Math.max(ii.width, ii.height) < 1600) f.verdict = 'too small for a hero (< 1600 px long edge)';
        else if (ii.height > ii.width * 1.05) f.verdict = 'portrait — cannot fill a 16:10 hero';
        else if (NC_ND.test(licence) || !(FREE.test(licence) || ATTRIBUTION.test(licence))) f.verdict = `licence not servable: ${licence || 'none'}`;
        else if (!FREE.test(licence) && !author) f.verdict = 'credited licence with no author';
        else if (used.has(key) && used.get(key) !== inst.slug) f.verdict = `already used by ${used.get(key)}`;
        else if (other && other !== inst.slug) f.verdict = `titled after ${other}`;
        else if (NOT_CAMPUS.test(h.title.replace(/^File:/, ''))) f.verdict = 'title names a non-campus subject';
        else f.verdict = 'CANDIDATE';
        f.titled_self = other === inst.slug;
        out.files.push(f);
      }
      await sleep(400);
    }
  }
  out.candidates = out.files.filter((f) => f.verdict === 'CANDIDATE').length;
  records[inst.slug] = out;
  if (n % 10 === 0) { writeJson(OUT, { _generated_by: 'scripts/universities/v25-geosearch.mjs', generated_at: new Date().toISOString().slice(0, 10), records }); }
  process.stdout.write(`${inst.slug}: ${coord.source.split(':')[0]} ${out.files.length} files, ${out.candidates} candidates\n`);
  await sleep(300);
}
writeJson(OUT, { _generated_by: 'scripts/universities/v25-geosearch.mjs', generated_at: new Date().toISOString().slice(0, 10), records });
const all = Object.values(records);
console.log(`done: ${all.length} institutions, ${all.filter((r) => r.candidates).length} with ≥1 candidate, ${all.reduce((a, r) => a + (r.candidates ?? 0), 0)} candidates`);
