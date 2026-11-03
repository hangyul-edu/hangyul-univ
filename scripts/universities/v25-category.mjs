/**
 * V25 — every photograph in an institution's own Commons category tree (2 levels), for a person to view on a sheet.
 * Used for institutions whose category exists but whose earlier passes left them without a usable hero (e.g. PNU).
 *   node scripts/universities/v25-category.mjs <slug> "<Category:Name>" [more categories…]
 * Appends to server/app/data/raw/v25_category_candidates.json (same record shape as the other V25 harvests).
 */
import { join } from 'node:path';
import { ROOT, get, readJson, writeJson } from './lib.mjs';
import { FREE, ATTRIBUTION, NC_ND } from './v22-licences.mjs';

const [slug, ...cats] = process.argv.slice(2);
const OUT = join(ROOT, 'server/app/data/raw/v25_category_candidates.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const content = readJson(join(ROOT, 'server/app/data/university_content.json')).records;
const used = new Map();
for (const [s, rec] of Object.entries(content)) for (const e of [rec.media?.hero, ...(rec.media?.gallery ?? [])]) if (e?.media_source) used.set(decodeURIComponent(e.media_source).replace(/ /g, '_'), s);
async function api(params) {
  for (let a = 0; a < 5; a += 1) {
    const r = await get(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 45000 });
    if (r.ok) return JSON.parse(r.text);
    await sleep(2000 * (a + 1));
  }
  return null;
}
const BAD = /alumni|people|students|faculty|hospital|병원|logo|seal|emblem|events|sports|football|baseball|portrait|maps/i;
const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const files = new Set(); const seen = new Set();
let frontier = [...cats];
for (let depth = 0; depth < 3 && frontier.length; depth += 1) {
  const next = [];
  for (const c of frontier) {
    if (seen.has(c)) continue; seen.add(c);
    let cont;
    do {
      const d = await api({ action: 'query', list: 'categorymembers', cmtitle: c, cmlimit: '500', cmtype: 'file|subcat', ...(cont ? { cmcontinue: cont } : {}) });
      for (const m of d?.query?.categorymembers ?? []) {
        if (m.ns === 6) files.add(m.title); else if (m.ns === 14 && !BAD.test(m.title)) next.push(m.title);
      }
      cont = d?.continue?.cmcontinue;
    } while (cont);
  }
  frontier = next;
}
const out = { slug, categories: [...seen], files: [] };
const list = [...files];
for (let i = 0; i < list.length; i += 40) {
  const d = await api({ action: 'query', titles: list.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480' });
  for (const p of d?.query?.pages ?? []) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const md = ii.extmetadata ?? {};
    const f = { title: p.title, width: ii.width, height: ii.height, mime: ii.mime, licence: strip(md.LicenseShortName), author: strip(md.Artist), thumb: ii.thumburl, source_url: ii.descriptionurl };
    const key = (ii.descriptionurl ?? '').replace(/ /g, '_');
    if (!/jpeg|png|webp/.test(ii.mime)) f.verdict = 'not a photograph';
    else if (Math.max(ii.width, ii.height) < 1400) f.verdict = 'too small';
    else if (NC_ND.test(f.licence) || !(FREE.test(f.licence) || ATTRIBUTION.test(f.licence))) f.verdict = `licence: ${f.licence}`;
    else if (!FREE.test(f.licence) && !f.author) f.verdict = 'no author';
    else if (used.has(key)) f.verdict = `used by ${used.get(key)}`;
    else f.verdict = 'CANDIDATE';
    out.files.push(f);
  }
  await sleep(300);
}
const doc = readJson(OUT, { records: {} });
doc.records[slug] = out; doc.generated_at = new Date().toISOString().slice(0, 10);
writeJson(OUT, doc);
console.log(slug, seen.size, 'categories', out.files.length, 'files', out.files.filter((f) => f.verdict === 'CANDIDATE').length, 'candidates');
