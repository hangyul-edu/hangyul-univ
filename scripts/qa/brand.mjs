#!/usr/bin/env node
// qa:brand — the Hangyul Univ brand-asset regression gate. Static: no browser, no server.
//   node scripts/qa/brand.mjs            checks the repository (and apps/*/dist when built)
//   BASE=https://univ.talkhangyul.com node scripts/qa/brand.mjs   also checks the live site over HTTP
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BRAND = 'packages/icons/assets/brand/hangyul-univ';
const SITE = 'https://univ.talkhangyul.com';
const OG = `${SITE}/og/hangyul-univ-og-v1.jpg`;
const BASE = process.env.BASE?.replace(/\/$/, '');
let failed = 0, passed = 0;
const check = (ok, label, detail = '') => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); } };
const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), 'utf8');

/** Width/height from a PNG IHDR or a JPEG SOF marker. */
function size(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}

// 1. Canonical files: six masters, six runtime logos (+@2x), social, icons.
const COLORS = ['black', 'ivory', 'orange'];
for (const o of ['horizontal', 'vertical']) for (const c of COLORS) {
  check(existsSync(abs(`${BRAND}/master/hangyul-univ-logo-${o}-${c}.png`)), `master logo ${o} ${c}`);
  for (const x of ['', '@2x']) check(existsSync(abs(`${BRAND}/hangyul-univ-logo-${o}-${c}${x}.png`)), `runtime logo ${o} ${c}${x}`);
}
for (const f of ['master/hangyul-univ-og-3600x1890.jpg', 'master/hangyul-univ-banner-3072x1500.jpg', 'hangyul-univ-og-v1.jpg', 'hangyul-univ-banner-1024x500.jpg',
  'favicon.ico', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
  'native/app-icon-1024.png', 'native/adaptive-foreground-1024.png', 'native/splash.png']) check(existsSync(abs(`${BRAND}/${f}`)), `canonical ${f}`);

// 2. Dimensions.
const dims = (p, w, h) => { if (!existsSync(abs(p))) return check(false, `${p} exists`); const [a, b] = size(abs(p)); check(a === w && b === h, `${p} is ${w}×${h}`, `${a}×${b}`); };
dims(`${BRAND}/hangyul-univ-og-v1.jpg`, 1200, 630);
dims('apps/marketing-web/public/og/hangyul-univ-og-v1.jpg', 1200, 630);
dims(`${BRAND}/hangyul-univ-banner-1024x500.jpg`, 1024, 500);
dims(`${BRAND}/apple-touch-icon.png`, 180, 180);
dims(`${BRAND}/icon-192.png`, 192, 192);
dims(`${BRAND}/icon-512.png`, 512, 512);
for (const app of ['student', 'agency', 'university']) dims(`apps/${app}-mobile/assets/app-icon-1024.png`, 1024, 1024);

// 3. Derivatives are current with the masters (and the published copies with the derivatives).
try { execFileSync('python3', ['scripts/brand/build-brand-assets.py', '--check'], { cwd: ROOT, stdio: 'pipe' }); check(true, 'derivatives current'); }
catch (e) { check(false, 'derivatives current', String(e.stdout ?? e.message).trim().split('\n').slice(0, 3).join(' | ')); }

