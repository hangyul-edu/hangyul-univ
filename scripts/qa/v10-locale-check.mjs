/**
 * V10: render the rebuilt marketing home in each locale and check what translation actually breaks —
 * raw i18n keys, page overflow (long-language expansion), wrong `lang`/`dir`, and missing RTL mirroring.
 *
 *   node scripts/qa/v10-locale-check.mjs [loc,loc,…] [width,width,…]
 */
import { chromium } from 'playwright';

const LOCALES = (process.argv[2] ?? 'en,ko,vi,ne,my,uz,ar,ur,mn,zh-Hans,zh-Hant,ru,ja,th,id,hi,bn,kk,ky,tr,fil').split(',');
const WIDTHS = (process.argv[3] ?? '1440,390').split(',').map(Number);
const RTL = new Set(['ar', 'ur', 'fa', 'he', 'ps']);

const browser = await chromium.launch();
let bad = 0;
for (const loc of LOCALES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3100/?lang=${loc}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const txt = document.body.innerText;
      const raw = [...new Set([...txt.matchAll(/\b(?:v\d+|common|marketing)\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+/g)].map((m) => m[0]))];
      return {
        lang: document.documentElement.lang, dir: document.documentElement.dir, raw,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelector('h1')?.innerText.replace(/\n/g, ' ').slice(0, 44) ?? '(none)',
        screens: +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
      };
    });
    const dirOk = r.dir === (RTL.has(loc) ? 'rtl' : 'ltr');
    const problems = [
      r.raw.length ? `rawKeys=${r.raw.slice(0, 3).join(',')}` : null,
      r.overflow > 1 ? `overflow=${r.overflow}px` : null,
      r.lang !== loc ? `lang=${r.lang}` : null,
      dirOk ? null : `dir=${r.dir}`,
    ].filter(Boolean);
    if (problems.length) bad += problems.length;
    console.log(`${loc.padEnd(8)} @${String(w).padEnd(5)} ${r.screens.toString().padStart(5)} screens  ${problems.length ? '✗ ' + problems.join(' ') : '✓'}  "${r.h1}"`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${bad} problem(s)`);
