#!/usr/bin/env node
/**
 * Key-screen capture for design review (Design Preview builds served by serve.mjs).
 *
 *   node scripts/qa/launch-final/shots.mjs --out docs/qa/launch-final/excellence/screens/before [--only student] [--widths 390,1440] [--prod]
 *
 * `--prod` captures the four production domains (Design Preview must be enabled there for the signed-in screens).
 *
 * One PNG per screen × width, first viewport only (what a person sees before scrolling) plus `-full` for the
 * whole page at 390. The list is the screens the product-excellence pass is judged on, not every route.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY } from './routes.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', 'docs/qa/launch-final/excellence/screens/after'));
const ONLY = arg('--only', null);
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
const FULL = process.argv.includes('--full');
const off = Number(arg('--port-offset', 0));
fs.mkdirSync(OUT, { recursive: true });

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? { marketing: 'https://univ.talkhangyul.com', student: 'https://app.univ.talkhangyul.com', agency: 'https://admin.univ.talkhangyul.com', university: 'https://partner.univ.talkhangyul.com' }
  : { student: `http://127.0.0.1:${4101 + off}`, agency: `http://127.0.0.1:${4102 + off}`, university: `http://127.0.0.1:${4103 + off}`, marketing: `http://127.0.0.1:${4100 + off}` };
export const SCREENS = {
  marketing: [['home', '/'], ['directory', '/universities'], ['university', '/universities/pusan-national-university']],
  student: [
    ['home', '/'], ['match', '/match'], ['explore', '/explore'], ['saved', '/explore?tab=saved'],
    ['university', '/universities/pusan-national-university'], ['applications', '/applications'],
    ['application', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56'], ['documents', '/documents'],
    ['messages', '/messages'], ['thread', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d'], ['more', '/more'],
    ['profile', '/profile'], ['compare', '/compare'],
  ],
  agency: [
    ['today', '/'], ['students', '/students'], ['case', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=application'],
    ['review', '/review?mode=documents'], ['messages', '/messages/84a80fb9-97f6-4d60-b78f-1e13baf3021a'],
  ],
  university: [
    ['home', '/'], ['applicants', '/applicants'], ['applicant', '/applications/8a3d287f-9d03-4198-8e72-7bfa14a2a3a8'],
    ['analytics', '/analytics'],
  ],
};

const browser = await chromium.launch();
for (const [app, screens] of Object.entries(SCREENS)) {
  if (ONLY && !ONLY.split(',').includes(app)) continue;
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, locale: 'ko-KR', deviceScaleFactor: 1 });
    if (app !== 'marketing') {
      await ctx.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, v); } catch { /* opaque origin */ } }, [PREVIEW_KEY, 'paid']);
    }
    const page = await ctx.newPage();
    for (const [name, route] of screens) {
      const url = `${BASE[app]}${route}${route.includes('?') ? '&' : '?'}lang=ko`;
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(700);
      const file = path.join(OUT, `${app}-${name}-${width}.png`);
      await page.screenshot({ path: file });
      if (FULL && width < 768) await page.screenshot({ path: file.replace('.png', '-full.png'), fullPage: true });
    }
    await ctx.close();
  }
  console.log(`${app}: done`);
}
await browser.close();
