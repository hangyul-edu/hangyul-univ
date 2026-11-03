// V28 visual gate (REPORT §374): npm run qa:v28-visual [-- --locales=ko,en --widths=390 --product=agency]
// Every capture route (scripts/qa/v28/capture.mjs) × locales × widths, against the dev stack on 3100–3103 + 8001.
// Per page: horizontal scroll · clipped control text · overlapping controls · covered primary CTA · offscreen dialog ·
// raw i18n key · English leak in a non-English UI · blank main · zero-size control · console error · broken image.
// Screenshot of every page in docs/qa/v28/visual/shots; findings in docs/qa/v28/visual/report.json. Exit 1 on any finding.
// Run alone (never next to Gradle or another browser job).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const LOCALES = arg('locales', 'ko,en,vi,ar,ru').split(',');
const WIDTHS = arg('widths', '390,1280').split(',').map(Number);
const ONLY = arg('product', '');
const OUT = 'docs/qa/v28/visual';
mkdirSync(`${OUT}/shots`, { recursive: true });

const PRODUCTS = [
  { name: 'marketing', base: 'http://127.0.0.1:3100', email: null, routes: [
    ['home', '/'], ['start', '/start?nationality=VN&level=BACHELOR&gpa=8.2&gpa_scale=10&langs=TOPIK:3', '.hg-fit-go button'],
    ['directory', '/universities'], ['detail-yonsei', '/universities/yonsei-university'],
    ['detail-nophoto', '/universities/busan-national-university-of-education'],
  ] },
  { name: 'student', base: 'http://127.0.0.1:3101', email: 'student@demo.hangyul.kr', routes: [
    ['home', '/'], ['explore', '/explore'], ['applications', '/applications'],
    ['application', '/applications/c62c31ff-5e45-4b21-bca1-bc9b924275d4'], ['documents', '/documents'], ['services', '/services'], ['messages', '/messages'],
  ] },
  { name: 'agency', base: 'http://127.0.0.1:3102', email: 'counselor@lotus.demo.hangyul.kr', routes: [
    ['today', '/'], ['students', '/students'], ['workspace', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e'], ['applications', '/applications'], ['messages', '/messages'],
  ] },
  { name: 'university', base: 'http://127.0.0.1:3103', email: 'admin@pusan.univ.demo.hangyul.kr', routes: [
    ['home', '/'], ['applicants', '/applicants'], ['analytics', '/analytics'], ['cohorts', '/cohorts'],
  ] },
];

// Runs in the page. Returns [{ check, detail }].
function inspect(locale) {
  const out = [];
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;
  const srOnly = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)' || /\b(hg-sr|sr-only|visually-hidden)\b/.test(e.className || '')) return true; } return false; };
  const W = innerWidth;
  // Content scrolling beneath a fixed/sticky bar (header, bottom tabs) is scrolling, not an overlap.
  const pinned = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  if (document.documentElement.scrollWidth > W + 1) out.push({ check: 'horizontal-scroll', detail: `${document.documentElement.scrollWidth} > ${W}` });
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')];
  for (const el of controls) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || srOnly(el) || el.closest('[hidden],[aria-hidden=true],[inert]')) continue;
    // An ancestor that is display:none / content-visibility hidden makes the control absent, not zero-size.
    if (!el.getClientRects().length || (el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true }))) continue;
    const r = el.getBoundingClientRect();
    if ((r.width === 0 || r.height === 0) && (el.innerText || '').trim() && !['contents'].includes(s.display)) out.push({ check: 'zero-size-control', detail: label(el) });
    if (r.width > 0 && el.scrollWidth > el.clientWidth + 2 && s.overflow.includes('hidden') && s.textOverflow !== 'ellipsis' && !el.title && el.clientWidth > 0
      && ![...el.querySelectorAll('*')].some((c) => getComputedStyle(c).textOverflow === 'ellipsis')) out.push({ check: 'clipped-text', detail: label(el) });
  }
  // Overlap: two visible controls in the viewport whose boxes intersect by > 4 px each way, neither containing the other.
  const boxes = controls.filter((el) => vis(el) && !srOnly(el)).map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < W);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, ra] = boxes[i]; const [b, rb] = boxes[j];
    if (a.contains(b) || b.contains(a) || pinned(a) !== pinned(b)) continue;
    // Compare line boxes, not the union: an inline link wrapped over two lines has a bounding box that covers its neighbours.
    // …and clip each line box to its nearest overflow-hidden ancestor (an ellipsis credit line hides what runs past it).
    const clipped = (el) => { let c = null; for (let e = el.parentElement; e; e = e.parentElement) { if (getComputedStyle(e).overflowX !== 'visible') { c = e.getBoundingClientRect(); break; } }
      return [...el.getClientRects()].map((r) => c ? { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) } : r); };
    const hit = clipped(a).some((p) => clipped(b).some((q) =>
      Math.min(p.right, q.right) - Math.max(p.left, q.left) > 4 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 4));
    if (hit && ra && rb) out.push({ check: 'overlapping-controls', detail: `${label(a)} × ${label(b)}` });
  }
  // A primary action in the viewport that something else covers (its centre hits another element).
  for (const el of document.querySelectorAll('.hg-btn--primary, .btn-primary, [data-variant=primary]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > W) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && !el.contains(hit) && !hit.contains(el) && !(pinned(hit) && !pinned(el))) out.push({ check: 'hidden-primary', detail: `${label(el)} under ${label(hit)}` });
  }
  for (const d of document.querySelectorAll('[role=dialog], dialog[open]')) {
    if (!vis(d)) continue;
    const r = d.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1 || r.top < -1) out.push({ check: 'offscreen-modal', detail: label(d) });
  }
  const main = document.querySelector('main') ?? document.body;
  if ((main.innerText || '').trim().length < 20) out.push({ check: 'blank-main', detail: `${(main.innerText || '').trim().length} chars` });
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.currentSrc && vis(img)) out.push({ check: 'broken-image', detail: img.currentSrc.slice(0, 100) });
  // Text: raw keys everywhere; English sentences in a non-English UI. Names, brands, code and anything marked lang=en/translate=no are exempt.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const RAW = /(?:^|\s)((?:[a-z][a-zA-Z0-9]*)\.(?:[a-zA-Z0-9_]+\.)+[a-zA-Z0-9_]+)(?=$|\s)/;
  const EN = /\b(?:the|your|you|and|with|this|that|from|will|have|been|are|is|for|not|can)\b/gi;
  let leaks = 0; const leakSamples = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim(); if (t.length < 3) continue;
    const el = n.parentElement; if (!el || !vis(el) || el.closest('script,style,code,pre,[translate=no],[data-no-l10n],[data-user-content]')) continue;
    const m = RAW.exec(t); if (m && !/\.(?:com|kr|org|net|ac|go|edu|io|png|jpg|svg|pdf)\b/i.test(m[1]) && !/@/.test(t)) out.push({ check: 'raw-key', detail: m[1] });
    if (locale !== 'en' && !el.closest('[lang^=en]')) {
      // Text inside Unicode isolates (U+2068…U+2069) is interpolated user content — a reviewer's note, a name — and exempt.
      const words = t.replace(/\u2068[^\u2069]*\u2069/g, '').match(EN) ?? [];
      if (words.length >= 2) { leaks += 1; if (leakSamples.length < 5) leakSamples.push(t.slice(0, 70)); }
    }
  }
  if (leaks) out.push({ check: 'mixed-locale', detail: `${leaks} English text nodes: ${leakSamples.join(' | ')}` });
  return out;
}

