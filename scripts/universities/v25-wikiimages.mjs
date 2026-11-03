/**
 * V25 — photographs used *inside* the institution's own Wikipedia articles (ko + en).
 *
 * V22 read Wikidata P18 (one image) and Commons categories; V24 widened the category and full-text routes. An
 * article often illustrates the campus with Commons files that were never put in the institution's category and
 * are not named after it ("본관.jpg", "Main Building in winter.JPG"). The article is about this institution, so
 * a photograph placed in it by an editor is a strong subject signal — still viewed by a person before use.
 *
 * Files local to a Wikipedia (not on Commons) are refused: on ko/en Wikipedia those are non-free (fair use).
 *
 *   node scripts/universities/v25-wikiimages.mjs
 * Output: server/app/data/raw/v25_wiki_candidates.json (nothing is applied).
 */
import { join } from 'node:path';
import { ROOT, get, readJson, writeJson, registry } from './lib.mjs';
import { FREE, ATTRIBUTION, NC_ND } from './v22-licences.mjs';

const OUT = join(ROOT, 'server/app/data/raw/v25_wiki_candidates.json');
const WD = readJson(join(ROOT, 'server/app/data/raw/v22_wikidata.json')).records;
const cov = readJson(join(ROOT, 'docs/qa/v25/_coverage_before.json'));
const content = readJson(join(ROOT, 'server/app/data/university_content.json')).records;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const used = new Map();
for (const [slug, rec] of Object.entries(content)) {
  const m = rec.media ?? {};
  for (const e of [m.hero, ...(m.gallery ?? [])]) if (e?.media_source) used.set(decodeURIComponent(e.media_source).replace(/ /g, '_'), slug);
}
const SKIP = /logo|emblem|seal|symbol|crest|coat[_ ]of|flag|signature|map|locator|icon|svg$|교표|로고|상징|휘장|엠블럼|문장|지도|서명|portrait|초상/i;

async function api(host, params) {
  for (let a = 0; a < 5; a += 1) {
    const r = await get(`https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 45000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    if (r.status === 429 || r.status === 0 || r.status >= 500) await sleep(2000 * (a + 1)); else return null;
  }
  return null;
}
const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const records = {};
const queue = registry().filter((i) => cov[i.slug]?.has_real_photo !== 'yes');
for (const inst of queue) {
  const w = WD[inst.slug] ?? {};
  const out = { slug: inst.slug, articles: [], files: [] };
  const titles = new Set();
  for (const [host, t] of [['ko.wikipedia.org', w.kowiki], ['en.wikipedia.org', w.enwiki]]) {
    if (!t) continue;
    out.articles.push(`${host}/wiki/${t}`);
    const d = await api(host, { action: 'query', titles: t, prop: 'images', imlimit: '50', redirects: '1' });
    for (const p of d?.query?.pages ?? []) for (const im of p.images ?? []) titles.add(im.title.replace(/^(파일|File):/, 'File:'));
    await sleep(300);
  }
  const list = [...titles].filter((t) => !SKIP.test(t));
  for (let i = 0; i < list.length; i += 40) {
    const d = await api('commons.wikimedia.org', { action: 'query', titles: list.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480' });
    for (const p of d?.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      const f = { title: p.title };
      if (p.missing || !ii) { f.verdict = 'not on Commons (local file = non-free on Wikipedia)'; out.files.push(f); continue; }
      const md = ii.extmetadata ?? {};
      Object.assign(f, { width: ii.width, height: ii.height, mime: ii.mime, licence: strip(md.LicenseShortName), author: strip(md.Artist), thumb: ii.thumburl, source_url: ii.descriptionurl });
      const key = (ii.descriptionurl ?? '').replace(/ /g, '_');
      if (!/jpeg|png|webp/.test(ii.mime)) f.verdict = `not a photograph (${ii.mime})`;
      else if (Math.max(ii.width, ii.height) < 1600) f.verdict = 'too small for a hero (< 1600 px long edge)';
      else if (ii.height > ii.width * 1.05) f.verdict = 'portrait — cannot fill a 16:10 hero';
      else if (NC_ND.test(f.licence) || !(FREE.test(f.licence) || ATTRIBUTION.test(f.licence))) f.verdict = `licence not servable: ${f.licence || 'none'}`;
      else if (!FREE.test(f.licence) && !f.author) f.verdict = 'credited licence with no author';
      else if (used.has(key)) f.verdict = used.get(key) === inst.slug ? 'already used by this institution' : `already used by ${used.get(key)}`;
      else f.verdict = 'CANDIDATE';
      out.files.push(f);
    }
    await sleep(400);
  }
  out.candidates = out.files.filter((f) => f.verdict === 'CANDIDATE').length;
  records[inst.slug] = out;
  process.stdout.write(`${inst.slug}: ${out.articles.length} articles, ${out.files.length} files, ${out.candidates} candidates\n`);
}
writeJson(OUT, { _generated_by: 'scripts/universities/v25-wikiimages.mjs', generated_at: new Date().toISOString().slice(0, 10), records });
const all = Object.values(records);
console.log(`done: ${all.length} institutions, ${all.filter((r) => r.candidates).length} with ≥1 candidate`);
