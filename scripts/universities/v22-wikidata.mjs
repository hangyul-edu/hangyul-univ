/**
 * V22 — Wikidata, for **all 425** institutions (brief step A(c), E).
 *
 * V21 worked from the 325 institutions whose registry row already carried a Wikidata item. The other 100
 * (70 junior colleges, 16 graduate universities, 14 universities) were never looked up, so they never got
 * a Commons category, a website, a founding year or a channel candidate. This script:
 *
 *   1. **resolves** an item for each institution that has none, by exact Korean label/alias match
 *      (`wbsearchentities`, language ko) confirmed by the item's own claims — it must be `P17` South
 *      Korea *and* an instance of an educational institution class. A near-miss is recorded as
 *      `UNRESOLVED`, never guessed;
 *   2. **refreshes**, for every item, the properties the rest of the V22 pipeline consumes:
 *      P18 image · P154 logo · P94 arms · P373 Commons category · P856 official website ·
 *      P2397 YouTube channel · P1451 motto · P571 inception · P112 founder (label) · ko/en sitelinks.
 *
 * Output: `server/app/data/raw/v22_wikidata.json`, keyed by slug. Nothing is written to the content
 * record here; `v22-apply.mjs` folds in the structured facts with their provenance.
 *
 *   node scripts/universities/v22-wikidata.mjs [--only slug,…]
 */
import { join } from 'node:path';
import { content, get, pool, progress, readJson, registry, ROOT, TODAY, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);

const WD = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';
const OUT = join(ROOT, 'server/app/data/raw/v22_wikidata.json');

/** Educational-institution classes an item may be an instance of (or a subclass thereof, via SPARQL). */
const EDU_CLASSES = ['Q3918', 'Q38723', 'Q189004', 'Q875538', 'Q1371037', 'Q15936437', 'Q2385804', 'Q847027',
  'Q23002054', 'Q5341295', 'Q3354859', 'Q1663017', 'Q494230', 'Q7894584', 'Q1021290', 'Q1455581', 'Q3551775',
  'Q31855', 'Q1143635', 'Q988105', 'Q62078547', 'Q4287745', 'Q2467461', 'Q1663017'];
// university · higher education institution · college · private university · public university ·
// vocational university · educational institution · technical university · junior college · seminary ·
// graduate school · theological seminary · medical school · music school · art school · … · research institute

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, base = WD) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = await get(`${base}?${new URLSearchParams({ format: 'json', ...params })}`, { accept: 'application/json', timeout: 60000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    if (r.status === 429 || r.status === 0) await sleep(1500 * (attempt + 1)); else return null;
  }
  return null;
}

async function sparql(query) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = await get(`${SPARQL}?${new URLSearchParams({ query, format: 'json' })}`, { accept: 'application/sparql-results+json', timeout: 120000 });
    if (r.ok) { try { return JSON.parse(r.text); } catch { return null; } }
    await sleep(3000 * (attempt + 1));
  }
  return null;
}

const normKo = (s) => (s ?? '').replace(/\s+/g, '').replace(/\(.*?\)/g, '');

/** Name variants the registry's Korean name might appear under on Wikidata. */
function koVariants(inst) {
  const n = inst.name_ko;
  const v = new Set([n]);
  if (inst.registry_name_ko) v.add(inst.registry_name_ko);
  // 한국폴리텍 VII 대학 부산캠퍼스 → 한국폴리텍VII대학 (the campus is not usually its own item)
  v.add(n.replace(/\s+/g, ''));
  // 전문대학 ↔ 대학 renames are common; so are 대학 ↔ 대학교
  if (/대학교$/.test(n)) v.add(n.replace(/대학교$/, '대학'));
  else if (/대학$/.test(n)) v.add(`${n}교`);
  return [...v];
}

/* ------------------------------------------------------------------- 1. resolve items for the unmatched */

const insts = registry();
const doc = content();
const prior = readJson(OUT, { records: {} }).records ?? {};
let targets = insts;
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));

