// Screenshots an Expo web build at phone size.
// node scripts/qa/_mobile.mjs <base> <demo-email-substring|-> <outdir> <step...>
//   step "/route"      → navigate directly (the web preview keeps the session in sessionStorage)
//   step "Label"       → tap the element with that exact text (use "A>B" to tap twice)
//   step "!name"       → just take a screenshot named <name>
// Writes NN-<step>.png (full page) and prints runtime errors (page errors and red-box overlays).
import { chromium } from '@playwright/test';
const [,, base, email, out, ...steps] = process.argv;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 200)}`));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|Failed to load resource/.test(m.text())) errs.push(`console: ${m.text().slice(0, 200)}`); });
await p.goto(base, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(3500);
await p.screenshot({ path: `${out}/00-login.png` });
if (email !== '-') { await p.getByText(email).first().click(); await p.waitForTimeout(6000); }
await p.screenshot({ path: `${out}/01-home.png`, fullPage: true });
let i = 2;
for (const s of steps) {
  if (s.startsWith('/')) { await p.goto(base + s, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(4000); }
  else if (!s.startsWith('!')) {
    for (const part of s.split('>')) {
      await p.getByText(part, { exact: true }).last().click({ timeout: 8000 }).catch((e) => errs.push(`tap ${part}: ${e.message.split('\n')[0].slice(0, 80)}`));
      await p.waitForTimeout(3000);
    }
  }
  const overlay = await p.locator('text=/cannot contain|Uncaught Error|Render Error/').count();
  if (overlay) errs.push(`error overlay on ${s}`);
  await p.screenshot({ path: `${out}/${String(i++).padStart(2, '0')}-${s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+/, '')}.png`, fullPage: true });
}
console.log(errs.length ? errs.join('\n') : 'no runtime errors');
await b.close();
