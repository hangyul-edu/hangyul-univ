/**
 * Production-wording leak scan (V12, brief Part 1).
 *
 *     node scripts/qa/v12-leak-scan.mjs                      # all four apps, ko + en
 *     BASE_MARKETING=http://localhost:3100 node scripts/qa/v12-leak-scan.mjs
 *     LOCALES=ko node scripts/qa/v12-leak-scan.mjs
 *
 * Loads every normal route with a real browser and fails if the **rendered text a customer can see** contains
 * development vocabulary. It reads the DOM, not the bundle, because that is the thing a customer looks at: a
 * forbidden string in a comment, in a dead i18n key or in a chunk nobody evaluates has never hurt anybody, and a
 * scan that fails on those gets disabled within a week.
 *
 * The allow-list is deliberately narrow (brief: "Do not weaken the scan with broad exclusions"):
 *
 *   · `/__dev` is not scanned at all — it exists to say these words.
 *   · Four words have an ordinary product meaning in this domain and are matched with the context that makes
 *     them a leak rather than being excluded outright. See ALLOWED below; each entry names the real usage it
 *     protects, so adding one is an argument, not a shrug.
 *
 * Exit code 1 on any hit, with the route, locale, matched term and the sentence it sat in.
 */
import { chromium } from '@playwright/test';

const PASSWORD = process.env.HG_DEMO_PASSWORD ?? 'Hangyul!2026';

/**
 * Signing in matters: the only real leak this scan has ever caught lived on an authenticated screen. A seeded
 * programme called "Authorised-submission fixture (development only)" reached the agency Today queue and the
 * deadline timeline through *stored task titles*, which no scan of the public site could ever have seen.
 */
const APPS = [
  {
    name: 'marketing',
    base: process.env.BASE_MARKETING ?? 'http://localhost:3100',
    routes: ['/', '/universities', '/universities?region=seoul', '/universities/seoul-national-university', '/privacy', '/terms', '/credits'],
  },
  {
    name: 'student',
    base: process.env.BASE_STUDENT ?? 'http://localhost:3101',
    routes: ['/login', '/start'],
    login: 'student@demo.hangyul.kr',
    authed: ['/', '/explore', '/applications', '/messages', '/more', '/documents', '/visa', '/services', '/settings'],
  },
  {
    name: 'agency',
    base: process.env.BASE_AGENCY ?? 'http://localhost:3102',
    routes: ['/login'],
    login: 'counselor@lotus.demo.hangyul.kr',
    authed: ['/', '/students', '/review', '/applications', '/messages', '/performance', '/manage'],
  },
  {
    name: 'university',
    base: process.env.BASE_UNIVERSITY ?? 'http://localhost:3103',
    routes: ['/login'],
    login: 'admissions@pusan.univ.demo.hangyul.kr',
    authed: ['/', '/applicants', '/programs', '/messages', '/analytics', '/manage'],
  },
  {
    // Hangyul's own operations area. The brief names it explicitly ("This includes: … Hangyul HQ"), and it is
    // the surface most likely to carry engineering vocabulary legitimately, so it is swept like the rest.
    name: 'hq',
    base: process.env.BASE_AGENCY ?? 'http://localhost:3102',
    routes: [],
    login: 'ops@demo.hangyul.kr',
    authed: ['/hq', '/hq/manage', '/hq/agencies'],
  },
];

/**
 * Forbidden vocabulary. English terms are matched case-insensitively on a word boundary; Korean has no word
 * boundary, so those are matched as substrings, which is why the Korean list is the specific compound rather
 * than the bare morpheme (개발 alone would match 개발도상국 and, more to the point, 자기개발).
 */
const FORBIDDEN = [
  // English
  /\bdev\b/i, /\bdevelopment (build|environment|only|data)\b/i, /\bdevelopment\b(?=[^.]*\bonly\b)/i,
  /\bdemo\b/i, /\bfixture\b/i, /\bsynthetic\b/i, /\bstub\b/i, /\bseed data\b/i,
  // "mock" alone is still development vocabulary; "mock interview" is not — see ALLOWED below, which is
  // why the bare token is matched with the compound excluded rather than dropped.
  /\bmock\b(?!\s+interviews?\b)/i,
  /\bsample data\b/i, /\bsample dataset\b/i, /\bpreview data\b/i, /\bnot connected\b/i,
  /\bmachine draft\b/i, /\btest account\b/i, /\bplaceholder\b/i, /\bTBD\b/, /\bcoming soon\b/i,
  /\bnot final\b/i, /\bnot legal advice\b/i, /\bto be provided by legal counsel\b/i,
  // Korean
  /개발용/, /개발 환경/, /개발 빌드/, /데모/, /샘플 데이터/, /예시 데이터/, /가상 데이터/, /미연동/,
  /검증용/, /기계 번역 초안/, /테스트 계정/, /추후 입력/, /준비 중입니다/,
];

