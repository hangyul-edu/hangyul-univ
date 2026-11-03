/**
 * V24 — 공유마당 items that passed licence + subject but expose no full rendition: they are *linked* public works
 * (filePath decodes to the original at 향토문화전자대전 grandculture.net, whose robots.txt blocks AI agents, so the
 * original is not fetched). Re-reads each item page once for its thumbnail and the decoded original URL, so a
 * person can fetch the full file through 공유마당's own download button. Augments gongu.json in place.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { get, decodeEntities } from './lib.mjs';
const [path] = process.argv.slice(2);
const g = JSON.parse(readFileSync(path, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const r of g) for (const x of r.rejected) {
  if (!/rendition/.test(x.why) || x.thumb_url) continue;
  await sleep(1000);
  const p = await get(x.url, { timeout: 30000 });
  if (!p.ok) continue;
  const m = new RegExp(`wrtFileImageView\\.do\\?wrtSn=${x.wrtSn}&(?:amp;)?thumbAt=Y&(?:amp;)?thumbSe=t_thumb&(?:amp;)?wrtTy=10006&(?:amp;)?filePath=([A-Za-z0-9+/=]+)`).exec(p.text);
  if (!m) continue;
  x.thumb_url = `https://gongu.copyright.or.kr/gongu/wrt/cmmn/${decodeEntities(m[0])}`;
  x.original_url = Buffer.from(m[1], 'base64').toString('utf8');
}
writeFileSync(path, JSON.stringify(g, null, 1));
console.log('leads with thumbs', g.flatMap((r) => r.rejected).filter((x) => x.thumb_url).length);
