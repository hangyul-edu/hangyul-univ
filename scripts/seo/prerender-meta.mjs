#!/usr/bin/env node
// Writes crawler-readable metadata for the public routes that have their own identity.
//
// Link-preview crawlers do not run the React app, so a shared `/universities/<slug>` link would otherwise
// preview as the homepage. After `vite build` this copies dist/index.html to
//   dist/universities/index.html, dist/universities/<slug>/index.html, dist/privacy|terms/index.html
// with only the <title>, description, canonical, og:url and og/twitter title+description swapped. The body and
// the bundle are identical, so the SPA boots exactly as before; Vercel serves a real file before its SPA rewrite.
//
// The institutions come from the DB snapshot in dist/data/public/ (vite copied the committed one there). With
// `PUBLIC_DATA_SOURCE=api` the build first re-takes that snapshot from the live public API at `PUBLIC_API_ORIGIN`
// (default: the connected Student origin) — the same endpoints scripts/public-data/export.py calls in-process, so the
// files keep their exact shapes — and the pages' fallback and this metadata are as fresh as the database. If the API
// is unreachable or answers anything inconsistent, the committed snapshot stays and the build goes on: a tunnel
// that is down must never fail a deployment. manifest.json records which snapshot shipped (`origin`, `via`,
// `generated_at`).
//
// The image is always the canonical Hangyul Univ card: no university has an approved share image, and a missing
// or private image must never produce a broken preview. Copy comes from the English locale file (the same
// strings `useSeo` shows), so the static and client-side values cannot drift.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const APP = join(ROOT, 'apps/marketing-web');
const DIST = join(APP, 'dist');
const SITE = 'https://univ.talkhangyul.com';
const BRAND = 'Hangyul Univ';

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const mk = json(join(ROOT, 'packages/i18n/locales/en/marketing.json'));
const common = json(join(ROOT, 'packages/i18n/locales/en/common.json'));
const DATA = join(DIST, 'data/public');

/** The public catalogue, re-taken from the live API. Returns null (and says why) when it cannot be trusted. */
async function snapshotFromApi(origin) {
  const started = Date.now();
  const BUDGET_MS = Number(process.env.PUBLIC_DATA_BUDGET_MS ?? 300_000);
  const get = async (path) => {
    if (Date.now() - started > BUDGET_MS) throw new Error(`over the ${BUDGET_MS / 1000}s budget`);
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(`${origin}/api/v1${path}`, {
          headers: { accept: 'application/json', 'ngrok-skip-browser-warning': '1' }, signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
        if (!(r.headers.get('content-type') ?? '').includes('application/json')) throw new Error(`GET ${path} -> not JSON`);
        return await r.json();
      } catch (e) {
        if (attempt >= 3) throw e;
        await new Promise((res) => setTimeout(res, 500 * attempt));
      }
    }
  };
  const allCards = async (order) => {
    const out = [];
    for (let page = 1; ; page++) {
      const res = await get(`/directory/institutions?order=${order}&page=${page}&page_size=200`);
      out.push(...res.items);
      if (out.length >= res.total || !res.items.length) return out;
    }
  };
  const dump = (o) => `${JSON.stringify(o)}\n`;
  const files = new Map();
  const regions = await get('/directory/regions');
  const ko = await allCards('ko');
  const en = await allCards('en');
  const slugs = ko.map((c) => c.slug);
  if (!slugs.length) throw new Error('the API lists no institutions');
  if (regions.total !== slugs.length) throw new Error(`regions total ${regions.total} != ${slugs.length} cards`);
  if ([...slugs].sort().join() !== en.map((c) => c.slug).sort().join()) throw new Error('ko/en orders disagree on the institution set');
  for (const s of slugs) if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) throw new Error(`unexpected slug ${s}`);
  const pos = new Map(slugs.map((s, n) => [s, n]));
  files.set('regions.json', dump(regions));
  files.set('institutions.json', dump({ items: ko, order_en: en.map((c) => pos.get(c.slug)) }));
  // Eight at a time: two calls per institution, never the whole catalogue at once.
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < slugs.length) {
      const s = slugs[next++];
      files.set(`institutions/${s}.json`, dump(await get(`/directory/institutions/${s}`)));
      files.set(`admissions/${s}.json`, dump(await get(`/directory/institutions/${s}/admissions`)));
    }
  }));
  const digest = createHash('sha256');
  for (const name of [...files.keys()].sort()) digest.update(`${name}\0`).update(files.get(name));
  const verified = ko.map((c) => c.last_verified).filter(Boolean).sort();
  files.set('manifest.json', dump({
    schema: 2, version: digest.digest('hex').slice(0, 16), institutions: slugs.length, origin: 'database',
    via: `scripts/seo/prerender-meta.mjs (public API ${origin})`,
    generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), data_as_of: verified.at(-1) ?? null,
  }));
  console.log(`prerender-meta: took the catalogue snapshot from ${origin} (${slugs.length} institutions, ${Math.round((Date.now() - started) / 1000)}s)`);
  return files;
}

