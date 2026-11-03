// V29: pricing section + comparison + add-ons + notes, at the brief's widths (§54). Writes docs/qa/v29/shots/.
import { chromium } from 'playwright';
const BASE = process.env.MK ?? 'http://localhost:3100';
const widths = (process.env.WIDTHS ?? '320,360,390,430,768,1440').split(',').map(Number);
const locales = (process.env.LOCALES ?? 'ko,en').split(',');
const out = '/root/hangyul-univ/docs/qa/v29/shots';
const b = await chromium.launch();
const findings = [];
for (const loc of locales) for (const w of widths) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${BASE}/?lang=${loc}#pricing`, { waitUntil: 'networkidle' });
  await p.evaluate(() => { document.querySelectorAll('.kn-reveal,[data-reveal]').forEach((e) => e.classList.add('is-in')); });
  await p.locator('#plan-compare > summary').click();
  await p.locator('#plan-notes > summary').click();
  await p.waitForTimeout(500);
  const sec = p.locator('#pricing');
  await sec.screenshot({ path: `${out}/pricing-${loc}-${w}.png` });
  const m = await p.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    const clipped = [...document.querySelectorAll('#pricing *')].filter((e) => {
      const cs = getComputedStyle(e); if (cs.display === 'none' || !e.checkVisibility?.() || e.closest('.hg-sr-only')) return false;
      return e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'visible' && e.clientWidth > 0;
    }).length;
    const tiny = [...document.querySelectorAll('#pricing p, #pricing li, #pricing td, #pricing th, #pricing dd, #pricing dt')]
      .filter((e) => e.checkVisibility?.() && parseFloat(getComputedStyle(e).fontSize) < 12).length;
    const missingKeys = [...document.querySelectorAll('#pricing *')].filter((e) => e.childNodes.length === 1 && /v\d+\.pricing\.|common:v29|v29\.addon/.test(e.textContent)).length;
    return { over, clipped, tiny, missingKeys };
  });
  if (m.over > 0 || m.clipped || m.tiny || m.missingKeys) findings.push({ loc, w, ...m });
  await p.close();
}
await b.close();
console.log(findings.length ? JSON.stringify(findings, null, 1) : 'pricing: no overflow, clipping, tiny text or raw keys');
process.exit(findings.length ? 1 : 0);
