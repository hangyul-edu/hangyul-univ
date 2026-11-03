/**
 * V24 — Openverse sweep for the no-photograph queue (D, then E, then C-video-only), deterministic order.
 *
 * Openverse's anonymous tier allows 20 requests/min and 200/day, so this paces at one request per 3.5 s,
 * caches every response (re-runs cost nothing for queries already made) and stops cleanly on HTTP 429,
 * recording where it stopped. Per institution: Korean name; English name; "<English name> campus" only
 * when the English query has more than one page of results (otherwise every English hit was already seen).
 * Licence filter at the API: license_type=commercial,modification (no NC, no ND).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { UA } from './lib.mjs';

const [queuePath, cacheDir] = process.argv.slice(2);
mkdirSync(cacheDir, { recursive: true });
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (q) => Buffer.from(q).toString('base64url').slice(0, 120);
let stopped = null;

async function search(q) {
  const f = join(cacheDir, `${key(q)}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  if (stopped) return { q, skipped: stopped };
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({ q, license_type: 'commercial,modification', page_size: '20' })}`;
  await sleep(3500);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 429) { stopped = `HTTP 429 at ${new Date().toISOString()} (${res.headers.get('retry-after') ?? 'no retry-after'})`; return { q, skipped: stopped }; }
  if (!res.ok) return { q, error: `HTTP ${res.status}` };
  const d = await res.json();
  const out = { q, url, fetched: new Date().toISOString(), result_count: d.result_count, page_count: d.page_count, results: d.results };
  writeFileSync(f, JSON.stringify(out));
  return out;
}

const log = [];
for (const [i, it] of queue.entries()) {
  const en = it.name_en || it.label_en || null;
  const rows = [];
  rows.push({ kind: 'ko', ...(await search(`"${it.name_ko}"`)) });
  if (en) {
    const e = await search(`"${en}"`);
    rows.push({ kind: 'en', ...e });
    if ((e.result_count ?? 0) > 20 || e.skipped) rows.push({ kind: 'en_campus', ...(await search(`"${en}" campus`)) });
    else rows.push({ kind: 'en_campus', q: `"${en}" campus`, not_run: `English phrase query returned ${e.result_count ?? 0} (≤ one page), all already inspected` });
  }
  log.push({ slug: it.slug, rows: rows.map(({ results, ...r }) => ({ ...r, n: results?.length ?? 0 })) });
  process.stdout.write(`${i + 1}/${queue.length} ${it.slug} ${rows.map((r) => r.result_count ?? (r.skipped ? 'SKIP' : r.not_run ? '-' : 'ERR')).join(',')}\n`);
}
writeFileSync(join(cacheDir, '_log.json'), JSON.stringify({ stopped, log }, null, 1));
console.log('stopped:', stopped);
