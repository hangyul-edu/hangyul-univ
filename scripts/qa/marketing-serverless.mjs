#!/usr/bin/env node
// `npm run qa:marketing-serverless` — the public Marketing site must work with the FastAPI service OFFLINE (P0, 2026-11-03).
//
// Serves the PRODUCTION build (apps/marketing-web/dist) from a tiny static server that mirrors the Vercel routing in
// apps/marketing-web/vercel.json — filesystem first, `/api/*` answered 503 (the API is down), missing `/assets/*` 404,
// everything else index.html — and drives it with Playwright. Any browser request to localhost:8001 / 127.0.0.1 or to a
// localhost origin other than this server fails the gate.
//
//   BASE=https://univ.talkhangyul.com node scripts/qa/marketing-serverless.mjs   # same checks against a live deployment
//   ROUTES=all (default) | sample                                                  # every institution slug, or the sample
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DIST = join(ROOT, 'apps/marketing-web/dist');
const DATA = join(ROOT, 'apps/marketing-web/public/data/public');
const ROUTES = process.env.ROUTES ?? 'all';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

// ------------------------------------------------------------------------------------------- 1. bundle scan
let base = process.env.BASE;
let server;
if (!base) {
  if (!existsSync(join(DIST, 'index.html'))) { console.error('no production build — run: npm run build -w @hangyul/marketing-web'); process.exit(2); }
  const hits = [];
  for (const f of readdirSync(join(DIST, 'assets')).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(join(DIST, 'assets', f), 'utf8');
    // A runtime dependency is a URL with a host AND a port; prose (the mobile help text mentions 10.0.2.2:8001) and
    // the router's port-less `new URL("http://localhost")` parse base are not.
    for (const m of src.matchAll(/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1):\d+/g)) hits.push(`${f}: ${m[0]}`);
  }
  check('bundle: no localhost / 127.0.0.1 URL with a port', hits.length === 0, hits.slice(0, 5).join(', '));

  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
  // The Quick Fit function, run locally exactly as deployed (apps/marketing-web/api/public-fit.py's `handler`).
  const py = join(ROOT, 'server/.venv/bin/python');
  const fnProc = spawn(existsSync(py) ? py : 'python3', ['-c', [
    'import importlib.util, sys', 'from http.server import ThreadingHTTPServer',
    `s = importlib.util.spec_from_file_location("pf", ${JSON.stringify(join(ROOT, 'apps/marketing-web/api/public-fit.py'))})`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    'srv = ThreadingHTTPServer(("127.0.0.1", 0), m.handler); print(srv.server_address[1], flush=True); srv.serve_forever()'].join('\n')],
  { stdio: ['ignore', 'pipe', 'inherit'] });
  const fnPort = await new Promise((r, j) => { fnProc.stdout.once('data', (d) => r(Number(String(d).trim()))); fnProc.once('exit', (c) => j(new Error(`fit function exited ${c}`))); });
  process.on('exit', () => fnProc.kill());
  const proxyFn = (req, res, path) => {
    const up = httpRequest({ host: '127.0.0.1', port: fnPort, path, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(up);
  };
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    // = the marketing rewrites in apps/marketing-web/vercel.json
    if (path === '/api/v1/public/fit') return proxyFn(req, res, '/api/public-fit');
    const adm = path.match(/^\/api\/v1\/directory\/institutions\/([^/]+)\/admissions$/);
    if (adm) return proxyFn(req, res, `/api/public-fit?admissions=${encodeURIComponent(adm[1])}${url.search ? `&${url.search.slice(1)}` : ''}`);
    if (path.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"detail":"API offline (qa:marketing-serverless)"}'); return; }
    const file = normalize(join(DIST, path));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file)); return;
    }
    if (path.startsWith('/assets/') || path.startsWith('/data/')) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(readFileSync(join(DIST, 'index.html')));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log(`serving the production build at ${base} (FastAPI offline: /api/* → 503; Quick Fit → the serverless function)`);
}
const ORIGIN = new URL(base).origin;

// ------------------------------------------------------------------------------------------- 2. canonical data
const index = JSON.parse(readFileSync(join(DATA, 'institutions.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'));
const regions = JSON.parse(readFileSync(join(DATA, 'regions.json'), 'utf8'));
const EXPECTED = manifest.institutions;
const bySlug = new Map(index.items.map((c) => [c.slug, c]));
check('canonical dataset: institutions.json matches manifest and regions', index.items.length === EXPECTED && regions.total === EXPECTED, `${EXPECTED} institutions`);

// ------------------------------------------------------------------------------------------- 3. browser
const browser = await chromium.launch();
const offenders = new Set();
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await p.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(u.hostname);
    if (u.port === '8001' || (local && u.origin !== ORIGIN)) { offenders.add(u.href); return route.abort(); }
    return route.continue();
  });
  return { ctx, p, errors };
}
const countText = (p) => p.locator('.mk-dir__count').innerText({ timeout: 15000 }).catch(() => '');
const digits = (s) => Number((s.match(/[\d,.٬،]+/g) ?? []).join('').replace(/[^\d]/g, '')) || 0;