// 4. HTML shells: required tags, exactly once, HTTPS production URLs, no localhost / preview hosts.
const REQUIRED = ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
const meta = (html, key) => [...html.matchAll(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`, 'g'))].map((m) => m[1]);
function checkHtml(html, label, { canonical } = {}) {
  for (const key of REQUIRED) { const v = meta(html, key); check(v.length === 1 && v[0].trim() !== '', `${label}: ${key} present once`, `found ${v.length}`); }
  check(meta(html, 'og:image')[0] === OG, `${label}: og:image is the canonical card`, meta(html, 'og:image')[0]);
  check(meta(html, 'twitter:image')[0] === OG, `${label}: twitter:image is the canonical card`);
  check(meta(html, 'twitter:card')[0] === 'summary_large_image', `${label}: twitter:card`);
  check(meta(html, 'og:image:width')[0] === '1200' && meta(html, 'og:image:height')[0] === '630', `${label}: og:image size`);
  check(/^https:\/\/([a-z]+\.)?univ\.talkhangyul\.com\//.test(meta(html, 'og:url')[0] ?? ''), `${label}: og:url is a production HTTPS URL`, meta(html, 'og:url')[0]);
  const head = html.slice(0, html.indexOf('</head>'));
  check(!/localhost|127\.0\.0\.1|vercel\.app|[?&](token|signature|X-Amz)/i.test(head), `${label}: no localhost / preview / signed URL in <head>`);
  check(!/favicon\.png|og\/hangyul-univ\.jpg|logo-combined/.test(html), `${label}: no obsolete brand reference`);
  check(/<link rel="icon" href="\/favicon\.ico"/.test(html) && /apple-touch-icon\.png/.test(html), `${label}: favicon links`);
  if (canonical) {
    const c = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
    check(c.length === 1 && c[0] === canonical, `${label}: canonical ${canonical}`, c.join(','));
    check(meta(html, 'og:url')[0] === canonical, `${label}: og:url matches canonical`);
  }
}
checkHtml(read('apps/marketing-web/index.html'), 'marketing index.html', { canonical: `${SITE}/` });
for (const app of ['student', 'agency', 'university']) checkHtml(read(`apps/${app}-web/index.html`), `${app} index.html`);

// 5. Every local asset an HTML shell or manifest references exists in that app's public directory.
for (const app of ['marketing', 'student', 'agency', 'university']) {
  const pub = `apps/${app}-web/public`;
  const html = read(`apps/${app}-web/index.html`);
  const refs = [...html.matchAll(/<link [^>]*href="(\/[^"]+)"/g)].map((m) => m[1]);
  const manifest = JSON.parse(read(`${pub}/site.webmanifest`));
  for (const r of [...refs, ...manifest.icons.map((i) => i.src)]) check(existsSync(abs(`${pub}${r}`)), `${app}: ${r} exists`);
}
for (const app of ['student', 'agency', 'university']) {
  const cfg = read(`apps/${app}-mobile/app.json`);
  for (const r of cfg.matchAll(/"\.\/(assets\/[^"]+\.png)"/g)) check(existsSync(abs(`apps/${app}-mobile/${r[1]}`)), `${app}-mobile: ${r[1]} exists`);
}

// 6. No current-product source still points at the retired Hangyul lockup.
const OBSOLETE = /logo-combined|symbol-192\.png|symbol\.webp|wordmark-(en|ko)|og\/hangyul-univ\.jpg|brandAssets\.(symbol|logoCombined|wordmark|favicon|appleTouch)/;
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { if (['node_modules', 'dist', 'android', 'ios', '.expo'].includes(n)) continue; const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|mjs|json|html|s?css)$/.test(n)) out.push(p); } return out; };
for (const f of [...walk(abs('apps')), ...walk(abs('packages')).filter((p) => !p.includes('/locales/'))]) {
  if (OBSOLETE.test(readFileSync(f, 'utf8'))) check(false, `obsolete brand reference in ${f.replace(`${ROOT}/`, '')}`);
}
passed += 1;

// 7. Built output, when present: the homepage and prerendered pages carry the tags; the card ships.
const dist = 'apps/marketing-web/dist';
if (existsSync(abs(`${dist}/index.html`))) {
  checkHtml(read(`${dist}/index.html`), 'dist /', { canonical: `${SITE}/` });
  checkHtml(read(`${dist}/universities/index.html`), 'dist /universities', { canonical: `${SITE}/universities` });
  const slug = JSON.parse(read('apps/marketing-web/public/data/public/institutions.json')).items[0];
  const page = read(`${dist}/universities/${slug.slug}/index.html`);
  checkHtml(page, `dist /universities/${slug.slug}`, { canonical: `${SITE}/universities/${slug.slug}` });
  check(meta(page, 'og:title')[0] === `${slug.name_en} | Hangyul Univ`, 'university og:title is "<Name> | Hangyul Univ"', meta(page, 'og:title')[0]);
  dims(`${dist}/og/hangyul-univ-og-v1.jpg`, 1200, 630);
} else console.log('note  apps/marketing-web/dist not built — skipped built-output checks');

// 8. Live site (optional).
if (BASE) {
  const get = async (path, init) => fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  const home = await get('/');
  check(home.status === 200, `live / → 200`, String(home.status));
  checkHtml(await home.text(), 'live /', BASE === SITE ? { canonical: `${SITE}/` } : {});
  const dir = await get('/universities');
  check(dir.status === 200, 'live /universities → 200', String(dir.status));
  checkHtml(await dir.text(), 'live /universities', { canonical: `${SITE}/universities` });
  const slug = JSON.parse(read('apps/marketing-web/public/data/public/institutions.json')).items[0];
  const uni = await get(`/universities/${slug.slug}`);
  check(uni.status === 200, `live /universities/${slug.slug} → 200`, String(uni.status));
  checkHtml(await uni.text(), `live /universities/${slug.slug}`, { canonical: `${SITE}/universities/${slug.slug}` });
  for (const [path, type] of [['/og/hangyul-univ-og-v1.jpg', 'image/jpeg'], ['/favicon.ico', 'image/'], ['/favicon-32.png', 'image/png'], ['/apple-touch-icon.png', 'image/png'],
    ['/icon-192.png', 'image/png'], ['/icon-512.png', 'image/png'], ['/site.webmanifest', ''], ['/brand/hangyul-univ-logo-horizontal-black.png', 'image/png']]) {
    const r = await get(path);
    check(r.status === 200 && (r.headers.get('content-type') ?? '').includes(type), `live ${path} → 200 ${type}`, `${r.status} ${r.headers.get('content-type')}`);
    if (path.startsWith('/og/')) {
      const bytes = Buffer.from(await r.arrayBuffer());
      check(bytes.equals(readFileSync(abs(`${BRAND}/hangyul-univ-og-v1.jpg`))), 'live OG image is byte-identical to the canonical card');
      check(!/noindex|none/.test(r.headers.get('x-robots-tag') ?? ''), 'live OG image has no robots restriction');
    }
  }
}

console.log(`qa:brand — ${passed} passed, ${failed} failed${BASE ? ` (live: ${BASE})` : ''}`);
process.exit(failed ? 1 : 0);
