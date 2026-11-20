#!/usr/bin/env node
/**
 * Owner pass 261119, requirement 7 — "no unintended English when a non-English locale is selected".
 *
 * Opens the critical screens of every app in Design Preview (synthetic fixtures, no API) in each selected locale,
 * collects every visible text node plus `aria-label` / `placeholder` / `title` / `alt`, and flags English:
 *
 *   non-Latin-script locales (ko, ja, zh, ar, ur, ru, kk, ky, mn, hi, bn, ne, my, th …)
 *     · RUN  — two or more consecutive ASCII words (≥ 2 letters each), and
 *     · WORD — a single word that occurs in the English bundles (en/*.json values);
 *   Latin-script locales (vi, id, fil, tr, uz)
 *     · EXACT — a text node that exactly equals an English bundle value whose translation in this locale differs.
 *
 * Not checked: text the product marks as quoted source data — `[data-no-l10n]` (catalogue wording copied from a
 * university's official page: scholarship terms, guide and video titles), `[lang=en]` "exact wording" disclosures,
 * `[data-user-content]` (what a person typed) and licence credits under photos.
 * Small explicit allow-list only: Hangyul Univ, TOPIK/TOEFL/IELTS/GKS/IEQAS, KRW/USD, file formats and sizes, emails,
 * URLs, file names, the brand logo, the Design Preview reviewer tool itself ([data-design-preview]), and catalogue names
 * that come from data — the university and programme names in the preview fixtures (packages/api-client/src/preview).
 *
 * Needs the Vite DEV servers started with VITE_ENABLE_DESIGN_PREVIEW=1 (a production build is not required):
 *   student 5301 · marketing 5300 · agency 5302 · university 5303  (override with STUDENT_URL, MARKETING_URL, …)
 *
 *   node scripts/qa/lang-leak.mjs                       # every app, every locale of the matrix
 *   node scripts/qa/lang-leak.mjs --app=student --locales=ko,ar --widths=390
 *   node scripts/qa/lang-leak.mjs --shots=/tmp/dir      # also write a full-page screenshot per page
 *   node scripts/qa/lang-leak.mjs --app=student --locales=th --widths=390 --merge   # re-check cells, fold into the report
 *
 * Writes docs/qa/launch-final/l10n/lang-leak.json (+ summary.md) and exits 1 when any leak is found.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const LOC = path.join(ROOT, 'packages/i18n/locales');
const OUT = path.join(ROOT, 'docs/qa/launch-final/l10n');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ONLY_APP = opt('app', '');
const ONLY_LOCALES = opt('locales', '') ? opt('locales', '').split(',') : null;
const ONLY_WIDTHS = opt('widths', '') ? opt('widths', '').split(',').map(Number) : null;
const SHOTS = opt('shots', '');
const readJson = (p, d = {}) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d);
const flat = (o, p = '') => Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));

// ---------- the selectable Student locales (same gate as packages/i18n isStudentAppLocale) ----------
const status = readJson(path.join(LOC, '_student_status.json'), { locales: {} }).locales;
const STUDENT_LOCALES = Object.entries(status)
  .filter(([l, s]) => l !== 'en' && s.manifest_pct >= 100 && s.leak_check && s.leak_check.leaks === 0).map(([l]) => l).sort();
const WIDE = new Set(['ko', 'ar', 'ja', 'vi']);
const LATIN = new Set(['vi', 'id', 'fil', 'tr', 'uz', 'ms', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'pl', 'cs', 'hu', 'ro']);

const STUDENT_PREVIEW = [
  ['dashboard', '/'], ['match', '/explore'], ['university', '/universities/pusan-national-university'],
  ['applications', '/applications'], ['application', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56'],
  ['documents', '/documents', 'expand'], ['essay', '/essays/b180b72a-e7b9-4ac3-a91a-6df3eac7bf35'],
  ['messages', '/messages'], ['thread', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d'], ['services', '/services'],
  ['profile', '/profile'], ['settings', '/settings'], ['visa', '/visa'], ['arrival', '/arrival'],
];
const APPS = {
  student: {
    base: process.env.STUDENT_URL ?? 'http://127.0.0.1:5301', preview: 'paid',
    public: [['login', '/login'], ['register', '/register']], routes: STUDENT_PREVIEW,
    matrix: () => (ONLY_LOCALES ?? STUDENT_LOCALES).map((l) => ({ locale: l, widths: ONLY_WIDTHS ?? (WIDE.has(l) ? [390, 1440] : [390]) })),
  },
  marketing: {
    base: process.env.MARKETING_URL ?? 'http://127.0.0.1:5300', preview: null, public: [['home', '/'], ['universities', '/universities'], ['detail', '/universities/seoul-national-university']], routes: [],
    matrix: () => (ONLY_LOCALES ?? ['ko', 'vi', 'ja', 'ar', 'ru']).map((l) => ({ locale: l, widths: ONLY_WIDTHS ?? [390] })),
  },
  agency: {
    base: process.env.AGENCY_URL ?? 'http://127.0.0.1:5302', preview: 'paid', public: [['login', '/login']],
    routes: [['home', '/'], ['students', '/students'], ['student', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=application'],
      ['tasks', '/tasks'], ['review', '/review'], ['messages', '/messages'], ['services', '/services'], ['application', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56']],
    matrix: () => (ONLY_LOCALES ?? ['ko']).map((l) => ({ locale: l, widths: ONLY_WIDTHS ?? [1440] })),
  },
  university: {
    base: process.env.UNIVERSITY_URL ?? 'http://127.0.0.1:5303', preview: 'paid', public: [['login', '/login']],
    routes: [['home', '/'], ['applicants', '/applicants'], ['messages', '/messages'], ['analytics', '/analytics'], ['settings', '/settings'], ['programs', '/programs']],
    matrix: () => (ONLY_LOCALES ?? ['ko']).map((l) => ({ locale: l, widths: ONLY_WIDTHS ?? [1440] })),
  },
};

// ---------- allow-list ----------
// Proper nouns / acronyms / UI key names that stay in Latin script in every language (NHIS = Korea's health insurer).
const ALLOW_TOKENS = new Set(`hangyul univ topik toefl ielts ibt gks ieqas krw usd us pdf jpg jpeg png webp heic kb mb ok gpa nhis esim sim sms kiip tb teps niied cefr csv ocr sla ctrl id app ai phd saml enter shift`.split(/\s+/));
// Official service / venue names published only in English (like TOPIK or HiKorea).
const ALLOW_PHRASES = ['Hangyul Univ', 'Hangyul', 'Design Preview', 'Korea Travel Helpline', 'IELTS Academic', 'TOEFL iBT', 'TOPIK II', 'e-visa', 'e-Visa', 'E-Visa', 'Global Korea Scholarship', 'Korea Visa Application Center', 'Korea Visa Application Centre', 'HiKorea'];
// Catalogue names from data: universities and programmes in the synthetic fixtures.
const fixtureNames = new Set();
const DATA_FILES = [
  ...fs.readdirSync(path.join(ROOT, 'packages/api-client/src/preview')).filter((x) => x.endsWith('.json')).map((f) => path.join(ROOT, 'packages/api-client/src/preview', f)),
  path.join(ROOT, 'apps/marketing-web/public/data/public/institutions.json'), // the public catalogue the marketing site reads
];
for (const file of DATA_FILES.filter((f) => fs.existsSync(f))) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const m of txt.matchAll(/"(?:name_en|university_name|program_name|name_official_en|university|program|scholarship|full_name|student_name|display_name|counselor_name|owner_name|assignee_name|first_name)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const v = m[1].replace(/\\"/g, '"');
    if (v.length >= 3 && /[A-Za-z]/.test(v)) fixtureNames.add(v); // people's names in the fixtures carry diacritics (Trần Minh Thư)
  }
}
const CATALOGUE = [...fixtureNames].sort((a, b) => b.length - a.length);

// ---------- English vocabulary ----------
const NS = fs.readdirSync(path.join(LOC, 'en')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const enMaps = Object.fromEntries(NS.map((ns) => [ns, Object.fromEntries(flat(readJson(path.join(LOC, 'en', `${ns}.json`))))]));
const EN_WORDS = new Set();
for (const m of Object.values(enMaps)) for (const v of Object.values(m)) {
  for (const w of v.replace(/\{\{[^}]*\}\}|<[^>]+>/g, ' ').match(/[A-Za-z]{2,}/g) ?? []) EN_WORDS.add(w.toLowerCase());
}
for (const t of ALLOW_TOKENS) EN_WORDS.delete(t);
function enExactIndex(locale) {
  const idx = new Map();
  const kept = new Set();
  const own = new Set();
  for (const ns of NS) {
    const mine = Object.fromEntries(flat(readJson(path.join(LOC, locale, `${ns}.json`))));
    for (const v of Object.values(mine)) own.add(v.trim());
    for (const [k, v] of Object.entries(enMaps[ns])) {
      const s = v.trim();
      if (s.length < 3 || /\{\{/.test(s) || !/[a-z]/i.test(s)) continue;
      const own = mine[k];
      if (own === undefined) continue;
      if (own.trim() === s) kept.add(s); // the locale deliberately keeps this exact text for some key (a loanword, a plan name)
      else if (!idx.has(s)) idx.set(s, `${ns}:${k}`);
    }
  }
  for (const s of kept) idx.delete(s);
  for (const s of own) idx.delete(s); // the same words are this locale's own translation of some key (Indonesian "Detail")
  for (const n of CATALOGUE) idx.delete(n);
  return idx;
}

function scrub(text) {
  let s = ` ${text} `;
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ').replace(/\b[\w-]+(?:\.[\w-]+)+\.(?:invalid|test|example)\b/g, ' ').replace(/https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|kr|org|net|ac\.kr)\b\S*/g, ' ');
  s = s.replace(/\b[\w\-() ]+\.(?:pdf|jpe?g|png|webp|heic|docx?)\b/gi, ' ');
  for (const n of CATALOGUE) if (s.includes(n)) s = s.split(n).join(' ');
  for (const p of ALLOW_PHRASES) s = s.split(p).join(' ');
  s = s.replace(/\b(?:Visa|Mastercard|JCB|AMEX|American Express|UnionPay)\s*(?:•|\*)+/g, ' '); // a saved card's brand + last digits
  s = s.replace(/\b[a-z]+-\d{4}\.\d{2}\b/g, ' '); // a rules/engine version id (rules-2026.09)
  return s;
}
function judge(text, locale, exact) {
  if (LATIN.has(locale)) {
    const t = text.trim();
    return exact.has(t) ? { rule: 'EXACT', key: exact.get(t) } : null;
  }
  const s = scrub(text);
  const words = s.split(/[^A-Za-z'’]+/).filter(Boolean);
  // consecutive ASCII words: tokens of letters separated only by spaces/punctuation, no non-ASCII between
  const runs = s.match(/[A-Za-z]{2,}(?:[\s,.'’:;!?&/-]+[A-Za-z]{2,})+/g) ?? [];
  const run = runs.find((r) => r.split(/[^A-Za-z]+/).filter((w) => w.length >= 2 && !ALLOW_TOKENS.has(w.toLowerCase())).length >= 2);
  if (run) return { rule: 'RUN', match: run.trim() };
  const w = words.find((x) => x.length >= 2 && EN_WORDS.has(x.toLowerCase()) && !ALLOW_TOKENS.has(x.toLowerCase()));
  if (w) return { rule: 'WORD', match: w };
  return null;
}

async function collect(page) {
  return page.evaluate(() => {
    const out = [];
    const skip = (el) => !!el.closest('script,style,noscript,svg,[data-design-preview]:not(html),[data-user-content],[data-source-quote],[lang="en"],[data-no-l10n],.hg-uni-credit,[class*="__credit"],[aria-hidden="true"],[hidden],.hg-logo,[data-brand]');
    const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) !== 0; };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t || !/[A-Za-z]{2}/.test(t)) continue;
      const el = n.parentElement;
      if (!el || skip(el) || !visible(el)) continue;
      out.push({ kind: 'text', text: t, where: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '') });
    }
    for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],img[alt]')) {
      if (skip(el)) continue;
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
        const v = el.getAttribute(a);
        if (v && /[A-Za-z]{2}/.test(v)) out.push({ kind: a, text: v.trim(), where: el.tagName.toLowerCase() });
      }
    }
    return out;
  });
}

