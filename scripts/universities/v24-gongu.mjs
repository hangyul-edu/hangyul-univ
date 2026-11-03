/**
 * V24 — 공유마당 (gongu.copyright.or.kr) photographs titled with the institution's name.
 *
 * Uses the public image listing (`/gongu/wrt/wrtCl/listWrtImage.do`, allowed by robots.txt for `*`), photo
 * type only (wrtTy=10006), filtered at the source to the licence codes that permit commercial reuse:
 * 01 KOGL Type 1, 20/21 CC BY family without NC/ND as reported per item, 23 CC BY-SA, 97 만료저작물
 * (expired), 98 기증저작물 자유이용. The item page's own licence mark (alt text + image URL) is re-read and is
 * what is recorded; an item whose mark is anything else is refused. The search is token-based and date-sorted,
 * so up to 10 pages × 96 are read and filtered by the longest-registry-name rule. 1 request/second.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { get, decodeEntities } from './lib.mjs';
import { titleNames } from './v24-commons.mjs';
import { subjectOk } from './v22-subject.mjs';

const [queuePath, out] = process.argv.slice(2);
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const BASE = 'https://gongu.copyright.or.kr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACCEPT = { '01': 'KOGL Type 1 (공공누리 제1유형: 출처표시)', 20: null, 21: 'CC BY', 23: 'CC BY-SA', 97: 'Public domain (만료저작물)', 98: '공유마당 기증저작물 자유이용 (attribution: 저작물·저작자·출처)' };
const clean = (s) => decodeEntities(s.replace(/<!H[SE]>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
async function page(url) { await sleep(1000); return get(url, { timeout: 30000 }); }

const results = [];
for (const [i, it] of queue.entries()) {
  const attempts = []; const cands = []; const rejected = [];
  const hits = new Map(); let total = null; let pages = 0;
  for (let p = 1; p <= 10; p += 1) {
    const url = `${BASE}/gongu/wrt/wrtCl/listWrtImage.do?${new URLSearchParams({ menuNo: '200018', pageIndex: String(p), sortSe: 'date', wrtTy: '10006', licenseCd: '01,20,21,23,97,98', searchWrd: it.name_ko, pageUnit: '96' })}`;
    const r = await page(url);
    if (!r.ok) { attempts.push({ route: 'gongu', query_or_url: url, result_count: null, outcome: `HTTP ${r.status}` }); break; }
    pages = p;
    total = Number((/총 : <strong>([\d,]+)/.exec(r.text)?.[1] ?? '0').replace(/,/g, ''));
    const items = [...r.text.matchAll(/view\.do\?wrtSn=(\d+)&amp;menuNo=200018">\s*<div class="photoCon_head">([\s\S]*?)<\/div>/g)];
    for (const m of items) hits.set(m[1], clean(m[2]));
    if (p * 96 >= total || !items.length) break;
  }
  const named = [...hits].filter(([, t]) => titleNames(t) === it.slug);
  attempts.push({ route: 'gongu', query_or_url: `${BASE}/gongu/wrt/wrtCl/listWrtImage.do?wrtTy=10006&licenseCd=01,20,21,23,97,98&searchWrd=${it.name_ko}`, result_count: total, outcome: `${pages} page(s) read (${hits.size} items${total > pages * 96 ? `; truncated at ${pages * 96} of ${total}` : ''}); ${named.length} titled with this institution's name` });
  for (const [sn, title] of named) {
    const url = `${BASE}/gongu/wrt/wrt/view.do?wrtSn=${sn}&menuNo=200018`;
    const r = await page(url);
    if (!r.ok) { rejected.push({ title, url, why: `view HTTP ${r.status}` }); continue; }
    const t = r.text;
    const lic = /<dt>이용조건<\/dt>\s*<dd>[\s\S]*?<img src="([^"]*img_license(\d+)\.png)" alt="([^"]*)"/.exec(t);
    const field = (label) => clean((new RegExp(`<dt>\\s*${label}\\s*</dt>\\s*<dd>([\\s\\S]*?)</dd>`).exec(t) ?? [, ''])[1]);
    const owner = field('저작\\(권\\)자').replace(/\(저작물.*$/, '').trim();
    const summary = field('요약정보');
    const res = /해상도<\/dt>\s*<dd>\s*(\d+)\s*\*\s*(\d+)/.exec(t);
    const big = /wrtFileImageView\.do\?wrtSn=\d+&amp;filePath=[^"'&]+&amp;thumbAt=Y&amp;thumbSe=b_tbumb&amp;wrtTy=10006/.exec(t)?.[0];
    const tags = [...t.matchAll(/class="tag[^"]*"[^>]*>([^<]+)</g)].map((m) => clean(m[1]));
    const row = { wrtSn: sn, title, url, owner, summary, licence_code: lic?.[2] ?? null, licence_mark_alt: lic?.[3]?.trim() ?? null, licence_mark_img: lic ? BASE + lic[1] : null, width: res ? +res[1] : null, height: res ? +res[2] : null, image_url: big ? `${BASE}/gongu/wrt/cmmn/${decodeEntities(big)}` : null };
    const licence = lic ? ACCEPT[lic[2]] : undefined;
    if (!licence) { rejected.push({ ...row, why: `licence mark ${row.licence_mark_alt ?? 'missing'} is not an accepted commercial-reuse licence` }); continue; }
    if (/NC|ND|비영리|변경금지/.test(row.licence_mark_alt)) { rejected.push({ ...row, why: `licence ${row.licence_mark_alt}` }); continue; }
    const s = subjectOk({ title, description: summary, via: [], names_institution: true });
    if (!s.ok) { rejected.push({ ...row, why: s.why }); continue; }
    if (!row.image_url) { rejected.push({ ...row, why: 'no image rendition found on the item page' }); continue; }
    cands.push({ ...row, licence });
  }
  results.push({ slug: it.slug, attempts, candidates: cands, rejected });
  console.log(`${i + 1}/${queue.length} ${it.slug} total=${total} named=${named.length} ok=${cands.length}`);
  writeFileSync(out, JSON.stringify(results, null, 1));
}