const qidOf = new Map();
for (const inst of targets) {
  const q = doc.records[inst.slug]?.wikidata_id || inst.wikidata_id || prior[inst.slug]?.qid;
  if (q) qidOf.set(inst.slug, { qid: q, via: doc.records[inst.slug]?.wikidata_id || inst.wikidata_id ? 'registry' : prior[inst.slug]?.via ?? 'prior' });
}
const unmatched = targets.filter((i) => !qidOf.has(i.slug));
console.log(`V22 Wikidata — ${targets.length} institutions; ${qidOf.size} already have an item, ${unmatched.length} to resolve`);

const unresolved = {};
let done = 0;
const resolved = await pool(unmatched, 3, async (inst) => {
  const candidates = new Map();
  for (const name of koVariants(inst)) {
    const d = await api({ action: 'wbsearchentities', search: name, language: 'ko', uselang: 'ko', limit: '7', type: 'item' });
    for (const s of d?.search ?? []) {
      const matchText = normKo(s.match?.text);
      if (!koVariants(inst).map(normKo).includes(matchText)) continue; // exact label/alias only
      candidates.set(s.id, { id: s.id, label: s.label, description: s.description ?? '', matched: s.match?.text });
    }
    await sleep(150);
  }
  progress(++done, unmatched.length, 'resolve');
  if (!candidates.size) return { slug: inst.slug, status: 'UNRESOLVED', why: 'no exact ko label/alias match' };
  return { slug: inst.slug, status: 'CANDIDATES', candidates: [...candidates.values()] };
});