const b = await chromium.launch();
const findings = []; let pages = 0;
for (const p of PRODUCTS) {
  if (ONLY && p.name !== ONLY) continue;
  for (const locale of LOCALES) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1, locale: locale === 'ko' ? 'ko-KR' : locale });
    const page = await ctx.newPage();
    let consoleErrs = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) consoleErrs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => consoleErrs.push(String(e).slice(0, 160)));
    if (p.email) {
      await page.goto(`${p.base}/login?demo=${encodeURIComponent(p.email)}&lang=${locale}`, { waitUntil: 'networkidle' });
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
    }
    for (const [slug, path, click] of p.routes) {
      consoleErrs = [];
      const id = `${p.name}/${slug} ${locale} ${w}`;
      try {
        await page.goto(`${p.base}${path}${path.includes('?') ? '&' : '?'}lang=${locale}`, { waitUntil: 'networkidle', timeout: 45000 });
        if (click) { await page.locator(click).first().click().catch(() => {}); await page.waitForLoadState('networkidle'); }
        await page.waitForTimeout(600);
        const res = await page.evaluate(inspect, locale);
        for (const c of consoleErrs) res.push({ check: 'console-error', detail: c });
        for (const r of res) findings.push({ page: id, ...r });
        await page.screenshot({ path: `${OUT}/shots/${p.name}-${slug}-${locale}-${w}.png` });
        pages += 1;
      } catch (e) { findings.push({ page: id, check: 'load', detail: String(e).slice(0, 160) }); }
    }
    await ctx.close();
  }
  console.log(`checked ${p.name}`);
}
await b.close();
const byCheck = {};
for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
writeFileSync(`${OUT}/report.json`, JSON.stringify({ at: new Date().toISOString(), locales: LOCALES, widths: WIDTHS, pages, byCheck, findings }, null, 1));
console.log(JSON.stringify({ pages, byCheck }, null, 1));
for (const f of findings.slice(0, 40)) console.log(`  ✗ ${f.page} ${f.check}: ${f.detail}`);
console.log(`EXIT=${findings.length ? 1 : 0}`);
process.exit(findings.length ? 1 : 0);
