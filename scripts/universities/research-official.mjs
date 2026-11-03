/**
 * V20 — read each institution's **own** website for the facts no registry carries (brief §6, §25, §27, §41).
 *
 * V17's enrichment reached the ceiling of what Wikidata knows about Korean higher education: 5 of 425
 * mission statements, 0 international offices, 0 dormitories, 0 introduction videos (§212). Everything the
 * brief asks for past that point exists in exactly one place — the university's own site — which is also
 * source number one in §6's order. So this reads it, and nothing else.
 *
 * What it will and will not do:
 *
 *   • It reads **only** the institution's own origin (and a same-institution subdomain reached from its
 *     own homepage). No search engines, no directories, no blogs, no aggregators (§6).
 *   • It honours `robots.txt` for every origin before the first request to it, identifies itself in the
 *     User-Agent with a contact address, and fetches at most four pages per institution.
 *   • It extracts **candidate source text and URLs**, never prose. The 교육이념 it stores is the
 *     university's own wording with the page it came from and the date it was read; turning that into
 *     student-facing language is editorial work done once, by hand, for the institutions that have it
 *     (§25) — this script's output is marked `verification_status: "SOURCE_CAPTURED"` until then.
 *   • A page it cannot read, a site that forbids it and a site that has nothing are three different
 *     outcomes and are recorded as three different things. None of them becomes an invented value.
 *
 *     node scripts/universities/research-official.mjs [--limit N] [--only slug,slug] [--concurrency 8]
 */
import { allowed, content, enrichment, get, links, mainText, pool, progress, registry, saveContent, TODAY } from './lib.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const LIMIT = Number(flag('--limit', '0')) || 0;
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
const CONCURRENCY = Number(flag('--concurrency', '8'));

/**
 * What a link has to say to be worth following, per thing we are looking for.
 *
 * Korean university navigation is remarkably consistent about these words, which is the only reason this
 * is tractable: 건학이념 and 교육이념 are the legal/]founding statements, 국제교류처 / 국제처 / 국제협력 is the
 * international office in almost every case, and 생활관 is as common as 기숙사 for halls of residence.
 */
const WANTED = {
  philosophy: {
    anchor: /건학\s*이념|교육\s*이념|창학\s*정신|건학\s*정신|교육\s*목표|교훈|설립\s*이념|대학\s*이념|mission|philosoph|vision|founding spirit/i,
    // A URL that says so even when the anchor text is an image.
    href: /ideolog|philosoph|mission|vision|founding|ideal|greeting|intro|about|outline|overview|univ_?info|history/i,
  },
  international: {
    anchor: /국제\s*(교류|협력|처|센터|교육)|국제화|International (Office|Affairs|Center|Centre|Students?|Exchange)|Global (Office|Center|Centre|Affairs)|외국인\s*유학생|유학생\s*지원/i,
    href: /\b(oia|intl|international|global|exchange|foreign)\b/i,
  },
  admissions: {
    anchor: /외국인\s*(전형|입학|신입생)|국제\s*입학|입학\s*안내|입학처|Admissions?|Apply/i,
    href: /admiss|ipsi|enter|apply|iphak/i,
  },
  dormitory: {
    anchor: /기숙사|생활관|학생\s*생활관|Dormitor|Residence Hall|Housing/i,
    href: /dorm|housing|residen|saenghwal|bibs/i,
  },
};

/** Section headings whose following text is the statement we want. Longest match wins. */
const PHILOSOPHY_HEADS = [
  '건학이념', '건학 이념', '교육이념', '교육 이념', '창학정신', '창학 정신', '건학정신', '건학 정신',
  '설립이념', '설립 이념', '교육목표', '교육 목표', '교훈', '대학이념', '대학 이념',
  'Educational Philosophy', 'Founding Philosophy', 'Founding Spirit', 'Educational Ideology',
  'Mission Statement', 'Our Mission', 'Vision and Mission', 'Educational Goals',
];

/** A YouTube channel link anywhere on the institution's own site — §16's ownership evidence. */
const YT = /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/(UC[\w-]{20,24})|@([\w.-]{2,60})|c\/([\w.-]{2,60})|user\/([\w.-]{2,60}))/ig;

