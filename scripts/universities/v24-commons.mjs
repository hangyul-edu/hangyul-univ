/**
 * V24 — the wider Commons route for the no-photograph queue.
 *
 * What V22 already did is not repeated as-is; this widens it in four ways, each recorded per institution:
 *   (a) every Wikidata alias / official name / former name / Korean short form as `Category:<name>`;
 *   (b) category search for the aliases V22 did not search (V22 searched only the first ko and en name);
 *   (c) the parent categories of each own category, kept only when the parent's title names the institution
 *       (longest-registry-name rule), and subcategories three levels deep with no per-level cap, kept only
 *       when they name the institution or are campus-vocabulary subcategories (V22's BAD_SUBCAT refused);
 *   (d) Commons full-text search for the aliases V22 did not search.
 * Subject verdict is V22's `subjectOk`; licence verdict is V22's `rightsOf` + an author for credited licences.
 * Quality is relaxed for *candidates* only (≥ 800 px long edge; portrait allowed, flagged), because the
 * reviewer, not this script, chooses.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, get, readJson, registry, pool } from './lib.mjs';
import { FREE, ATTRIBUTION, NC_ND } from './v22-licences.mjs';
import { subjectOk, foreignOrAmbiguous, CAMPUS_WORDS } from './v22-subject.mjs';

const [queuePath, namesPath, out] = process.argv.slice(2);
const NAMES = JSON.parse(readFileSync(process.env.V24_NAMES ?? namesPath, 'utf8'));
const V22 = readJson(join(ROOT, 'server/app/data/raw/v22_commons_candidates.json')).records;
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BAD_SUBCAT = /alumni|faculty|people|staff|students?\b|professors?|graduates|hospital|medical cent|clinic|의료원|병원|station|publications?|documents|maps|affiliated|high school|middle school|elementary|football|baseball|basketball|volleyball|soccer|sports?|teams?|collections?|artworks?|paintings|books|events?|ceremon|festival|졸업|동문|병원|portraits|presidents|rectors|chancellors|botanical|herbarium|specimens|signage|coins|stamps|screenshots|videos|audio|logos?|emblems|seals|flags|diagrams|charts|scans|cars|buses|vehicles|press|conference|lectures|theses|yearbooks|newspapers|posters|awards/i;
const CAMPUS_SUBCAT = /campus|buildings?|gates?|library|libraries|halls?|views?|aerial|museum|chapel|church|stadium|gymnasium|dormitor|architecture|exterior|towers?|main|entrance|quad|lawn|avenue|캠퍼스|건물|정문|도서관|본관/i;

async function api(params) {
  for (let a = 0; a < 4; a += 1) {
    const r = await get(`${COMMONS}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 45000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    if (r.status === 429 || r.status === 0 || r.status >= 500) await sleep(1500 * (a + 1)); else return null;
  }
  return null;
}
const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => (s ?? '').toLowerCase().replace(/[\s_\-.·'’"“”()（）,]/g, '');

/* longest-registry-name ownership, over every alias of every institution */
const nameOwner = new Map();
const usable = (n) => (/[가-힣]/.test(n) ? n.length >= 3 : n.length >= 6 && /\s/.test(n));
for (const inst of registry()) {
  const nm = NAMES[inst.slug];
  for (const n of [...nm.ko, ...nm.en].filter(usable)) {
    const k = norm(n);
    if (nameOwner.has(k) && nameOwner.get(k) !== inst.slug) nameOwner.set(k, null); else nameOwner.set(k, inst.slug);
  }
}
const allNames = [...nameOwner.keys()].sort((a, b) => b.length - a.length);
export const titleNames = (t) => { const s = norm(t); for (const n of allNames) if (s.includes(n)) return nameOwner.get(n); return undefined; };

async function exist(titles) {
  const outp = [];
  for (let i = 0; i < titles.length; i += 40) {
    // No redirect following: "Category:Luther University" soft-redirects to a Canadian college — a category reached
    // only through a redirect is not this institution's category.
    const d = await api({ action: 'query', titles: titles.slice(i, i + 40).join('|') });
    for (const p of d?.query?.pages ?? []) if (!p.missing && p.ns === 14 && !p.redirect) outp.push(p.title);
  }
  return outp;
}

