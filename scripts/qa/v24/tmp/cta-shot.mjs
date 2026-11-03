import { chromium } from 'playwright';
const S = process.argv[2];
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  const browse = p.locator('.kn-btn--browse');
  await browse.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  const bb = await browse.boundingBox(); console.log(w, 'browse', JSON.stringify(bb));
  await p.screenshot({ path: `${S}/cta-browse-${w}.png`, clip: { x: 0, y: bb.y - 260, width: w, height: 380 } });
  await browse.hover(); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/cta-browse-hover-${w}.png`, clip: { x: 0, y: bb.y - 40, width: w, height: 140 } });
  const sum = p.locator('.kn-compare__toggle');
  await sum.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  let sb = await sum.boundingBox(); console.log(w, 'compare', JSON.stringify(sb), await sum.getAttribute('aria-expanded'));
  await p.screenshot({ path: `${S}/cta-compare-${w}.png`, clip: { x: 0, y: Math.max(0, sb.y - 420), width: w, height: 560 } });
  await sum.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  sb = await sum.boundingBox(); console.log(w, 'opened', await sum.getAttribute('aria-expanded'), await sum.innerText());
  await p.screenshot({ path: `${S}/cta-compare-open-${w}.png`, clip: { x: 0, y: Math.max(0, sb.y - 60), width: w, height: 600 } });
  await p.close();
}
await b.close();
