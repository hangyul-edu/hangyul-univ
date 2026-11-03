/**
 * V22 — read each institution's **own** website, wider and deeper than V20 (brief steps C, D, E).
 *
 * V20 read one page (the homepage) plus the philosophy page it linked to. Korean university homepages
 * are increasingly a carousel and a login box; the links this pipeline needs live on the **sitemap**,
 * on the 대학소개 landing page and in the **footer of the international office's own site**. So this
 * reads, per institution and in this order, at most six pages, all on the institution's own origin or
 * a same-institution subdomain, all after `robots.txt`:
 *
 *   homepage → sitemap (if linked) → 대학소개 / About (if linked) → the 교육이념·건학이념·비전 page →
 *   the international office page → an English-language landing page (if linked)
 *
 * From those pages it extracts, with the page each came from:
 *
 *   • official destinations — international office, (international) admissions, dormitory;
 *   • YouTube channel links in the markup (`youtube.com/@…`, `/channel/UC…`, `/c/…`, `/user/…`), which
 *     is the ownership evidence `v22-verify-youtube.mjs` then confirms (step C);
 *   • the philosophy page's **verbatim** statements under 건학이념 / 교육이념 / 교육목표 / 비전 / 교훈 /
 *     인재상 headings, recorded as SOURCED_UNREVIEWED quotes — never paraphrased here (step E).
 *
 * Websites come from the registry first, then Wikidata P856 (`v22-wikidata.mjs`), which covers 348 of
 * the 425 against the registry's 281. A site that forbids robots, a site that cannot be reached and a
 * site that has none of this are recorded as three different outcomes.
 *
 * A site that answers 403/406 to the identified bot UA is retried once with a browser UA. robots.txt is
 * honoured in both cases — the policy document is robots.txt, not a WAF default — and the fallback is
 * recorded on the result.
 *
 * Output: `server/app/data/raw/v22_official.json`. Nothing is written to the content record here.
 *
 *   node scripts/universities/v22-research-official.mjs [--only slug,…] [--concurrency 4] [--limit N]
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { cleanStatement, plausibleDestination } from './v22-statements.mjs';
import { allowed, content, decodeEntities, pool, progress, readJson, registry, ROOT, TODAY, UA, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const LIMIT = Number(flag('--limit', '0')) || 0;
const CONCURRENCY = Math.min(4, Number(flag('--concurrency', '4')));

const WD_RAW = join(ROOT, 'server/app/data/raw/v22_wikidata.json');
const OUT = join(ROOT, 'server/app/data/raw/v22_official.json');
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* ----------------------------------------------------------------------------------------- fetching */

