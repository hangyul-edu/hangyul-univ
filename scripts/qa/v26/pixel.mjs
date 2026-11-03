// V26 — pixel-identity check for refactors that must not change what users see (the CSS consolidation, REPORT §347).
//   node scripts/qa/v26/pixel.mjs shoot <label>        viewport + full-page shots of the core routes at 1440 and 390
//   node scripts/qa/v26/pixel.mjs diff <a> <b>         per-shot share of differing pixels (threshold 0 = identical)
// Reduced motion on, animations frozen, one Chromium.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
const DIR = path.join(ROOT, 'docs/qa/v26/_work/pix');
const SETS = [
  ['marketing', 'http://localhost:3100', null, ['/', '/universities', '/universities/yonsei-university', '/universities/inst-2640', '/start', '/privacy']],
  ['student', 'http://localhost:3101', 'student@demo.hangyul.kr', ['/', '/explore?tab=foryou', '/services', '/applications', `/applications/${IDS.studentApplication}`, '/documents', `/essays/${IDS.studentEssay}`, '/messages', '/universities/pusan-national-university', '/visa']],
  ['agency', 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr', ['/', '/students', '/review', '/messages', '/performance', '/settings']],
  ['university', 'http://localhost:3103', 'admin@pusan.univ.demo.hangyul.kr', ['/', `/applications/${IDS.universityApplication}`, '/analytics', '/cohorts', '/agencies']],
];
const [mode, a, b] = process.argv.slice(2);

if (mode === 'shoot') {
  const browser = await chromium.launch();
  for (const [name, base, login, routes] of SETS) {
    for (const w of [1440, 390]) {
      const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
      await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
      const p = await ctx.newPage();
      if (login) { await p.goto(`${base}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
      for (const r of routes) {
        await p.goto(`${base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
        await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        for (let y = 0; y < 10; y += 1) { await p.mouse.wheel(0, 900); await p.waitForTimeout(60); }
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(700);
        const out = path.join(DIR, a, name); fs.mkdirSync(out, { recursive: true });
        await p.screenshot({ path: path.join(out, `${r.replace(/[/?=&:]/g, '_') || 'home'}-${w}.png`), fullPage: true });
      }
      await ctx.close();
    }
    process.stdout.write(`${name} `);
  }
  await browser.close();
  console.log(`→ ${path.relative(ROOT, path.join(DIR, a))}`);
} else if (mode === 'diff') {
  let identical = 0; let differ = 0;
  for (const [name] of SETS) {
    const da = path.join(DIR, a, name); if (!fs.existsSync(da)) continue;
    for (const f of fs.readdirSync(da)) {
      const fb = path.join(DIR, b, name, f);
      if (!fs.existsSync(fb)) { console.log(`MISSING ${name}/${f}`); differ += 1; continue; }
      const A = PNG.sync.read(fs.readFileSync(path.join(da, f))); const B = PNG.sync.read(fs.readFileSync(fb));
      if (A.width !== B.width || A.height !== B.height) { console.log(`SIZE    ${name}/${f} ${A.width}×${A.height} → ${B.width}×${B.height}`); differ += 1; continue; }
      let n = 0;
      for (let i = 0; i < A.data.length; i += 4) if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) n += 1;
      const share = n / (A.width * A.height);
      if (n === 0) identical += 1; else { differ += 1; console.log(`DIFF    ${name}/${f} ${(share * 100).toFixed(3)} % (${n} px)`); }
    }
  }
  console.log(`\nidentical ${identical} · different ${differ}`);
  process.exit(differ ? 1 : 0);
}
