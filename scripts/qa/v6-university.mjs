// V6 university console captures. Usage: OUT=docs/qa/v6/university/after node scripts/qa/v6-university.mjs [widths] [filter]
import { chromium } from '@playwright/test';
const B = 'http://localhost:3103';
const out = process.env.OUT ?? 'docs/qa/v6/university/after';
const widths = (process.argv[2] ?? '1440,1280,390').split(',').map(Number);
const filter = process.argv[3] ?? '';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
async function login(email) {
  await ctx.clearCookies();
  await page.goto(`${B}/login`);
  const r = await page.request.post(`${B}/api/v1/auth/demo-login`, { data: { email, client: 'university' } });
  if (!r.ok()) console.log('login fail', email, r.status());
  return (await r.json()).access_token;
}
const A = 'admissions@pusan.univ.demo.hangyul.kr', M = 'admin@pusan.univ.demo.hangyul.kr';
// find an application id in review
const tok = await login(A);
const list = await (await page.request.get(`${B}/api/v1/applications?status=UNIVERSITY_REVIEW&page_size=5`, { headers: { Authorization: `Bearer ${tok}` } })).json().catch(() => null);
const appId = process.env.APP ?? list?.items?.[0]?.id;
const shots = [
  ['overview', A, '/'], ['applicants', A, '/applicants'], ['applicant', A, `/applications/${appId}`], ['documents', A, '/documents'],
  ['offers', A, '/offers'], ['messages', A, '/messages'],
  ['programs', M, '/programs'], ['analytics', M, '/analytics'], ['cohorts', M, '/cohorts'], ['partnership', M, '/partnership'],
  ['scholarships', M, '/scholarships'], ['exports', M, '/exports'], ['settings', M, '/settings'], ['agencies', M, '/agencies'],
];
let cur = A;
for (const [name, who, route] of shots) {
  if (filter && !name.includes(filter)) continue;
  if (who !== cur) { await login(who); cur = who; }
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : w < 1300 ? 800 : 900 });
    await page.goto(`${B}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);
    const f = `${out}/un-${name}-${w}.png`;
    await page.screenshot({ path: f, fullPage: true });
    console.log(f, await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth ? 'OVERFLOW' : ''));
  }
}
await browser.close();
