/**
 * Hostile sweep: find every element whose computed background is solid Hangyul tangerine and whose
 * computed foreground is NOT the canonical light foreground — at rest, hover, focus and active.
 */
import { chromium } from '@playwright/test';

const ORANGE = [
  [204, 78, 0],   // --hg-primary        #CC4E00
  [179, 68, 0],   // --hg-primary-hover  #B34400
  [158, 60, 0],   // --hg-primary-pressed#9E3C00
  [255, 103, 0],  // legacy tangerine
];
const near = (rgb, target, tol = 26) => rgb.every((v, i) => Math.abs(v - target[i]) <= tol);
const isOrange = (rgb) => ORANGE.some((o) => near(rgb, o));
const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[,\/]/).map((x) => parseFloat(x)); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };

// Relative luminance → is this a light foreground?
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

const SCAN = () => {
  const out = [];
  const els = document.querySelectorAll('a,button,[role="button"],input[type="submit"],input[type="button"],.kn-btn,.hg-btn');
  for (const el of els) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 120) : '',
      text: (el.textContent || '').trim().slice(0, 48),
      bg: cs.backgroundColor, fg: cs.color,
      svgFill: (() => { const s = el.querySelector('svg'); return s ? getComputedStyle(s).color : null; })(),
    });
  }
  return out;
};

const urls = process.argv.slice(2);
const browser = await chromium.launch();
const findings = [];
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch { }
  await page.waitForTimeout(600);
  // rest
  const rest = await page.evaluate(SCAN);
  for (const e of rest) {
    const bg = parse(e.bg), fg = parse(e.fg);
    if (!bg || !fg || bg.a < 0.9) continue;
    if (!isOrange(bg.rgb)) continue;
    const ok = lum(fg.rgb) > 0.6;
    if (!ok) findings.push({ url, state: 'rest', ...e });
  }
  // hover / focus / active on each orange control
  const handles = await page.$$('a,button,[role="button"],.kn-btn,.hg-btn');
  for (const h of handles) {
    let info;
    try { info = await h.evaluate((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { bg: cs.backgroundColor, w: r.width, h: r.height, cls: String(el.className).slice(0, 120), text: (el.textContent || '').trim().slice(0, 48) }; }); } catch { continue; }
    if (info.w < 4 || info.h < 4) continue;
    const bg0 = parse(info.bg);
    const candidate = bg0 && bg0.a > 0.9 && isOrange(bg0.rgb);
    // also probe non-orange controls — hover may TURN them orange
    for (const state of ['hover', 'focus', 'active']) {
      try {
        if (state === 'hover') await h.hover({ timeout: 2000 });
        else if (state === 'focus') await h.focus({ timeout: 2000 });
        else { await page.mouse.move(0, 0); await h.hover({ timeout: 2000 }); await page.mouse.down(); }
        const after = await h.evaluate((el) => { const cs = getComputedStyle(el); const s = el.querySelector('svg'); return { bg: cs.backgroundColor, fg: cs.color, svg: s ? getComputedStyle(s).color : null }; });
        if (state === 'active') await page.mouse.up();
        const bg = parse(after.bg), fg = parse(after.fg);
        if (!bg || !fg || bg.a < 0.9 || !isOrange(bg.rgb)) continue;
        if (lum(fg.rgb) <= 0.6) findings.push({ url, state, cls: info.cls, text: info.text, bg: after.bg, fg: after.fg });
        if (after.svg) { const sv = parse(after.svg); if (sv && lum(sv.rgb) <= 0.6) findings.push({ url, state: state + ':icon', cls: info.cls, text: info.text, bg: after.bg, fg: after.svg }); }
      } catch { }
    }
    void candidate;
  }
  if (errs.length) findings.push({ url, state: 'console', text: errs.slice(0, 3).join(' | ') });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(findings, null, 1));
console.log('FINDINGS', findings.filter((f) => f.state !== 'console').length);
