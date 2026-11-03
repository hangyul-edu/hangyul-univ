/**
 * V23 — fold `v23_youtube.json` into the content record, with V22's youtube record shape.
 *
 *   • Only institutions that had **no channel**, or a verified channel and **no film**, are touched; an
 *     existing `youtube.video_id` is never overwritten, and an existing channel is never replaced by a
 *     different one.
 *   • The hand-check (`curated/v23-youtube-rejections.json`) is applied first: a rejected film is not
 *     written (its verified channel still is).
 *
 *   node scripts/universities/v23-apply.mjs [--dry]
 */
import { join } from 'node:path';
import { content, readJson, ROOT, saveContent } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const youtube = readJson(join(ROOT, 'server/app/data/raw/v23_youtube.json'), { records: {} }).records ?? {};
const rejected = readJson(join(ROOT, 'scripts/universities/curated/v23-youtube-rejections.json'), { records: {} }).records ?? {};

const doc = content();
const tally = {};
const bump = (k) => { tally[k] = (tally[k] ?? 0) + 1; };

for (const [slug, y] of Object.entries(youtube)) {
  if (!y?.channel || !['CHANNEL_AND_VIDEO', 'CHANNEL_ONLY'].includes(y.status)) continue;
  const rec = doc.records[slug];
  if (!rec) { bump('skipped: no content record'); continue; }
  const prevYt = rec.youtube;
  if (prevYt?.video_id) { bump('skipped: film already verified'); continue; }
  if (prevYt && prevYt.channel_id !== y.channel.id) { bump('skipped: different channel already verified'); continue; }
  const video = y.video && rejected[slug]?.video_id !== y.video.id ? y.video : null;
  if (y.video && !video) bump('film refused in hand-check');
  rec.youtube = prevYt
    ? { ...prevYt, ...(video ? { video_id: video.id, video_title: video.title, video_found_via: video.from, video_verified_at: y.checked } : {}) }
    : {
      channel_id: y.channel.id, channel_url: y.channel.url, channel_title: y.channel.title,
      verified_via: y.channel.via, source_url: y.channel.source_url ?? rec.official_site?.url ?? null,
      verified_at: y.checked, verification_status: 'REGISTRY_ASSERTED',
      ...(video ? { video_id: video.id, video_title: video.title, video_found_via: video.from } : {}),
    };
  if (!prevYt) bump('channel added');
  if (video) bump('intro film added');
}

if (!DRY) saveContent(doc);
console.log(`V23 apply${DRY ? ' (dry run)' : ''}`);
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k.padEnd(44)} ${v}`);
console.log(`  institutions with a verified intro film     ${Object.values(doc.records).filter((r) => r.youtube?.video_id).length}`);
console.log('  → server/app/data/university_content.json\n');