/**
 * Narrow, argued exceptions. Each is a string that contains a forbidden token for a legitimate product reason.
 * A match is a leak unless the surrounding sentence is one of these.
 */
const ALLOWED = [
  // "초안" is the status of a student's own essay and of an application — a real domain state, not a disclaimer.
  { term: /초안/, why: 'essay/application draft is a real state (common:essayStatus.DRAFT)' },
  { term: /\bdraft\b/i, why: 'essay/application draft is a real state' },
  // "준비 중" is a journey stage (서류 준비 중 / 비자 준비 중). "준비 중입니다" as a whole sentence is the
  // "coming soon" sense and stays forbidden above.
  { term: /준비 중(?!입니다)/, why: 'document/visa preparation is a real stage' },
  // V15: a mock interview is a thing Premium sells (business plan §3-3, 모의 면접 1회). The bare token stays
  // forbidden — "mock data" must still fail — so the pattern above excludes only this compound.
  { term: /\bmock interviews?\b/i, why: 'a mock interview is a Premium service, not development vocabulary' },
];

const LOCALES = (process.env.LOCALES ?? 'ko,en').split(',');

/** Visible text only: no <script>, no <style>, no aria-hidden-but-present markup we never paint. */
const visibleText = () =>
  document.body ? (document.body.innerText || '').replace(/\s+/g, ' ') : '';

const sentences = (text) => text.split(/(?<=[.!?。？！])\s+|·|\|/).filter(Boolean);

function scan(text) {
  const hits = [];
  for (const sentence of sentences(text)) {
    for (const rx of FORBIDDEN) {
      const m = sentence.match(rx);
      if (!m) continue;
      // An allowed usage covers the match only when it explains this exact token in this exact sentence.
      const excused = ALLOWED.some((a) => a.term.test(m[0]) || (a.term.test(sentence) && a.term.source === rx.source));
      if (excused) continue;
      hits.push({ term: m[0], sentence: sentence.trim().slice(0, 180) });
    }
  }
  return hits;
}

const browser = await chromium.launch();
let failures = 0;
let scanned = 0;

for (const locale of LOCALES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('hg.locale', l); } catch { /* private mode */ }
  }, locale);
  const page = await ctx.newPage();

  for (const app of APPS) {
    // Signed-out routes first, then sign in once and sweep the console's own screens.
    const signedOut = app.routes ?? [];
    let signedIn = [];
    if (app.login && app.authed) {
      try {
        // Hangyul HQ lives on the agency console's origin, so by the time we reach it the context is already
        // signed in as a counsellor and `/login` redirects straight past the form. Clear the session first.
        await page.goto(`${app.base}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.evaluate(() => {
          try { localStorage.clear(); sessionStorage.clear(); } catch { /* private mode */ }
        });
        await page.context().clearCookies();
        await page.goto(`${app.base}/login`, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.fill('#email', app.login);
        await page.fill('#password', PASSWORD);
        await page.click('button[type=submit]');
        await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
        await page.waitForTimeout(800);
        signedIn = app.authed;
      } catch (e) {
        // Loud, not silent: an app whose authenticated routes were never scanned must not read as a pass.
        console.log(`  !  ${locale} ${app.name} — could not sign in (${String(e).split('\n')[0].slice(0, 80)})`);
        failures += 1;
      }
    }
    for (const route of [...signedOut, ...signedIn]) {
      const url = `${app.base}${route}`;
      // One retry: `networkidle` on the heaviest console pages times out occasionally when the machine is
      // busy, and a route that merely failed to load must not read as a route that passed. If it fails twice
      // it counts as a failure, because an unscanned route is not a clean one.
      let loaded = false;
      for (const attempt of [1, 2]) {
        try {
          await page.goto(url, { waitUntil: attempt === 1 ? 'networkidle' : 'domcontentloaded', timeout: 30_000 });
          loaded = true;
          break;
        } catch {
          if (attempt === 2) break;
          await page.waitForTimeout(1_500);
        }
      }
      if (!loaded) {
        console.log(`  ✗  ${locale} ${app.name}${route} — could not be loaded, so it was never scanned`);
        failures += 1;
        continue;
      }
      await page.waitForTimeout(500);
      scanned += 1;
      const text = await page.evaluate(visibleText);
      const hits = scan(text);
      if (hits.length) {
        failures += hits.length;
        console.log(`\n  ✗  ${locale} ${app.name}${route}`);
        for (const h of hits) console.log(`       “${h.term}”  in: ${h.sentence}`);
      } else {
        console.log(`  ✓  ${locale} ${app.name}${route}`);
      }
    }
  }
  await ctx.close();
}

await browser.close();

console.log(`\n${scanned} rendered routes scanned · ${failures} leak(s)`);
if (failures) {
  console.log('\nA normal route is showing development vocabulary. Move it behind /__dev or rewrite the copy.');
  process.exit(1);
}