async function run(it) {
  const nm = NAMES[it.slug];
  const v22 = V22[it.slug] ?? { categories: [] };
  const attempts = [];
  const v22Cats = new Set((v22.categories ?? []).map((c) => `Category:${c.replace(/^Category:/, '')}`));
  const names = [...new Set([...nm.ko, ...nm.en])].filter(usable);
  const cats = new Set([...(it.categories ?? []).map((c) => `Category:${c}`)]);
  // (a) Category:<every name>
  const byName = await exist(names.map((n) => `Category:${n}`));
  for (const c of byName) if (!foreignOrAmbiguous(c) && !BAD_SUBCAT.test(c)) cats.add(c);
  attempts.push({ route: 'commons', query_or_url: `Category:<name> for ${names.length} names/aliases: ${names.join(' | ')}`, result_count: byName.length, outcome: byName.length ? `exists: ${byName.join(', ')}` : 'no category under any name' });
  // (b) category search for aliases V22 did not search (V22: first ko + first en)
  const extra = names.filter((n) => n !== it.name_ko && n !== it.name_en && n !== it.label_en).slice(0, 6);
  let found = 0;
  for (const n of extra) {
    const d = await api({ action: 'query', list: 'search', srsearch: n, srnamespace: '14', srlimit: '20' });
    for (const s of d?.query?.search ?? []) {
      const name = s.title.replace(/^Category:/, '');
      if (BAD_SUBCAT.test(name) || foreignOrAmbiguous(name)) continue;
      // Found by search, so the title must *begin* with one of our names ("Martin Luther University College"
      // contains "Luther University" and is in Canada).
      if (titleNames(name) === it.slug && names.some((n) => norm(name).startsWith(norm(n)))) { cats.add(s.title); found += 1; }
    }
  }
  attempts.push({ route: 'commons', query_or_url: `category search (ns14) for aliases not searched in V22: ${extra.join(' | ') || '(none)'}`, result_count: found, outcome: found ? 'categories naming the institution added' : 'nothing naming the institution' });
  // (c) parents naming the institution; subcats 3 deep
  const roots = [...cats];
  let parentsAdded = 0;
  for (let i = 0; i < roots.length; i += 40) {
    const d = await api({ action: 'query', prop: 'categories', titles: roots.slice(i, i + 40).join('|'), cllimit: 'max', clshow: '!hidden' });
    for (const p of d?.query?.pages ?? []) for (const c of p.categories ?? []) {
      const name = c.title.replace(/^Category:/, '');
      if (BAD_SUBCAT.test(name) || foreignOrAmbiguous(name) || cats.has(c.title)) continue;
      if (titleNames(name) === it.slug && names.some((n) => norm(name).startsWith(norm(n)))) { cats.add(c.title); parentsAdded += 1; }
    }
  }
  const files = new Map();
  const seen = new Set();
  async function walk(cat, depth) {
    if (seen.has(cat) || seen.size > 60) return;
    seen.add(cat);
    let cont = {};
    for (let page = 0; page < 4; page += 1) {
      const d = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'file|subcat', ...cont });
      for (const m of d?.query?.categorymembers ?? []) {
        if (m.ns === 6) { const e = files.get(m.title) ?? new Set(); e.add(`category:${cat.replace(/^Category:/, '')}`); files.set(m.title, e); }
        if (m.ns === 14 && depth > 0) {
          const name = m.title.replace(/^Category:/, '');
          if (BAD_SUBCAT.test(name) || foreignOrAmbiguous(name)) continue;
          const owner = titleNames(name);
          if (owner && owner !== it.slug) continue;
          if (owner !== it.slug && !CAMPUS_SUBCAT.test(name)) continue;
          cats.add(m.title);
          await walk(m.title, depth - 1);
        }
      }
      if (!d?.continue) break;
      cont = d.continue;
    }
  }
  for (const c of [...cats]) await walk(c, 3);
  const newCats = [...seen].filter((c) => !v22Cats.has(c));
  attempts.push({ route: 'commons', query_or_url: `category tree (parents naming it + 3 levels): ${[...seen].join(', ') || '(no categories)'}`, result_count: files.size, outcome: `${seen.size} categories walked (${newCats.length} not walked by V22${parentsAdded ? `, ${parentsAdded} parent(s)` : ''}), ${files.size} files` });
  // (d) full-text search for aliases V22 did not search
  let ft = 0;
  for (const n of extra) {
    const d = await api({ action: 'query', list: 'search', srsearch: `"${n}"`, srnamespace: '6', srlimit: '50' });
    for (const s of d?.query?.search ?? []) {
      if (titleNames(s.title) !== it.slug) continue;
      const e = files.get(s.title) ?? new Set(); e.add(`search:${n}`); files.set(s.title, e); ft += 1;
    }
  }
  attempts.push({ route: 'commons', query_or_url: `file full-text search for aliases not searched in V22: ${extra.join(' | ') || '(none)'}`, result_count: ft, outcome: ft ? 'title-named files added (title-only tie → campus vocabulary required)' : 'no file title naming the institution' });
  return { slug: it.slug, attempts, files: [...files].map(([title, via]) => ({ title, via: [...via] })) };
}

