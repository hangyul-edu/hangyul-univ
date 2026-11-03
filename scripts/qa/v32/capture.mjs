#!/usr/bin/env node
/**
 * V32 — screenshots of the QA stack (scripts/qa/v32/stack.mjs) for the design pass.
 *
 *   node scripts/qa/v32/capture.mjs <label> [app:route ...] [--widths 1440,390] [--lang en]
 *   e.g. node scripts/qa/v32/capture.mjs before university:/ university:/applicants agency:/ student:/
 *
 * Signs the consoles in with the fixture accounts through the real login (the request context shares the browser's
 * cookie jar, so the app restores the session on the first navigation). Files: docs/qa/v32/shots/<label>/<app>-<route>-<w>.png
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const STATE = 'docs/qa/v32/.stack.json';
if (!existsSync(STATE)) { console.error('start the stack first: node scripts/qa/v32/stack.mjs start'); process.exit(2); }
const { ports } = JSON.parse(readFileSync(STATE, 'utf8'));
const args = process.argv.slice(2);
const label = args[0];
const widths = (args.includes('--widths') ? args[args.indexOf('--widths') + 1] : '1440,390').split(',').map(Number);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const targets = args.slice(1).filter((a) => a.includes(':') && !a.startsWith('--') && !/^\d/.test(a));
const LOGIN = { student: 'student@demo.hangyul.kr', agency: 'counselor@lotus.demo.hangyul.kr', university: 'admin@pusan.univ.demo.hangyul.kr' };
const PASSWORD = 'Hangyul!2026';
const OUT = `docs/qa/v32/shots/${label}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, isMobile: w < 500, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const signed = new Set();
  for (const target of targets) {
    const [app, route] = target.split(/:(.*)/s);
    const base = `http://localhost:${ports[app]}`;
    if (LOGIN[app] && !signed.has(app)) {
      // Through the app's own origin (the Vite proxy), so the refresh cookie is set for the host the app runs on.
      const r = await page.request.post(`${base}/api/v1/auth/login`, { data: { email: LOGIN[app], password: PASSWORD, client: app } });
      if (!r.ok()) console.error(`login failed for ${app}: ${r.status()}`);
      signed.add(app);
    }
    const url = `${base}${route}${route.includes('?') ? '&' : '?'}lang=${lang}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.error('goto', url, e.message.slice(0, 80)));
    await page.waitForTimeout(800);
    const name = `${app}-${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${w}.png`;
    const full = args.includes('--full');
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: full });
    console.log(`${OUT}/${name}`);
  }
  await ctx.close();
}
await browser.close();
