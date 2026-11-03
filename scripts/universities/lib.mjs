/**
 * Shared plumbing for the V20 university research pipeline (brief §41).
 *
 * Everything here is deliberately dependency-free: this runs offline/admin, in CI and on a laptop, and a
 * research pipeline that needs an install step is one nobody re-runs. No public request path ever reaches
 * any of it — the output is a committed JSON file that the seeder reads (§46).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_PATH = join(ROOT, 'server/app/data/university_content.json');
export const REGISTRY_PATH = join(ROOT, 'server/app/data/korean_institutions.json');
export const ENRICHMENT_PATH = join(ROOT, 'server/app/data/university_enrichment.json');

/** Identifies us, carries a contact, and is the string a site owner would see in their logs. */
export const UA = 'HangyulUnivBot/1.0 (+https://talkhangyul.com; study-abroad directory; contact support@talkhangyul.com)';

export const TODAY = new Date().toISOString().slice(0, 10);

export const readJson = (p, fallback = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
export const writeJson = (p, data) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, `${JSON.stringify(data, null, 1)}\n`); };

export function registry() { return readJson(REGISTRY_PATH).institutions; }
export function enrichment() { return (readJson(ENRICHMENT_PATH, { records: {} }).records) ?? {}; }

/** The canonical content document. One record per slug; every value carries its own provenance. */
export function content() {
  return readJson(CONTENT_PATH, {
    _generated_by: 'scripts/universities/*',
    generated_at: TODAY,
    institutions: 0,
    records: {},
  });
}
export function saveContent(doc) {
  doc.generated_at = TODAY;
  doc.institutions = Object.keys(doc.records).length;
  writeJson(CONTENT_PATH, doc);
}

/* ------------------------------------------------------------------------------------------ networking */

export async function get(url, { timeout = 15000, accept = 'text/html,*/*' } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'ko,en;q=0.8' } });
    if (!res.ok) return { ok: false, status: res.status, url: res.url };
    const buf = Buffer.from(await res.arrayBuffer());
    // Korean university sites still serve EUC-KR more often than anyone would guess. Decode by the
    // declared charset or the response header, not by hope: mojibake here becomes mojibake on the page.
    const head = buf.subarray(0, 4096).toString('latin1');
    const declared = (/charset\s*=\s*["']?([\w-]+)/i.exec(res.headers.get('content-type') ?? '') ?? /charset\s*=\s*["']?([\w-]+)/i.exec(head) ?? [])[1];
    const enc = (declared ?? 'utf-8').toLowerCase().replace('ks_c_5601-1987', 'euc-kr');
    let text;
    try { text = new TextDecoder(enc === 'utf8' ? 'utf-8' : enc).decode(buf); }
    catch { text = buf.toString('utf8'); }
    return { ok: true, status: res.status, url: res.url, text };
  } catch (e) {
    return { ok: false, status: 0, url, error: String(e).slice(0, 120) };
  } finally { clearTimeout(timer); }
}

/**
 * robots.txt, honoured. §6 says do not scrape arbitrary websites; this reads one site — the institution's
 * own — and only the paths that site says a robot may read. A site we cannot read is recorded as such.
 */
const robotsCache = new Map();
export async function allowed(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const origin = u.origin;
  if (!robotsCache.has(origin)) {
    const r = await get(`${origin}/robots.txt`, { timeout: 8000, accept: 'text/plain' });
    robotsCache.set(origin, r.ok ? parseRobots(r.text) : []);
  }
  const rules = robotsCache.get(origin);
  const path = u.pathname + u.search;
  let verdict = true; let best = -1;
  for (const [kind, pattern] of rules) {
    if (!path.startsWith(pattern)) continue;
    if (pattern.length > best) { best = pattern.length; verdict = kind === 'allow'; }
  }
  return verdict;
}

/** Only the groups that apply to us: our own token and `*`. Longest-match wins, Allow beats Disallow. */
export function parseRobots(text) {
  const rules = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') { applies = value === '*' || /hangyul/i.test(value); continue; }
    if (!applies) continue;
    if (key === 'disallow' && value) rules.push(['disallow', value]);
    if (key === 'allow' && value) rules.push(['allow', value]);
  }
  return rules;
}

/* -------------------------------------------------------------------------------------- HTML, minimally */

/** Scripts, styles and comments out; tags to line breaks; entities decoded; whitespace collapsed. */
export function plainText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td|dd|dt)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/**
 * The page with its chrome removed, which is what a statement has to be found in.
 *
 * Whole-page text puts the global navigation, the skip links, the language switcher and the footer in
 * front of the content, and every Korean university template lists 건학이념 / 교육이념 / 교육목표 as
 * sibling menu items — so a regex looking for a heading finds the *menu* first, every time. Dropping the
 * obvious chrome containers before the text is extracted is the difference between a statement and a
 * list of other pages. It is deliberately conservative: it removes elements whose own tag or class says
 * what they are, and nothing on a guess about position.
 */
export function mainText(html) {
  const stripped = html
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    // class/id tokens every one of these templates uses for chrome
    .replace(/<(div|ul|section|form)\b[^>]*\b(?:class|id)\s*=\s*["'][^"']*\b(gnb|lnb|snb|nav|navi|menu|header|footer|breadcrumb|sitemap|quick|skip|search|language|lang-?select|util|top-?banner|popup|layer)\b[^"']*["'][\s\S]{0,40000}?<\/\1>/gi, ' ');
  const text = plainText(stripped);
  // If stripping removed almost everything the page was one big chrome container; fall back rather than
  // report an empty page.
  return text.length > 200 ? text : plainText(html);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Every `<a>` as `{ href, text }`, resolved against the page it came from. */
export function links(html, baseUrl) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    let href;
    try { href = new URL(decodeEntities(m[1]), baseUrl).toString(); } catch { continue; }
    if (!/^https?:/i.test(href)) continue;
    out.push({ href, text: plainText(m[2]).slice(0, 120) });
  }
  return out;
}

/** Bounded-concurrency map that never rejects: a failed item resolves to its error. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      try { out[idx] = await fn(items[idx], idx); } catch (e) { out[idx] = { error: String(e).slice(0, 160) }; }
    }
  }));
  return out;
}

export function progress(done, total, label) {
  if (done % 25 === 0 || done === total) process.stdout.write(`\r  ${label} ${done}/${total}   `);
  if (done === total) process.stdout.write('\n');
}