function sameInstitution(href, homeUrl) {
  try {
    const a = new URL(href).hostname.replace(/^www\./, '');
    const b = new URL(homeUrl).hostname.replace(/^www\./, '');
    // `oia.snu.ac.kr` and `snu.ac.kr` are the same institution; `studyinkorea.go.kr` is not.
    const root = (h) => h.split('.').slice(-3).join('.');
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`) || root(a) === root(b);
  } catch { return false; }
}

/**
 * The statement itself — and this is the part that has to be **pessimistic**.
 *
 * The naive version of this function (take the text after the heading) returns navigation. Korean
 * university menus list these headings as siblings, so "건학이념" on a homepage is followed by
 * "과 비전 비전체계도 교육목표 및 인재상" — four more menu items, which read as a sentence to a regex and
 * as nonsense to a human. Publishing that as a university's founding philosophy is precisely the
 * "does anything look generated or fabricated" failure §56 asks about, and it is worse than an empty
 * section. So a candidate has to survive all of:
 *
 *   1. it is on a page the homepage linked to as the philosophy page, not on the homepage itself —
 *      a content page's heading is followed by content;
 *   2. it does not contain a *second* heading keyword (a menu listing its own siblings always does);
 *   3. it reads as prose: a Korean sentence ending, a 「」/""-quoted motto, or two clauses of English;
 *   4. it carries no chrome vocabulary (로그인, 사이트맵, Copyright …);
 *   5. 10–400 characters, so a label and a whole page are both refused.
 *
 * Everything that survives is still stored as SOURCE_CAPTURED and still does not render. §25 asks for
 * Hangyul's own student-facing paraphrase; this is the sourced material that paraphrase is written from,
 * and `review-philosophy.mjs` is where it becomes publishable.
 */
const CHROME = /로그인|사이트맵|바로가기|검색|전체메뉴|퀵메뉴|개인정보|이메일무단|Copyright|All rights|Skip to|이전\s*다음|더보기/i;
/** Korean declarative/aspirational endings, a quoted motto, or English prose with a finite verb. */
const PROSE = /(다|함|임|음|한다|입니다|합니다|이다)[.。]?\s*$|^[「『"'“‘][^」』"'”’]{4,}[」』"'”’]|[A-Za-z]{3,}\s+(is|are|to|of|for|and|which|that|we|our)\s+[A-Za-z]{3,}/;

function extractPhilosophy(text, { homepage = false } = {}) {
  if (homepage) return null;
  const heads = PHILOSOPHY_HEADS.slice().sort((a, b) => b.length - a.length);
  for (const head of heads) {
    let from = 0;
    for (let guard = 0; guard < 4; guard += 1) {
      const i = text.indexOf(head, from);
      if (i < 0) break;
      from = i + head.length;
      const after = text.slice(from, from + 900).replace(/^[\s:：|·\-–—>»]+/, '');
      const body = after.split('\n').map((l) => l.trim()).filter((l) => l.length > 1).slice(0, 5).join(' ')
        .replace(/\s+/g, ' ').trim().slice(0, 400);
      if (body.length < 10) continue;
      // (2) a menu listing its siblings
      if (heads.some((h) => h !== head && body.includes(h))) continue;
      if (CHROME.test(body)) continue;
      if (!/[가-힣]{4,}|[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(body)) continue;
      if (!PROSE.test(body)) continue;
      return { heading: head, text: body };
    }
  }
  return null;
}

function pickLinks(all, homeUrl) {
  const found = {};
  for (const kind of Object.keys(WANTED)) {
    const { anchor, href } = WANTED[kind];
    const hit = all.find((l) => sameInstitution(l.href, homeUrl) && l.text && anchor.test(l.text))
      ?? all.find((l) => sameInstitution(l.href, homeUrl) && href.test(l.href) && anchor.test(l.href));
    if (hit) found[kind] = hit.href;
  }
  return found;
}

async function research(inst, home) {
  const out = { slug: inst.slug, checked: TODAY, pages: 0 };
  if (!(await allowed(home))) { out.status = 'ROBOTS_DISALLOWED'; return out; }
  let first = await get(home);
  out.pages += 1;
  // The registry's URL is often a decade old: an `http://` host that now only answers on TLS, or a deep
  // path (`/eng/default/new/main.jsp`) that has since 404'd while the origin is perfectly alive. Two
  // cheap retries recover a meaningful share of the 144 "unreachable" rows, and neither leaves the
  // institution's own origin.
  if (!first.ok) {
    for (const alt of [home.replace(/^http:/, 'https:'), new URL(home).origin]) {
      if (alt === home) continue;
      if (!(await allowed(alt))) continue;
      const retry = await get(alt);
      out.pages += 1;
      if (retry.ok) { first = retry; break; }
    }
  }
  if (!first.ok) { out.status = 'UNREACHABLE'; out.detail = first.error ?? `HTTP ${first.status}`; return out; }
  const base = first.url;
  const all = links(first.text, base);
  const found = pickLinks(all, base);
  out.links = found;

  // YouTube, from the institution's own markup. This *is* the ownership check (§16): a channel the
  // university links to from its own site is the university's channel. A search result is not.
  const channels = new Set();
  for (const m of first.text.matchAll(YT)) channels.add(m[0].split('?')[0]);
  if (channels.size) out.youtube_links = [...channels].slice(0, 4);
  out.youtube_source = base;

  // The philosophy page, if the homepage pointed at one and robots permits it. The homepage itself is
  // never a source for the statement — see extractPhilosophy.
  let statement = null;
  let statementUrl = null;
  if (found.philosophy && await allowed(found.philosophy)) {
    const page = await get(found.philosophy);
    out.pages += 1;
    if (page.ok) {
      statement = extractPhilosophy(mainText(page.text));
      if (statement) statementUrl = page.url;
      // Footers carry the social row more often than homepages do.
      if (!channels.size) for (const m of page.text.matchAll(YT)) channels.add(m[0].split('?')[0]);
      if (channels.size && !out.youtube_links) { out.youtube_links = [...channels].slice(0, 4); out.youtube_source = page.url; }
    }
  }
  if (found.philosophy) out.philosophy_url = found.philosophy;
  if (statement) out.philosophy = { ...statement, url: statementUrl };
  out.status = 'OK';
  return out;
}

const insts = registry();
const enr = enrichment();
let targets = insts
  .map((i) => ({ inst: i, home: i.website_url || (enr[i.slug] ?? {}).website_url }))
  .filter((t) => t.home);
if (ONLY.length) targets = targets.filter((t) => ONLY.includes(t.inst.slug));
if (LIMIT) targets = targets.slice(0, LIMIT);

console.log(`V20 official-site research — ${targets.length} institutions with a website (of ${insts.length})`);
let done = 0;
const results = await pool(targets, CONCURRENCY, async (t) => {
  const r = await research(t.inst, t.home).catch((e) => ({ slug: t.inst.slug, status: 'ERROR', detail: String(e).slice(0, 120) }));
  progress(++done, targets.length, 'read');
  return r;
});

const doc = content();
const tally = {};
for (const r of results) {
  if (!r?.slug) continue;
  tally[r.status] = (tally[r.status] ?? 0) + 1;
  const rec = (doc.records[r.slug] ??= {});
  rec.official_site = { url: targets.find((t) => t.inst.slug === r.slug).home, status: r.status, checked: r.checked ?? TODAY, pages_read: r.pages ?? 0 };
  if (r.links?.international) rec.international_office_url = r.links.international;
  if (r.links?.admissions) rec.international_admissions_url = r.links.admissions;
  if (r.links?.dormitory) rec.dormitory_url = r.links.dormitory;
  if (r.philosophy_url) rec.philosophy_url = r.philosophy_url;
  // A re-read replaces what the previous read found. Without this a value captured by an older, looser
  // version of the extractor would survive forever — which is how a navigation menu ends up permanently
  // recorded as a university's founding philosophy. A **human-reviewed** record is never touched: the
  // crawler owns SOURCE_CAPTURED and nothing else.
  if (r.status === 'OK' && rec.education_philosophy?.verification_status === 'SOURCE_CAPTURED') {
    delete rec.education_philosophy;
  }
  if (r.philosophy && rec.education_philosophy?.verification_status !== 'HANGYUL_REVIEWED') {
    rec.education_philosophy = {
      // The institution's own wording, stored verbatim as SOURCE MATERIAL. §25 asks for a Hangyul
      // interpretation in student-facing language; `statement_ko` is what that is written from, and the
      // page never renders a field whose status is still SOURCE_CAPTURED.
      heading: r.philosophy.heading,
      statement: r.philosophy.text,
      source_url: r.philosophy.url,
      verified_at: r.checked,
      verification_status: 'SOURCE_CAPTURED',
    };
  }
  if (r.youtube_links?.length) {
    rec.youtube_candidates = { links: r.youtube_links, found_on: r.youtube_source, verified_at: r.checked };
  }
}
saveContent(doc);

const n = results.length;
const got = (f) => results.filter(f).length;
console.log(`\n  status: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  education philosophy captured   ${got((r) => r?.philosophy)} / ${n}`);
console.log(`  international office            ${got((r) => r?.links?.international)} / ${n}`);
console.log(`  international admissions        ${got((r) => r?.links?.admissions)} / ${n}`);
console.log(`  dormitory                       ${got((r) => r?.links?.dormitory)} / ${n}`);
console.log(`  youtube link on own site        ${got((r) => r?.youtube_links?.length)} / ${n}`);
console.log(`  → server/app/data/university_content.json\n`);
