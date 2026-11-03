// V26 — computed-style census of the brand colour (REPORT §338, brief §9/§12).
//   node scripts/qa/v26/census.mjs [--json out.json] [--only agency,university,student,marketing]
//
// The rule (FRONTEND_CONVENTIONS "V25", REPORT §317): tangerine is for THE primary action, the current/selected item and
// focus. Everything else is ink or neutral. This walks every visible element on the core routes of each product and
// classifies each element whose computed background is in the tangerine family:
//   primary   a primary action (button/link with a primary class or role)
//   selected  the current/selected item (aria-current / aria-pressed / aria-selected / is-active)
//   stray     anything else — a tangerine fill that is decoration, a secondary, a badge or a tint
// A tinted background (tangerine at low alpha / peach) counts as stray too: a peach "secondary" reads as orange.
// It also reports any tangerine-filled element whose text is not light (the "orange button never has dark text" rule).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
export const ROUTES = {
  agency: { base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr',
    routes: ['/', '/students', `/students/${IDS.agencyStudent}`, '/review', '/messages', '/performance', '/settings'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr',
    routes: ['/', `/applications/${IDS.universityApplication}`, '/analytics', '/cohorts', '/agencies', '/messages'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr',
    routes: ['/', '/explore', '/services', '/applications', `/applications/${IDS.studentApplication}`, '/documents', '/messages'] },
  marketing: { base: 'http://localhost:3100', login: null, routes: ['/', '/universities', '/universities/yonsei-university', '/start'] },
};

/** Runs inside the page. Returns {primary, selected, stray: [...], darkOnOrange: [...]} */
function censusInPage() {
  const toRgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  // Tangerine family: hue 12–36°, saturated. "Solid" = opaque and mid lightness; "tint" = pale (peach) or low alpha.
  const kind = (c) => { if (!c || c.a === 0) return null; const { h, s, l } = hsl(c); if (h < 12 || h > 36 || s < 0.45) return null; if (c.a >= 0.9 && l < 0.7) return 'solid'; if (l >= 0.85 || c.a < 0.9) return 'tint'; return null; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const out = { primary: 0, selected: 0, stray: [], darkOnOrange: [] };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} “${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)}”`;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const k = kind(toRgb(cs.backgroundColor));
    if (!k) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    const isPrimary = /(^|\s)(btn-primary|hg-btn--primary|kn-btn--primary|kn-btn--cta|is-primary|kn-plan__cta)(\s|$)/.test(cls) || el.getAttribute('data-variant') === 'primary';
    const isSelected = ['true', 'page', 'step', 'location'].includes(el.getAttribute('aria-current') ?? '') || el.getAttribute('aria-pressed') === 'true'
      || el.getAttribute('aria-selected') === 'true' || /(^|\s)(active|is-active|is-selected|is-current|is-highlight)(\s|$)/.test(cls) || !!el.closest('[aria-current="page"]')
      // The journey's current stage, and the plan the business recommends (a deliberate default, not decoration).
      || /(^|\s)v25-line__node(\s|$)/.test(cls) && !!el.closest('[data-state="current"], [aria-current]') || !!el.closest('[data-recommended]') || /(^|\s)kn-matrix__hi(\s|$)/.test(cls)
      // A semantic state (watch / late / stuck = the warning and danger scale) is not the brand colour used as decoration.
      || ['watch', 'late', 'stuck', 'warning'].includes(el.getAttribute('data-tone') ?? '');
    if (k === 'solid' && isPrimary) out.primary += 1;
    else if (isSelected) out.selected += 1;
    else out.stray.push(`${k}: ${label(el)}`);
    if (k === 'solid') {
      const fg = toRgb(cs.color);
      if (fg && lum(fg) < 0.6 && (el.innerText || '').trim()) out.darkOnOrange.push(label(el));
    }
  }
  return out;
}

async function run(only, jsonOut) {
  const browser = await chromium.launch();
  const report = {};
  for (const [name, s] of Object.entries(ROUTES).filter(([k]) => !only || only.includes(k))) {
    const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
    const p = await ctx.newPage();
    if (s.login) {
      await p.goto(`${s.base}/login?demo=${encodeURIComponent(s.login)}&lang=ko`, { waitUntil: 'networkidle' });
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    }
    report[name] = {};
    for (const r of s.routes) {
      await p.goto(`${s.base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(500);
      report[name][r] = await p.evaluate(censusInPage);
    }
    await ctx.close();
  }
  await browser.close();
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  return report;
}

export { censusInPage, run };

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const only = a.includes('--only') ? a[a.indexOf('--only') + 1].split(',') : null;
  const json = a.includes('--json') ? a[a.indexOf('--json') + 1] : null;
  const rep = await run(only, json);
  let stray = 0; let dark = 0;
  for (const [app, routes] of Object.entries(rep)) for (const [r, c] of Object.entries(routes)) {
    stray += c.stray.length; dark += c.darkOnOrange.length;
    console.log(`${app.padEnd(10)} ${r.slice(0, 40).padEnd(40)} primary ${c.primary}  selected ${c.selected}  stray ${c.stray.length}  dark-on-orange ${c.darkOnOrange.length}${c.stray.length ? '  ← ' + c.stray.slice(0, 3).join(' | ') : ''}`);
  }
  console.log(`\nTOTAL stray tangerine fills: ${stray} · dark text on solid tangerine: ${dark}`);
}
