/**
 * V23 — verify the YouTube links found on the institution's **rendered** own site, with V22's rules.
 *
 * Input: `server/app/data/raw/v23_rendered_youtube_links.json` (`v23-render-youtube.mjs`).
 * Every rule is V22's, imported from `v22-verify-youtube.mjs` and not restated here:
 *   • `resolveChannel` — the candidate URL resolved to the channel it actually is;
 *   • `pickChannel` / `titleMatches` / `SUBUNIT` — stored only when the channel's own title names the
 *     institution and the channel is not a sub-unit's;
 *   • `findIntro` — the intro film from inside that channel only (featured trailer → RSS → /videos →
 *     in-channel search), PREFER/AVOID vocabulary plus the oEmbed uploader check.
 *
 * A channel found this way is recorded with `verified_via: 'own-site-rendered'` and the rendered page it
 * was found on as `source_url`. Also re-tries the institutions that already have a verified channel but
 * no intro film (their channel and its provenance are kept as they are).
 *
 * Output: `server/app/data/raw/v23_youtube.json`, in the shape of `v22_youtube.json`.
 *
 *   node scripts/universities/v23-verify-youtube.mjs [--only slug,…]
 */
import { join } from 'node:path';
import { content, pool, readJson, registry, ROOT, TODAY, writeJson } from './lib.mjs';
import { findIntro, GRADUATE_WORD, pickChannel, resolveChannel, SUBUNIT } from './v22-verify-youtube.mjs';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);

const RENDERED = join(ROOT, 'server/app/data/raw/v23_rendered_youtube_links.json');
const WD_RAW = join(ROOT, 'server/app/data/raw/v22_wikidata.json');
const OUT = join(ROOT, 'server/app/data/raw/v23_youtube.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const insts = registry();
const bySlug = new Map(insts.map((i) => [i.slug, i]));
const doc = content();
const rendered = readJson(RENDERED, { records: {} }).records ?? {};
const wd = readJson(WD_RAW, { records: {} }).records ?? {};

let targets = [...insts].sort((a, b) => a.slug.localeCompare(b.slug)).filter((i) => {
  const y = doc.records[i.slug]?.youtube;
  if (y?.video_id) return false;                 // settled — never re-opened
  if (y?.channel_id) return true;                // verified channel, no film: re-try the film
  return (rendered[i.slug]?.links ?? []).length > 0;
});
if (ONLY.length) targets = targets.filter((i) => ONLY.includes(i.slug));
console.log(`V23 YouTube verification — ${targets.length} institutions to check`);

const results = await pool(targets, 2, async (inst) => {
  const rec = doc.records[inst.slug] ?? {};
  const out = { slug: inst.slug, checked: TODAY };
  let channel;
  if (rec.youtube?.channel_id) {
    channel = { id: rec.youtube.channel_id, title: rec.youtube.channel_title, url: rec.youtube.channel_url, trailer: null, via: rec.youtube.verified_via, source_url: rec.youtube.source_url, kept: true };
    // The featured trailer is part of V22's route 1; read it from the channel page again.
    const live = await resolveChannel(channel.url).catch(() => null);
    if (live?.id === channel.id) { channel.trailer = live.trailer; channel.handle = live.handle; }
  } else {
    const resolved = [];
    const seen = new Set();
    for (const c of rendered[inst.slug].links.slice(0, 12)) {
      const ch = await resolveChannel(c.url).catch(() => null);
      await sleep(250);
      if (!ch || seen.has(ch.id)) continue;
      seen.add(ch.id);
      resolved.push({ ...ch, via: 'own-site-rendered', source_url: c.found_on, candidate_url: c.url });
    }
    out.candidates = resolved.map((r) => ({ id: r.id, title: r.title, via: r.via, candidate_url: r.candidate_url, source_url: r.source_url }));
    channel = pickChannel(resolved, inst, wd[inst.slug]?.label_en);
    if (!channel) {
      out.status = resolved.length ? 'UNVERIFIED_NAME_MISMATCH' : 'UNRESOLVED';
      // Why, for the report: a sub-unit channel vs a channel that names someone/something else.
      if (resolved.length) out.refused_because = resolved.map((r) => (SUBUNIT.test(r.title) || (!/대학원/.test(inst.name_ko) && GRADUATE_WORD.test(r.title)) ? 'subunit' : 'title-does-not-name-institution'));
      console.log(`  ${inst.slug.padEnd(40)} ${out.status} ${resolved.map((r) => r.title).join(' | ')}`);
      return out;
    }
  }
  out.channel = { id: channel.id, title: channel.title, url: channel.url ?? `https://www.youtube.com/channel/${channel.id}`, via: channel.via, source_url: channel.source_url, handle: channel.handle ?? null, kept_from_v21: !!channel.kept };
  const video = await findIntro(channel, inst);
  if (video) out.video = video;
  out.status = video ? 'CHANNEL_AND_VIDEO' : 'CHANNEL_ONLY';
  console.log(`  ${inst.slug.padEnd(40)} ${out.status} ${channel.title}${video ? ` → ${video.title} [${video.id}, ${video.from}]` : ''}`);
  return out;
});

const prior = readJson(OUT, { records: {} }).records ?? {};
const records = ONLY.length ? { ...prior } : {};
for (const r of results) if (r?.slug) records[r.slug] = r;
writeJson(OUT, { _generated_by: 'scripts/universities/v23-verify-youtube.mjs', generated_at: TODAY, institutions: Object.keys(records).length, records });

const rs = Object.values(records);
const tally = {};
for (const r of rs) tally[r.status] = (tally[r.status] ?? 0) + 1;
console.log(`\n  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  new channels (own-site-rendered)   ${rs.filter((r) => r.channel && !r.channel.kept_from_v21).length}`);
console.log(`  films on retried channels          ${rs.filter((r) => r.channel?.kept_from_v21 && r.video).length}`);
console.log(`  → server/app/data/raw/v23_youtube.json  (${bySlug.size} in registry)\n`);
