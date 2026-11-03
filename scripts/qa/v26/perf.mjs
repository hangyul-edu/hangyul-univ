// V26 — lab performance of the PRODUCTION builds (REPORT §339 / §348, brief §49–§51).
//   node scripts/qa/v26/perf.mjs build            # vite build of the 4 apps into dist-perf (sequential, one at a time)
//   node scripts/qa/v26/perf.mjs measure <label>  # vite preview on 4610–4613 against the dev API :8001; 3 cold loads per route
//
// Per route (median of 3 cold loads, fresh context each, 1440×900, no throttling — lab, local): LCP, CLS, long-task total,
// request count, transferred JS / CSS / image bytes, API request count and duplicate API requests. Writes
// docs/qa/v26/perf-<label>.json. Signed-in routes sign in a fixture account through the real login (isolated test DB).
import { FIXTURE_PASSWORD } from '../auth.mjs';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
const PORTS = { marketing: 4610, student: 4611, agency: 4612, university: 4613 };
const PLAN = {
  marketing: { login: null, routes: ['/', '/universities', '/universities/yonsei-university'] },
  student: { login: 'student@demo.hangyul.kr', routes: ['/', '/explore', `/applications/${IDS.studentApplication}`, '/services'] },
  agency: { login: 'counselor@lotus.demo.hangyul.kr', routes: ['/', `/students/${IDS.agencyStudent}`] },
  university: { login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/analytics'] },
};
const env = { ...process.env, HG_API_URL: 'http://127.0.0.1:8001',
  VITE_MARKETING_URL: `http://localhost:${PORTS.marketing}`, VITE_STUDENT_APP_URL: `http://localhost:${PORTS.student}`,
  VITE_AGENCY_APP_URL: `http://localhost:${PORTS.agency}`, VITE_UNIVERSITY_APP_URL: `http://localhost:${PORTS.university}` };
const [mode, label = 'before'] = process.argv.slice(2);
// `bundle <label>` measures the static entry bundle (no server needed); `measure <label>` the routes.

if (mode === 'build') {
  for (const app of Object.keys(PORTS)) {
    console.log(`build ${app}`);
    execFileSync('npx', ['vite', 'build', '--outDir', 'dist-perf', '--emptyOutDir'], { cwd: path.join(ROOT, `apps/${app}-web`), env, stdio: 'inherit' });
  }
  process.exit(0);
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const wait = async (url, ms = 60_000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return; } catch { /* */ } await new Promise((r) => setTimeout(r, 500)); } throw new Error(`timeout ${url}`); };

async function measureOnce(browser, base, login, route) {
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ }
    window.__lcp = 0; window.__cls = 0; window.__long = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  const p = await ctx.newPage();
  if (login) {
    // The request context shares the browser's cookie jar: the refresh cookie set here is what the app restores from.
    const client = login.includes('univ.') ? 'university' : login.includes('@lotus') || login.includes('@demo.') && !login.startsWith('student') ? 'agency' : 'student';
    await p.request.post('http://127.0.0.1:8001/api/v1/auth/login', { data: { email: login, password: FIXTURE_PASSWORD, client } });
    await p.goto(`${base}/?lang=ko`, { waitUntil: 'networkidle' });
  }
  const bytes = { js: 0, css: 0, img: 0, other: 0 }; let requests = 0; const api = [];
  p.on('response', async (res) => {
    requests += 1;
    const u = res.url(); const ty = res.request().resourceType();
    if (u.includes('/api/')) api.push(`${res.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
    const len = Number((await res.headerValue('content-length').catch(() => null)) ?? 0) || (await res.body().catch(() => Buffer.alloc(0))).length;
    if (ty === 'script') bytes.js += len; else if (ty === 'stylesheet') bytes.css += len; else if (ty === 'image') bytes.img += len; else bytes.other += len;
  });
  await p.goto(`${base}${route}${route.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const m = await p.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, long: window.__long }));
  await ctx.close();
  const seen = new Map(); for (const a of api) seen.set(a, (seen.get(a) ?? 0) + 1);
  return { ...m, requests, ...bytes, api: api.length, duplicateApi: [...seen.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0), dupList: [...seen].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`) };
}

// Reboot-safe (this VM restarts under memory pressure): every route is written as soon as it is measured, and a rerun
// skips the routes already in the file.
const OUT = path.join(ROOT, `docs/qa/v26/perf-${label}.json`);
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
if (mode === 'bundle') {
  // Static: the JS/CSS the entry HTML loads before any route code (entry + modulepreload + stylesheet), gzip-free bytes.
  out._bundle = {};
  for (const app of Object.keys(PORTS)) {
    const dist = path.join(ROOT, `apps/${app}-web/dist-perf`);
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    const size = (f) => fs.statSync(path.join(dist, f)).size;
    const all = fs.readdirSync(path.join(dist, 'assets'));
    out._bundle[app] = {
      entry_js_kb: Math.round(refs.filter((r) => r.endsWith('.js')).reduce((a, r) => a + size(r), 0) / 1024),
      entry_css_kb: Math.round(refs.filter((r) => r.endsWith('.css')).reduce((a, r) => a + size(r), 0) / 1024),
      total_js_kb: Math.round(all.filter((f) => f.endsWith('.js')).reduce((a, f) => a + size(`/assets/${f}`), 0) / 1024),
      total_css_kb: Math.round(all.filter((f) => f.endsWith('.css')).reduce((a, f) => a + size(`/assets/${f}`), 0) / 1024),
      chunks: all.filter((f) => f.endsWith('.js')).length,
    };
    console.log(app, out._bundle[app]);
  }
  save();
  process.exit(0);
}
const browser = await chromium.launch();
for (const [app, port] of Object.entries(PORTS)) {
  const prev = spawn('npx', ['vite', 'preview', '--outDir', 'dist-perf', '--port', String(port), '--strictPort'], { cwd: path.join(ROOT, `apps/${app}-web`), env, detached: true, stdio: 'ignore' });
  try {
    await wait(`http://localhost:${port}/`);
    out[app] ??= {};
    for (const r of PLAN[app].routes) {
      if (out[app][r]) continue;
      const runs = [];
      for (let i = 0; i < 3; i += 1) runs.push(await measureOnce(browser, `http://localhost:${port}`, PLAN[app].login, r));
      const pick = (k) => median(runs.map((x) => x[k]));
      out[app][r] = { lcp_ms: Math.round(pick('lcp')), cls: Number(pick('cls').toFixed(3)), long_task_ms: Math.round(pick('long')), requests: pick('requests'),
        js_kb: Math.round(pick('js') / 1024), css_kb: Math.round(pick('css') / 1024), img_kb: Math.round(pick('img') / 1024), api: pick('api'),
        duplicate_api: pick('duplicateApi'), duplicates: runs[0].dupList };
      save();
      console.log(`${app.padEnd(10)} ${r.slice(0, 44).padEnd(44)} LCP ${out[app][r].lcp_ms} ms · CLS ${out[app][r].cls} · long ${out[app][r].long_task_ms} ms · req ${out[app][r].requests} · JS ${out[app][r].js_kb} KB · CSS ${out[app][r].css_kb} KB · img ${out[app][r].img_kb} KB · api ${out[app][r].api} (dup ${out[app][r].duplicate_api})`);
    }
  } finally { try { process.kill(-prev.pid, 'SIGTERM'); } catch { /* */ } }
}
await browser.close();
save();
console.log(`→ ${path.relative(ROOT, OUT)}`);
