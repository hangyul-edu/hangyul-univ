#!/usr/bin/env node
// Design-foundation screenshots (Design Preview builds served by launch-final/serve.mjs).
//   node scripts/qa/_foundation-shots.mjs <outDir> [--widths 390,1440] [--apps student,agency,university,marketing] [--only name]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const widths = arg('--widths', '390,1440').split(',').map(Number);
const apps = arg('--apps', 'student,agency,university,marketing').split(',');
const only = arg('--only', null);
const lang = arg('--lang', 'en');
const BASE = { marketing: 'http://127.0.0.1:4100', student: 'http://127.0.0.1:4101', agency: 'http://127.0.0.1:4102', university: 'http://127.0.0.1:4103' };
const ROUTES = {
  student: { home: '/', explore: '/explore', applications: '/applications', appdetail: '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', documents: '/documents', tasks: '/tasks', messages: '/messages', notifications: '/notifications', profile: '/profile', settings: '/settings', essays: '/essays', login: '/login' },
  agency: { home: '/', students: '/students', student: '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e', tasks: '/tasks', review: '/review', applications: '/applications', appdetail: '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', performance: '/performance', settings: '/settings', team: '/team', notifications: '/notifications', messages: '/messages', login: '/login' },
  university: { home: '/', applicants: '/applicants', appdetail: '/applications/8a3d287f-9d03-4198-8e72-7bfa14a2a3a8', programs: '/programs', analytics: '/analytics', settings: '/settings', documents: '/documents', messages: '/messages', notifications: '/notifications', login: '/login' },
  marketing: { home: '/', unidetail: '/universities/seoul-national-university' },
};
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const overflow = [];
for (const app of apps) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, locale: 'en-US', deviceScaleFactor: 1 });
    if (app !== 'marketing') await ctx.addInitScript(() => { try { if (!location.pathname.startsWith('/login')) sessionStorage.setItem('hg.designPreview', 'paid'); } catch {} });
    const page = await ctx.newPage();
    for (const [name, route] of Object.entries(ROUTES[app])) {
      if (only && !only.split(',').includes(name)) continue;
      try {
        await page.goto(`${BASE[app]}${route}${route.includes('?') ? '&' : '?'}lang=${lang}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(app === 'marketing' ? 1800 : 500);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight }));
        if (m.sw > m.iw) overflow.push(`${app} ${name} @${w}: ${m.sw} > ${m.iw}`);
        const maxH = app === 'marketing' ? 5000 : 2600;
        await page.screenshot({ path: path.join(out, `${app}-${name}-${w}.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(m.h, maxH) } });
      } catch (e) { console.log(`ERR ${app} ${name} ${w}: ${String(e.message).slice(0, 120)}`); }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(overflow.length ? `overflow:\n${overflow.join('\n')}` : 'no overflow');
