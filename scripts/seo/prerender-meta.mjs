#!/usr/bin/env node
// Writes crawler-readable metadata for the public routes that have their own identity.
//
// Link-preview crawlers do not run the React app, so a shared `/universities/<slug>` link would otherwise
// preview as the homepage. After `vite build` this copies dist/index.html to
//   dist/universities/index.html, dist/universities/<slug>/index.html, dist/start|privacy|terms/index.html
// with only the <title>, description, canonical, og:url and og/twitter title+description swapped. The body and
// the bundle are identical, so the SPA boots exactly as before; Vercel serves a real file before its SPA rewrite.
//
// The image is always the canonical Hangyul Univ card: no university has an approved share image, and a missing
// or private image must never produce a broken preview. Copy comes from the English locale file (the same
// strings `useSeo` shows), so the static and client-side values cannot drift.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const { items } = json(join(APP, 'public/data/public/institutions.json'));
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
