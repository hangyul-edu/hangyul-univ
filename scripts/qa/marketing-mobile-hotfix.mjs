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
 * 4. Final polish (2026-11-04) — release gate for phones at 320×568 · 360×640 · 375×667 · 390×844 · 393×852 · 412×915 ·
 *    430×932 and 568×320 landscape: compact header geometry (pill 50–58 px, footprint ≤ 72 px, logo/action/menu inside the
 *    pill, no collision, action on one line), 44 px touch targets, the closing band's two actions identical in width and
 *    height and edge-aligned, the floating header never covering an anchored section / FAQ question / focused control,
 *    no horizontal overflow, dark-scheme rendering identical to light, menu integrity, long-locale layouts (ko en vi
 *    zh-Hans ja ar + fil ru my), Android-style text scaling 125/150/200 %, and safe-area handling.
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
await finalPolish();
console.log(fails.length ? `FAIL qa:marketing-mobile-hotfix — ${fails.length} failed` : 'PASS qa:marketing-mobile-hotfix');
process.exit(fails.length ? 1 : 0);

// ─────────────────────────────────────────────────────────────────────────────────────────── 4. final mobile polish
async function finalPolish() {
  const MATRIX = [[320, 568], [360, 640], [375, 667], [390, 844], [393, 852], [412, 915], [430, 932]];
  const b = await chromium.launch();
  const open = async (w, h, { lang = 'ko', scheme = 'light', hash = '' } = {}) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: 'reduce' });
    await p.goto(`${BASE}/?lang=${lang}${hash}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    return p;
  };
  // Geometry probe: header parts, closing-band actions, overflow, touch targets.
  const probe = (p) => p.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const q = (s) => document.querySelector(s);
    const hdr = q('.kn-header'); const act = q('.kn-header [data-cta]'); const burger = q('.kn-burger');
    const logoImg = q('.kn-header__brand .hg-logo__img');
    const rng = document.createRange(); rng.selectNodeContents(act);
    const lineTops = new Set([...rng.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top / 4)));
    const card = q('.kn-cta'); const cs = getComputedStyle(card);
    const btns = [...document.querySelectorAll('.kn-cta__actions > .kn-btn')];
    const targets = [];
    const want = [['.kn-burger', 1], ['.kn-header [data-cta]', 0], ['.kn-hero__actions > *', 0], ['.kn-faq__q', 0], ['.kn-cta__actions > .kn-btn', 0],
      ['.kn-footer__social-link', 1], ['.kn-footer__lang button', 0], ['.kn-fcol__title', 0]];
    for (const [s, square] of want) for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.height < 43.5 || (square && r.width < 43.5)) targets.push(`${s} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return {
      header: box(hdr), act: box(act), burger: box(burger), logo: box(logoImg), lines: lineTops.size,
      actOverflow: act.scrollWidth - act.clientWidth,
      card: box(card), pad: [parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)], btns: btns.map(box),
      overflow: document.documentElement.scrollWidth - innerWidth, targets,
    };
  });
  const near = (a, b2, t = 0.75) => Math.abs(a - b2) <= t;
  const parseC = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);

  for (const [w, h] of MATRIX) {
    const p = await open(w, h);
    const g = await probe(p);
    const tag = `${w}×${h}`;
    ok(g.header.h >= 50 && g.header.h <= 58 && g.header.b <= 72, `${tag} compact header: pill ${g.header.h}px, footprint ${Math.round(g.header.b)}px (50–58, ≤ 72)`);
    ok(g.header.l >= 12 && g.header.l <= 20 && near(g.header.l, w - g.header.r), `${tag} header side margin ${g.header.l}px, symmetric`);
    const inside = (x) => x && x.l >= g.header.l - 0.5 && x.r <= g.header.r + 0.5 && x.t >= g.header.t - 0.5 && x.b <= g.header.b + 0.5;
    ok(inside(g.logo) && inside(g.act) && inside(g.burger) && g.logo.w >= 90, `${tag} logo (${Math.round(g.logo.w)}px), action, menu all inside the pill`);
    ok(g.logo.r + 8 <= g.act.l && g.act.r <= g.burger.l + 0.5, `${tag} no collision: logo→action ${Math.round(g.act.l - g.logo.r)}px, action→menu ${Math.round(g.burger.l - g.act.r)}px`);
    ok(g.lines === 1 && g.actOverflow <= 0, `${tag} header action on one line, unclipped`);
    ok(g.act.h >= 44 && g.burger.w >= 44 && g.burger.h >= 44, `${tag} header targets: action ${g.act.h}px tall, menu ${g.burger.w}×${g.burger.h}`);
    const [a, c] = g.btns;
    ok(g.btns.length === 2 && near(a.w, c.w, 0.5) && near(a.h, c.h, 0.5), `${tag} closing actions identical: ${a.w.toFixed(1)}×${a.h.toFixed(1)} / ${c.w.toFixed(1)}×${c.h.toFixed(1)}`);
    ok(near(a.l, c.l, 0.5) && near(a.r, c.r, 0.5) && near(a.l, g.card.l + g.pad[0], 1) && near(a.r, g.card.r - g.pad[1], 1), `${tag} closing actions edge-aligned to the card's content box`);
    ok(a.h >= 52 && a.h <= 60 && c.t - a.b >= 10 && c.t - a.b <= 16, `${tag} closing actions ${a.h}px tall, ${c.t - a.b}px apart (52–60, 10–16)`);
    ok(!g.targets.length, `${tag} touch targets ≥ 44px${g.targets.length ? ` — ${g.targets.join('; ')}` : ''}`);
    ok(g.overflow <= 0, `${tag} no horizontal overflow (${g.overflow})`);
    await p.close();
  }

  // The floating pill never covers what navigation lands on: anchors (direct + from the menu), FAQ questions brought into
  // view by keyboard focus, and a question that is opened.
  for (const [w, h] of [[320, 568], [390, 844], [430, 932]]) {
    const p = await open(w, h, { hash: '#faq' });
    await p.waitForTimeout(1200);
    const hb = () => p.evaluate(() => document.querySelector('.kn-header').getBoundingClientRect().bottom);
    const topOf = (s) => p.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().top, s);
    let head = await hb();
    ok((await topOf('#faq')) >= head - 0.5 && (await topOf('#faq h2')) >= head + 8, `${w}: /#faq lands with the FAQ heading below the header`);
    // Keyboard: put the 5th question just under the pill, then focus the 4th (hidden behind it) the way Tab would.
    await p.evaluate(() => { const qs = document.querySelectorAll('.kn-faq__q'); const r = qs[4].getBoundingClientRect(); scrollBy(0, r.top - 70); });
    await p.waitForTimeout(200);
    await p.locator('.kn-faq__q').nth(3).focus(); await p.waitForTimeout(400);
    head = await hb();
    const fq = await p.evaluate(() => document.querySelectorAll('.kn-faq__q')[3].getBoundingClientRect().top);
    ok(fq >= head, `${w}: a focused FAQ question is scrolled clear of the header (${Math.round(fq)} ≥ ${Math.round(head)})`);
    // Open a question that sits right under the pill: the answer must start below the header too.
    await p.locator('.kn-faq__q').nth(2).click(); await p.waitForTimeout(500);
    const oq = await p.evaluate(() => { const it = document.querySelectorAll('.kn-faq__item')[2]; return { q: it.querySelector('.kn-faq__q').getBoundingClientRect().top, open: it.open }; });
    ok(oq.open && oq.q >= (await hb()) - 0.5, `${w}: an opened FAQ question is not under the header (${Math.round(oq.q)})`);
    // From the menu.
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    await p.locator('.kn-burger').click(); await p.waitForTimeout(500);
    await p.locator('.kn-mnav a[href*="#faq"]').click(); await p.waitForTimeout(1500);
    ok((await topOf('#faq h2')) >= (await hb()) + 8, `${w}: menu → FAQ lands below the header`);
    await p.close();
  }

  // Dark device preference changes nothing on the marketing site (it is light-themed by design).
  {
    const shot = async (scheme) => {
      const p = await open(390, 844, { scheme });
      const v = await p.evaluate(() => {
        const sel = ['.kn-header', '.kn-header [data-cta]', '.kn-hero__title', '.kn-cta', '.kn-cta__title', '.kn-cta__text', '.kn-cta__actions > .kn-btn--primary', '.kn-cta__actions > .kn-btn--quiet-onphoto', '.kn-faq__q', '.kn-footer', '.kn-footer__statement', '#why-title em'];
        return Object.fromEntries(sel.map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, [c.color, c.backgroundColor, c.borderTopColor, c.webkitTextFillColor].join(' ')]; }));
      });
      await p.close(); return v;
    };
    const [L, D] = [await shot('light'), await shot('dark')];
    const diff = Object.keys(L).filter((k) => L[k] !== D[k]);
    ok(!diff.length, `dark scheme: header, hero, closing band, FAQ, footer and the #why accent render exactly as in light${diff.length ? ` — differs: ${diff.join(', ')}` : ''}`);
    const cardBg = [24, 26, 31]; // --hg-text, the band's own colour
    for (const k of ['.kn-cta__title', '.kn-cta__text']) {
      const cr = contrast(parseC(D[k]).slice(0, 3), cardBg);
      ok(cr >= 4.5, `dark scheme: ${k} contrast ${cr.toFixed(1)}:1 on the closing band`);
    }
  }

  // Menu integrity.
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [430, 932]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await open(w, h, { scheme });
      await p.locator('.kn-burger').click(); await p.waitForTimeout(600);
      const m = await p.evaluate(() => {
        const oc = document.querySelector('.ed-offcanvas.info-open') ?? document.querySelector('.ed-offcanvas');
        const r = oc.getBoundingClientRect(); const close = oc.querySelector('button[aria-label]') ?? oc.querySelector('button');
        const cr = close.getBoundingClientRect();
        const links = [...oc.querySelectorAll('.kn-mnav a, .kn-mnav__foot a, .kn-mnav__foot button')].map((e) => e.getBoundingClientRect());
        const c = getComputedStyle(oc);
        return { l: r.left, r: r.right, w: innerWidth, close: [cr.left, cr.top, cr.width, cr.height], links: links.length, linkMin: Math.min(...links.map((x) => x.height)),
          offRight: links.filter((x) => x.right > innerWidth + 0.5 || x.left < -0.5).length, scrollable: oc.scrollHeight <= oc.clientHeight || /auto|scroll/.test(c.overflowY) || [...oc.querySelectorAll('*')].some((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)),
          bg: c.backgroundColor, color: c.color, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      const tag = `${w} ${scheme} menu`;
      ok(m.l >= -0.5 && m.r <= m.w + 0.5 && !m.offRight && m.overflow <= 0, `${tag}: sheet and its ${m.links} controls fit the viewport`);
      ok(m.close[0] >= 0 && m.close[1] >= 0 && m.close[2] >= 44 && m.close[3] >= 44, `${tag}: close visible, ${m.close[2]}×${m.close[3]}`);
      ok(m.linkMin >= 44, `${tag}: menu controls ≥ 44px (${Math.round(m.linkMin)})`);
      ok(m.scrollable, `${tag}: content reachable (fits or scrolls)`);
      ok(/255, 255, 255/.test(m.bg) && contrast(parseC(m.color).slice(0, 3), [255, 255, 255]) >= 7, `${tag}: light sheet, ink text (${m.bg} / ${m.color})`);
      if (w === 390 && scheme === 'light') {
        // The language selector inside the menu works: pick English, the URL and the document follow.
        await p.locator('.kn-mnav__lang button').first().click(); await p.waitForTimeout(400);
        const opt = p.locator('[role="option"], [role="menuitemradio"], .hg-locale__scroll a, .hg-locale__scroll button').filter({ hasText: /^English|English$/ }).first();
        if (await opt.count()) { await opt.click(); await p.waitForTimeout(800); }
        ok(/lang=en/.test(p.url()) && (await p.evaluate(() => document.documentElement.lang)).startsWith('en'), `${tag}: language selector switches to English (${p.url().split('?')[1]})`);
      }
      await p.close();
    }
  }

  // Long and non-Latin locales at the narrowest phone and a common one.
  for (const lang of ['en', 'vi', 'zh-Hans', 'ja', 'ar', 'fil', 'ru', 'my']) {
    for (const [w, h] of [[320, 568], [390, 844]]) {
      const p = await open(w, h, { lang });
      const g = await probe(p);
      const extra = await p.evaluate(() => {
        const bad = [];
        for (const s of ['.kn-faq__q span', '.kn-cta__title', '.kn-cta__text', '.kn-hero__title', '.kn-footer__statement', '.kn-cta__actions > .kn-btn']) for (const e of document.querySelectorAll(s)) {
          const r = e.getBoundingClientRect(); if (r.right > innerWidth + 0.5 || r.left < -0.5 || e.scrollWidth > e.clientWidth + 1) bad.push(s);
        }
        return bad;
      });
      const tag = `${lang} ${w}`;
      const [a, c] = g.btns;
      const sideA = Math.min(g.logo.r, g.act.l), sideB = Math.max(g.logo.r, g.act.l); // RTL mirrors the order
      ok(g.overflow <= 0 && !extra.length, `${tag}: no overflow${extra.length ? ` — ${[...new Set(extra)].join(', ')}` : ''}`);
      ok(g.actOverflow <= 0 && g.act.h <= 52 && g.act.w > 40 && Math.min(g.header.r - g.act.r, g.act.l - g.header.l) >= 0 && g.burger.l >= g.header.l && g.burger.r <= g.header.r + 0.5,
        `${tag}: header action fits the pill (${Math.round(g.act.w)}×${Math.round(g.act.h)})`);
      ok(sideB - sideA >= 0 && near(a.w, c.w, 0.5) && near(a.h, c.h, 0.5), `${tag}: closing actions identical (${Math.round(a.w)}×${Math.round(a.h)} / ${Math.round(c.w)}×${Math.round(c.h)})`);
      await p.close();
    }
  }

  // Android text scaling (Chrome's accessibility "Text scaling" grows every font size, px included): emulate it by
  // scaling every computed font size, then check the header, FAQ, the closing band and the document width.
  for (const [w, h] of [[320, 568], [390, 844]]) {
    for (const f of [1.25, 1.5, 2]) {
      const p = await open(w, h);
      await p.evaluate((k) => {
        const els = [...document.querySelectorAll('body *')]; const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
        els.forEach((e, i) => { e.style.setProperty('font-size', `${sizes[i] * k}px`, 'important'); });
      }, f);
      await p.waitForTimeout(300);
      const g = await probe(p);
      const faq = await p.evaluate(() => [...document.querySelectorAll('.kn-faq__q')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 0.5).length);
      const tag = `${w} text ${Math.round(f * 100)}%`;
      ok(g.overflow <= 0, `${tag}: no horizontal scrolling (${g.overflow})`);
      ok(g.burger.r <= g.header.r + 0.5 && g.act.l >= g.logo.r && g.actOverflow <= 0, `${tag}: header action and menu stay inside the pill, label unclipped`);
      ok(!faq && near(g.btns[0].w, g.btns[1].w, 0.5) && near(g.btns[0].h, g.btns[1].h, 0.5), `${tag}: FAQ questions reflow; closing actions still identical`);
      await p.close();
    }
  }

  // Landscape: robust, not composed.
  {
    const p = await b.newPage({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const g = await probe(p);
    const hero = await p.evaluate(() => { const a = [...document.querySelectorAll('.kn-hero__actions > *')].map((e) => e.getBoundingClientRect()); const t = document.querySelector('.kn-hero__title').getBoundingClientRect(); return { title: t.top, hb: document.querySelector('.kn-header').getBoundingClientRect().bottom, last: a.at(-1).bottom, docH: document.documentElement.scrollHeight }; });
    ok(g.overflow <= 0 && g.header.b < 80, `568×320 landscape: no overflow, header ${Math.round(g.header.b)}px`);
    ok(hero.title >= hero.hb && hero.last < hero.docH, `568×320 landscape: hero headline clears the header, actions reachable by scrolling`);
    await p.locator('.kn-burger').click(); await p.waitForTimeout(600);
    const m = await p.evaluate(() => { const oc = document.querySelector('.ed-offcanvas'); const last = [...oc.querySelectorAll('a, button')].at(-1); oc.scrollTop = oc.scrollHeight; [...oc.querySelectorAll('*')].forEach((e) => { e.scrollTop = e.scrollHeight; }); const r = last.getBoundingClientRect(); return { lastBottom: r.bottom, h: innerHeight }; });
    ok(m.lastBottom <= m.h + 0.5, `568×320 landscape: the menu's last control is reachable (${Math.round(m.lastBottom)} ≤ ${m.h})`);
    await p.close();
  }

  // Safe areas: the document opts into edge-to-edge, and the footer, header and menu read the insets — with no visible
  // padding where there is no inset.
  {
    const p = await open(390, 844);
    const s = await p.evaluate(() => {
      const css = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules].map((r) => r.cssText); } catch { return []; } }).join('\n');
      return { meta: document.querySelector('meta[name=viewport]').content, footer: /kn-footer[^{]*\{[^}]*safe-area-inset-bottom/.test(css), header: /kn-header[^{]*\{[^}]*safe-area-inset-left/.test(css),
        menu: /ed-offcanvas[^{]*\{[^}]*safe-area-inset/.test(css), pb: parseFloat(getComputedStyle(document.querySelector('.kn-footer')).paddingBottom) };
    });
    ok(/viewport-fit=cover/.test(s.meta) && s.footer && s.header && s.menu, `safe area: viewport-fit=cover; footer, header and menu read env(safe-area-inset-*)`);
    ok(s.pb === 32, `safe area: no extra footer padding without an inset (${s.pb}px)`);
    await p.close();
  }
  await b.close();
}
