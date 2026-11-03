/**
 * V13 — country probe (brief Part 17). Measures, per source-market locale, what a visitor from that market
 * actually sees: whether the public homepage renders their language, and whether the student app does.
 *
 * This is the factual half of the country simulations. The personas are synthetic; these numbers are not.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const MARKETS = [
  ['VN', 'vi', 'Vietnam'], ['NP', 'ne', 'Nepal'], ['MM', 'my', 'Myanmar'], ['UZ', 'uz', 'Uzbekistan'],
  ['MN', 'mn', 'Mongolia'], ['CN', 'zh-Hans', 'China'], ['IN', 'hi', 'India'], ['BD', 'bn', 'Bangladesh'],
  ['PK', 'ur', 'Pakistan'], ['ID', 'id', 'Indonesia'], ['TH', 'th', 'Thailand'], ['PH', 'tl', 'Philippines'],
  ['KZ', 'kk', 'Kazakhstan'], ['KG', 'ky', 'Kyrgyzstan'],
];
// The English the homepage falls back to. If a locale renders these, it fell back.
const EN_MARKERS = ['Start my preparation', 'Explore universities', 'Korean universities'];
// Locales that fall back through Russian rather than English (packages/i18n FALLBACK_CHAIN).
const RU_CHAIN = new Set(['uz', 'kk', 'ky', 'tg']);

const BASE = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch();
const out = [];
for (const [cc, loc, name] of MARKETS) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?lang=${loc}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const r = await p.evaluate((markers) => {
    const text = document.body.innerText;
    const cta = document.querySelector('.kn-hero__actions .kn-btn');
    return {
      htmlLang: document.documentElement.lang,
      dir: document.documentElement.dir || 'ltr',
      primaryCta: cta ? cta.innerText.trim() : null,
      englishFallback: markers.some((m) => text.includes(m)),
      russianFallback: /Корейских университетов/.test(text),
      // The scale, written in the digits of whatever language the sentence ended up in.
      //
      // V13 could assert the literal "200+" because the homepage existed in three locales and everything
      // else fell back to English. V14 translated it into every market then exposed, so a Bengali reader correctly sees
      // ২০০ and an Arabic reader ٢٠٠ — asserting Latin digits would now assert a *defect*. The expected
      // string is therefore computed from the locale, the same way `copyLocale()` decides what to render.
      hasCount: text.includes(new Intl.NumberFormat(document.documentElement.lang || 'en').format(200)),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  }, EN_MARKERS);
  out.push({ country: cc, name, locale: loc, ...r });
  const served = r.englishFallback ? 'en (fallback)' : r.russianFallback && RU_CHAIN.has(loc) ? 'ru (owner copy, chain)' : 'own locale';
  console.log(`${cc} ${name.padEnd(12)} lang=${String(r.htmlLang).padEnd(8)} dir=${r.dir} served=${served.padEnd(22)} scale=${r.hasCount} overflow=${r.overflow}`);
  await ctx.close();
}
await b.close();
writeFileSync('docs/qa/v13/country-probe.json', JSON.stringify({ measured_at: new Date().toISOString(), surface: 'marketing homepage @390', rows: out }, null, 2));
const fell = out.filter((r) => r.englishFallback).length;
const ru = out.filter((r) => !r.englishFallback && r.russianFallback).length;
console.log(`\n${out.length} markets measured — ${fell} see the public homepage in English, ${ru} in the owner's own Russian via the fallback chain`);
const bad = out.filter((r) => !r.hasCount || r.overflow > 1);
if (bad.length) { console.error('\nFAIL:'); for (const r of bad) console.error(`  ✖ ${r.country}: scale=${r.hasCount} overflow=${r.overflow}px`); process.exit(1); }