// Homepage + marquee
{
  const { ctx, p, errors } = await page();
  await p.goto(`${base}/?lang=en`, { waitUntil: 'networkidle' });
  const links = await p.$$eval('.kn-marquee__group:not([aria-hidden]) a[href*="/universities/"]', (as) => as.map((a) => new URL(a.href).pathname + new URL(a.href).search));
  const unknown = links.filter((h) => !bySlug.has(h.split('?')[0].split('/').pop()));
  const kept = links.filter((h) => h.includes('lang=en'));
  check('homepage renders', (await p.title()).length > 0 && errors.length === 0, errors.join(' | '));
  check('marquee: every logo links to a canonical university detail', links.length > 0 && unknown.length === 0, `${links.length} links${unknown.length ? `, unknown: ${unknown.slice(0, 3)}` : ''}`);
  check('marquee: links preserve the locale', kept.length === links.length, `${kept.length}/${links.length}`);
  if (links[0]) {
    await p.goto(`${base}${links[0]}`, { waitUntil: 'networkidle' });
    const slug = links[0].split('?')[0].split('/').pop();
    const c = bySlug.get(slug);
    const title = await p.title();
    check('marquee: first logo opens the right university', title.includes(c.name_en ?? c.name_ko) || title.includes(c.name_ko), title);
  }
  await ctx.close();
}

// Directory, locales, search, filter
for (const lang of ['en', 'ko', 'vi', 'zh-Hans', 'ja', 'ar']) {
  const { ctx, p, errors } = await page();
  await p.goto(`${base}/universities?lang=${lang}`, { waitUntil: 'networkidle' });
  const n = digits(await countText(p));
  const cards = await p.locator('.mk-dir__grid li').count();
  const notFound = await p.getByText("We couldn't find that page.").count();
  check(`directory ${lang}: ${EXPECTED} institutions, cards rendered`, n === EXPECTED && cards > 0 && notFound === 0 && errors.length === 0, `count=${n} cards=${cards}${errors.length ? ` errors=${errors[0]}` : ''}`);
  await ctx.close();
}
{
  const { ctx, p } = await page();
  await p.goto(`${base}/universities?lang=en&q=Yonsei`, { waitUntil: 'networkidle' });
  const first = await p.locator('.mk-dir__grid li').first().innerText().catch(() => '');
  check('search: "Yonsei" ranks Yonsei University first', /Yonsei University/i.test(first), first.split('\n')[0]);
  const busan = regions.regions.find((r) => r.key === 'Busan').count;
  await p.goto(`${base}/universities?lang=en&region=Busan`, { waitUntil: 'networkidle' });
  const n = digits(await countText(p));
  check('filter: region=Busan shows the canonical Busan count', n === busan, `${n} vs ${busan}`);
  await p.goto(`${base}/universities?lang=en&q=zzzzqqq`, { waitUntil: 'networkidle' });
  const empty = await countText(p);
  check('empty filter result is a real empty state (0 after a successful load)', digits(empty) === 0 && (await p.getByText("We couldn't find that page.").count()) === 0, empty);
  await ctx.close();
}

// Data failure is an error, not "0 institutions" and not not-found
{
  const { ctx, p } = await page();
  await p.route('**/data/public/institutions.json', (r) => r.abort());
  await p.goto(`${base}/universities?lang=en`, { waitUntil: 'networkidle' });
  // React Query retries a failed load (≈7 s of backoff) before it settles on the error state.
  await p.locator('[role="alert"]').first().waitFor({ timeout: 30000 }).catch(() => {});
  const count = await p.locator('.mk-dir__count').innerText().catch(() => '');
  const alert = await p.locator('[role="alert"]').count();
  const nf = await p.getByText("We couldn't find that page.").count();
  check('data-load failure → temporary error state (no false "0 institutions", no false 404)', alert > 0 && nf === 0 && !/\b0\b/.test(count), `alert=${alert} notFound=${nf} count="${count}"`);
  await ctx.close();
}

// Invalid slug is a genuine not-found
{
  const { ctx, p } = await page();
  await p.goto(`${base}/universities/no-such-university-xyz?lang=en`, { waitUntil: 'networkidle' });
  check('invalid slug → not-found', (await p.getByText("We couldn't find that page.").count()) > 0);
  await ctx.close();
}

