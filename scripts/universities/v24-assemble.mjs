/**
 * V24 — assemble the candidate file: Openverse (cached responses) + wider Commons + KOGL + 공유마당, judged with
 * V22's licence and subject rules, downloaded (≤ 3000 px long edge) to raw/v24_media_candidates/<slug>/<n>.<ext>.
 * Writes server/app/data/raw/v24_media_candidates.json. Never touches university_content.json.
 *   node v24-assemble.mjs <scratch-dir> [--review review.json]   (review = { "<slug>/<n>": "reason" } human/visual rejections)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, UA, readJson } from './lib.mjs';
import { titleNames, infoFor, judge } from './v24-commons.mjs';
import { subjectOk } from './v22-subject.mjs';

const dir = process.argv[2];
const reviewPath = process.argv.includes('--review') ? process.argv[process.argv.indexOf('--review') + 1] : null;
const review = reviewPath ? JSON.parse(readFileSync(reviewPath, 'utf8')) : {};
const queue = JSON.parse(readFileSync(join(dir, 'queue.json'), 'utf8'));
const commons = Object.fromEntries(JSON.parse(readFileSync(join(dir, 'commons.json'), 'utf8')).map((r) => [r.slug, r]));
const gongu = Object.fromEntries((readJson(join(dir, 'gongu.json'), []) ?? []).map((r) => [r.slug, r]));
const kogl = Object.fromEntries([...readJson(join(dir, 'kogl.json'), []), ...readJson(join(dir, 'kogl_fix.json'), [])].map((r) => [r.slug, r]));
const ovDir = join(dir, 'cache/openverse');
const ovKey = (q) => Buffer.from(q).toString('base64url').slice(0, 120);
const ovLog = readJson(join(ovDir, '_log.json'), null);
const humanRejected = new Set(Object.entries(readJson(join(ROOT, 'scripts/universities/curated/v22-media-picked.json')).records).filter(([, v]) => /rejected/.test(v.why ?? '')).map(([k]) => k));
const OUT_DIR = join(ROOT, 'server/app/data/raw/v24_media_candidates');
const OUT = join(ROOT, 'server/app/data/raw/v24_media_candidates.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PER = 6;
const NAMES = JSON.parse(readFileSync(process.env.V24_NAMES ?? join(dir, 'names.json'), 'utf8'));
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The name must appear as written — words separated by whitespace only, word-bounded — so "Touchdown Jesus', University of Notre Dame" does not read as "Jesus University". */
const strictlyNames = (slug, title) => [...NAMES[slug].ko, ...NAMES[slug].en].filter((n) => n.length >= 3).some((n) => new RegExp(`(^|[^\\p{L}])${n.trim().split(/\s+/).map(esc).join('\\s+')}($|[^\\p{L}])`, 'iu').test(title));
const LEAD_DROP = /수여식|동아리|스트로마톨라이트|현판|전시실|공예실|조형물|훈련장|역사 문화 공원|국학원/;

const LIC = { cc0: ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'], pdm: ['Public Domain Mark 1.0', 'https://creativecommons.org/publicdomain/mark/1.0/'], by: ['CC BY', 'https://creativecommons.org/licenses/by/'], 'by-sa': ['CC BY-SA', 'https://creativecommons.org/licenses/by-sa/'] };
const rejectedTally = {};
const tally = (why) => { const k = why.replace(/\d+×\d+/, 'N×N').replace(/\(([a-z0-9-]+)\)$/, '(…)').replace(/licence .*/, 'licence not accepted (NC/ND/KOGL 0,2–4/unknown)').slice(0, 90); rejectedTally[k] = (rejectedTally[k] ?? 0) + 1; };

async function download(url, file) {
  for (let a = 0; a < 3; a += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) { const b = Buffer.from(await res.arrayBuffer()); if (b.length > 5000) { writeFileSync(file, b); return b.length; } }
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (a + 1)); continue; }
      return 0;
    } catch { await sleep(1500); }
  }
  return 0;
}
const extOf = (url, mime) => (/png/i.test(mime ?? url) ? 'png' : /webp/i.test(mime ?? url) ? 'webp' : 'jpg');

