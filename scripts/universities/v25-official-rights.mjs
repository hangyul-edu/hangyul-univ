/**
 * V25 — what each photo-less institution's own website says about reuse (REPORT §318 step 1, brief §5/§8).
 *
 * For every institution still without a photograph: read the official homepage (and its English homepage when one is on
 * record) once, robots.txt honoured, and record the reuse terms the page itself states:
 *   OPEN_KOGL_1      a 공공누리 제1유형 mark (commercial use + change allowed, source credit required)
 *   OPEN_KOGL_OTHER  a 공공누리 mark of type 2–4 (forbids commercial use and/or change — not usable)
 *   OPEN_CC          a Creative Commons licence link
 *   RESERVED         an explicit reservation (무단 전재/재배포 금지, All rights reserved, Copyright ©)
 *   SILENT           no statement (= all rights reserved by default under Korean copyright law)
 *   BLOCKED          robots.txt disallows, or the site did not answer
 * Nothing is downloaded. Output: server/app/data/raw/v25_official_rights.json
 */
import { join } from 'node:path';
import { ROOT, get, readJson, writeJson, registry, allowed } from './lib.mjs';

const OUT = join(ROOT, 'server/app/data/raw/v25_official_rights.json');
const content = readJson(join(ROOT, 'server/app/data/university_content.json')).records;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queue = registry().filter((i) => !content[i.slug]?.media?.hero);

function classify(html) {
  const t = html.replace(/\s+/g, ' ');
  const kogl = /공공누리|kogl|open_?type|img_open/i.test(t);
  const k1 = /제\s*1\s*유형|type\s*0?1\b|opentype0?1|open0?1\.(png|gif|jpg)|kogl0?1/i.test(t);
  const cc = /creativecommons\.org\/licenses\/(by(?!-nc|-nd)[^"' ]*)/i.exec(t);
  const reserved = /무단\s*(전재|복제|배포|도용)|all rights reserved|copyright\s*(©|&copy;|\(c\))/i.test(t);
  if (kogl && k1) return 'OPEN_KOGL_1';
  if (cc) return 'OPEN_CC';
  if (kogl) return 'OPEN_KOGL_OTHER';
  if (reserved) return 'RESERVED';
  return 'SILENT';
}

const records = {};
for (const inst of queue) {
  const rec = content[inst.slug] ?? {};
  const urls = [...new Set([rec.official_site?.url, rec.website_url].filter(Boolean))].slice(0, 2);
  const out = { slug: inst.slug, checked_at: new Date().toISOString().slice(0, 10), pages: [] };
  if (!urls.length) out.outcome = 'NO_SITE_ON_RECORD';
  for (const u of urls) {
    if (!(await allowed(u))) { out.pages.push({ url: u, terms: 'BLOCKED', why: 'robots.txt' }); continue; }
    const r = await get(u, { timeout: 20000 });
    await sleep(800);
    if (!r.ok) { out.pages.push({ url: u, terms: 'BLOCKED', why: `HTTP ${r.status}` }); continue; }
    out.pages.push({ url: r.url, terms: classify(r.text) });
  }
  const order = ['OPEN_KOGL_1', 'OPEN_CC', 'OPEN_KOGL_OTHER', 'RESERVED', 'SILENT', 'BLOCKED'];
  out.outcome ??= order.find((o) => out.pages.some((p) => p.terms === o)) ?? 'BLOCKED';
  records[inst.slug] = out;
  process.stdout.write(`${inst.slug}: ${out.outcome}\n`);
}
writeJson(OUT, { _generated_by: 'scripts/universities/v25-official-rights.mjs', generated_at: new Date().toISOString().slice(0, 10), records });
const c = {}; for (const r of Object.values(records)) c[r.outcome] = (c[r.outcome] ?? 0) + 1;
console.log('done', c);