// Quick Fit (public, serverless) + a detail page carrying the visitor's answers
{
  const { ctx, p, errors } = await page();
  const fitRes = p.waitForResponse((r) => r.url().endsWith('/api/v1/public/fit') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await p.goto(`${base}/start?lang=en&nationality=VN&level=BACHELOR&gpa=3.4&gpa_scale=4.0&langs=TOPIK:3`, { waitUntil: 'networkidle' });
  const countries = await p.locator('select option, [role="option"]').count().catch(() => 0);
  await p.getByRole('button', { name: 'Show my universities' }).click();
  const r = await fitRes;
  const body = r ? await r.json().catch(() => null) : null;
  await p.locator('.mk-qs__results').waitFor({ timeout: 20000 }).catch(() => {});
  const shown = await p.locator('.mk-qs__results a[href*="/universities/"]').count();
  check('Quick Fit: public flow returns real results without FastAPI', r?.status() === 200 && body?.total > 0 && shown > 0 && errors.length === 0,
    `status ${r?.status()} total ${body?.total} counts ${JSON.stringify(body?.counts)} links ${shown} countries ${countries}`);
  const admRes = p.waitForResponse((x) => /\/admissions\?/.test(x.url()), { timeout: 30000 }).catch(() => null);
  await p.goto(`${base}/universities/kaist?lang=en&level=MASTER&langs=TOEFL_IBT:90`, { waitUntil: 'networkidle' });
  const a = await admRes;
  const aj = a ? await a.json().catch(() => null) : null;
  check('detail with Quick Fit answers: scholarship summary from the fit engine', a?.status() === 200 && aj?.summary != null, `status ${a?.status()} summary ${aj?.summary ? aj.summary.count : null}`);
  await ctx.close();
}

// Detail pages: named sample + every slug
const named = ['seoul-national-university', 'yonsei-university', 'korea-university', 'kaist',
  'sungkyunkwan-university', 'hanyang-university', 'kyung-hee-university'];
const sample = [...named.filter((s) => bySlug.has(s))];
const regional = index.items.find((c) => c.region === 'Jeju' || c.region === 'Gangwon');
const small = index.items.find((c) => c.institution_type === 'JUNIOR_COLLEGE');
const withSchol = index.items.find((c) => (c.signals?.scholarships ?? 0) > 0);
const withoutSchol = index.items.find((c) => c.institution_type === 'UNIVERSITY' && !c.signals?.scholarships);
const fallbackMedia = index.items.find((c) => !c.enrichment?.media?.hero);
for (const c of [regional, small, withSchol, withoutSchol, fallbackMedia]) if (c && !sample.includes(c.slug)) sample.push(c.slug);
const missingNamed = named.filter((s) => !bySlug.has(s));
check('sample covers the named universities', missingNamed.length === 0, missingNamed.length ? `not in dataset: ${missingNamed}` : `${sample.length} slugs`);

{
  const { ctx, p } = await page();
  if (withSchol) {
    const adm = JSON.parse(readFileSync(join(DATA, 'admissions', `${withSchol.slug}.json`), 'utf8'));
    await p.goto(`${base}/universities/${withSchol.slug}?lang=ko`, { waitUntil: 'networkidle' });
    const body = await p.locator('body').innerText();
    const shown = adm.scholarships.some((s) => body.includes(s.name_display_ko ?? s.name));
    check('scholarship / public metadata rendered on detail', shown, `${withSchol.slug}: ${adm.scholarships.length} schemes`);
  }
  await ctx.close();
}

const slugs = ROUTES === 'sample' ? sample : [...sample, ...index.items.map((c) => c.slug).filter((s) => !sample.includes(s))];
let ok = 0; const bad = [];
{
  const { ctx, p, errors } = await page();
  for (const slug of slugs) {
    const c = bySlug.get(slug);
    errors.length = 0;
    const res = await p.goto(`${base}/universities/${slug}?lang=en`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction((names) => names.some((n) => document.title.includes(n)) || document.body.innerText.includes("We couldn't find that page.") || !!document.querySelector('[role="alert"]'),
      [c.name_en, c.name_ko].filter(Boolean), { timeout: 20000 }).catch(() => {});
    const title = await p.title();
    const right = [c.name_en, c.name_ko].filter(Boolean).some((n) => title.includes(n));
    const nf = await p.getByText("We couldn't find that page.").count();
    if (res?.status() === 200 && right && nf === 0 && errors.length === 0) ok++; else bad.push(`${slug} (status ${res?.status()}, title "${title}", notFound ${nf}, errors ${errors.length})`);
  }
  await ctx.close();
}
check(`university detail routes: ${ok}/${slugs.length} resolve to the right university`, ok === slugs.length && (ROUTES === 'sample' || slugs.length === EXPECTED), bad.slice(0, 5).join('; '));

check('no request to localhost:8001 / 127.0.0.1 / another localhost origin', offenders.size === 0, [...offenders].slice(0, 5).join(', '));
await browser.close();
server?.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? 'FAIL' : 'PASS'} qa:marketing-serverless — ${results.length - failed}/${results.length} checks${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
