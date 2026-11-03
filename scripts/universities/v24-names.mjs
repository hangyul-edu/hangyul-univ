/**
 * V24 — every name an institution may be found under: registry ko/en, Wikidata labels, aliases (ko/en),
 * P1448 official names and P1449 nicknames (with end dates kept as "former" names), plus the Korean short
 * form (…대학교 → …대). Writes <out> = { slug: { ko:[], en:[], former:[] } } and is cached.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, get, readJson } from './lib.mjs';

const [csvQueue, out] = process.argv.slice(2);
const reg = readJson(join(ROOT, 'server/app/data/korean_institutions.json')).institutions;
const wd = readJson(join(ROOT, 'server/app/data/raw/v22_wikidata.json')).records;
const cov = readFileSync(join(ROOT, 'docs/qa/v23/UNIVERSITY_VISUAL_COVERAGE.csv'), 'utf8').split('\n').slice(1).filter(Boolean)
  .map((l) => l.match(/"([^"]*)"/g).map((s) => s.slice(1, -1)));
const enOf = Object.fromEntries(cov.map((r) => [r[0], r[2]]));
const qids = [...new Set(reg.map((i) => wd[i.slug]?.qid).filter(Boolean))];
const ent = {};
for (let i = 0; i < qids.length; i += 50) {
  const r = await get(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: qids.slice(i, i + 50).join('|'), props: 'labels|aliases|claims', languages: 'ko|en', format: 'json' })}`, { accept: 'application/json', timeout: 60000 });
  if (r.ok) Object.assign(ent, JSON.parse(r.text).entities);
}
const mono = (c) => c?.mainsnak?.datavalue?.value;
const names = {};
for (const inst of reg) {
  const w = wd[inst.slug] ?? {};
  const e = ent[w.qid] ?? {};
  const ko = new Set([inst.name_ko, w.resolved_label, w.kowiki?.replace(/\s*\(.*\)$/, ''), e.labels?.ko?.value].filter(Boolean));
  const en = new Set([enOf[inst.slug], w.label_en, w.enwiki?.replace(/\s*\(.*\)$/, ''), e.labels?.en?.value].filter(Boolean));
  for (const a of e.aliases?.ko ?? []) ko.add(a.value);
  for (const a of e.aliases?.en ?? []) en.add(a.value);
  const former = new Set();
  for (const p of ['P1448', 'P1449']) for (const c of e.claims?.[p] ?? []) {
    const v = mono(c); if (!v?.text || !['ko', 'en'].includes(v.language)) continue;
    (v.language === 'ko' ? ko : en).add(v.text);
    if (c.qualifiers?.P582) former.add(v.text);
  }
  for (const n of [...ko]) if (/대학교$/.test(n) && n.length >= 5) ko.add(n.replace(/대학교$/, '대'));
  names[inst.slug] = { qid: w.qid ?? null, ko: [...ko], en: [...en], former: [...former] };
}
writeFileSync(out, JSON.stringify(names, null, 1));
console.log('entities', Object.keys(ent).length, 'institutions', Object.keys(names).length);
