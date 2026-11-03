/**
 * V20 — official YouTube, verified rather than guessed (brief §16, §17, §41).
 *
 * §16's rule is the whole design: *do not assume the first search result is official*. Nothing here
 * searches. A channel is written down only when one of two things is true:
 *
 *   `own-site`         the institution links to the channel **from its own website** — the evidence
 *                      `research-official.mjs` collected, and the strongest form of ownership there is
 *                      short of a verified API handshake;
 *   `wikidata:P2397`   the institution's own Wikidata item carries the channel id as a statement.
 *
 * A candidate that resolves to a channel whose own title has nothing to do with the institution is
 * dropped — a university that links to a city's tourism channel from its footer has not given us its
 * channel. Where a site links several (a research lab, a library, a student society), the one whose
 * title matches the institution wins and the rest are discarded.
 *
 * The **video** is the channel's own trailer — `channelVideoPlayerRenderer`, the upload the channel owner
 * chose to feature on their home tab. That is as close to "the official introduction" as an external
 * party can get without asking, and it is the owner's selection rather than ours. Its title is read from
 * YouTube's own oEmbed endpoint and checked against §16's avoid-list: a lecture recording, a graduation
 * livestream or an entrance-ceremony relay is not an introduction and is refused, leaving the channel
 * linked and nothing embedded.
 *
 *   node scripts/universities/verify-youtube.mjs [--limit N] [--only slug,…] [--concurrency 6]
 */
import { content, enrichment, pool, progress, registry, saveContent, TODAY } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const LIMIT = Number(flag('--limit', '0')) || 0;
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const CONCURRENCY = Number(flag('--concurrency', '6'));

// YouTube serves its channel pages as an app shell; a browser UA is what gets the markup that carries
// the canonical id and the featured video. Nothing is scraped beyond those two values and the title.
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** §16 — what an official introduction is not. */
const AVOID = /강의|특강|수업|공개강좌|졸업식|학위수여식|입학식|생중계|실시간|라이브|LIVE|중계|세미나|웨비나|설명회\s*(실황|생)|브이로그|vlog|shorts|합격수기|채용설명|총장\s*취임|학술대회|conference|lecture|graduation|commencement|webinar|livestream/i;
/**
 * …and what an official introduction **is**. This is a requirement, not a preference, and the smoke test
 * is why: a channel trailer is usually a brand film, but three of the first eight were not — a language
 * programme's episode 42, a cafeteria short with eight hashtags, and a promo for a *different*
 * institution that happens to be affiliated. Embedding any of those as "the official introduction to
 * this university" is the fabrication §56 asks us to hunt for. A channel whose trailer does not announce
 * itself as an introduction keeps its link and embeds nothing, which the UI is already built for.
 */
const PREFER = /소개|홍보\s*(영상|동영상|필름)?|캠퍼스\s*투어|브랜드\s*필름|대학\s*영상|university\s*(introduction|film|tour)|campus\s*tour|about\s+(us|the university)|promotion(al)?|brand\s*film|welcome\s+to|intro(duction)?\b/i;

async function fetchText(url, { browser = false, timeout = 15000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ac.signal, redirect: 'follow',
      headers: { 'User-Agent': browser ? BROWSER_UA : 'HangyulUnivBot/1.0 (+https://talkhangyul.com)', 'Accept-Language': 'ko,en;q=0.8' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(timer); }
}

/** A candidate URL → the channel it actually is. Handles `/@handle`, `/c/name`, `/user/name`, `/channel/UC…`. */
async function resolveChannel(url) {
  const html = await fetchText(url, { browser: true });
  if (!html) return null;
  const id = (/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html) ?? [])[1];
  if (!id) return null;
  const title = (/<meta property="og:title" content="([^"]*)"/.exec(html) ?? [])[1] ?? '';
  const trailer = (/"channelVideoPlayerRenderer":\{"videoId":"([\w-]{11})"/.exec(html) ?? [])[1] ?? null;
  return { id, title: decodeHtml(title), trailer, url: `https://www.youtube.com/channel/${id}` };
}

const decodeHtml = (s) => s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** YouTube's own oEmbed — public, keyless, and authoritative about a video's title and uploader. */
async function videoMeta(id) {
  const txt = await fetchText(`https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${id}&format=json`);
  if (!txt) return null;
  try { const j = JSON.parse(txt); return { title: j.title ?? '', author: j.author_name ?? '' }; } catch { return null; }
}

/**
 * Look inside a verified channel for its introduction film.
 *
 * Only the channel's **own** search is used — `/channel/<id>/search?query=…` — so nothing from
 * anywhere else on YouTube can be returned. Each candidate is then confirmed through oEmbed, whose
 * `author_name` must match the channel: that is what stops a cross-posted or embedded third-party
 * video being accepted as the university's own (§16).
 */
async function searchChannel(channelId, channelTitle) {
  for (const query of ['대학 소개영상', '홍보영상', 'university introduction', 'campus tour']) {
    const html = await fetchText(
      `https://www.youtube.com/channel/${channelId}/search?query=${encodeURIComponent(query)}`,
      { browser: true },
    );
    if (!html) continue;
    const ids = [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 6);
    for (const id of ids) {
      const meta = await videoMeta(id);
      if (!meta) continue;
      if (!PREFER.test(meta.title) || AVOID.test(meta.title)) continue;
      // The uploader must be this channel. A search page can surface a video the channel merely
      // appears in.
      if (norm(meta.author) !== norm(channelTitle)) continue;
      return { id, title: meta.title, from: `search:${query}` };
    }
  }
  return null;
}

