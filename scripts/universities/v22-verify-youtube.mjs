/**
 * V22 — official YouTube, verified rather than guessed, for the institutions V21 left without (step C).
 *
 * Nothing here searches YouTube for a university. A channel is considered only when
 *
 *   `own-site`         the institution's **own website** links to it — the evidence collected by
 *                      `v22-research-official.mjs` (homepage, sitemap, about, international office and
 *                      English pages) and by V20's `research-official.mjs`; the page it was found on is
 *                      recorded as `source_url`;
 *   `wikidata:P2397`   the institution's own Wikidata item carries the channel id.
 *
 * …and it is **stored** only when the resolved channel's own title names the institution (stem match
 * on letters; a two-syllable Korean stem additionally needs 대학/univ in the title so 부산대학교 cannot
 * claim a city channel). Sub-unit channels (a language institute, a library, one campus's office) are
 * refused by the same rule unless they carry the institution's name.
 *
 * The **introduction film** is then looked for inside that channel only, in this order:
 *   1. the channel's own featured trailer; 2. the channel's RSS feed of latest uploads
 *   (`feeds/videos.xml?channel_id=…`); 3. the channel's /videos tab; 4. the channel's own search.
 * A video is accepted when its title matches the introduction vocabulary (`PREFER`) and not the
 * avoid-list (`AVOID`) — the same vocabulary `verify-youtube.mjs` uses — **and** YouTube's oEmbed names
 * this channel as the uploader. How each was found is recorded (`video_found_via`).
 *
 * Also re-visits institutions whose V21 channel has no film (CHANNEL_ONLY) with the two new routes.
 *
 * Output: `server/app/data/raw/v22_youtube.json`. `v22-apply.mjs` folds it into the content record.
 *
 *   node scripts/universities/v22-verify-youtube.mjs [--only slug,…] [--concurrency 3] [--limit N]
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { content, decodeEntities, pool, progress, readJson, registry, ROOT, TODAY, writeJson } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const LIMIT = Number(flag('--limit', '0')) || 0;
const CONCURRENCY = Math.min(4, Number(flag('--concurrency', '3')));

const OFFICIAL = join(ROOT, 'server/app/data/raw/v22_official.json');
const WD_RAW = join(ROOT, 'server/app/data/raw/v22_wikidata.json');
const OUT = join(ROOT, 'server/app/data/raw/v22_youtube.json');

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** §16 — what an official introduction is not: verify-youtube.mjs's list, plus what the V22 run let through
 *  (ambassador programmes, one department's promo, a library re-opening, a club sign-up, admission testimonials). */
