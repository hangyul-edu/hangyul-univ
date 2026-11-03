// V23 — record, per verified official film, the largest YouTube poster that actually exists. `maxresdefault` is missing
// for ~15 % of films and `sddefault` for a few; requesting a missing one is a broken image (or a console 404 behind a
// fallback). `hqdefault` exists for every video. Writes `youtube.poster` into server/app/data/university_content.json.
//   node scripts/universities/v23-posters.mjs   (then reload: cd server && .venv/bin/python -m scripts.v12_load_institutions)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const P = path.join(ROOT, 'server/app/data/university_content.json');
const data = JSON.parse(fs.readFileSync(P, 'utf8'));
const counts = {};
for (const [slug, rec] of Object.entries(data.records)) {
  const id = rec.youtube?.video_id;
  if (!id) continue;
  let poster = 'hqdefault';
  for (const size of ['maxresdefault', 'sddefault']) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, { method: 'HEAD' }).catch(() => null);
    if (r?.ok) { poster = size; break; }
  }
  rec.youtube.poster = poster;
  counts[poster] = (counts[poster] ?? 0) + 1;
  void slug;
}
fs.writeFileSync(P, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(counts));
