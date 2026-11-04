#!/usr/bin/env node
/**
 * `npm run qa:marketing-mobile-hotfix` — the two marketing phone fixes of 2026-11-04 stay fixed.
 *
 *   BASE=https://univ.talkhangyul.com node scripts/qa/marketing-mobile-hotfix.mjs   # default: a local `vite preview` on :4699
 *
 * 1. Hero: at 320/360/390/412/430 the headline clears the floating header by the hotfix minimum, the first CTA ends
 *    inside the initial viewport, no horizontal overflow.
 * 2. "한귤과 함께라면, 유학의 길이 달라집니다": under `prefers-color-scheme: dark` AND Chrome's algorithmic auto-dark
 *    (what Android applies), the document opts out (`color-scheme: only light`), and the highlighted line paints its own
 *    opaque glyphs with ≥ 4.5:1 contrast against the section background.
 * 3. Refinement (b): the hero group sits a further 20 px lower (minimums raised by 16 px), and on phones the storytelling
 *    sections (#why 01–03, #services rows) are a centred column — ordinal, title and body centred on the viewport axis,
 *    body measure ≤ 21rem, the rule between propositions centred at 70–85 % of the column. Tablet (800) and desktop
 *    (1440) keep their start-aligned composition.
 */
import { chromium } from 'playwright';

const BASE = (process.env.BASE ?? 'http://localhost:4699').replace(/\/$/, '');
const SIZES = [[320, 568, 44], [360, 740, 56], [390, 844, 64], [412, 915, 68], [430, 932, 76]]; // [w, h, min header→title gap]
const fails = []; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };

const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const parse = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const browser = await chromium.launch({ args: ['--blink-settings=forceDarkModeEnabled=true', '--force-dark-mode'] });
for (const [w, h, minGap] of SIZES) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const m = await p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const header = r('.kn-header') ?? r('header'); const title = r('.kn-hero__title'); const cta = r('.kn-hero__actions [data-cta="primary"]');
    return { gap: title.top - header.bottom, ctaBottom: cta.bottom, overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  ok(m.gap >= minGap, `${w}×${h} hero headline clears the header by ${Math.round(m.gap)} px (min ${minGap})`);
  ok(m.ctaBottom <= h - 80, `${w}×${h} first CTA ends at ${Math.round(m.ctaBottom)} px, inside the initial viewport`);
  ok(m.overflow <= 0, `${w}×${h} no horizontal overflow (${m.overflow})`);
  await p.close();
}
for (const scheme of ['light', 'dark']) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme });
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await p.locator('#why').scrollIntoViewIfNeeded(); await p.waitForTimeout(1000);
  const s = await p.evaluate(() => {
    const em = document.querySelector('#why-title em'); const c = getComputedStyle(em);
    let bgEl = em, bg = 'rgba(0, 0, 0, 0)';
    while (bgEl && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(bgEl).backgroundColor; bgEl = bgEl.parentElement; }
    return { scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.querySelector('meta[name=color-scheme]')?.content ?? '',
      fill: c.webkitTextFillColor, color: c.color, clip: c.backgroundClip, opacity: c.opacity, bg, text: em.textContent };
  });
  ok(/only/.test(s.scheme) && /only light/.test(s.meta), `${scheme}: the marketing document opts out of automatic darkening (${s.scheme}; meta "${s.meta}")`);
  const fill = parse(s.fill);
  ok(fill.length >= 3 && (fill[3] ?? 1) === 1 && s.clip !== 'text' && s.opacity === '1', `${scheme}: "${s.text}" paints opaque glyphs (${s.fill}, clip ${s.clip})`);
  const cr = contrast(fill.slice(0, 3), parse(s.bg).slice(0, 3));
  ok(cr >= 4.5, `${scheme}: highlighted line contrast ${cr.toFixed(2)}:1 against ${s.bg}`);
  ok(lum(fill.slice(0, 3)) < 0.5, `${scheme}: the line is ink, not near-white (${s.fill})`);
  await p.close();
}
for (const [w, h] of [[360, 740], [390, 844], [430, 932], [800, 1024], [1440, 900]]) {
  const phone = w < 768;
  const p = await browser.newPage({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, colorScheme: 'light' });
  await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  const a = await p.evaluate(() => {
    const mid = innerWidth / 2;
    const info = (el) => { const r = el.getBoundingClientRect(); return { align: getComputedStyle(el).textAlign, off: Math.abs((r.left + r.right) / 2 - mid), w: r.width }; };
    const sel = ['#why .kn-tri__n', '#why .kn-tri__title', '#why .kn-tri__text', '#services .kn-mediarow__title', '#services .kn-mediarow__text'];
    const els = sel.flatMap((s) => [...document.querySelectorAll(s)].map((e) => ({ s, ...info(e) })));
    const rules = [...document.querySelectorAll('#why .kn-tri__col + .kn-tri__col')].map((c) => {
      const b = getComputedStyle(c, '::before'); const r = c.getBoundingClientRect();
      return { ratio: parseFloat(b.width) / r.width, left: parseFloat(b.left), right: parseFloat(b.right), border: getComputedStyle(c).borderTopWidth };
    });
    return { els, rules, rem: parseFloat(getComputedStyle(document.documentElement).fontSize), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  if (phone) {
    const bad = a.els.filter((e) => e.align !== 'center' || e.off > 2);
    ok(a.els.length === 15 && !bad.length, `${w}: ${a.els.length} storytelling elements centred${bad.length ? ` — off: ${bad.map((e) => `${e.s} ${e.align} ${e.off.toFixed(1)}`).join('; ')}` : ''}`);
    const wide = a.els.filter((e) => /text/.test(e.s) && e.w > 21 * a.rem + 0.5);
    ok(!wide.length, `${w}: body paragraphs keep a ≤ 21rem measure`);
    ok(a.rules.length === 2 && a.rules.every((r) => r.ratio >= 0.7 && r.ratio <= 0.85 && Math.abs(r.left - r.right) < 1 && r.border === '0px'),
      `${w}: dividers centred at ${a.rules.map((r) => `${Math.round(r.ratio * 100)}%`).join(', ')} of the column`);
    ok(a.overflow <= 0, `${w}: no horizontal overflow (${a.overflow})`);
  } else {
    const centred = a.els.filter((e) => e.align === 'center');
    ok(!centred.length, `${w}: tablet/desktop storytelling sections keep their start alignment`);
  }
  await p.close();
}
await browser.close();
console.log(fails.length ? `FAIL qa:marketing-mobile-hotfix — ${fails.length} failed` : 'PASS qa:marketing-mobile-hotfix');
process.exit(fails.length ? 1 : 0);
