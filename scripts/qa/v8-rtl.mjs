// V8 RTL QA — marketing home + student home / explore / budget in ar, ur, fa, he at 390 and 1440.
// Usage: node scripts/qa/v8-rtl.mjs [locales=ar,ur,fa,he] [--out=docs/qa/v8/rtl]
// Needs the dev stack (marketing :3100, student :3101, API :8001). One Chromium, pages visited one after another.
// Checks per view:
//   dir      <html dir> must be "rtl"
//   overflow documentElement.scrollWidth <= innerWidth + 1; offenders = visible elements sticking out of the viewport
//   mirror   the header brand sits in the right half, and the first <h1> is not left-aligned (heuristic for mirrored layout)
//   physical visible text blocks whose computed text-align is a physical "left" (logical start/end are fine in RTL)
//   english  visible Latin-script words (≥ 3 letters) outside an allowlist = untranslated English fallbacks
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const args = process.argv.slice(2);
const out = (args.find((a) => a.startsWith('--out=')) ?? '--out=docs/qa/v8/rtl').slice(6);
const locales = (args.find((a) => !a.startsWith('--')) ?? 'ar,ur,fa,he').split(',');
const MK = 'http://localhost:3100', ST = 'http://localhost:3101';
const STUDENT = process.env.HG_RTL_STUDENT ?? 'student.offer@demo.hangyul.kr';
const WIDTHS = [[390, 844], [1440, 900]];
const VIEWS = [['mk-home', MK, '/'], ['st-home', ST, '/'], ['st-explore', ST, '/explore'], ['st-budget', ST, '/budget']];
fs.mkdirSync(out, { recursive: true });

const ALLOW = new Set(['hangyul', 'univ', 'topik', 'ielts', 'toefl', 'gpa', 'krw', 'usd', 'eur', 'vnd', 'bba', 'wikimedia', 'commons', 'demo', 'pdf', 'jpg', 'png']);

async function measure(p) {
  return p.evaluate((allow) => {
    const W = innerWidth;
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 || r.left < -1) {
        // skip children of an element that clips horizontally (carousels, scrollers)
        let a = el.parentElement, clipped = false;
        while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') { clipped = true; break; } a = a.parentElement; }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    const brand = document.querySelector('header a[href="/"], .hg-brand, [class*="brand"] a, header img');
    const br = brand?.getBoundingClientRect();
    const h1 = document.querySelector('h1');
    const physical = [...document.querySelectorAll('p, h1, h2, h3, h4, li, td, th, label, dt, dd')]
      .filter((el) => vis(el) && el.textContent.trim() && getComputedStyle(el).textAlign === 'left')
      .slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: ${el.textContent.trim().slice(0, 30)}`);
    const text = (document.querySelector('main') ?? document.body).innerText;
    const words = (text.match(/[A-Za-z][A-Za-z'’-]{2,}/g) ?? []).filter((w) => !allow.includes(w.toLowerCase()));
    const freq = {}; for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
    return {
      dir: document.documentElement.dir, lang: document.documentElement.lang,
      overflowPx: document.documentElement.scrollWidth - W,
      offenders: offenders.slice(0, 10), offenderCount: offenders.length,
      brandRight: br ? Math.round(br.left + br.width / 2) > W / 2 : null,
      h1Align: h1 ? getComputedStyle(h1).textAlign : null,
      physicalLeft: physical,
      englishWords: words.length,
      englishTop: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => `${w}×${n}`),
    };
  }, [...ALLOW]);
}

const b = await chromium.launch();
const report = [];
try {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  pageerror', e.message.slice(0, 120)));
  await p.goto(`${ST}/login?demo=${encodeURIComponent(STUDENT)}`);
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  for (const loc of locales) {
    for (const origin of [MK, ST]) { await p.goto(`${origin}/?lang=${loc}`, { waitUntil: 'domcontentloaded' }); await p.evaluate((l) => localStorage.setItem('hg.locale', l), loc); }
    for (const [name, origin, path] of VIEWS) {
      for (const [w, h] of WIDTHS) {
        await p.setViewportSize({ width: w, height: h });
        await p.goto(`${origin}${path}?lang=${loc}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
        await p.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(900);
        const m = await measure(p);
        const file = `${out}/${loc}-${name}-${w}.png`;
        await p.screenshot({ path: file, fullPage: true, clip: undefined }).catch(() => p.screenshot({ path: file }));
        const ok = m.dir === 'rtl' && m.overflowPx <= 1;
        report.push({ loc, view: name, width: w, file, ...m });
        console.log(`${ok ? 'ok ' : 'BAD'} ${loc} ${name} ${w} dir=${m.dir} ovf=${m.overflowPx} offenders=${m.offenderCount} brandRight=${m.brandRight} h1=${m.h1Align} left=${m.physicalLeft.length} en=${m.englishWords}`);
      }
    }
  }
} finally {
  await b.close();
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`wrote ${out}/report.json (${report.length} views)`);
