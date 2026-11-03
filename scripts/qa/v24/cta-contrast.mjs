// V24 — the global button rule, measured (REPORT §291).
//
//   node scripts/qa/v24/cta-contrast.mjs [--json out.json]
//
// Every visible button / link / summary / [role=button] on the sampled routes of all four web products is put into
// each interactive state through CDP (`CSS.forcePseudoState`: none, hover, active, focus-visible) with transitions
// switched off, and its computed fill is read. Wherever the fill is tangerine, every text node and icon inside it
// must be white. That is the whole rule: a tangerine primary never carries ink, grey or tangerine text, in any state.
// It also records, per marketing view, how many *filled* tangerine controls are visible (the one-primary rule).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
// --self-test: plant one tangerine button with ink text on the first marketing page; the run must then fail.
const SELF_TEST = process.argv.includes('--self-test');
const SPEC = SELF_TEST ? [{ app: 'self-test', base: 'http://localhost:3100', routes: ['/faq'] }] : [
  { app: 'marketing', base: 'http://localhost:3100', routes: ['/', '/universities', '/universities/yonsei-university', '/universities/inst-2640', '/start', '/faq'] },
  { app: 'student-public', base: 'http://localhost:3101', routes: ['/login', '/register'] },
  { app: 'student', base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', routes: ['/', '/explore', '/universities/pusan-national-university', '/services', '/applications', '/documents', '/essays', '/messages', '/settings'] },
  { app: 'agency', base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr', routes: ['/', '/students', '/students/eeddf03a-f61c-4efc-9af1-501b63e546c7', '/review', '/messages', '/performance'] },
  { app: 'university', base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/analytics', '/messages', '/manage'] },
];
const STATES = [[], ['hover'], ['active'], ['focus-visible']];

const browser = await chromium.launch();
const violations = [];
let checked = 0;
const primaryCounts = [];
for (const s of SPEC) {
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
    const p = await ctx.newPage();
    if (s.login) {
      await p.goto(`${s.base}/login?demo=${encodeURIComponent(s.login)}&lang=ko`, { waitUntil: 'networkidle' });
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    }
    const cdp = await ctx.newCDPSession(p);
    for (const r of s.routes) {
      await p.goto(`${s.base}${r}?lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      if (SELF_TEST) await p.evaluate(() => { const b = document.createElement('button'); b.textContent = 'planted'; b.style.cssText = 'background:#CC4E00;color:#1a1a1a;padding:12px;position:relative;z-index:9'; document.body.prepend(b); });
      // Reveal everything the scroll reveals, then come back up.
      for (let y = 0; y < 12; y += 1) { await p.mouse.wheel(0, 800); await p.waitForTimeout(60); }
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(400);
      const n = await p.evaluate(() => {
        const els = [...document.querySelectorAll('button, a[href], summary, [role="button"], input[type="submit"]')]
          .filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none'; })
          .slice(0, 400);
        els.forEach((e, i) => e.setAttribute('data-v24i', String(i)));
        return els.length;
      });
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-v24i]' });
      let filled = 0;
      for (const nodeId of nodeIds) {
        for (const st of STATES) {
          await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: st });
          const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
          const idx = attributes[attributes.indexOf('data-v24i') + 1];
          const res = await p.evaluate((i) => {
            const e = document.querySelector(`[data-v24i="${i}"]`);
            if (!e) return null;
            const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
            const tangerine = (c) => {
              const [r, g, b, a = 1] = rgb(c); if (a < 0.9) return false;
              const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
              if (d === 0) return false;
              const sat = d / (1 - Math.abs(2 * l - 1));
              let h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
              h = (h * 60 + 360) % 360;
              return h >= 8 && h <= 40 && sat > 0.6 && l > 0.25 && l < 0.7;
            };
            const bg = getComputedStyle(e).backgroundColor;
            if (!tangerine(bg)) return { filled: false };
            const white = (c) => { const [r, g, b, a = 1] = rgb(c); return a === 0 || (r >= 240 && g >= 240 && b >= 240); };
            const bad = [];
            const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const t = walker.currentNode; if (!t.textContent.trim()) continue;
              const c = getComputedStyle(t.parentElement).color; if (!white(c)) bad.push(`text "${t.textContent.trim().slice(0, 30)}" ${c}`);
            }
            for (const svg of e.querySelectorAll('svg, svg *')) {
              const cs = getComputedStyle(svg);
              for (const k of ['fill', 'stroke']) { const v = cs[k]; if (v && v !== 'none' && v.startsWith('rgb') && !white(v)) bad.push(`svg ${k} ${v}`); }
            }
            const label = (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40);
            return { filled: true, bad, label, cls: String(e.className).slice(0, 80), bg };
          }, idx);
          checked += 1;
          if (!res?.filled) continue;
          if (st.length === 0) filled += 1;
          if (res.bad.length) violations.push({ app: s.app, width, route: r, state: st[0] || 'default', label: res.label, cls: res.cls, bg: res.bg, bad: [...new Set(res.bad)].slice(0, 4) });
        }
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      }
      primaryCounts.push({ app: s.app, width, route: r, filled, controls: n });
      process.stdout.write('.');
    }
    await ctx.close();
  }
}
await browser.close();
const uniq = [...new Map(violations.map((v) => [`${v.app}|${v.route}|${v.label}|${v.state}|${v.cls}`, v])).values()];
console.log(`\nCTA rule: ${checked} control×state readings; ${uniq.length} violation(s)`);
for (const v of uniq.slice(0, 60)) console.log(`  ✗ ${v.app}@${v.width} ${v.route} [${v.state}] "${v.label}" .${v.cls.split(' ')[0]} bg ${v.bg} → ${v.bad.join('; ')}`);
if (out) fs.writeFileSync(out, JSON.stringify({ checked, violations: uniq, primaryCounts }, null, 2));
if (SELF_TEST) { const ok = uniq.some((v) => v.label === 'planted'); console.log(`self-test: planted violation ${ok ? 'caught' : 'MISSED'}`); console.log(`EXIT=${ok ? 0 : 1}`); process.exit(ok ? 0 : 1); }
console.log(`EXIT=${uniq.length ? 1 : 0}`);
process.exit(uniq.length ? 1 : 0);
