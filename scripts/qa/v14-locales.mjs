/**
 * Visual localization QA across every target market (V14, brief Part 63; the count comes from markets.ts).
 *
 * A coverage percentage says a key has *a* value. It cannot say whether that value fits, reads in the right
 * direction, or is actually in the right language. This loads the homepage in every market locale, at desktop
 * and phone width, and looks for the five things that go wrong in practice:
 *
 *   overflow        anything wider than the viewport, or a control whose label has broken out of it
 *   clipping        text cut off by its own box (scrollWidth beyond clientWidth on a non-scrolling element)
 *   English leakage a visible string identical to the English source, in a locale that is not English
 *   mixed script    characters from a writing system this locale does not use (the Korean source leaking in
 *                   is the likeliest failure, so hangul is checked everywhere but `ko`)
 *   direction       `dir` on <html> matching the locale's own direction, and the flag matching the market
 *
 * Screenshots go to docs/qa/v14/locales/shots/ so a person can look at anything the machine reports.
 *
 *   node scripts/qa/v14-locales.mjs                    # all markets, 390 + 1440
 *   LOCALES=ar,ne WIDTHS=390 SHOTS=1 node scripts/qa/v14-locales.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = (process.env.WIDTHS ?? '390,1440').split(',').map(Number);
const SHOTS = process.env.SHOTS === '1';
const OUT = join(ROOT, 'docs/qa/v14/locales/shots');

/** The market table, read from source so this gate and the product cannot disagree about which markets exist. */
const table = readFileSync(join(ROOT, 'packages/i18n/src/markets.ts'), 'utf8');
const MARKETS = [...table.matchAll(/\{ code: '(\w+)',\s*asset: '\w+',\s*locale: '([\w-]+)'/g)]
  .map((m) => ({ code: m[1], country: m[1], locale: m[2] }));
const RESEARCH_MARKETS = [...table.matchAll(/\{ code: '(\w+)', locale: '([\w-]+)', nameEn: '([^']+)' \}/g)]
  .map((m) => ({ code: m[1], locale: m[2], nameEn: m[3] }));
const only = process.env.LOCALES?.split(',');
const targets = only ? MARKETS.filter((m) => only.includes(m.locale)) : MARKETS;

/**
 * The two market lists, and their difference, printed on every run (V14 final pass).
 *
 * `MARKETS` is what the product presents itself to — defined by `apps/flags`, which is the owner's decision.
 * `RESEARCH_MARKETS` is what it has actually researched: a visa playbook, a country simulation, usually a
 * student persona. They are different lists on purpose, and the difference is reported rather than reconciled
 * because reconciling it is a business decision, not an engineering one. The failure mode this prevents is
 * the one V14 found by accident: three researched markets reading the site in English and nobody noticing,
 * because no single place held both lists.
 */
const researched = new Set(RESEARCH_MARKETS.map((m) => m.code));
const presented = new Set(MARKETS.map((m) => m.code));
const researchedNotPresented = RESEARCH_MARKETS.filter((m) => !presented.has(m.code));
const presentedNotResearched = MARKETS.filter((m) => !researched.has(m.code) && m.code !== 'KR');
console.log(`markets presented (a flag exists): ${MARKETS.length} · researched: ${RESEARCH_MARKETS.length} · both: ${MARKETS.filter((m) => researched.has(m.code)).length}`);
if (researchedNotPresented.length) {
  console.log(`  researched but not presented (no flag asset, locale still ships): ${researchedNotPresented.map((m) => `${m.nameEn} (${m.locale})`).join(', ')}`);
}
if (presentedNotResearched.length) {
  console.log(`  presented but not yet researched: ${presentedNotResearched.length} — ${presentedNotResearched.map((m) => m.code).join(' ')}`);
}
console.log('  (Korea is the destination, not a source market, and is excluded from the second line.)\n');

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps']);
const SCRIPTS = [
  ['hangul', /[가-힯]/, ['ko']],
  ['cyrillic', /[Ѐ-ӿ]/, ['ru', 'uk', 'sr', 'mn', 'kk', 'ky', 'tg', 'bg', 'be', 'mk']],
  ['han', /[一-鿿]/, ['zh-Hans', 'zh-Hant', 'ja', 'ko']],
  ['kana', /[぀-ヿ]/, ['ja']],
  ['arabic', /[؀-ۿ]/, ['ar', 'fa', 'ur', 'ps']],
  ['devanagari', /[ऀ-ॣ०-ॿ]/, ['hi', 'mr', 'ne']],
  ['thai', /[฀-๿]/, ['th']],
];

/** English strings that must not survive into another locale — the homepage's own headline set. */
const EN = JSON.parse(readFileSync(join(ROOT, 'packages/i18n/locales/en/marketing.json'), 'utf8'));
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\{\{\w+\}\}/g, '').trim();
const ENGLISH_MARKERS = [
  strip(EN.v11.hero.title), strip(EN.v11.why.title), strip(EN.v11.services.title),
  strip(EN.v11.faq.title), strip(EN.v11.cta.title), strip(EN.v11.unis.all),
].filter((s) => s.length > 6);

if (SHOTS) mkdirSync(OUT, { recursive: true });
const problems = [];
const rows = [];
const browser = await chromium.launch();

for (const m of targets) {
  const expectDir = RTL.has(m.locale) ? 'rtl' : 'ltr';
  const row = { ...m, dir: expectDir, overflow: 0, clipped: 0, english: 0, mixed: [], flag: '?' };
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?lang=${m.locale}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(600);
    // Reveal-on-scroll content has to be on screen before it can be measured.
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(500);

    const dir = await page.evaluate(() => document.documentElement.dir || 'ltr');
    if (dir !== expectDir) problems.push(`${m.locale} @${width}: dir="${dir}", expected "${expectDir}"`);

    const found = await page.evaluate((markers) => {
      const out = { overflow: [], clipped: [], english: [], text: '' };
      const docW = document.documentElement.clientWidth;
      /** Is this element actually on screen? The closed mobile menu is translated off it and is not a defect. */
      const onScreen = (el) => {
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        for (let a = el; a; a = a.parentElement) {
          const st = getComputedStyle(a);
          if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') return false;
          if (a.hasAttribute('hidden') || a.getAttribute('aria-hidden') === 'true') return false;
          // The offcanvas drawer keeps its contents in the DOM and slides them out of view.
          if (a.matches?.('.ed-offcanvas, [data-offcanvas]') && !a.classList.contains('is-open')) return false;
        }
        return true;
      };
      if (document.documentElement.scrollWidth > docW + 1) out.overflow.push(`page ${document.documentElement.scrollWidth}px > ${docW}px`);
      for (const el of document.querySelectorAll('.kn-hero__title, .kn-hero__lede, .kn-btn, .kn-head__title, .kn-head__lede, .kn-tri__title, .kn-tri__text, .kn-mediarow__title, .kn-faq__q, .kn-cta__title, .kn-footer__biz *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || !onScreen(el)) continue;
        if (r.right > docW + 1 || r.left < -1) out.overflow.push(`${el.className || el.tagName} out of viewport`);
        // A control with a fixed height whose text does not fit is clipped; a wrapping block is not.
        const st = getComputedStyle(el);
        if (st.overflow !== 'visible' && st.overflowX !== 'auto' && st.overflowX !== 'scroll'
            && el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${el.className || el.tagName} clipped`);
        if (st.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${el.className} nowrap overflow`);
      }
      // The footer's business-information block carries the registered representative's name, the business
      // division contact and the Korean mail-order registration number. Brief Part 50 says in as many words
      // not to translate or transliterate those, so they are Korean on a German page *by instruction* — and
      // they are excluded from the mixed-script scan rather than the scan being weakened for everything.
      const biz = document.querySelector('.kn-footer__biz');
      const bizText = biz ? biz.innerText : '';
      out.text = document.body.innerText;
      if (bizText) out.text = out.text.split(bizText).join(' ');
      for (const mk of markers) if (out.text.includes(mk)) out.english.push(mk);
      return out;
    }, m.locale === 'en' ? [] : ENGLISH_MARKERS);

    row.overflow += found.overflow.length;
    row.clipped += found.clipped.length;
    row.english += found.english.length;
    for (const o of found.overflow) problems.push(`${m.locale} @${width}: overflow — ${o}`);
    for (const c of found.clipped) problems.push(`${m.locale} @${width}: clipped — ${c}`);
    for (const e of found.english) problems.push(`${m.locale} @${width}: English leaked — "${e.slice(0, 48)}"`);

    for (const [name, re, allowed] of SCRIPTS) {
      if (allowed.includes(m.locale)) continue;
      const hit = found.text.match(re);
      if (hit) {
        row.mixed.push(name);
        problems.push(`${m.locale} @${width}: ${name} character "${hit[0]}" in a locale that does not use it`);
      }
    }

    if (width === WIDTHS[0]) {
      // The language control must show this market's own flag, not a default.
      const src = await page.locator('.kn-footer__lang img.hg-flag').first().getAttribute('src').catch(() => null);
      row.flag = src?.split('/').pop()?.replace('.svg', '') ?? 'none';
      if (row.flag !== m.country) problems.push(`${m.locale}: language control shows flag "${row.flag}", expected "${m.country}"`);
    }

    if (SHOTS) await page.screenshot({ path: join(OUT, `${m.locale}-${width}.png`) });
    await ctx.close();
  }
  rows.push(row);
  const bad = row.overflow + row.clipped + row.english + row.mixed.length;
  console.log(`${row.locale.padEnd(8)} ${row.country}  ${row.dir}  ${bad === 0 ? 'clean' : `${bad} issue(s)`}`);
}

await browser.close();

writeFileSync(join(ROOT, 'docs/qa/v14/locales/report.json'),
  `${JSON.stringify({ generated_at: new Date().toISOString(), widths: WIDTHS, markets: rows }, null, 2)}\n`);

if (problems.length) {
  console.error(`\nLocale visual QA: ${problems.length} problem(s) across ${targets.length} markets\n`);
  for (const p of [...new Set(problems)].slice(0, 60)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\nLocale visual QA: OK — ${targets.length} markets × ${WIDTHS.length} widths, 0 overflow, 0 clipping, 0 English leakage, 0 mixed script.`);