// Confirm each candidate's claims in one SPARQL query: South Korea + an educational class (transitively).
const candQids = [...new Set(resolved.flatMap((r) => (r?.candidates ?? []).map((c) => c.id)))];
const confirmed = new Set();
const classOf = new Map();
for (let i = 0; i < candQids.length; i += 100) {
  const values = candQids.slice(i, i + 100).map((q) => `wd:${q}`).join(' ');
  const d = await sparql(`SELECT ?item ?classLabel WHERE {
    VALUES ?item { ${values} }
    ?item wdt:P17 wd:Q884 .
    ?item wdt:P31 ?class .
    ?class wdt:P279* ?root .
    VALUES ?root { ${EDU_CLASSES.map((q) => `wd:${q}`).join(' ')} }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  for (const row of d?.results?.bindings ?? []) {
    const q = row.item.value.split('/').pop();
    confirmed.add(q);
    classOf.set(q, row.classLabel?.value);
  }
}
let newly = 0;
for (const r of resolved) {
  if (!r?.slug) continue;
  if (r.status !== 'CANDIDATES') { unresolved[r.slug] = r.why; continue; }
  const ok = r.candidates.filter((c) => confirmed.has(c.id));
  if (ok.length === 1) { qidOf.set(r.slug, { qid: ok[0].id, via: 'ko-label-exact+P17+P31', label: ok[0].label, class: classOf.get(ok[0].id) }); newly += 1; }
  else if (ok.length > 1) unresolved[r.slug] = `ambiguous: ${ok.map((c) => c.id).join(', ')}`;
  else unresolved[r.slug] = `label matched ${r.candidates.map((c) => `${c.id} (${c.description})`).join('; ')} but not confirmed as a Korean educational institution`;
}
console.log(`  newly resolved ${newly} · unresolved ${Object.keys(unresolved).length}`);

/* ----------------------------------------------------------------------- 2. refresh the properties */

const qids = [...new Set([...qidOf.values()].map((v) => v.qid))];
const facts = new Map();
const fileName = (v) => `File:${decodeURIComponent(v.split('/').pop()).replace(/_/g, ' ')}`;
for (let i = 0; i < qids.length; i += 80) {
  const values = qids.slice(i, i + 80).map((q) => `wd:${q}`).join(' ');
  const d = await sparql(`SELECT ?item ?img ?logo ?arms ?cat ?site ?yt ?motto ?inception ?founder ?founderLabel ?ko ?en ?itemLabelEn WHERE {
    VALUES ?item { ${values} }
    OPTIONAL { ?item wdt:P18 ?img }
    OPTIONAL { ?item wdt:P154 ?logo }
    OPTIONAL { ?item wdt:P94 ?arms }
    OPTIONAL { ?item wdt:P373 ?cat }
    OPTIONAL { ?item wdt:P856 ?site }
    OPTIONAL { ?item wdt:P2397 ?yt }
    OPTIONAL { ?item wdt:P1451 ?motto }
    OPTIONAL { ?item wdt:P571 ?inception }
    OPTIONAL { ?item wdt:P112 ?founder . ?founder rdfs:label ?founderLabel FILTER(LANG(?founderLabel) = "ko") }
    OPTIONAL { ?ko schema:about ?item ; schema:isPartOf <https://ko.wikipedia.org/> }
    OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?item rdfs:label ?itemLabelEn FILTER(LANG(?itemLabelEn) = "en") }
  }`);
  for (const row of d?.results?.bindings ?? []) {
    const q = row.item.value.split('/').pop();
    const f = facts.get(q) ?? { images: new Set(), logos: new Set(), arms: new Set(), categories: new Set(), websites: new Set(), youtube: new Set(), mottos: [], inceptions: new Set(), founders: new Set(), kowiki: null, enwiki: null, label_en: null };
    if (row.img) f.images.add(fileName(row.img.value));
    if (row.logo) f.logos.add(fileName(row.logo.value));
    if (row.arms) f.arms.add(fileName(row.arms.value));
    if (row.cat) f.categories.add(row.cat.value);
    if (row.site) f.websites.add(row.site.value);
    if (row.yt) f.youtube.add(row.yt.value);
    if (row.motto && !f.mottos.some((m) => m.text === row.motto.value)) f.mottos.push({ text: row.motto.value, lang: row.motto['xml:lang'] ?? null });
    if (row.inception) f.inceptions.add(row.inception.value.slice(0, 10));
    if (row.founder) f.founders.add(row.founderLabel?.value ?? row.founder.value.split('/').pop());
    if (row.ko) f.kowiki = decodeURIComponent(row.ko.value.split('/wiki/').pop()).replace(/_/g, ' ');
    if (row.en) f.enwiki = decodeURIComponent(row.en.value.split('/wiki/').pop()).replace(/_/g, ' ');
    if (row.itemLabelEn) f.label_en = row.itemLabelEn.value;
    facts.set(q, f);
  }
  process.stdout.write(`\r  properties ${Math.min(i + 80, qids.length)}/${qids.length}   `);
  await sleep(500);
}
console.log();

const records = { ...prior };
for (const inst of targets) {
  const r = qidOf.get(inst.slug);
  if (!r) { records[inst.slug] = { status: 'UNRESOLVED', why: unresolved[inst.slug] ?? 'no item', checked: TODAY }; continue; }
  const f = facts.get(r.qid) ?? {};
  const s = (x) => [...(x ?? [])];
  records[inst.slug] = {
    status: 'OK', qid: r.qid, via: r.via, resolved_label: r.label ?? null, resolved_class: r.class ?? null,
    source_url: `https://www.wikidata.org/wiki/${r.qid}`, checked: TODAY,
    images: s(f.images), logos: s(f.logos), arms: s(f.arms), categories: s(f.categories), websites: s(f.websites),
    youtube: s(f.youtube), mottos: f.mottos ?? [], inceptions: s(f.inceptions), founders: s(f.founders),
    kowiki: f.kowiki ?? null, enwiki: f.enwiki ?? null, label_en: f.label_en ?? null,
  };
}
writeJson(OUT, { _generated_by: 'scripts/universities/v22-wikidata.mjs', generated_at: TODAY, institutions: Object.keys(records).length, records });

const all = Object.values(records);
const has = (k) => all.filter((r) => r.status === 'OK' && (r[k]?.length)).length;
console.log(`  items                ${all.filter((r) => r.status === 'OK').length} / ${all.length}`);
console.log(`  P373 category        ${has('categories')}`);
console.log(`  P18 image            ${has('images')}`);
console.log(`  P154 logo            ${has('logos')}`);
console.log(`  P856 website         ${has('websites')}`);
console.log(`  P2397 youtube        ${has('youtube')}`);
console.log(`  P571 inception       ${has('inceptions')}`);
console.log(`  P112 founder         ${has('founders')}`);
console.log(`  kowiki / enwiki      ${all.filter((r) => r.kowiki).length} / ${all.filter((r) => r.enwiki).length}`);
console.log(`  → server/app/data/raw/v22_wikidata.json\n`);
