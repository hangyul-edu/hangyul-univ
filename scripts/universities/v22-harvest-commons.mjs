/**
 * V22 — the **wide** Commons sweep, for every institution (brief step A, B).
 *
 * V21 walked one route: Wikidata `P373` → category → files, one level of subcategory, 325 institutions.
 * This walks five, for all 425, and records for every candidate *how* it was tied to the institution:
 *
 *   `category`   a file in a Commons category that **is** the institution's — its P373 category, or
 *                `Category:<English name>` / `Category:<Korean name>` where such a category exists, or a
 *                category found by Commons' own category search whose title names the institution —
 *                plus two levels of subcategory, descending only into subcategories that name the
 *                institution or a campus thing (buildings, gates, library …) and never into people,
 *                alumni, hospital, station, sports or affiliated-school subcategories;
 *   `infobox`    the `그림`/`image`/`로고`/`logo` field of the institution's own ko/en Wikipedia infobox,
 *                resolved to a file that exists **on Commons** (a local fair-use upload is refused);
 *   `article`    any other file used in the ko/en article, accepted only if Commons categorises it under
 *                one of the institution's categories or its title names the institution;
 *   `search`     Commons full-text search for the Korean and English names, same acceptance rule;
 *   `wikidata`   P18 / P154 / P94 on the item.
 *
 * **Subject safety** is the whole design: a file reaches the candidate list only through Commons' own
 * categorisation of it under *this* institution, through *this* institution's own infobox, or through a
 * title that names *this* institution in full — and a name match is awarded to the **longest** registry
 * name it matches, so "Korea University" never claims a file about "Korea University of Technology and
 * Education". A city or province name is never a match on its own. Files whose names say they are a
 * map, a logo (for the photo slot), a hospital, a subway station, a ceremony, a portrait, an affiliated
 * school or a sports team are refused on the name.
 *
 * **Rights** are read from the Commons API per file. Servable: CC0 / public domain (incl. PD-textlogo,
 * PD-shape, PD-ineligible) with no credit, and CC BY / CC BY-SA **with a complete credit** (author
 * required). NC and ND are recorded as blocked with the licence that blocked them. A logo is only ever
 * servable in the no-credit class, because the logo slot renders no credit (`logoIsServable`).
 *
 * It downloads nothing. Output: `server/app/data/raw/v22_commons_candidates.json`.
 *
 *   node scripts/universities/v22-harvest-commons.mjs [--only slug,…] [--concurrency 4] [--limit N]
 */
import { join } from 'node:path';
import { get, pool, progress, readJson, registry, ROOT, TODAY, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const LIMIT = Number(flag('--limit', '0')) || 0;
const CONCURRENCY = Math.min(4, Number(flag('--concurrency', '4')));

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WD_RAW = join(ROOT, 'server/app/data/raw/v22_wikidata.json');
const OUT = join(ROOT, 'server/app/data/raw/v22_commons_candidates.json');

import { ATTRIBUTION, FREE, NC_ND } from './v22-licences.mjs';

import { CAMPUS_WORDS, foreignOrAmbiguous, NOT_A_PHOTO, subjectOk } from './v22-subject.mjs';
/** …and one that says it is not an institutional mark. */
const NOT_A_LOGO = /\b(map|diagram|chart|photo|building|campus|gate|aerial|street|view|panorama|interior|ceremony|people|authority|library|hospital|station|team|club|society|festival|poster|flag of)\b|병원|역\b|동문|축제|포스터/i;
const IS_LOGO_NAME = /\b(logo|logotype|emblem|seal|symbol|wordmark|ci|signature|mark|crest|insignia|arms)\b|로고|엠블럼|상징|심벌|심볼|교표|문장/i;
/** Subcategories never descended into: they are about people, other entities or non-place subjects. */
const BAD_SUBCAT = /alumni|faculty|people|staff|students?\b|professors?|graduates|hospital|medical cent|clinic|의료원|병원|station|publications?|documents|maps|affiliated|high school|middle school|elementary|football|baseball|basketball|volleyball|soccer|sports?|teams?|collections?|artworks?|paintings|books|events?|ceremon|festival|졸업|동문|병원|portraits|presidents|rectors|chancellors|botanical|herbarium|specimens|signage|coins|stamps|screenshots|videos|audio|logos?|emblems|seals|flags|diagrams|charts|scans|cars|buses|vehicles|press|conference|lectures|theses|yearbooks|newspapers|posters|awards/i;
const CAMPUS_SUBCAT = /campus|buildings?|gates?|library|libraries|halls?|views?|aerial|museum|chapel|church|stadium|gymnasium|dormitor|architecture|park|garden|interior|exterior|towers?|monuments?|statues?|sculptures?|panoram|main|entrance|quad|lawn|avenue|street|night|autumn|spring|winter|summer|snow|cherry|trees/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, base = COMMONS) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = await get(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { accept: 'application/json', timeout: 45000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    if (r.status === 429 || r.status === 0 || r.status >= 500) await sleep(1200 * (attempt + 1)); else return null;
  }
  return null;
}

