// V4 native QA through Expo web: first viewport (390×844) + tall "full" capture (390×H) per step.
// node scripts/qa/v4-mobile.mjs <base> <demo-email-substring|-> <outdir> <step...>
//   "/route" navigate · "Label" tap exact text ("A>B" taps in order) · "~Label" tap first match containing text · "!name" screenshot only
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [,, base, email, out, ...steps] = process.argv;
fs.mkdirSync(out, { recursive: true });
const TALL = Number(process.env.TALL ?? 2400);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: process.env.TZID ?? 'Asia/Ho_Chi_Minh' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 200)}`));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|Failed to load resource/.test(m.text())) errs.push(`console: ${m.text().slice(0, 200)}`); });
await p.goto(base, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(3500);
if (email !== '-') { await p.getByText(email).first().click(); await p.waitForTimeout(6000); }
const shoot = async (name) => {
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.setViewportSize({ width: 390, height: TALL }); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${name}-full.png` });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
};
await shoot('01-home');
let i = 2;
for (const s of steps) {
  if (s.startsWith('/')) { await p.goto(base + s, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(4000); }
  else if (!s.startsWith('!')) {
    for (const part of s.split('>')) {
      const loc = part.startsWith('~') ? p.getByText(part.slice(1)).first() : p.getByText(part, { exact: true }).last();
      await loc.click({ timeout: 8000 }).catch((e) => errs.push(`tap ${part}: ${e.message.split('\n')[0].slice(0, 80)}`));
      await p.waitForTimeout(3000);
    }
  }
  const overlay = await p.locator('text=/cannot contain|Uncaught Error|Render Error/').count();
  if (overlay) errs.push(`error overlay on ${s}`);
  await shoot(`${String(i++).padStart(2, '0')}-${s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+/, '').slice(0, 40)}`);
}
console.log(errs.length ? errs.join('\n') : 'no runtime errors');
await b.close();
