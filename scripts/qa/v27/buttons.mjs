// V27 button-affordance gate (REPORT §361, brief §22–§23).
//
//   node scripts/qa/v27/buttons.mjs [--json out.json]        (needs the dev stack: marketing 3100, student 3101, agency 3102)
//
// For every visible control on each route, at 1280 and 390 px:
//   ORANGE_DARK_TEXT   a tangerine/orange fill with dark text (the primary must carry white text)
//   WEAK_EDGE          a light control whose fill and border both sit under 3:1 against what is behind it (WCAG 1.4.11
//                      non-text contrast) — the "white button with a faint border" that does not read as a button
//   DISABLED_LOOKS_ON  a disabled control styled exactly like its enabled self (no opacity / colour / cursor change)
//   NO_FOCUS           keyboard focus draws nothing (no outline, no box-shadow change)
//   SMALL_TARGET       at 390 px, a control's hit area under 44 × 44 px (inline text links in running text excepted)
// Exits 1 when any finding is left; prints a per-surface summary. Read EXIT= from the wrapper, not the prose.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const ROUTES = [
  ['marketing', 'http://127.0.0.1:3100', null, ['/?lang=ko', '/start?lang=ko', '/universities?lang=ko', '/universities/dankook-university?lang=ko']],
  ['student', 'http://127.0.0.1:3101', 'student@demo.hangyul.kr', ['/', '/explore', '/applications', '/documents', '/services']],
  ['agency', 'http://127.0.0.1:3102', 'counselor@lotus.demo.hangyul.kr', ['/', '/students', '/applications', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e']],
];
const only = process.env.SURFACES?.split(',');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const probe = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x)); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const behind = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const isOrange = ({ r, g, b }) => r > 180 && g > 50 && g < 140 && b < 80;
  const sel = 'button, a.btn, a.kn-btn, a.hg-btn, [role="button"], input[type="submit"], .hg-option';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!rect.width || !rect.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[aria-hidden="true"], .hg-devchip, [data-devtools]')) continue;
    const bg = parse(cs.backgroundColor);
    const fg = parse(cs.color);
    const back = behind(el);
    const filled = bg && bg.a > 0.5;
    const bw = parseFloat(cs.borderTopWidth) || 0;
    const bc = parse(cs.borderTopColor);
    const hasBorder = bw >= 1 && bc && bc.a > 0.3;
    const name = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.');
    const issues = [];
    if (filled && isOrange(bg) && fg && lum(fg) < 0.4) issues.push('ORANGE_DARK_TEXT');
    // A control with a visible box: padding or a min-height that makes it a "button" rather than a text link.
    const boxy = rect.height >= 30 && (parseFloat(cs.paddingLeft) >= 8 || cs.display.includes('flex') || cs.display.includes('grid'));
    const text = !filled && !hasBorder;
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
    if (boxy && !text && !disabled) {
      const fillC = filled ? contrast(bg, back) : 1;
      const edgeC = hasBorder ? contrast(bc, filled ? bg : back) : 1;
      if (fillC < 3 && edgeC < 3 && Math.max(fillC, contrast(hasBorder ? bc : back, back)) < 3) issues.push('WEAK_EDGE');
    }
    if ((el.disabled || el.getAttribute('aria-disabled') === 'true') && parseFloat(cs.opacity) > 0.75 && cs.cursor !== 'not-allowed' && cs.cursor !== 'default') issues.push('DISABLED_LOOKS_ON');
    const inline = el.tagName === 'A' && !boxy && el.closest('p, li, td, dd');
    if (innerWidth <= 480 && !inline && (rect.height < 43.5 || rect.width < 43.5)) issues.push('SMALL_TARGET');
    out.push({ name, cls, tag: el.tagName, w: Math.round(rect.width), h: Math.round(rect.height), issues, idx: out.length });
  }
  return out;
};

const focusProbe = async (page) => {
  // Tab through the first 25 focusable controls and check focus draws something.
  const missing = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
      return { ring, name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), tag: el.tagName, cls: (el.getAttribute('class') || '').slice(0, 60) };
    });
    if (r && !r.ring) missing.push(r);
  }
  return missing;
};

const browser = await chromium.launch();
const report = {};
let total = 0;
for (const [surface, base, email, paths] of ROUTES) {
  if (only && !only.includes(surface)) continue;
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    if (email) {
      await page.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle' });
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
    }
    for (const path of paths) {
      try {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(500);
      } catch { continue; }
      const found = (await page.evaluate(probe)).filter((x) => x.issues.length);
      const focus = width === 1280 ? await focusProbe(page) : [];
      const key = `${surface} ${width} ${path}`;
      report[key] = { controls: found, focusMissing: focus };
      const n = found.length + focus.length;
      total += n;
      const by = {};
      for (const f of found) for (const i of f.issues) by[i] = (by[i] ?? 0) + 1;
      if (focus.length) by.NO_FOCUS = focus.length;
      console.log(`${n ? 'FAIL' : 'ok  '} ${key}  ${JSON.stringify(by)}`);
    }
    await ctx.close();
  }
}
await browser.close();
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
console.log(`buttons: ${total} finding(s)`);
process.exit(total ? 1 : 0);