const records = [];
const leadsAll = [];
const downloadFailed = [];
for (const it of queue) {
  const attempts = []; const pool = []; const rej = [];
  const nm = titleNames;
  /* 1 — Openverse */
  const ovRows = ovLog?.log?.find((l) => l.slug === it.slug)?.rows;
  const en = it.name_en || it.label_en;
  const qs = [[`"${it.name_ko}"`, 'ko'], ...(en ? [[`"${en}"`, 'en'], [`"${en}" campus`, 'en_campus']] : [])];
  const wmTitles = [];
  for (const [q, kind] of qs) {
    const f = join(ovDir, `${ovKey(q)}.json`);
    const base = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial,modification`;
    if (!existsSync(f)) {
      const row = ovRows?.find((r) => r.kind === kind);
      attempts.push({ route: 'openverse', query_or_url: base, result_count: null, outcome: row?.not_run ? `not run: ${row.not_run}` : 'not run: Openverse anonymous quota (200 requests/day) exhausted before this query; re-run v24-openverse.mjs to resume (responses are cached)' });
      continue;
    }
    const d = JSON.parse(readFileSync(f, 'utf8'));
    let named = 0;
    for (const r of d.results ?? []) {
      if (r.source === 'wikimedia' || r.provider === 'wikimedia') { if (titleNames(r.title.startsWith('File:') ? r.title : `File:${r.title}`) === it.slug) wmTitles.push({ r, q }); else tally('openverse/wikimedia: title does not name the institution (category ties come from the Commons route)'); continue; }
      const owner = titleNames(r.title ?? '');
      if (owner !== it.slug) { if (owner) tally(`openverse: title names another institution`); else tally('openverse: title does not name the institution'); continue; }
      if (!strictlyNames(it.slug, r.title ?? '')) { tally('openverse: name only matches after punctuation is stripped (e.g. "Touchdown Jesus\', University of Notre Dame")'); continue; }
      named += 1;
      const lic = LIC[r.license];
      if (!lic) { tally(`openverse: licence ${r.license}`); rej.push({ title: r.title, why: `licence ${r.license}` }); continue; }
      const userTags = (r.tags ?? []).filter((t) => !t.unstable__provider).map((t) => t.name).join(' ');
      const s = subjectOk({ title: r.title, description: userTags, via: [], names_institution: true });
      if (!s.ok) { tally(`subject: ${s.why}`); rej.push({ title: r.title, why: s.why }); continue; }
      if (!r.creator && !/cc0|pdm/.test(r.license)) { tally('openverse: credited licence without creator'); continue; }
      if (Math.max(r.width ?? 1024, r.height ?? 0) < 800) { tally('too small'); continue; }
      pool.push({ source_type: 'openverse', provider: r.provider, source_url: r.foreign_landing_url, image_url: r.url, source_owner: r.creator ?? null, license: `${lic[0]}${r.license_version && !/cc0|pdm/.test(r.license) ? ` ${r.license_version}` : ''}`, license_url: r.license_url ?? lic[1], attribution_required: !/cc0|pdm/.test(r.license), title: r.title, width: r.width, height: r.height, why_this_is_the_institution: `${r.provider} title "${r.title}" names ${it.name_en || it.name_ko} (longest-registry-name rule); found by Openverse q=${q}`, rank: 1 });
    }
    attempts.push({ route: 'openverse', query_or_url: base, result_count: d.result_count, outcome: `${(d.results ?? []).length} inspected; ${named} non-Wikimedia titled with this institution; Wikimedia hits re-verified on Commons` });
  }
  /* 2 — Commons (wider route + Openverse's Wikimedia hits re-read on Commons) */
  const c = commons[it.slug] ?? { attempts: [], judged: [] };
  attempts.push(...c.attempts);
  const judged = [...c.judged];
  const have = new Set(judged.map((j) => j.title));
  const extraTitles = [];
  for (const { r } of wmTitles) { const t = `File:${r.title.replace(/^File:/, '')}`; if (!have.has(t)) extraTitles.push(t); }
  if (extraTitles.length) {
    for (const f of await infoFor([...new Set(extraTitles)])) { const via = ['openverse']; judged.push({ ...f, via, v22: null, verdict: judge(f, via, it.slug) }); }
  }
  for (const j of judged) {
    if (!j.verdict.ok) { tally(`commons: ${j.verdict.why}`); continue; }
    if (j.v22 === 'v22-logo' || /logotype|로고타입|\.png$/i.test(j.title)) { tally('commons: a logo / graphic, not a photograph'); continue; }
    if (j.v22 === 'v22-servable') { tally('commons: already servable in V22 (not new; see v22_commons_candidates.json)'); continue; }
    const rend = (j.thumb && (j.width ?? 0) > 2560) ? j.thumb : j.url;
    const w = rend === j.thumb ? j.thumbW : j.width; const h = rend === j.thumb ? j.thumbH : j.height;
    const free = j.verdict.free;
    pool.push({ source_type: 'commons', source_url: j.page, image_url: rend, source_owner: j.author, license: j.licence, license_url: j.licence_url, attribution_required: !free, title: j.title, width: w, height: h, mime: j.mime,
      why_this_is_the_institution: j.via.some((v) => v.startsWith('category:')) ? `Commons categorises it under ${j.via.filter((v) => v.startsWith('category:')).map((v) => v.slice(9)).join('; ')}` : `file title names ${it.name_en || it.name_ko} (longest-registry-name rule) with campus vocabulary; via ${j.via.join(', ')}`,
      v22_status: j.v22, portrait: j.verdict.portrait || undefined, rank: (j.verdict.names_institution ? 2 : 0) + (j.verdict.portrait ? 0 : 1) });
  }
  /* 3 — KOGL */
  if (it.establishment === 'PRIVATE') attempts.push({ route: 'kogl', query_or_url: null, result_count: 0, outcome: 'not applicable: PRIVATE institution — 공공누리 marks public bodies’ own works; only NATIONAL/PUBLIC sites were read' });
  else attempts.push(...(kogl[it.slug]?.attempts ?? [{ route: 'kogl', query_or_url: it.website, result_count: 0, outcome: 'not reached' }]));
  for (const p of kogl[it.slug]?.pages ?? []) for (const im of p.images ?? []) pool.push({ source_type: 'kogl', _needs_review: true, source_url: p.url, image_url: im.src, title: im.alt, license: 'KOGL Type 1', license_url: 'https://www.kogl.or.kr/info/licenseType1.do', attribution_required: true, kogl_mark: p.kogl, rank: 0 });
  /* 4 — 공유마당 */
  const g = gongu[it.slug];
  if (g) {
    attempts.push(...g.attempts);
    for (const r of g.rejected) tally(`gongu: ${r.why}`);
    for (const x of g.candidates) pool.push({ source_type: 'gongu', source_url: x.url, image_url: x.image_url, source_owner: x.owner, license: x.licence, license_url: x.licence_code === '98' ? 'https://gongu.copyright.or.kr/gongu/main/contents.do?menuNo=200092' : x.licence_code === '01' ? 'https://www.kogl.or.kr/info/licenseType1.do' : x.licence_code === '21' ? 'https://creativecommons.org/licenses/by/4.0/' : x.licence_code === '23' ? 'https://creativecommons.org/licenses/by-sa/4.0/' : null, licence_mark: { alt: x.licence_mark_alt, img: x.licence_mark_img }, attribution_required: x.licence_code !== '97', title: x.title, width: x.width, height: x.height, summary: x.summary, why_this_is_the_institution: `공유마당 item titled "${x.title}"${x.summary ? `; summary: ${x.summary.slice(0, 120)}` : ''}`, rank: 1 });
  } else attempts.push({ route: 'gongu', query_or_url: `listWrtImage.do?searchWrd=${it.name_ko}`, result_count: null, outcome: 'not run (time-box reached before this institution)' });

  /* select, download */
  const seen = new Set();
  const chosen = pool.filter((p) => { const k = p.image_url; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.rank - a.rank || (Math.max(b.width ?? 0, b.height ?? 0) - Math.max(a.width ?? 0, a.height ?? 0)));
  const reviewed = chosen.filter((p) => { const why = review[`${it.slug}/${p.title}`]; if (why) tally(`visual review: ${why}`); return !why; });
  const keep = reviewed.slice(0, PER);
  const sdir = join(OUT_DIR, it.slug);
  rmSync(sdir, { recursive: true, force: true }); // <n> is positional: never let a stale file stand for another candidate
  const candidates = [];
  const leads = [];
  for (const x of (g?.rejected ?? []).filter((x) => /rendition/.test(x.why) && x.thumb_url && !LEAD_DROP.test(x.title))) leads.push({ kind: 'licence-cleared, no full rendition on 공유마당', source_type: 'gongu', source_url: x.url, thumb_url: x.thumb_url, original_url: x.original_url, source_owner: x.owner, license: 'KOGL Type 1 (공공누리 제1유형: 출처표시)', license_url: 'https://www.kogl.or.kr/info/licenseType1.do', licence_mark: { alt: x.licence_mark_alt, img: x.licence_mark_img }, attribution_required: true, title: x.title, why_not_downloaded: '공유마당 serves only a 260 px thumbnail of this linked work; the original is at 향토문화전자대전 (grandculture.net), whose robots.txt disallows AI agents, so it was not fetched. A person can download it through 공유마당’s download button.' });
  for (const [i, p] of keep.entries()) {
    const n = i + 1;
    mkdirSync(sdir, { recursive: true });
    const file = join(sdir, `${candidates.length + 1}.${extOf(p.image_url, p.mime)}`);
    const size = await download(p.image_url, file);
    if (!size) { tally('download failed'); downloadFailed.push({ slug: it.slug, title: p.title, image_url: p.image_url }); leads.push({ kind: 'licence-cleared, download blocked', ...(({ rank, _needs_review, mime, ...x }) => x)(p), why_not_downloaded: `image host refused the download (${/staticflickr/.test(p.image_url) ? 'Flickr CDN 403/429' : 'error'}); needs a person to open the landing page and VISUALLY confirm the subject before use` }); continue; }
    const { rank, _needs_review, mime, ...rest } = p;
    candidates.push({ file: file.replace(`${ROOT}/`, ''), ...rest, prior_human_rejection: humanRejected.has(it.slug) || undefined });
    await sleep(300);
  }
  records.push({ slug: it.slug, tier: it.tier, name_ko: it.name_ko, name_en: it.name_en || it.label_en || null, establishment: it.establishment, candidates, leads, more_passing_not_downloaded: Math.max(0, reviewed.length - PER), rejected_samples: rej.slice(0, 5), attempts });
  process.stdout.write(`${it.slug}: ${candidates.length}\n`);
}
writeFileSync(OUT, `${JSON.stringify({ _generated_by: 'scripts/universities/v24-*.mjs', _what: 'V24 photograph CANDIDATES for institutions with no own photograph (D, E, then C-video-only). Review only — nothing here is applied to university_content.json.', generated_at: new Date().toISOString().slice(0, 10), openverse_stopped: ovLog?.stopped ?? null, queue_size: queue.length, rejected_by_reason: rejectedTally, download_failed: downloadFailed, records }, null, 1)}\n`);
console.log('institutions with candidates', records.filter((r) => r.candidates.length).length, 'candidates', records.reduce((s, r) => s + r.candidates.length, 0));