export const AVOID = /강의|특강|수업|공개강좌|졸업식|학위수여식|수여식|입학식|생중계|실시간|라이브|LIVE|중계|세미나|웨비나|설명회\s*(실황|생)|브이로그|vlog|shorts|합격|수기|후기|채용|총장\s*취임|학술대회|conference|lecture|graduation|commencement|webinar|livestream|뉴스|news|인터뷰|interview|토크|talk|콘서트|concert|축제|festival|응원|cheer|레시피|recipe|먹방|챌린지|challenge|ep\.?\s*\d|\d+\s*화\b|#shorts|홍보대사|홍보단|홍보처|홍보모델|서포터즈|비하인드|behind|학과|[가-힣]{2,}과\s|전공|학부|과정|과목|교육대학원|특수대학원|전문대학원|도서관|박물관|임명식|박람회|사업|콘텐츠|현지|동아리|기숙사|식당|장학|공모|이벤트|행사|발표|시연|강좌|튜토리얼|교수|연구실|연구소|산학|동문|원장|총장님|학장|캐릭터|정책|탄소|접수|수시|정시|전형|ver\)|POV|club|department|dept\.?|program(me)?s?\b|course|curriculum|degree|sign-?up|event|workshop|library|museum|dormitory|scholarship|recruit|hiring|tutorial|guide|episode|part\s*\d|GCA|AIEP|re-?opening|hybrid|learning|AI·XR|school\s+of|college\s+of|faculty|lab\b|professor|alumni|mascot|character|policy|contest|\d(st|nd|rd|th)\s+place|수상|우수상|학회|학생회|연합회|스쿨|총동창회|생활관|광화문|정부|부처|시청|군청|도청/i;
/** …and what one **is**: the institution's own introduction/promotional film, named as such. "홍보" or "소개" alone is not enough. */
export const PREFER = /(대학|학교|대학교|캠퍼스|공식|official|university|college|institute)\s*(소개|홍보)\s*(영상|동영상|필름|video)?|소개\s*(영상|동영상|필름|video)|홍보\s*(영상|동영상|필름|video|movie)|를\s*소개합니다|캠퍼스\s*(투어|소개|영상)|브랜드\s*필름|university\s*(introduction|film|tour|video|promotion)|college\s*(introduction|film|tour|video)|campus\s*tour|about\s+(us|the university|the college)|promotion(al)?\s*(video|film)|brand\s*film|welcome\s+to|PR\s*(video|film|영상)|official\s*(video|film)|introduction\s*(video|film)|intro\s*(video|film)/i;
/** A channel whose title says it is a sub-unit — an admissions office, a student broadcaster, a library, an international office — is not the institution's channel. */
export const SUBUNIT = /입학처|입학\s*홍보|홍보처|방송국|broadcast|도서관|library|박물관|museum|학과|department|전공|학부|college of|school of|국제교류|international|global|어학|language|센터|center|centre|연구소|연구원|lab\b|동아리|club|학생회|총학|student|신문|press|newspaper|산학|평생교육|링크|LINC|RISE|사업단|병원|hospital|의료원/i;
export const GRADUATE_WORD = /대학원(?!대학교|대학$)/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchText(url, { browser = false, timeout = 20000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': browser ? BROWSER_UA : 'HangyulUnivBot/1.0 (+https://talkhangyul.com)', 'Accept-Language': 'ko,en;q=0.8', Cookie: 'CONSENT=YES+cb; SOCS=CAI' } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(timer); }
}

const norm = (s) => (s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

/** A candidate URL → the channel it actually is. */
export async function resolveChannel(url) {
  const html = await fetchText(url, { browser: true });
  if (!html) return null;
  const id = (/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html) ?? /"channelId":"(UC[\w-]{22})"/.exec(html) ?? [])[1];
  if (!id) return null;
  const title = decodeEntities((/<meta property="og:title" content="([^"]*)"/.exec(html) ?? [])[1] ?? '').normalize('NFC');
  const trailer = (/"channelVideoPlayerRenderer":\{"videoId":"([\w-]{11})"/.exec(html) ?? [])[1] ?? null;
  const handle = (/"canonicalBaseUrl":"\/(@[^"\\]+)"/.exec(html) ?? [])[1] ?? null;
  return { id, title, trailer, handle, url: `https://www.youtube.com/channel/${id}` };
}

export async function videoMeta(id) {
  const txt = await fetchText(`https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${id}&format=json`);
  if (!txt) return null;
  // YouTube returns some Korean titles in NFD (decomposed jamo), which no NFC regex can match — normalise first.
  try { const j = JSON.parse(txt); return { title: (j.title ?? '').normalize('NFC'), author: (j.author_name ?? '').normalize('NFC') }; } catch { return null; }
}

/** The channel's own RSS feed: its latest uploads, titles and ids, no scraping. */
async function rssVideos(channelId) {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!xml) return [];
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = (/<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(m[1]) ?? [])[1];
    const title = decodeEntities((/<title>([^<]*)<\/title>/.exec(m[1]) ?? [])[1] ?? '').normalize('NFC');
    if (id) out.push({ id, title });
  }
  return out;
}

/** The channel's /videos tab, read from the page's own initial data. */
async function tabVideos(channelId) {
  const html = await fetchText(`https://www.youtube.com/channel/${channelId}/videos`, { browser: true });
  if (!html) return [];
  const out = [];
  const seen = new Set();
  // Two layouts are in the wild: `videoRenderer` (title.runs[].text) and `lockupViewModel` (title.content).
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) {
    if (seen.has(m[1])) continue;
    const seg = html.slice(m.index, m.index + 3000);
    const t = /"title":\{"content":"((?:[^"\\]|\\.)*)"/.exec(seg) ?? /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(seg) ?? /"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/.exec(seg);
    if (!t) continue;
    seen.add(m[1]);
    let title = t[1];
    try { title = JSON.parse(`"${t[1]}"`); } catch { /* keep raw */ }
    out.push({ id: m[1], title: title.normalize('NFC') });
    if (out.length >= 40) break;
  }
  return out;
}

async function searchVideos(channelId) {
  const out = [];
  for (const query of ['대학 소개영상', '홍보영상', 'university introduction', 'campus tour']) {
    const html = await fetchText(`https://www.youtube.com/channel/${channelId}/search?query=${encodeURIComponent(query)}`, { browser: true });
    if (!html) continue;
    for (const id of [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 6)) out.push({ id, title: null, query });
    await sleep(300);
  }
  return out;
}

const authorMatches = (author, channelTitle) => { const a = norm(author); const c = norm(channelTitle); return !!a && !!c && (a === c || a.includes(c) || c.includes(a)); };

