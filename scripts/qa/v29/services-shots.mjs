// V29: the student services page and the agency plan panel, signed in as demo accounts (writes docs/qa/v29/shots/).
import { chromium } from 'playwright';
const out = '/root/hangyul-univ/docs/qa/v29/shots';
const PW = 'Hangyul!2026';
const shots = [
  { app: 'student', base: 'http://localhost:3101', email: process.env.STUDENT ?? 'student@demo.hangyul.kr', path: '/services' },
  ...(process.env.AGENCY_STUDENT ? [{ app: 'agency', base: 'http://localhost:3102', email: 'counselor@lotus.demo.hangyul.kr', path: `/students/${process.env.AGENCY_STUDENT}` }] : []),
];
const b = await chromium.launch();
const issues = [];
for (const s of shots) for (const loc of (process.env.LOCALES ?? 'ko,en').split(',')) for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${s.base}/?lang=${loc}`);
  const r = await p.request.post(`${s.base}/api/v1/auth/login`, { data: { email: s.email, password: PW, client: s.app } });
  if (!r.ok()) { issues.push(`${s.app} login ${r.status()}`); await ctx.close(); continue; }
  await p.goto(`${s.base}${s.path}?lang=${loc}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${s.app}-services-${loc}-${w}.png`, fullPage: true });
  const m = await p.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    raw: [...document.querySelectorAll('body *')].filter((e) => e.childNodes.length === 1 && e.childNodes[0].nodeType === 3 && /\b(v\d{2}\.[a-z]+\.[a-zA-Z.]+|common:v29)/.test(e.textContent)).map((e) => e.textContent.slice(0, 60)),
  }));
  if (m.over > 0 || m.raw.length) issues.push(`${s.app} ${loc} ${w}: overflow ${m.over}, raw keys ${JSON.stringify(m.raw.slice(0, 5))}`);
  await ctx.close();
}
await b.close();
console.log(issues.length ? issues.join('\n') : 'services: no overflow, no raw keys');
process.exit(issues.length ? 1 : 0);
