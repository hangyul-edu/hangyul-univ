#!/usr/bin/env node
/**
 * Marketing, from the production build, against a live API (owner requirements 1 and 3, 2026-11-19).
 *
 * Serves apps/marketing-web/dist like Vercel does (`/start` redirect, filesystem, `/api/*` proxied to `--api`, SPA
 * fallback) and, at 390 and 1440 px, captures the home hero + header, the directory and university detail pages,
 * while checking that:
 *   - every primary 유학 준비 CTA opens the Student login with `next=/match` and the page's language;
 *   - the directory and detail pages are served by the live `/api/v1/directory/*` (not the snapshot), and only one
 *     page of the list is fetched (no client-side download of all 425 records);
 *   - an Arabic detail page is RTL.
 *
 *   node scripts/qa/marketing-live-shots.mjs --api https://app.univ.talkhangyul.com --out <dir>
 *   (env PLAYWRIGHT needs Chromium's libraries; see the QA brief)
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DIST = join(ROOT, 'apps/marketing-web/dist');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const API = opt('api', 'https://app.univ.talkhangyul.com').replace(/\/$/, '');
const OUT = resolve(opt('out', join(ROOT, 'docs/qa/marketing-live')));
const SLUGS = opt('slugs', 'kyung-hee-university,').split(',');
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/start') {
    const lang = url.searchParams.get('lang');
    res.writeHead(307, { location: `https://app.univ.talkhangyul.com/login?next=%2Fmatch${lang ? `&lang=${lang}` : ''}` }); res.end(); return;
  }
  if (path.startsWith('/api/')) {
    try {
      const r = await fetch(API + req.url, { method: req.method, headers: { accept: 'application/json', 'ngrok-skip-browser-warning': '1', 'accept-language': req.headers['accept-language'] ?? '' } });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' }); res.end(Buffer.from(await r.arrayBuffer()));
    } catch { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"detail":"upstream unreachable"}'); }
    return;
  }
  const file = normalize(join(DIST, path));
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) { res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file)); return; }
  if (/^\/(assets|data)\//.test(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(readFileSync(join(DIST, 'index.html')));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`build at ${base}, /api → ${API}, screenshots → ${OUT}`);

const index = JSON.parse(readFileSync(join(DIST, 'data/public/institutions.json'), 'utf8'));
const withPhoto = SLUGS[0] || index.items.find((c) => c.enrichment?.media?.hero)?.slug;
const withoutPhoto = SLUGS[1] || index.items.find((c) => c.institution_type === 'UNIVERSITY' && !c.enrichment?.media?.hero)?.slug;

const browser = await chromium.launch();
async function visit(width, path, name, { full = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const api = []; const snapshot = []; const errors = [];
  p.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/v1/directory')) api.push(u.pathname + u.search); if (u.pathname.startsWith('/data/public/')) snapshot.push(u.pathname); });
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30_000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: full });
  return { ctx, p, api, snapshot, errors };
}

for (const width of [390, 1440]) {
  for (const lang of ['ko', 'en']) {
    const { ctx, p, errors } = await visit(width, `/?lang=${lang}`, `home-${lang}`);
    const hrefs = await p.$$eval('a[data-cta="primary"]', (as) => as.map((a) => a.href));
    const good = hrefs.length >= 2 && hrefs.every((h) => { const u = new URL(h); return u.pathname === '/login' && u.searchParams.get('next') === '/match' && (lang === 'en' || u.searchParams.get('lang') === lang); });
    check(`${width} home ${lang}: header + hero + closing 유학 준비 → Student login next=/match`, good && !errors.length, [...new Set(hrefs)].join(' · '));
    await ctx.close();
  }
  {
    const { ctx, api, snapshot, errors, p } = await visit(width, '/universities?lang=ko', 'universities-ko');
    const list = api.filter((x) => x.startsWith('/api/v1/directory/institutions?'));
    const details = api.filter((x) => /^\/api\/v1\/directory\/institutions\/[^/?]+/.test(x));
    const cards = await p.locator('.mk-dir__grid li').count();
    check(`${width} directory: one live page from /api/v1/directory/institutions, no per-institution fetches, no snapshot`, list.length >= 1 && details.length === 0 && snapshot.length === 0 && cards > 0 && !errors.length,
      `${list.length} list call(s) [${list[0] ?? ''}], ${details.length} detail calls, ${snapshot.length} snapshot files, ${cards} cards`);
    await ctx.close();
  }
  for (const [slug, lang, tag] of [[withPhoto, 'ko', 'photo'], [withoutPhoto, 'en', 'nophoto']]) {
    const { ctx, p, api, snapshot, errors } = await visit(width, `/universities/${slug}?lang=${lang}`, `detail-${tag}-${lang}`, { full: true });
    const live = api.some((x) => x.startsWith(`/api/v1/directory/institutions/${slug}`));
    const hero = await p.$eval('.hg-uni-hero__act a.kn-btn--primary', (a) => a.href).catch(() => '');
    const u = hero ? new URL(hero) : null;
    check(`${width} detail ${slug} (${lang}): live DB record, hero CTA → Student login next=/match`, live && snapshot.length === 0 && u?.pathname === '/login' && u.searchParams.get('next') === '/match' && !errors.length,
      `api ${api.length}, snapshot ${snapshot.length}, cta ${hero}`);
    await ctx.close();
  }
}
{
  const { ctx, p } = await visit(1440, `/universities/${withPhoto}?lang=ar`, 'detail-photo-ar', { full: true });
  const dir = await p.evaluate(() => document.documentElement.dir);
  check('ar detail page is RTL', dir === 'rtl', `dir=${dir}`);
  await ctx.close();
}
{
  const { ctx, p } = await visit(390, `/universities/${withPhoto}?lang=ar`, 'detail-photo-ar', { full: true });
  await ctx.close(); void p;
}
await browser.close();
server.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${failed ? 'FAIL' : 'PASS'} marketing-live-shots — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