async function getAs(url, ua, timeout = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': ua, Accept: 'text/html,*/*', 'Accept-Language': 'ko,en;q=0.8' } });
    if (!/html|xml|text\/plain/i.test(res.headers.get('content-type') ?? 'text/html')) return { ok: false, status: 415, url: res.url };
    if (!res.ok) return { ok: false, status: res.status, url: res.url };
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.subarray(0, 4096).toString('latin1');
    const declared = (/charset\s*=\s*["']?([\w-]+)/i.exec(res.headers.get('content-type') ?? '') ?? /charset\s*=\s*["']?([\w-]+)/i.exec(head) ?? [])[1];
    const enc = (declared ?? 'utf-8').toLowerCase().replace('ks_c_5601-1987', 'euc-kr').replace(/^utf8$/, 'utf-8');
    let text;
    try { text = new TextDecoder(enc).decode(buf); } catch { text = buf.toString('utf8'); }
    return { ok: true, status: res.status, url: res.url, text };
  } catch (e) {
    return { ok: false, status: 0, url, error: `${e?.cause?.code ?? ''} ${String(e?.cause?.message ?? e)}`.slice(0, 160) };
  } finally { clearTimeout(timer); }
}

const execFileP = promisify(execFile);
/**
 * Many Korean university servers send an incomplete certificate chain, which Node refuses outright
 * (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). The page is public and only links and text are read from it, so
 * such a site is re-read through curl without chain verification, and the result records `tls_fallback`.
 */
async function getViaCurl(url, ua, timeout = 20000) {
  try {
    const { stdout } = await execFileP('curl', ['-skL', '-m', String(Math.round(timeout / 1000)), '-A', ua, '-H', 'Accept-Language: ko,en;q=0.8', '--compressed', '-w', '\n@@HG@@%{http_code}@@%{url_effective}@@%{content_type}', url], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, timeout: timeout + 5000 });
    const buf = Buffer.from(stdout);
    const tailIdx = buf.lastIndexOf('\n@@HG@@');
    if (tailIdx < 0) return { ok: false, status: 0, url, error: 'curl: no trailer' };
    const [, code, effective, ctype] = buf.subarray(tailIdx + 1).toString('utf8').split('@@');
    const body = buf.subarray(0, tailIdx);
    const status = Number(code);
    if (status < 200 || status >= 300) return { ok: false, status, url: effective || url };
    const head = body.subarray(0, 4096).toString('latin1');
    const declared = (/charset\s*=\s*["']?([\w-]+)/i.exec(ctype ?? '') ?? /charset\s*=\s*["']?([\w-]+)/i.exec(head) ?? [])[1];
    const enc = (declared ?? 'utf-8').toLowerCase().replace('ks_c_5601-1987', 'euc-kr').replace(/^utf8$/, 'utf-8');
    let text;
    try { text = new TextDecoder(enc).decode(body); } catch { text = body.toString('utf8'); }
    return { ok: true, status, url: effective || url, text, tls_fallback: true };
  } catch (e) { return { ok: false, status: 0, url, error: `curl: ${String(e).slice(0, 80)}` }; }
}
const TLS_ERR = /CERT|UNABLE_TO_VERIFY|SSL|TLS|EPROTO|HANDSHAKE|certificate/i;

/** Identified UA first; browser UA only when the identified one is refused by a WAF. */
async function fetchPage(url, state) {
  if (!(await allowed(url))) return { ok: false, status: 'ROBOTS' };
  let r = await getAs(url, UA);
  if (!r.ok && r.status === 0 && TLS_ERR.test(r.error ?? '')) {
    const viaCurl = await getViaCurl(url, UA);
    if (viaCurl.ok) { state.tls_fallback = true; r = viaCurl; }
  }
  if (!r.ok && [403, 406, 429, 503, 0].includes(r.status)) {
    const retry = await getAs(url, BROWSER_UA);
    if (retry.ok) { state.ua_fallback = true; r = retry; }
  }
  // `<script>location.href="/kor"</script>` and `<meta http-equiv="refresh">` landing pages: follow, twice at most.
  for (let hop = 0; hop < 2 && r.ok && r.text.length < 2500; hop += 1) {
    const m = /(?:location(?:\.href)?\s*=\s*|location\.replace\(\s*|http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url\s*=\s*)["']?([^"'\s;>]+)/i.exec(r.text);
    if (!m) break;
    let next;
    try { next = new URL(decodeEntities(m[1]), r.url).toString(); } catch { break; }
    if (next === r.url || !(await allowed(next))) break;
    const hopped = await getAs(next, state.ua_fallback ? BROWSER_UA : UA);
    if (!hopped.ok) break;
    r = hopped;
  }
  return r;
}

/* ---------------------------------------------------------------------------------------- HTML text */

/** Tags removed with awareness of quoted attribute values, so `onclick="…'>…"` cannot leak JS into text. */
const TAG = /<\/?[a-zA-Z!][^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g;
function textOf(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|iframe|select|form)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td|dd|dt|blockquote|figcaption)>/gi, '\n')
      .replace(TAG, ' '),
  ).replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
/** Like `mainTextOf`, but heading elements are fenced so a statement is read from a **heading**, not from a word mid-sentence. */
function markedTextOf(html) {
  const marked = html
    .replace(/<(h[1-6]|dt|th|strong|b|em|legend|caption)\b[^>]*>/gi, '\n§H§')
    .replace(/<\/(h[1-6]|dt|th|strong|b|em|legend|caption)>/gi, '§/H§\n')
    .replace(/<(p|span|div|li)\b[^>]*\b(?:class|id)\s*=\s*["'][^"']*\b(tit|title|subject|sub-?tit|stit|h-?tit|heading|headline|cont-?tit|box-?tit|txt-?tit|ideology-?tit|vision-?tit)\b[^"']*["'][^>]*>/gi, '\n§H§')
    .replace(/§H§([^§]{0,120}?)<\/(p|span|div|li)>/gi, '§H§$1§/H§\n');
  return mainTextOf(marked);
}
function mainTextOf(html) {
  const stripped = html
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(div|ul|section|form)\b[^>]*\b(?:class|id)\s*=\s*["'][^"']*\b(gnb|lnb|snb|nav|navi|menu|header|footer|breadcrumb|sitemap|quick|skip|search|language|lang-?select|util|top-?banner|popup|layer|sns|share)\b[^"']*["'][\s\S]{0,40000}?<\/\1>/gi, ' ');
  const t = textOf(stripped);
  return t.length > 200 ? t : textOf(html);
}
function linksOf(html, baseUrl) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
    let href;
    try { href = new URL(decodeEntities(m[1]).trim(), baseUrl).toString(); } catch { continue; }
    if (!/^https?:/i.test(href)) continue;
    const inner = m[2];
    const alt = [...inner.matchAll(/\b(?:alt|title)\s*=\s*["']([^"']*)["']/gi)].map((x) => x[1]).join(' ');
    out.push({ href, text: `${textOf(inner)} ${decodeEntities(alt)}`.replace(/\s+/g, ' ').trim().slice(0, 160) });
  }
  return out;
}

/* ------------------------------------------------------------------------------------- vocabulary */

const WANTED = {
  sitemap: { anchor: /사이트\s*맵|사이트\s*지도|전체\s*메뉴|sitemap|site map/i, href: /sitemap|site_?map|allmenu|all_?menu|totalmenu/i },
  about: { anchor: /^(대학\s*소개|학교\s*소개|대학교\s*소개|대학원\s*소개|about(\s+us|\s+the\s+university)?|소개)$/i, href: /\/(about|intro|introduction|univ_?intro|university|info|about_?us)\b/i },
  philosophy: {
    anchor: /건학\s*이념|교육\s*이념|창학\s*정신|건학\s*정신|설립\s*이념|대학\s*이념|교육\s*목표|교육\s*목적|비전\s*(및|과)?\s*(미션|목표)?|미션\s*(및|과)?\s*비전|인재상|교훈|이념\s*및|philosoph|mission|vision|founding (spirit|principle)/i,
    href: /ideolog|philosoph|mission|vision|founding|ideal|spirit|purpose|objective|motto/i,
  },
  international: {
    anchor: /국제\s*(교류|협력|처|센터|교육|본부|교류원|교류처|교류팀|교류센터|교류본부|협력처|협력팀|협력단|어학|언어)|국제화|글로벌\s*(센터|교류|교육|협력|본부|처|원)|International (Office|Affairs|Center|Centre|Students?|Exchange|Cooperation|Relations|Program)|Office of International|Global (Office|Center|Centre|Affairs|Education|Cooperation)|외국인\s*유학생|유학생\s*(지원|센터|안내)/i,
    href: /\b(oia|intl|international|global|exchange|foreign|kic|gec|oiae|oice|cie|ipsi\/foreign)\b/i,
  },
  admissions: {
    anchor: /외국인\s*(특별)?\s*(전형|입학|신입생|편입)|국제\s*입학|유학생\s*(입학|모집|전형)|입학\s*(안내|정보|홈페이지)|입학처|입학\s*본부|입시\s*(안내|정보|홈페이지)|Admissions?( Guide| Information| Office)?|How to Apply|Apply Now|International Admission/i,
    href: /admiss|ipsi|iphak|enter|apply|recruit|entrance/i,
  },
  dormitory: {
    anchor: /기숙사|생활관|학생\s*생활관|행복\s*기숙사|글로벌\s*하우스|국제\s*학사|학사\b|생활\s*관|Dormitor(y|ies)|Residence Hall|Student Housing|Housing|Accommodation/i,
    href: /dorm|housing|residen|saenghwal|dormitory|house|living/i,
  },
  english: { anchor: /^(english|eng|영어|english site|english version)$/i, href: /\/(eng|en|english|english_?site)(\/|\b|\.|$)/i },
};

const PHILOSOPHY_HEADS = [
  '건학이념', '건학 이념', '교육이념', '교육 이념', '창학정신', '창학 정신', '건학정신', '건학 정신', '설립이념', '설립 이념',
  '교육목표', '교육 목표', '교육목적', '교육 목적', '대학이념', '대학 이념', '교훈', '비전', 'VISION', 'Vision', '미션', 'MISSION', 'Mission', '인재상', '핵심가치',
  'Educational Philosophy', 'Founding Philosophy', 'Founding Spirit', 'Educational Ideology', 'Educational Goals', 'Educational Objectives',
  'Mission Statement', 'Our Mission', 'Vision and Mission', 'Mission and Vision', 'Motto',
];
const KIND_OF = (h) => (/건학|창학|설립|founding/i.test(h) ? 'founding' : /교육\s*(이념|목표|목적)|educational/i.test(h) ? 'educational' : /비전|vision/i.test(h) ? 'vision' : /미션|mission/i.test(h) ? 'mission' : /교훈|motto/i.test(h) ? 'motto' : /인재상/.test(h) ? 'talent_profile' : /핵심가치/.test(h) ? 'core_values' : /대학\s*이념/.test(h) ? 'identity' : 'other');
const CHROME = /로그인|사이트맵|바로가기|검색|전체메뉴|퀵메뉴|개인정보|이메일무단|Copyright|All rights|Skip to|이전\s*다음|더보기|메뉴|location\.href|javascript|function\s*\(|\{|\}|=>|onclick|window\.|document\.|\.do\b|\.jsp|\.php|http|www\./i;
const PROSE = /(다|함|임|음|한다|입니다|합니다|이다|라|자|것|함양|양성|구현|실현|추구|지향|기여|육성|배양|인재|정신|교육|사람)[.。!]?\s*$|^[「『"'“‘][^」』"'”’]{4,}[」』"'”’]|[A-Za-z]{3,}\s+(is|are|to|of|for|and|which|that|we|our|who|with)\s+[A-Za-z]{3,}|[가-힣]{2,}[,·]\s*[가-힣]{2,}[,·]\s*[가-힣]{2,}/;

/**
 * Verbatim statements under the philosophy headings. Pessimistic by design (V20's lessons kept): a
 * candidate on a page the homepage pointed at; no sibling heading inside it; no chrome vocabulary or
 * script fragments; reads as prose or a quoted motto or a list of values; 8–400 characters.
 */
/** Cut a body at the last sentence end before `max`, or at `max`; a quote never ends mid-word if it can help it. */
function cutQuote(body, max = 400) {
  if (body.length <= max) return body;
  const head = body.slice(0, max);
  const ends = [...head.matchAll(/[.。!?]["'”’」』]?\s|다\s|다$|[.。]$/g)].map((m) => m.index + m[0].length);
  const last = ends.filter((i) => i >= 40).pop();
  return (last ? head.slice(0, last) : head).trim();
}
/** A block whose first lines are all short is a menu or a figure caption list, not a statement. */
const looksLikeMenu = (lines) => lines.slice(0, 4).filter((l) => l.length < 10).length >= 3;

const SENTENCE_END = /([.。!?]["'”’」』]?|다|함|임|음|라|것)$/;
function acceptBody(head, heads, lines) {
  if (looksLikeMenu(lines)) return null;
  // Take whole lines while the statement is still short or still mid-sentence; stop at the first short
  // fragment once there is a statement — the figure captions and value lists under it are not the quote.
  const kept = [];
  let len = 0;
  for (const l of lines) {
    if (len >= 40 && l.length < 12) break;
    kept.push(l); len += l.length + 1;
    if (len >= 60 && SENTENCE_END.test(l)) break;
    if (len >= 700) break;
  }
  const body = kept.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (body.length < 8) return null;
  if (CHROME.test(body.slice(0, 600))) return null;
  if (!/[가-힣]{2,}|[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(body)) return null;
  if (!PROSE.test(body.slice(0, 600)) && !PROSE.test(cutQuote(body))) return null;
  // A sibling heading as the *start* of the body is a menu; inside a sentence it is just a word.
  if (heads.some((h) => h !== head && h.length > 2 && body.startsWith(h))) return null;
  return cutQuote(body);
}

/**
 * Verbatim statements under the philosophy headings. Pessimistic by design (V20's lessons kept): a
 * candidate on a page the homepage pointed at; read from a fenced **heading**, not from a word
 * mid-sentence; no chrome vocabulary or script fragments; not a menu; reads as prose, a quoted motto
 * or a list of values; cut at a sentence end, at most 400 characters.
 */
function extractStatements(text) {
  const heads = PHILOSOPHY_HEADS.slice().sort((a, b) => b.length - a.length);
  const out = [];
  const seenKinds = new Set();
  const push = (kind, heading, quote) => { if (!seenKinds.has(kind)) { seenKinds.add(kind); out.push({ kind, heading, quote }); } };
  // Pass 1 — fenced headings: `§H§교육이념§/H§` followed by content up to the next fenced heading.
  for (const m of text.matchAll(/§H§([^§]{1,40})§\/H§([^§]{8,1500})/g)) {
    const hText = m[1].replace(/\s+/g, ' ').trim();
    const hNorm = hText.replace(/\s+/g, '');
    const head = heads.find((h) => { const n = h.replace(/\s+/g, ''); return hNorm === n || (hNorm.startsWith(n) && hNorm.length <= n.length + 6) || (hNorm.endsWith(n) && hNorm.length <= n.length + 4); });
    if (!head) continue;
    const lines = m[2].split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
    const quote = acceptBody(head, heads, lines);
    if (quote) push(KIND_OF(head), hText, quote);
    if (out.length >= 4) return out;
  }
  text = text.replace(/§\/?H§/g, '');
  // Pass 2 — a heading on its own line, for pages whose templates use no heading elements.
  for (const head of heads) {
    let from = 0;
    for (let guard = 0; guard < 5 && out.length < 4; guard += 1) {
      const i = text.indexOf(head, from);
      if (i < 0) break;
      from = i + head.length;
      const before = text.slice(Math.max(0, i - 2), i);
      const afterCh = text.slice(from, from + 1);
      if (/[가-힣A-Za-z]/.test(before.slice(-1)) || /[가-힣A-Za-z]/.test(afterCh)) continue;
      if (!/\n\s*$/.test(text.slice(Math.max(0, i - 6), i)) && i !== 0) continue;   // must start a line
      const after = text.slice(from, from + 1500).replace(/^[\s:：|·\-–—>»]+/, '');
      const lines = [];
      for (const l of after.split('\n').map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 8)) {
        if (heads.some((h) => l === h || l.startsWith(`${h} `) || l.startsWith(`${h}:`))) break;
        lines.push(l);
      }
      const quote = acceptBody(head, heads, lines);
      if (quote) { push(KIND_OF(head), head, quote); break; }
    }
  }
  return out;
}

const YT = /https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:channel\/UC[\w-]{20,24}|@[\w.\-%]{2,80}|c\/[\w.\-%]{2,80}|user\/[\w.\-%]{2,80})/ig;

function sameInstitution(href, homeUrl) {
  try {
    const a = new URL(href).hostname.replace(/^www\./, '');
    const b = new URL(homeUrl).hostname.replace(/^www\./, '');
    const root = (h) => h.split('.').slice(-3).join('.');
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`) || root(a) === root(b);
  } catch { return false; }
}

function pickLink(all, homeUrl, kind, exclude = new Set()) {
  const { anchor, href } = WANTED[kind];
  const own = all.filter((l) => sameInstitution(l.href, homeUrl) && !exclude.has(l.href) && !/\.(pdf|hwp|docx?|xlsx?|zip|jpg|png)$/i.test(l.href));
  // A short anchor that *is* the word ("기숙사", "International Office") beats a sentence that contains it.
  return own.find((l) => l.text && l.text.length <= 16 && anchor.test(l.text))?.href
    ?? own.find((l) => l.text && anchor.test(l.text))?.href
    ?? own.find((l) => href.test(l.href) && (anchor.test(l.href) || anchor.test(l.text)))?.href
    ?? null;
}

/* --------------------------------------------------------------------------------------------- run */

const insts = registry();
const doc = content();
const wd = readJson(WD_RAW, { records: {} }).records ?? {};

function homeOf(inst) {
  const reg = inst.website_url || doc.records[inst.slug]?.website_url;
  const wdSites = (wd[inst.slug]?.websites ?? []).filter((u) => /^https?:/.test(u));
  return { home: reg || wdSites[0] || null, source: reg ? 'registry' : wdSites[0] ? 'wikidata:P856' : null, alternates: wdSites.filter((u) => u !== reg) };
}

async function research(inst) {
  const { home, source, alternates } = homeOf(inst);
  const out = { slug: inst.slug, checked: TODAY, website_source: source, pages_read: 0, pages: [] };
  if (!home) { out.status = 'NO_WEBSITE'; return out; }
  out.website = home;
  const state = {};
  const tried = new Set();
  let first = null;
  for (const url of [home, home.replace(/^http:/, 'https:'), new URL(home).origin, ...alternates.slice(0, 2)]) {
    if (tried.has(url)) continue;
    tried.add(url);
    const r = await fetchPage(url, state);
    out.pages_read += 1;
    if (r.status === 'ROBOTS') { out.robots_blocked = (out.robots_blocked ?? 0) + 1; continue; }
    if (r.ok && r.text.length > 300) { first = r; break; }
    out.last_error = r.error ?? `HTTP ${r.status}`;
  }
  if (!first) { out.status = out.robots_blocked === tried.size ? 'ROBOTS_DISALLOWED' : 'UNREACHABLE'; return out; }
  out.resolved_home = first.url;
  const base = first.url;
  const pagesHtml = [{ url: base, html: first.text, role: 'home' }];
  const all = linksOf(first.text, base);
  const read = new Set([base]);

  const readOne = async (url, role) => {
    if (!url || read.has(url) || out.pages_read >= 7) return null;
    read.add(url);
    const r = await fetchPage(url, state);
    out.pages_read += 1;
    if (!r.ok) return null;
    pagesHtml.push({ url: r.url, html: r.text, role });
    all.push(...linksOf(r.text, r.url));
    return r;
  };

  await readOne(pickLink(all, base, 'sitemap'), 'sitemap');
  if (!pickLink(all, base, 'philosophy')) await readOne(pickLink(all, base, 'about'), 'about');
  const philosophyUrl = pickLink(all, base, 'philosophy');
  const philPage = await readOne(philosophyUrl, 'philosophy');
  const intlUrl = pickLink(all, base, 'international');
  await readOne(intlUrl, 'international');
  if (!pickLink(all, base, 'admissions') || !pickLink(all, base, 'dormitory')) await readOne(pickLink(all, base, 'english'), 'english');

  out.links = {
    international: intlUrl ?? pickLink(all, base, 'international'),
    admissions: pickLink(all, base, 'admissions'),
    dormitory: pickLink(all, base, 'dormitory'),
    philosophy: philosophyUrl,
  };
  for (const k of Object.keys(out.links)) if (!out.links[k] || !plausibleDestination(out.links[k], base)) delete out.links[k];

  // YouTube, from the institution's own markup on any page read.
  const yt = new Map();
  for (const p of pagesHtml) for (const m of p.html.matchAll(YT)) { const u = m[0].split('?')[0].replace(/^http:/, 'https:').replace('//m.', '//www.'); if (!yt.has(u)) yt.set(u, p.url); }
  if (yt.size) out.youtube_links = [...yt].slice(0, 6).map(([url, found_on]) => ({ url, found_on }));

  // Verbatim statements from the philosophy page (never from the homepage).
  if (philPage?.ok) {
    const statements = extractStatements(markedTextOf(philPage.text)).map((s) => ({ ...s, quote: cleanStatement(s.quote, s.kind) })).filter((s) => s.quote);
    if (process.env.V22_DEBUG) console.log(`\n#### ${philPage.url}\n${markedTextOf(philPage.text).slice(0, 3500)}\n####`);
    if (statements.length) out.statements = statements.map((s) => ({ ...s, source_url: philPage.url, fetched_at: TODAY }));
  }
  if (state.ua_fallback) out.ua_fallback = true;
  if (state.tls_fallback) out.tls_fallback = true;
  out.pages = pagesHtml.map((p) => ({ role: p.role, url: p.url }));
  out.status = 'OK';
  return out;
}

let targets = insts;
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);
console.log(`V22 official-site research — ${targets.length} institutions (${targets.filter((i) => homeOf(i).home).length} with a website)`);

let done = 0;
const results = await pool(targets, CONCURRENCY, async (inst) => {
  const r = await research(inst).catch((e) => ({ slug: inst.slug, status: 'ERROR', detail: String(e).slice(0, 120), checked: TODAY }));
  progress(++done, targets.length, 'read');
  return r;
});

const prior = readJson(OUT, { records: {} }).records ?? {};
const records = ONLY.length || LIMIT ? { ...prior } : {};
for (const r of results) if (r?.slug) records[r.slug] = r;
writeJson(OUT, { _generated_by: 'scripts/universities/v22-research-official.mjs', generated_at: TODAY, institutions: Object.keys(records).length, records });

const rs = Object.values(records);
const tally = {};
for (const r of rs) tally[r.status] = (tally[r.status] ?? 0) + 1;
const got = (f) => rs.filter(f).length;
console.log(`\n  status: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  website from wikidata only      ${got((r) => r.website_source === 'wikidata:P856')}`);
console.log(`  international office            ${got((r) => r.links?.international)}`);
console.log(`  admissions                      ${got((r) => r.links?.admissions)}`);
console.log(`  dormitory                       ${got((r) => r.links?.dormitory)}`);
console.log(`  philosophy page located         ${got((r) => r.links?.philosophy)}`);
console.log(`  verbatim statements captured    ${got((r) => r.statements?.length)}`);
console.log(`  youtube link on own site        ${got((r) => r.youtube_links?.length)}`);
console.log(`  browser-UA fallback used        ${got((r) => r.ua_fallback)}`);
console.log(`  TLS-chain fallback (curl) used  ${got((r) => r.tls_fallback)}`);
console.log(`  → server/app/data/raw/v22_official.json\n`);
