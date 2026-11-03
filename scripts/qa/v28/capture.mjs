// V28 BEFORE/AFTER capture: node scripts/qa/v28/capture.mjs <before|after> [product-filter] [width-filter]
// Same routes, same widths, Korean UI (lang=ko), dev stack on 3100–3103. Viewport shot at every width; full page at 390 and
// 1280. Output docs/qa/v28/<label>/<product>-<route>-<w>[-full].png. Resumable (skips existing files).
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const [label = 'before', onlyProduct, onlyWidth] = process.argv.slice(2);
const OUT = `docs/qa/v28/${label}`;
mkdirSync(OUT, { recursive: true });
const WEB = [390, 430, 768, 1024, 1280, 1440];
const CONSOLE = [...WEB, 1728];
const PRODUCTS = [
  { name: 'marketing', base: 'http://127.0.0.1:3100', email: null, widths: WEB, routes: [
    ['home', '/?lang=ko'],
    ['start', '/start?lang=ko&nationality=VN&level=BACHELOR&gpa=8.2&gpa_scale=10&langs=TOPIK:3', '.hg-fit-go button'],
    ['directory', '/universities?lang=ko'],
    ['detail-yonsei', '/universities/yonsei-university?lang=ko'],
    ['detail-nophoto', '/universities/busan-national-university-of-education?lang=ko'],
  ] },
  { name: 'student', base: 'http://127.0.0.1:3101', email: 'student@demo.hangyul.kr', widths: WEB, routes: [
    ['home', '/?lang=ko'], ['explore', '/explore?lang=ko'], ['applications', '/applications?lang=ko'],
    ['application', '/applications/c62c31ff-5e45-4b21-bca1-bc9b924275d4?lang=ko'], ['documents', '/documents?lang=ko'],
    ['services', '/services?lang=ko'], ['messages', '/messages?lang=ko'],
  ] },
  { name: 'student-anon', base: 'http://127.0.0.1:3101', email: null, widths: [390, 1280], routes: [['register', '/register?lang=ko']] },
  { name: 'agency', base: 'http://127.0.0.1:3102', email: 'counselor@lotus.demo.hangyul.kr', widths: CONSOLE, routes: [
    ['today', '/?lang=ko'], ['students', '/students?lang=ko'], ['workspace', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?lang=ko'],
    ['applications', '/applications?lang=ko'], ['messages', '/messages?lang=ko'],
  ] },
  { name: 'university', base: 'http://127.0.0.1:3103', email: 'admin@pusan.univ.demo.hangyul.kr', widths: CONSOLE, routes: [
    ['home', '/?lang=ko'], ['applicants', '/applicants?lang=ko'], ['analytics', '/analytics?lang=ko'], ['cohorts', '/cohorts?lang=ko'],
  ] },
];

const b = await chromium.launch();
const errors = [];
for (const p of PRODUCTS) {
  if (onlyProduct && !p.name.startsWith(onlyProduct)) continue;
  for (const w of p.widths) {
    if (onlyWidth && String(w) !== onlyWidth) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${p.name} ${w}: ${e}`));
    if (p.email) {
      await page.goto(`${p.base}/login?demo=${encodeURIComponent(p.email)}&lang=ko`, { waitUntil: 'networkidle' });
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
    }
    for (const [slug, path, click] of p.routes) {
      const file = `${OUT}/${p.name}-${slug}-${w}`;
      if (existsSync(`${file}.png`)) continue;
      try {
        await page.goto(`${p.base}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
        if (click) { await page.locator(click).first().click().catch(() => {}); await page.waitForLoadState('networkidle'); }
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${file}.png` });
        if (w === 390 || w === 1280) {
          const h = await page.evaluate(() => document.body.scrollHeight);
          for (let y = 0; y < h; y += 700) { await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(40); }
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await page.screenshot({ path: `${file}-full.png`, fullPage: true });
        }
      } catch (e) { errors.push(`${p.name} ${slug} ${w}: ${String(e).slice(0, 120)}`); }
    }
    await ctx.close();
  }
  console.log(`captured ${p.name}`);
}
await b.close();
console.log(JSON.stringify({ errors }, null, 1));