const GENERIC_EN = new Set(['korea', 'korean', 'national', 'university', 'college', 'institute', 'of', 'the', 'and', 'seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'gyeonggi', 'gangwon', 'jeju', 'international', 'graduate', 'school', 'science', 'technology', 'arts', 'education', 'womens', 'women', 'catholic', 'christian', 'theological', 'cyber', 'digital', 'health', 'polytechnic']);
/** Does this channel plausibly belong to this institution — and to the institution itself, not a sub-unit of it? */
export function titleMatches(channelTitle, inst, labelEn) {
  const t = norm(channelTitle);
  if (!t) return false;
  const isGraduate = /대학원/.test(inst.name_ko);
  if (SUBUNIT.test(channelTitle) || (!isGraduate && GRADUATE_WORD.test(channelTitle))) return false;
  const ko = norm(inst.name_ko);
  const enRaw = inst.name_en ?? labelEn ?? '';
  const en = norm(enRaw);
  const koStem = ko.replace(/(대학교|대학원대학교|대학원대학|대학|전문대학|대학원)$/, '');
  const enStem = en.replace(/(university|college|institute|ofscienceandtechnology|graduateschool|graduateuniversity|seminary)$/, '');
  const universityWord = /대학|univ|college|institute|school|seminary|polytech|폴리텍/i.test(channelTitle);
  if (ko.length >= 3 && t.includes(ko)) return true;
  if (en.length >= 5 && t.includes(en)) return true;
  if (koStem.length >= 3 && t.includes(koStem)) return true;
  if (koStem.length === 2 && t.includes(koStem) && universityWord) return true;
  if (enStem.length >= 4 && t.includes(enStem) && (enStem.length >= 7 || universityWord)) return true;
  // "ewhauniv": the first distinctive English word plus a university word.
  const first = enRaw.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC_EN.has(w))[0];
  if (first && t.includes(first) && universityWord) return true;
  // "UNIST", "DGIST", "KAIST": the English name's initials, as a whole word in the title.
  const acronym = enRaw.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w) && !/^(of|and|the|for)$/i.test(w)).map((w) => w[0]).join('');
  if (acronym.length >= 4 && new RegExp(`(^|[^A-Za-z])${acronym}([^A-Za-z]|$)`).test(channelTitle)) return true;
  return false;
}

/** The introduction film, from inside the verified channel only. */
/** Every registry institution's Korean name, longest first, so a title that names *another* institution is refused. */
const ALL_KO = registry().map((i) => i.name_ko.replace(/\s+/g, '')).sort((a, b) => b.length - a.length);
function namesOtherInstitution(title, inst) {
  const t = title.replace(/\s+/g, '');
  const own = inst.name_ko.replace(/\s+/g, '');
  for (const n of ALL_KO) { if (t.includes(n) && n !== own && !own.includes(n) && !n.includes(own)) return true; }
  // "노던애리조나대학교의 …": any other X대학교 token that is not part of our own name.
  for (const m of title.matchAll(/[가-힣A-Za-z]+대학교/g)) { if (!own.includes(m[0].replace(/\s+/g, '')) && m[0] !== '대학교') return true; }
  return false;
}
/** The film has to be about a university at all — "광화문1번가 홍보영상" names no institution and no campus. */
const ABOUT_A_UNIVERSITY = /대학|캠퍼스|학교|university|college|institute|campus|school/i;

export async function findIntro(channel, inst) {
  const isGraduate = /대학원/.test(inst.name_ko);
  // An anniversary film is the institution's only when it is the institution's anniversary (개교/창립), not a college's.
  const ok = (title) => !!title && PREFER.test(title) && !AVOID.test(title) && (isGraduate || !GRADUATE_WORD.test(title))
    && (!/주년|anniversary/i.test(title) || /개교|창립|설립|founding/i.test(title)) && !namesOtherInstitution(title, inst) && ABOUT_A_UNIVERSITY.test(title);
  const confirm = async (id, from, titleHint) => {
    const meta = await videoMeta(id);
    if (!meta) return null;
    if (!ok(meta.title)) return null;
    if (!authorMatches(meta.author, channel.title)) return null;
    return { id, title: meta.title, from };
  };
  if (channel.trailer) { const v = await confirm(channel.trailer, 'trailer'); if (v) return v; }
  for (const v of await rssVideos(channel.id)) { if (ok(v.title)) { const c = await confirm(v.id, 'rss'); if (c) return c; } }
  for (const v of await tabVideos(channel.id)) { if (ok(v.title)) { const c = await confirm(v.id, 'videos-tab'); if (c) return c; } }
  for (const v of await searchVideos(channel.id)) { const c = await confirm(v.id, `search:${v.query}`); if (c) return c; }
  return null;
}

/** Of the resolved candidates, the channel that names the institution itself — own-site evidence first,
 *  then the one whose title is not a campus / library / institute. Exported for V23 (rendered own site). */