const strip = (v) => (v?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => (s ?? '').toLowerCase().replace(/[\s_\-.·'’"“”()（）]/g, '');
const stripFile = (t) => t.replace(/^(File|Image|파일|그림):/i, '').replace(/_/g, ' ').trim();

/* --------------------------------------------------------------------------------- names and matching */

const insts = registry();
const wd = readJson(WD_RAW, { records: {} }).records ?? {};

/** The names an institution may be found under. Exact, full names — never a place name alone. */
function namesOf(inst) {
  const w = wd[inst.slug] ?? {};
  const ko = new Set([inst.name_ko, inst.registry_name_ko, w.resolved_label, w.kowiki?.replace(/\s*\(.*\)$/, '')].filter(Boolean));
  const en = new Set([inst.name_en, w.label_en, w.enwiki?.replace(/\s*\(.*\)$/, '')].filter(Boolean));
  // A ko label that is a *different* institution's name must not become ours (renames collide).
  return { ko: [...ko], en: [...en].filter((n) => n.length >= 6) };
}
/** Every normalised name → the slug that owns it. Longest match wins at lookup time. */
const nameOwner = new Map();
for (const inst of insts) {
  const { ko, en } = namesOf(inst);
  for (const n of [...ko, ...en]) {
    const k = norm(n);
    if (!k) continue;
    // A name shared by two registry rows (e.g. a renamed college whose old name another row still uses)
    // belongs to neither for matching purposes.
    if (nameOwner.has(k) && nameOwner.get(k) !== inst.slug) nameOwner.set(k, null); else nameOwner.set(k, inst.slug);
  }
}
const allNames = [...nameOwner.keys()].sort((a, b) => b.length - a.length);

/** Which institution a title names, by the **longest** registry name it contains. */
function titleNames(title) {
  const t = norm(title);
  for (const n of allNames) if (t.includes(n)) return nameOwner.get(n);
  return undefined;
}

/* ------------------------------------------------------------------------------------------ Commons */

async function categoriesExist(titles) {
  if (!titles.length) return [];
  const d = await api({ action: 'query', titles: titles.join('|') });
  return (d?.query?.pages ?? []).filter((p) => !p.missing && p.ns === 14).map((p) => p.title);
}

async function searchCategories(name) {
  const d = await api({ action: 'query', list: 'search', srsearch: name, srnamespace: '14', srlimit: '20' });
  return (d?.query?.search ?? []).map((s) => s.title);
}

async function searchFiles(name) {
  const d = await api({ action: 'query', list: 'search', srsearch: `"${name}"`, srnamespace: '6', srlimit: '50' });
  return (d?.query?.search ?? []).map((s) => s.title);
}

/** Files in a category tree, two levels, campus-ish subcategories only. */
async function filesIn(root, inst, accepted, seen = new Set(), depth = 2) {
  if (seen.has(root) || seen.size > 24) return [];
  seen.add(root);
  const d = await api({ action: 'query', list: 'categorymembers', cmtitle: root, cmlimit: '300', cmtype: 'file|subcat' });
  const members = d?.query?.categorymembers ?? [];
  const files = members.filter((m) => m.ns === 6).map((m) => ({ title: m.title, via: `category:${root.replace(/^Category:/, '')}` }));
  if (depth > 0) {
    for (const sub of members.filter((m) => m.ns === 14).slice(0, 12)) {
      const name = sub.title.replace(/^Category:/, '');
      if (BAD_SUBCAT.test(name) || foreignOrAmbiguous(name)) continue;
      const owner = titleNames(name);
      const namesUs = owner === inst.slug;
      const namesOther = owner && owner !== inst.slug;
      if (namesOther) continue;
      if (!namesUs && !CAMPUS_SUBCAT.test(name)) continue;
      accepted.add(sub.title);
      files.push(...(await filesIn(sub.title, inst, accepted, seen, depth - 1)));
    }
  }
  return files;
}

/** Wikipedia: infobox image/logo fields and the article's file list. */
async function wikipedia(lang, title) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const d = await api({ action: 'query', prop: 'revisions|images', rvprop: 'content', rvslots: 'main', imlimit: '100', titles: title, redirects: '1' }, base);
  const page = d?.query?.pages?.[0];
  if (!page || page.missing) return { infoboxImages: [], infoboxLogos: [], images: [] };
  const text = page.revisions?.[0]?.slots?.main?.content ?? '';
  const infobox = (text.match(/\{\{\s*(?:Infobox|대학교? 정보|학교 정보|대학 정보|University|대학교|학교)[^]*?\n\}\}/i) ?? [text.slice(0, 6000)])[0];
  const field = (re) => {
    const out = [];
    for (const m of infobox.matchAll(re)) {
      let v = m[2].trim();
      if (!v || /\{\{/.test(v)) continue;
      v = (v.match(/\[\[\s*(?:File|Image|파일|그림)\s*:\s*([^\]|]+)/i) ?? [, v])[1];
      v = stripFile(v.split('|')[0]).trim();
      if (/\.(jpe?g|png|svg|gif|webp|tiff?)$/i.test(v)) out.push(`File:${v}`);
    }
    return out;
  };
  return {
    infoboxImages: field(/\|\s*(그림|이미지|사진|image|image_name|campus_image|photo)\s*=\s*([^\n]+)/gi),
    infoboxLogos: field(/\|\s*(로고|교표|상징|문장|logo|seal_image|logo_image|emblem|image_logo)\s*=\s*([^\n]+)/gi),
    images: (page.images ?? []).map((i) => `File:${stripFile(i.title)}`),
  };
}

/** `imageinfo` + categories, 50 at a time. Files missing on Commons (local uploads) are dropped. */
async function infoFor(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const d = await api({
      action: 'query', prop: 'imageinfo|categories', titles: titles.slice(i, i + 50).join('|'),
      iiprop: 'url|extmetadata|size|mime', cllimit: 'max', clshow: '!hidden', redirects: '1',
    });
    for (const page of d?.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (page.missing || !info) continue;
      const ext = info.extmetadata ?? {};
      out.push({
        title: page.title, url: info.url, page: info.descriptionurl, mime: info.mime, width: info.width, height: info.height,
        licence: strip(ext.LicenseShortName) || strip(ext.License) || 'unknown',
        author: strip(ext.Artist) || 'unknown',
        description: strip(ext.ImageDescription).slice(0, 240),
        categories: (page.categories ?? []).map((c) => c.title),
      });
    }
  }
  return out;
}

function judge(f, slot) {
  const name = f.title.replace(/^File:/, '');
  const free = FREE.test(f.licence);
  const credited = !free && ATTRIBUTION.test(f.licence) && !NC_ND.test(f.licence);
  if (!/^image\/(png|jpeg|svg\+xml|webp|gif|tiff)$/.test(f.mime ?? '')) return { ok: false, why: `mime ${f.mime}` };
  if (slot === 'logo') {
    if (NOT_A_LOGO.test(name)) return { ok: false, why: 'name says it is not a mark' };
    if (!free) return { ok: false, why: `licence ${f.licence} — the logo slot renders no credit, so only a no-credit licence is servable` };
    if (Math.max(f.width ?? 0, f.height ?? 0) < 120) return { ok: false, why: `too small ${f.width}×${f.height}` };
    const r = (f.width ?? 1) / (f.height ?? 1);
    if (r < 0.18 || r > 8) return { ok: false, why: `aspect ${r.toFixed(2)}` };
    return { ok: true, rights: 'CC0_PUBLIC_DOMAIN' };
  }
  const subject = subjectOk({ title: f.title, description: f.description, via: f.via ?? [] });
  if (!subject.ok) return subject;
  if (/svg|gif/.test(f.mime)) return { ok: false, why: `mime ${f.mime} is not a photograph` };
  if (!free && !credited) return { ok: false, why: `licence ${f.licence}` };
  if (credited && (!f.author || f.author === 'unknown')) return { ok: false, why: `licence ${f.licence} needs a credit and the file names no author` };
  if ((f.width ?? 0) < 1000) return { ok: false, why: `too small ${f.width}×${f.height}` };
  if ((f.width ?? 0) < (f.height ?? 1) * 0.9) return { ok: false, why: 'portrait' };
  return { ok: true, rights: free ? 'CC0_PUBLIC_DOMAIN' : 'ATTRIBUTION_SUPPORTED', hero_grade: (f.width ?? 0) >= 1400 && (f.width ?? 0) >= (f.height ?? 1) * 1.1 };
}

/* --------------------------------------------------------------------------------------------- run */

let targets = insts;
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);
console.log(`V22 wide Commons sweep — ${targets.length} institutions`);

let done = 0;
const results = await pool(targets, CONCURRENCY, async (inst) => {
  const w = wd[inst.slug] ?? {};
  const { ko, en } = namesOf(inst);
  const candidates = new Map(); // title → { via: Set, signal }
  const add = (title, via) => {
    const t = `File:${stripFile(title)}`;
    const e = candidates.get(t) ?? { via: new Set() };
    e.via.add(via);
    candidates.set(t, e);
  };

  // (1) categories: P373, by-name, by category search
  const accepted = new Set();
  for (const c of w.categories ?? []) accepted.add(`Category:${c}`);
  const byName = await categoriesExist([...new Set([...en, ...ko].map((n) => `Category:${n}`))]);
  for (const c of byName) if (!foreignOrAmbiguous(c)) accepted.add(c);
  for (const n of [...ko.slice(0, 1), ...en.slice(0, 1)]) {
    for (const c of await searchCategories(n)) {
      const name = c.replace(/^Category:/, '');
      if (BAD_SUBCAT.test(name) || foreignOrAmbiguous(name)) continue;
      if (titleNames(name) === inst.slug) accepted.add(c);
    }
  }
  // A P373 category is Wikidata's statement about the item, but the same guard applies to its subcategories.
  const roots = [...accepted];
  for (const root of roots) for (const f of await filesIn(root, inst, accepted)) add(f.title, f.via);

  // (2) Wikidata direct
  for (const f of w.images ?? []) add(f, 'wikidata:P18');
  for (const f of w.logos ?? []) add(f, 'wikidata:P154');
  for (const f of w.arms ?? []) add(f, 'wikidata:P94');

  // (3) Wikipedia ko/en
  const articleFiles = new Set();
  for (const [lang, title] of [['ko', w.kowiki], ['en', w.enwiki]]) {
    if (!title) continue;
    const a = await wikipedia(lang, title);
    for (const f of a.infoboxImages) add(f, `infobox:${lang}:image`);
    for (const f of a.infoboxLogos) add(f, `infobox:${lang}:logo`);
    for (const f of a.images) articleFiles.add(`File:${stripFile(f)}`);
  }
  // (4) Commons full-text search
  const searchFound = new Set();
  for (const n of [...ko.slice(0, 1), ...en.slice(0, 1)]) for (const t of await searchFiles(n)) searchFound.add(t);

  // Article/search files need a second tie to the institution: a category of ours, or a title naming us.
  const needTie = [...new Set([...articleFiles, ...searchFound])].filter((t) => !candidates.has(t));
  const tied = [];
  if (needTie.length) {
    const infos = await infoFor(needTie.slice(0, 300));
    const acceptedNorm = [...accepted].map((c) => norm(c.replace(/^Category:/, '')));
    for (const f of infos) {
      const owner = titleNames(f.title.replace(/^File:/, ''));
      const inOurCat = f.categories.some((c) => { const n = norm(c.replace(/^Category:/, '')); return acceptedNorm.some((a) => n === a || n.startsWith(a)) && !BAD_SUBCAT.test(c); });
      const namesOther = owner && owner !== inst.slug;
      if (namesOther) continue;
      if (owner === inst.slug || inOurCat) {
        const via = articleFiles.has(f.title) ? `article:${owner === inst.slug ? 'title' : 'category'}` : `search:${owner === inst.slug ? 'title' : 'category'}`;
        add(f.title, via);
        tied.push(f);
      }
    }
  }

  // imageinfo for everything (reuse what we already fetched)
  const have = new Map(tied.map((f) => [f.title, f]));
  const missing = [...candidates.keys()].filter((t) => !have.has(t)).slice(0, 600);
  for (const f of await infoFor(missing)) have.set(f.title, f);

  const logos = []; const photos = []; const blocked = [];
  for (const [title, meta] of candidates) {
    const f = have.get(title);
    if (!f) { blocked.push({ title, kind: 'unknown', why: 'not on Commons (local upload or deleted)', via: [...meta.via] }); continue; }
    const name = title.replace(/^File:/, '');
    const via = [...meta.via];
    const isLogo = via.some((v) => /P154|P94|infobox:..:logo/.test(v)) || IS_LOGO_NAME.test(name) || /svg/.test(f.mime ?? '');
    // A file about another institution never gets in, whatever route found it.
    const owner = titleNames(name);
    if (owner && owner !== inst.slug) { blocked.push({ title, kind: isLogo ? 'logo' : 'photo', why: `names another institution (${owner})`, via }); continue; }
    const namesUs = owner === inst.slug;
    const row = { title, licence: f.licence, width: f.width, height: f.height, mime: f.mime, url: f.url, page: f.page, author: f.author, description: f.description, via, names_institution: namesUs, categories: f.categories.slice(0, 8) };
    const v = judge({ ...f, via, names_institution: namesUs, categories: f.categories }, isLogo ? 'logo' : 'photo');
    if (!v.ok) { blocked.push({ ...row, kind: isLogo ? 'logo' : 'photo', why: v.why }); continue; }
    if (isLogo) logos.push({ ...row, rights: v.rights });
    else photos.push({ ...row, rights: v.rights, hero_grade: v.hero_grade, campus_words: CAMPUS_WORDS.test(`${name} ${f.description}`) });
  }
  // Rank: campus vocabulary, then direct ties (infobox/P18/own category), then free licence, then width.
  const tieScore = (p) => (p.via.some((x) => /infobox|P18/.test(x)) ? 2 : p.via.some((x) => /^category:/.test(x)) ? 1 : 0);
  // Rank: campus vocabulary → the title names the institution → direct tie → free licence → width.
  photos.sort((a, b) => (b.campus_words - a.campus_words) || (Number(b.names_institution) - Number(a.names_institution)) || (tieScore(b) - tieScore(a)) || (Number(FREE.test(b.licence)) - Number(FREE.test(a.licence))) || ((b.width ?? 0) - (a.width ?? 0)));
  logos.sort((a, b) => (Number(/svg/.test(b.mime)) - Number(/svg/.test(a.mime))) || ((b.width ?? 0) - (a.width ?? 0)));
  progress(++done, targets.length, 'commons');
  return { slug: inst.slug, name_ko: inst.name_ko, name_en: inst.name_en ?? null, categories: roots.map((c) => c.replace(/^Category:/, '')), scanned: candidates.size, logos, photos, blocked: blocked.slice(0, 60) };
});

const prior = readJson(OUT, { records: {} }).records ?? {};
const records = ONLY.length || LIMIT ? { ...prior } : {};
for (const r of results) if (r?.slug) records[r.slug] = r;
writeJson(OUT, { _generated_by: 'scripts/universities/v22-harvest-commons.mjs', generated_at: TODAY, institutions: Object.keys(records).length, records });

const rs = Object.values(records);
const n = rs.length;
const cnt = (f) => rs.filter(f).length;
console.log(`\n  institutions with ≥1 own category          ${cnt((r) => r.categories?.length)} / ${n}`);
console.log(`  institutions with ≥1 servable LOGO        ${cnt((r) => r.logos?.length)}`);
console.log(`  institutions with ≥1 servable PHOTO       ${cnt((r) => r.photos?.length)}  (${rs.reduce((s, r) => s + (r.photos?.length ?? 0), 0)} files)`);
console.log(`    of which hero-grade (≥1400px landscape) ${cnt((r) => r.photos?.some((p) => p.hero_grade))}`);
console.log(`    with ≥2 photographs                     ${cnt((r) => (r.photos?.length ?? 0) >= 2)}`);
console.log(`  files refused (rights/quality/subject)    ${rs.reduce((s, r) => s + (r.blocked?.length ?? 0), 0)}`);
console.log(`  → server/app/data/raw/v22_commons_candidates.json\n`);
