#!/usr/bin/env node
/**
 * Accessibility and behaviour check of the public university detail page.
 *
 *   BASE=http://localhost:3100 node scripts/qa/university-detail-a11y.mjs [slugs] [lang]
 *
 * Per page, at 390 and 1440: axe-core (WCAG 2.1 A/AA), heading order (no skipped level), every image has an alt
 * attribute, nothing below the hero loads eagerly, no horizontal overflow, the level selector answers the keyboard and
 * the video iframe does not exist until Play is pressed. Exits 1 on a serious/critical axe violation or a failed check.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const [slugs = 'ajou-university,sejong-university,inst-668', lang = 'en'] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:3100';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b = await chromium.launch({ args: ['--headless=new'] });
let failed = false;
const fail = (msg) => { failed = true; console.log(`  FAIL ${msg}`); };

for (const slug of slugs.split(',')) for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/universities/${slug}?lang=${lang}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.hg-unid', { timeout: 15000 });
  await p.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(400);
  console.log(`${slug} @${w}`);

  await p.addScriptTag({ content: axe });
  const res = await p.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  for (const v of res.violations) {
    const bad = v.impact === 'serious' || v.impact === 'critical';
    const inPage = v.nodes.filter((n) => n.target.some((t) => String(t).includes('hg-un')) || n.html.includes('hg-un'));
    console.log(`  ${bad ? 'AXE' : 'axe'} ${v.impact} ${v.id} ×${v.nodes.length} (in detail page: ${inPage.length}) ${v.nodes[0].target.join(' ')}`);
    if (bad && inPage.length) failed = true;
  }

  const m = await p.evaluate(() => {
    const root = document.querySelector('.hg-unid');
    const hs = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    const skips = hs.filter((l, i) => i > 0 && l > hs[i - 1] + 1).length;
    const imgs = [...root.querySelectorAll('img')];
    return {
      h1: hs.filter((l) => l === 1).length, skips,
      noAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
      eager: imgs.filter((i) => !i.closest('.hg-uni-hero') && i.loading !== 'lazy').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      iframes: root.querySelectorAll('iframe').length,
    };
  });
  if (m.h1 !== 1) fail(`h1 count ${m.h1}`);
  if (m.skips) fail(`${m.skips} skipped heading level(s)`);
  if (m.noAlt) fail(`${m.noAlt} image(s) without alt`);
  if (m.eager) fail(`${m.eager} eager image(s) below the hero`);
  if (m.overflow) fail('horizontal overflow');
  if (m.iframes) fail('video iframe present before Play');

  const levels = p.locator('.hg-unid-level');
  if (await levels.count() > 1) {
    await levels.nth(1).focus();
    await p.keyboard.press('Enter');
    if (await levels.nth(1).getAttribute('aria-pressed') !== 'true') fail('level selector did not answer the keyboard');
  }
  const play = p.locator('.hg-uni-video__play');
  if (await play.count()) {
    await play.focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('.hg-uni-video__frame iframe', { timeout: 3000 }).catch(() => fail('Play did not create the player'));
  }
  await ctx.close();
}
await b.close();
console.log(failed ? 'FAILED' : 'OK');
process.exit(failed ? 1 : 0);