if (process.env.PUBLIC_DATA_SOURCE === 'api') {
  const origin = (process.env.PUBLIC_API_ORIGIN ?? 'https://app.univ.talkhangyul.com').replace(/\/$/, '');
  try {
    const files = await snapshotFromApi(origin);
    // Written beside the old snapshot and swapped in whole: a failure half-way can never ship a mixed one.
    const tmp = `${DATA}.next`;
    rmSync(tmp, { recursive: true, force: true });
    for (const [name, body] of files) {
      mkdirSync(dirname(join(tmp, name)), { recursive: true });
      writeFileSync(join(tmp, name), body);
    }
    rmSync(DATA, { recursive: true, force: true });
    renameSync(tmp, DATA);
  } catch (e) {
    console.warn(`prerender-meta: WARNING — could not refresh the catalogue from ${origin} (${e.message}); keeping the committed DB snapshot`);
  }
}
if (!existsSync(join(DATA, 'institutions.json'))) throw new Error(`prerender-meta: no catalogue snapshot in ${DATA}`);
const manifest = json(join(DATA, 'manifest.json'));
console.log(`prerender-meta: catalogue snapshot origin=${manifest.origin ?? 'database'} generated_at=${manifest.generated_at ?? 'unknown'} (${manifest.institutions} institutions)`);
const { items } = json(join(DATA, 'institutions.json'));
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
const branded = (title) => (title.includes(BRAND) ? title : `${title} · ${BRAND}`);

/** Replace exactly one tag; a template that lost a tag fails the build rather than shipping a page without it. */
function swap(html, pattern, replacement) {
  const hits = html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
  if (hits !== 1) throw new Error(`prerender-meta: expected exactly one ${pattern} in dist/index.html, found ${hits}`);
  return html.replace(pattern, replacement);
}

function page(path, title, description) {
  const t = esc(branded(title));
  const d = esc(description);
  const url = `${SITE}${path}`;
  let html = template;
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = swap(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${d}" />`);
  html = swap(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  html = swap(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
  html = swap(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`);
  html = swap(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${d}" />`);
  html = swap(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`);
  html = swap(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${d}" />`);
  const out = join(DIST, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

const seo = mk.v12.seo;
page('/universities', seo.directory.title, seo.directory.description);
page('/privacy', seo.privacy.title, seo.privacy.description);
page('/terms', seo.terms.title, seo.terms.description);
let n = 0;
for (const inst of items) {
  if (!/^[a-z0-9-]+$/.test(inst.slug)) throw new Error(`prerender-meta: unexpected slug ${inst.slug}`);
  const name = inst.name_en || inst.name_ko;
  const region = common.region?.[inst.region] ?? inst.region;
  page(`/universities/${inst.slug}`, `${name} | ${BRAND}`, fill(seo.university.description, { name, region }));
  n += 1;
}
console.log(`prerender-meta: wrote metadata for /universities, /privacy, /terms and ${n} university pages`);