const browser = await chromium.launch();
const ran = [];
const report = { generated_at: new Date().toISOString(), allow: { tokens: [...ALLOW_TOKENS], phrases: ALLOW_PHRASES, catalogue_names: CATALOGUE.length }, apps: {}, leaks: 0 };
for (const [app, cfg] of Object.entries(APPS)) {
  if (ONLY_APP && ONLY_APP !== app) continue;
  const appRep = (report.apps[app] = { pages: 0, leaks: [] });
  for (const { locale, widths } of cfg.matrix()) {
    const exact = enExactIndex(locale);
    for (const width of widths) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 }, locale, extraHTTPHeaders: { 'Accept-Language': locale } });
      await ctx.addInitScript(([loc]) => { try { localStorage.setItem('hg.locale', loc); localStorage.setItem('hg.cookieConsent', JSON.stringify({ v: 1, analytics: false })); } catch { /* */ } }, [locale]);
      const page = await ctx.newPage();
      const pages = [...cfg.public.map((r) => [...r, null, false]), ...cfg.routes.map((r) => [r[0], r[1], r[2] ?? null, true])];
      for (const [name, route, action, signedIn] of pages) {
        if (signedIn) await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), ['hg.designPreview', cfg.preview]).catch(() => {});
        else await page.evaluate(() => sessionStorage.removeItem('hg.designPreview')).catch(() => {});
        const url = `${cfg.base}${route}${route.includes('?') ? '&' : '?'}lang=${locale}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
          if (signedIn && !(await page.evaluate(() => sessionStorage.getItem('hg.designPreview')))) {
            await page.evaluate((v) => sessionStorage.setItem('hg.designPreview', v), cfg.preview);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
          }
          await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
          // Lazy routes compile on first request in the dev server: wait until the rendered text stops changing.
          let last = -1;
          for (let i = 0; i < 40; i++) {
            await page.waitForTimeout(800);
            const n = await page.evaluate(() => (document.querySelector('main')?.innerText ?? document.body.innerText).length).catch(() => 0);
            const busy = await page.locator('.hg-skeleton, [aria-busy="true"]').count().catch(() => 0);
            if (n > 40 && n === last && !busy) break;
            last = n;
          }
          if (action === 'expand') {
            const btn = page.locator('main [aria-expanded="false"]').first();
            if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForTimeout(500); }
          }
        } catch (e) { appRep.leaks.push({ locale, width, page: name, rule: 'LOAD', text: String(e.message).slice(0, 160) }); continue; }
        appRep.pages++;
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${app}-${locale}-${width}-${name}.png`), fullPage: true }).catch(() => {}); }
        const seen = new Set();
        const items = await collect(page);
        if (process.env.LEAK_DUMP) fs.appendFileSync(process.env.LEAK_DUMP, items.map((i) => `${app}|${locale}|${name}|${i.kind}|${i.text}`).join('\n') + '\n');
        for (const it of items) {
          const v = judge(it.text, locale, exact);
          if (!v) continue;
          const id = `${it.kind}|${it.text}`;
          if (seen.has(id)) continue;
          seen.add(id);
          appRep.leaks.push({ locale, width, page: name, kind: it.kind, where: it.where, text: it.text.slice(0, 200), ...v });
        }
      }
      await ctx.close();
      ran.push({ app, locale, width });
      console.log(`${app} ${locale} @${width}: ${appRep.leaks.filter((l) => l.locale === locale && l.width === width).length} leak(s)`);
    }
  }
  report.leaks += appRep.leaks.length;
}
await browser.close();

