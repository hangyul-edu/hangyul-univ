/**
 * V24 — 공공누리 (KOGL) Type 1 on NATIONAL/PUBLIC institutions' own sites.
 *
 * robots.txt honoured (lib.mjs `allowed`). Homepage → up to 10 same-origin pages whose link text says campus /
 * view / tour / gallery / photo / facilities. On each page the KOGL mark is read from the page itself (an
 * <img> whose src or alt says 공공누리/KOGL/opentype, or the text "공공누리 제N유형"); the type is recorded
 * with the evidence (mark URL + alt). Only Type 1 pages are kept; their content images are listed for
 * review (src, alt, page). Nothing is accepted here automatically — see v24-assemble for the verdict.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { get, allowed, links, decodeEntities } from './lib.mjs';

const [queuePath, out] = process.argv.slice(2);
const queue = JSON.parse(readFileSync(queuePath, 'utf8')).filter((q) => q.establishment !== 'PRIVATE');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WANT = /캠퍼스|전경|투어|갤러리|포토|사진|홍보|교정|시설|둘러보기|campus|tour|gallery|photo/i;
function kogl(html, base) {
  const marks = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /src\s*=\s*["']([^"']+)/i.exec(tag)?.[1] ?? '';
    const alt = decodeEntities(/alt\s*=\s*["']([^"']*)/i.exec(tag)?.[1] ?? '');
    if (/kogl|opentype|open_type|img_open|공공누리|codetype|copyright/i.test(src + alt) && /공공누리|kogl|opentype|유형|type/i.test(src + alt)) {
      let abs = src; try { abs = new URL(src, base).toString(); } catch {}
      const t = /제?\s*([1-4])\s*유형|type\s*0?([1-4])|opentype0?([1-4])|open0?([1-4])|kogl0?([1-4])|img_opentype0?([1-4])|type([1-4])/i.exec(src + ' ' + alt);
      marks.push({ src: abs, alt, type: t ? Number(t.slice(1).find(Boolean)) : null });
    }
  }
  const textType = /공공누리\s*(?:공공저작물\s*자유이용허락\s*)?제\s*([1-4])\s*유형/.exec(html.replace(/<[^>]+>/g, ' '))?.[1];
  return { marks, textType: textType ? Number(textType) : null };
}
function images(html, base) {
  const outp = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /src\s*=\s*["']([^"']+)/i.exec(m[0])?.[1]; if (!src || /^data:/.test(src)) continue;
    const alt = decodeEntities(/alt\s*=\s*["']([^"']*)/i.exec(m[0])?.[1] ?? '');
    let abs; try { abs = new URL(src, base).toString(); } catch { continue; }
    if (/logo|icon|btn|bul|arrow|kogl|opentype|banner|sns|blank|spacer|\.gif$|\.svg$/i.test(abs)) continue;
    outp.push({ src: abs, alt });
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)/gi)) { try { outp.push({ src: new URL(m[1], base).toString(), alt: '(css background)' }); } catch {} }
  return outp;
}
const results = [];
for (const it of queue) {
  const attempts = []; const pages = [];
  if (!it.website) { results.push({ slug: it.slug, attempts: [{ route: 'kogl', query_or_url: null, result_count: 0, outcome: 'no official website on record (registry or Wikidata P856)' }], pages }); continue; }
  const home = it.website;
  if (!(await allowed(home))) { results.push({ slug: it.slug, attempts: [{ route: 'kogl', query_or_url: home, result_count: 0, outcome: 'robots.txt disallows the homepage for our user agent' }], pages }); continue; }
  let h = await get(home, { timeout: 20000 });
  // JS / meta landing pages (defaultUrl, location.href='…', meta refresh): follow up to two hops on the same site.
  for (let hop = 0; hop < 2 && h.ok && h.text.length < 6000; hop += 1) {
    const m = /defaultUrl\s*:\s*["']([^"']+)/.exec(h.text) ?? /location\.(?:href|replace)\s*(?:=|\()\s*["']([^"']+\.(?:do|9is|htm|html|kunsan|jsp|php)[^"']*)/i.exec(h.text) ?? /http-equiv=["']refresh["'][^>]*url=([^"'>]+)/i.exec(h.text);
    if (!m) break;
    const next = new URL(m[1], h.url).toString();
    if (!(await allowed(next))) break;
    h = await get(next, { timeout: 20000 });
  }
  if (!h.ok) { results.push({ slug: it.slug, attempts: [{ route: 'kogl', query_or_url: home, result_count: 0, outcome: `homepage HTTP ${h.status} ${h.error ?? ''}` }], pages }); continue; }
  const origin = new URL(h.url).origin;
  const cand = [...new Map(links(h.text, h.url).filter((l) => l.href.startsWith(origin) && WANT.test(l.text)).map((l) => [l.href, l])).values()].slice(0, 10);
  if (cand.length < 4) for (const l of links(h.text, h.url)) { if (cand.length >= 10) break; if (l.href.startsWith(origin) && !/javascript|\.(css|js|pdf|hwp|zip)$|login|logout|#/i.test(l.href) && !cand.some((c) => c.href === l.href) && l.href !== h.url) cand.push({ ...l, text: l.text || '(sampled internal page)' }); }
  const hk = kogl(h.text, h.url);
  pages.push({ url: h.url, text: 'homepage', kogl: hk, images: [] });
  for (const l of cand) {
    if (!(await allowed(l.href))) { pages.push({ url: l.href, text: l.text, robots: 'disallowed' }); continue; }
    await sleep(1000);
    const r = await get(l.href, { timeout: 20000 });
    if (!r.ok) { pages.push({ url: l.href, text: l.text, status: r.status }); continue; }
    const k = kogl(r.text, r.url);
    pages.push({ url: r.url, text: l.text, kogl: k, images: (k.marks.some((m) => m.type === 1) || k.textType === 1) ? images(r.text, r.url) : [] });
  }
  const t1 = pages.filter((p) => p.kogl && (p.kogl.marks.some((m) => m.type === 1) || p.kogl.textType === 1));
  const anyMark = pages.filter((p) => p.kogl && (p.kogl.marks.length || p.kogl.textType));
  attempts.push({ route: 'kogl', query_or_url: `${h.url} + ${cand.length} campus/photo pages`, result_count: t1.length, outcome: `${anyMark.length} page(s) carry a KOGL mark (${[...new Set(anyMark.flatMap((p) => [...p.kogl.marks.map((m) => m.type), p.kogl.textType]).filter(Boolean))].join(',') || 'type unreadable'}); ${t1.length} Type 1` });
  results.push({ slug: it.slug, attempts, pages });
  console.log(it.slug, attempts[0].outcome);
}
writeFileSync(out, JSON.stringify(results, null, 1));