/** imageinfo for a list of titles (also used for Openverse's Wikimedia hits). */
export async function infoFor(titles) {
  const res = [];
  for (let i = 0; i < titles.length; i += 50) {
    const d = await api({ action: 'query', prop: 'imageinfo|categories', titles: titles.slice(i, i + 50).join('|'), iiprop: 'url|extmetadata|size|mime', iiurlwidth: '2560', cllimit: 'max', clshow: '!hidden', redirects: '1' });
    for (const p of d?.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      if (p.missing || !info) continue;
      const ext = info.extmetadata ?? {};
      res.push({ title: p.title, page: info.descriptionurl, url: info.url, thumb: info.thumburl, thumbW: info.thumbwidth, thumbH: info.thumbheight, mime: info.mime, width: info.width, height: info.height,
        licence: strip(ext.LicenseShortName) || 'unknown', licence_url: strip(ext.LicenseUrl) || null, author: strip(ext.Artist) || 'unknown', description: strip(ext.ImageDescription).slice(0, 300), categories: (p.categories ?? []).map((c) => c.title) });
    }
  }
  return res;
}

export function judge(f, via, slug) {
  if (!/^image\/(jpeg|png|webp|tiff)$/.test(f.mime ?? '')) return { ok: false, why: `mime ${f.mime}` };
  const names_institution = titleNames(f.title) === slug;
  const namesOther = titleNames(f.title);
  if (namesOther && namesOther !== slug) return { ok: false, why: `title names another institution (${namesOther})` };
  const s = subjectOk({ title: f.title, description: f.description, via, categories: f.categories, names_institution });
  if (!s.ok) return s;
  const free = FREE.test(f.licence);
  const credited = !free && ATTRIBUTION.test(f.licence) && !NC_ND.test(f.licence);
  if (!free && !credited) return { ok: false, why: `licence ${f.licence}` };
  if (credited && (!f.author || f.author === 'unknown' || /no machine-readable author/i.test(f.author))) return { ok: false, why: `licence ${f.licence} needs a credit and the file names no author` };
  if (Math.max(f.width ?? 0, f.height ?? 0) < 800) return { ok: false, why: `too small ${f.width}×${f.height}` };
  return { ok: true, free, names_institution, portrait: (f.height ?? 0) > (f.width ?? 0) };
}

if (process.argv[1].endsWith('v24-commons.mjs')) {
  const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
  let done = 0;
  const results = await pool(queue, 3, async (it) => {
    const r = await run(it);
    const infos = await infoFor(r.files.map((f) => f.title));
    const viaOf = Object.fromEntries(r.files.map((f) => [f.title, f.via]));
    const v22 = V22[it.slug] ?? {};
    const known = new Map([...(v22.photos ?? []).map((p) => [p.title, 'v22-servable']), ...(v22.blocked ?? []).map((p) => [p.title, `v22-blocked: ${p.why}`]), ...(v22.logos ?? []).map((p) => [p.title, 'v22-logo'])]);
    r.judged = infos.map((f) => ({ ...f, via: viaOf[f.title] ?? [], v22: known.get(f.title) ?? null, verdict: judge(f, viaOf[f.title] ?? [], it.slug) }));
    delete r.files;
    done += 1; if (done % 20 === 0) console.log(`commons ${done}/${queue.length}`);
    return r;
  });
  writeFileSync(out, JSON.stringify(results, null, 1));
  const ok = results.filter((r) => r.judged?.some((j) => j.verdict.ok));
  console.log('done', results.length, 'with ≥1 passing', ok.length, ok.map((r) => `${r.slug}:${r.judged.filter((j) => j.verdict.ok).length}`).join(' '));
}