fs.mkdirSync(OUT, { recursive: true });
// --merge: re-check a few (app, locale, width) cells after a fix and fold the result into the full report instead of
// re-running the whole matrix; the merged cells are listed under `reruns`.
if (args.includes('--merge') && fs.existsSync(path.join(OUT, 'lang-leak.json'))) {
  const full = JSON.parse(fs.readFileSync(path.join(OUT, 'lang-leak.json'), 'utf8'));
  for (const [app, r] of Object.entries(report.apps)) {
    const cells = new Set(ran.filter((c) => c.app === app).map((c) => `${c.locale}@${c.width}`));
    const prev = full.apps[app] ?? { pages: r.pages, leaks: [] };
    prev.leaks = [...prev.leaks.filter((l) => !cells.has(`${l.locale}@${l.width}`)), ...r.leaks];
    full.apps[app] = prev;
  }
  full.reruns = [...(full.reruns ?? []), { at: report.generated_at, cells: ran.map((c) => `${c.app}:${c.locale}@${c.width}`) }];
  full.leaks = Object.values(full.apps).reduce((n, r) => n + r.leaks.length, 0);
  Object.assign(report, full);
}
const tag = args.includes('--merge') ? '' : `${ONLY_APP ? `.${ONLY_APP}` : ''}${ONLY_LOCALES || ONLY_WIDTHS ? '.partial' : ''}`;
fs.writeFileSync(path.join(OUT, `lang-leak${tag}.json`), JSON.stringify(report, null, 1) + '\n');
const lines = [`# Language leak test (${report.generated_at.slice(0, 10)})`, '', `Total leaks: **${report.leaks}**`, '', '| app | pages | leaks |', '|---|---|---|',
  ...Object.entries(report.apps).map(([a, r]) => `| ${a} | ${r.pages} | ${r.leaks.length} |`), '',
  ...(report.reruns ?? []).map((r) => `Re-checked after a fix (${r.at.slice(0, 16)}): ${r.cells.join(', ')}`), ''];
for (const [a, r] of Object.entries(report.apps)) for (const l of r.leaks.slice(0, 200)) lines.push(`- ${a} ${l.locale}@${l.width} ${l.page} [${l.rule}] ${JSON.stringify(l.text)}${l.match ? ` → ${l.match}` : ''}`);
fs.writeFileSync(path.join(OUT, `summary${tag}.md`), lines.join('\n') + '\n');
console.log(`total leaks: ${report.leaks}`);
process.exit(report.leaks ? 1 : 0);
