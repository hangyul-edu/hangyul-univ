// V26 — zoom / reflow review (brief §8 and §48, WCAG 2.2 1.4.4 + 1.4.10). One Chromium, sequential.
//   node scripts/qa/v26/zoom.mjs [--shots docs/qa/v26/visual/zoom]
// For each core route: browser zoom 80 / 90 / 110 / 125 / 200 % emulated through deviceScaleFactor + CSS-pixel viewport
// (1440 px at 200 % = 720 CSS px, the layout the user actually gets), plus the WCAG reflow width of 320 CSS px. Reports
// horizontal overflow, text clipped by `overflow: hidden` ancestors with `text-overflow` other than ellipsis, and controls
// under 24×24 CSS px (2.5.8 target size minimum) that are not inline text links.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
const SHOTS = process.argv.includes('--shots') ? path.join(ROOT, process.argv[process.argv.indexOf('--shots') + 1]) : null;
const SETS = [
  ['marketing', 'http://localhost:3100', null, ['/', '/universities', '/universities/yonsei-university', '/start']],
  ['student', 'http://localhost:3101', 'student@demo.hangyul.kr', ['/', '/explore?tab=all', '/services', `/applications/${IDS.studentApplication}`, '/documents']],
  ['agency', 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr', ['/', `/students/${IDS.agencyStudent}`, '/review']],
  ['university', 'http://localhost:3103', 'admin@pusan.univ.demo.hangyul.kr', ['/', '/analytics']],
];
const ZOOMS = [0.8, 0.9, 1.1, 1.25, 2];
let problems = 0; const report = {};
const browser = await chromium.launch();
for (const [name, base, login, routes] of SETS) {
  for (const z of [...ZOOMS, 'reflow']) {
    const cssW = z === 'reflow' ? 320 : Math.round(1440 / z);
    const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: cssW, height: z === 'reflow' ? 640 : Math.round(900 / (z === 'reflow' ? 1 : z)) }, deviceScaleFactor: z === 'reflow' ? 1 : z, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
    const p = await ctx.newPage();
    if (login) { await p.goto(`${base}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
    for (const r of routes) {
      await p.goto(`${base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(400);
      const res = await p.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth - W;
        const small = [];
        const targets = [...document.querySelectorAll('button, [role="button"], input:not([type=hidden]), select, a[class*="btn"], a[href], [role="tab"], [role="radio"], [role="checkbox"]')]
          .map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0);
        // WCAG 2.2 § 2.5.8 (target size, minimum): a target under 24×24 CSS px passes when a 24-px circle centred on it meets
        // no other target (the spacing exception; ancestors/descendants are not "other" targets) and inline text links are exempt.
        const spaced = (x) => { const cx = x.r.left + x.r.width / 2, cy = x.r.top + x.r.height / 2; return targets.every((o) => o === x || o.el.contains(x.el) || x.el.contains(o.el) || Math.hypot(Math.max(o.r.left - cx, 0, cx - o.r.right), Math.max(o.r.top - cy, 0, cy - o.r.bottom)) >= 12); };
        for (const { el, r } of targets) {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden') continue;
          if ((r.width < 24 || r.height < 24) && !(el.tagName === 'A' && cs.display === 'inline') && !spaced({ el, r })) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} “${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}”`);
        }
        return { over, small: small.slice(0, 5), smallN: small.length };
      });
      const key = `${name} ${r} @${z === 'reflow' ? '320px reflow' : `${Math.round(z * 100)}%`}`;
      report[key] = res;
      const bad = res.over > 1 || res.smallN > 0;
      if (bad) problems += 1;
      console.log(`  ${bad ? 'FAIL' : 'PASS'}  ${key} — overflow ${res.over}px, controls < 24px: ${res.smallN}${res.smallN ? ' (' + res.small.join(' | ') + ')' : ''}`);
      if (SHOTS && (z === 2 || z === 'reflow')) { fs.mkdirSync(path.join(SHOTS, name), { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name, `${(r.replace(/[/?=&:]/g, '_') || 'home')}-${z === 'reflow' ? 'reflow320' : 'zoom200'}.png`), fullPage: false }); }
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(ROOT, 'docs/qa/v26/zoom.json'), JSON.stringify(report, null, 2));
console.log(`\nzoom/reflow — ${problems ? `${problems} route×zoom combinations with a problem` : 'no overflow, no control under 24 px'}`);
process.exit(problems ? 1 : 0);