export function pickChannel(resolved, inst, labelEn) {
  const named = resolved.filter((r) => titleMatches(r.title, inst, labelEn));
  // Prefer own-site evidence, then the channel whose title is closest to the whole name.
  named.sort((a, b) => (Number(b.via === 'own-site') - Number(a.via === 'own-site')) || (Number(/erica|campus|캠퍼스|library|도서관|institute|어학|language/i.test(a.title)) - Number(/erica|campus|캠퍼스|library|도서관|institute|어학|language/i.test(b.title))));
  return named[0] ?? null;
}

/* --------------------------------------------------------------------------------------------- run */

// Importing this module (V23 does) must not run the V22 pass.
const IS_MAIN = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {

const insts = registry();
const doc = content();
const official = readJson(OFFICIAL, { records: {} }).records ?? {};
const wd = readJson(WD_RAW, { records: {} }).records ?? {};

function candidatesFor(inst) {
  const rec = doc.records[inst.slug] ?? {};
  const out = [];
  for (const l of official[inst.slug]?.youtube_links ?? []) out.push({ url: l.url, via: 'own-site', found_on: l.found_on });
  for (const l of rec.youtube_candidates?.links ?? []) out.push({ url: l, via: 'own-site', found_on: rec.youtube_candidates.found_on });
  for (const id of wd[inst.slug]?.youtube ?? []) out.push({ url: `https://www.youtube.com/channel/${id}`, via: 'wikidata:P2397', found_on: wd[inst.slug].source_url });
  const seen = new Set();
  return out.filter((c) => { const k = c.url.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

let targets = insts.filter((i) => {
  const rec = doc.records[i.slug] ?? {};
  if (rec.youtube?.video_id) return false;                       // settled in V21
  if (rec.youtube?.channel_id) return true;                       // channel, no film: try the new routes
  return candidatesFor(i).length > 0;
});
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);
console.log(`V22 YouTube verification — ${targets.length} institutions to check`);

let done = 0;
const results = await pool(targets, CONCURRENCY, async (inst) => {
  const rec = doc.records[inst.slug] ?? {};
  const out = { slug: inst.slug, checked: TODAY };
  let channel = null;
  if (rec.youtube?.channel_id) {
    channel = { id: rec.youtube.channel_id, title: rec.youtube.channel_title, url: rec.youtube.channel_url, trailer: null, via: rec.youtube.verified_via, source_url: rec.youtube.source_url, kept: true };
  } else {
    const resolved = [];
    const seen = new Set();
    for (const c of candidatesFor(inst).slice(0, 6)) {
      const ch = await resolveChannel(c.url);
      await sleep(250);
      if (!ch || seen.has(ch.id)) continue;
      seen.add(ch.id);
      resolved.push({ ...ch, via: c.via, source_url: c.found_on, candidate_url: c.url });
    }
    out.candidates = resolved.map((r) => ({ id: r.id, title: r.title, via: r.via }));
    channel = pickChannel(resolved, inst, wd[inst.slug]?.label_en);
    if (!channel) { out.status = resolved.length ? 'UNVERIFIED_NAME_MISMATCH' : 'UNRESOLVED'; progress(++done, targets.length, 'verify'); return out; }
  }
  out.channel = { id: channel.id, title: channel.title, url: channel.url ?? `https://www.youtube.com/channel/${channel.id}`, via: channel.via, source_url: channel.source_url, handle: channel.handle ?? null, kept_from_v21: !!channel.kept };
  const video = await findIntro(channel, inst);
  if (video) out.video = video;
  out.status = video ? 'CHANNEL_AND_VIDEO' : 'CHANNEL_ONLY';
  progress(++done, targets.length, 'verify');
  return out;
});

const prior = readJson(OUT, { records: {} }).records ?? {};
const records = ONLY.length || LIMIT ? { ...prior } : {};
for (const r of results) if (r?.slug) records[r.slug] = r;
writeJson(OUT, { _generated_by: 'scripts/universities/v22-verify-youtube.mjs', generated_at: TODAY, institutions: Object.keys(records).length, records });

const rs = Object.values(records);
const tally = {};
for (const r of rs) tally[r.status] = (tally[r.status] ?? 0) + 1;
console.log(`\n  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  new channels via own site      ${rs.filter((r) => r.channel && !r.channel.kept_from_v21 && r.channel.via === 'own-site').length}`);
console.log(`  new channels via wikidata      ${rs.filter((r) => r.channel && !r.channel.kept_from_v21 && r.channel.via === 'wikidata:P2397').length}`);
console.log(`  films found: ${['trailer', 'rss', 'videos-tab', 'search'].map((k) => `${k} ${rs.filter((r) => r.video?.from?.startsWith(k)).length}`).join(' · ')}`);
console.log(`  → server/app/data/raw/v22_youtube.json\n`);
}