const norm = (s) => (s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

/** Does this channel plausibly belong to this institution? Compared on letters, not on punctuation. */
function titleMatches(channelTitle, inst) {
  const norm = (s) => (s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const t = norm(channelTitle);
  if (!t) return false;
  const ko = norm(inst.name_ko);
  const en = norm(inst.name_en);
  // 경성대학교 → 경성; "Kyungsung University" → kyungsung. The stem is what a channel title carries.
  const koStem = ko.replace(/(대학교|대학원대학교|대학|전문대학)$/, '');
  const enStem = en.replace(/(university|college|institute|ofscienceandtechnology)$/, '');
  return (koStem.length >= 2 && t.includes(koStem))
    || (enStem.length >= 4 && t.includes(enStem))
    || (ko.length >= 3 && t.includes(ko))
    || (en.length >= 5 && t.includes(en));
}

const insts = registry();
const enr = enrichment();
const doc = content();

let targets = insts.filter((i) => {
  const rec = doc.records[i.slug] ?? {};
  return rec.youtube_candidates?.links?.length || (enr[i.slug] ?? {}).youtube?.channel_id;
});
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

console.log(`V20 YouTube verification — ${targets.length} institutions with at least one candidate`);
let done = 0;
const results = await pool(targets, CONCURRENCY, async (inst) => {
  const rec = doc.records[inst.slug] ?? {};
  const fromSite = rec.youtube_candidates?.links ?? [];
  const fromWikidata = (enr[inst.slug] ?? {}).youtube?.channel_url;
  const out = { slug: inst.slug };

  const seen = new Set();
  const resolved = [];
  for (const link of fromSite.slice(0, 4)) {
    const ch = await resolveChannel(link);
    if (ch && !seen.has(ch.id)) { seen.add(ch.id); resolved.push({ ...ch, via: 'own-site' }); }
  }
  if (!resolved.length && fromWikidata) {
    const ch = await resolveChannel(fromWikidata);
    if (ch) resolved.push({ ...ch, via: 'wikidata:P2397' });
  }
  // The institution's own channel, not whatever else its footer links to.
  // The channel's own title has to name the institution. The first draft accepted a lone candidate on
  // trust and recorded "TU - The Head Office of International Affairs" as Tongmyong University's
  // official channel — a sub-office, with a language-programme episode as its trailer. A footer link is
  // evidence that the institution knows the channel, not that the channel is the institution.
  const named = resolved.filter((c) => titleMatches(c.title, inst));
  const chosen = named[0] ?? null;
  if (!chosen) { out.status = resolved.length ? 'UNVERIFIED_NAME_MISMATCH' : 'UNRESOLVED'; out.candidates = resolved.length; progress(++done, targets.length, 'verify'); return out; }

  out.channel = chosen;
  if (chosen.trailer) {
    const meta = await videoMeta(chosen.trailer);
    if (meta && PREFER.test(meta.title) && !AVOID.test(meta.title)) out.video = { id: chosen.trailer, title: meta.title, from: 'trailer' };
    else if (meta) out.rejected_video = { id: chosen.trailer, title: meta.title, why: AVOID.test(meta.title) ? 'avoid-list' : 'not an introduction' };
  }
  // V21 — **search the channel** when its featured film is not an introduction, or there is none.
  //
  // V20 looked only at the trailer, so 84 verified channels produced 35 films and 37 refusals: a
  // university whose home tab features last week's entrance ceremony still has a 소개영상, it is just
  // not pinned. YouTube's in-channel search finds it, and the uploader check below is what keeps this
  // honest — a search result is only accepted when oEmbed says the video belongs to *this* channel.
  if (!out.video) {
    const found = await searchChannel(chosen.id, chosen.title);
    if (found) out.video = found;
  }
  out.status = out.video ? 'CHANNEL_AND_VIDEO' : 'CHANNEL_ONLY';
  progress(++done, targets.length, 'verify');
  return out;
});

const tally = {};
for (const r of results) {
  if (!r?.slug) continue;
  tally[r.status] = (tally[r.status] ?? 0) + 1;
  const rec = (doc.records[r.slug] ??= {});
  if (!r.channel) { delete rec.youtube; continue; }
  rec.youtube = {
    channel_id: r.channel.id,
    channel_url: r.channel.url,
    channel_title: r.channel.title,
    verified_via: r.channel.via,
    source_url: r.channel.via === 'own-site' ? (rec.youtube_candidates?.found_on ?? rec.official_site?.url) : (enr[r.slug] ?? {}).source_url,
    verified_at: TODAY,
    verification_status: 'REGISTRY_ASSERTED',
    ...(r.video ? { video_id: r.video.id, video_title: r.video.title, video_found_via: r.video.from } : {}),
  };
  if (r.rejected_video) rec.youtube.rejected_video = r.rejected_video;
}
saveContent(doc);

console.log(`\n  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  via own site      ${results.filter((r) => r?.channel?.via === 'own-site').length}`);
console.log(`  via wikidata      ${results.filter((r) => r?.channel?.via === 'wikidata:P2397').length}`);
console.log(`  videos rejected   ${results.filter((r) => r?.rejected_video).length}`);
console.log('  → server/app/data/university_content.json\n');
