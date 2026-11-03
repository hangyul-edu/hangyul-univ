// Finds the subtree that makes a page wider than the viewport by hiding candidates one at a time.
import { chromium } from '@playwright/test';
const [base, email, path, w] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 844 } })).newPage();
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(1000);
const ulInfo = await p.evaluate(() => { const ul = document.querySelector('.ssc-list'); const cs = getComputedStyle(ul); return { disp: cs.display, cols: cs.gridTemplateColumns, pad: cs.padding, mar: cs.margin, w: ul.getBoundingClientRect().width, kids: [...ul.children].slice(0,3).map((k) => { const r = k.getBoundingClientRect(); const c = getComputedStyle(k); return [k.tagName, Math.round(r.left), Math.round(r.right), c.marginInline, c.width]; }) }; }); console.log(JSON.stringify(ulInfo));
await p.evaluate(() => { const ul = document.querySelector('.ssc-list'); ul.scrollIntoView(); scrollTo({ left: 9999, top: scrollY, behavior: 'instant' }); }); await p.waitForTimeout(300); await p.screenshot({ path: process.env.SHOT });
console.log(JSON.stringify(await p.evaluate(() => {
  document.querySelectorAll('.ssc-list details').forEach((d) => { d.open = true; }); const ul = document.querySelector('.ssc-list'); const ulR = ul.getBoundingClientRect(); const bad = [...ul.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > ulR.right + 1).map((e) => `${e.tagName}.${String(e.className).slice(0,40)} right=${Math.round(e.getBoundingClientRect().right)} text=${(e.innerText||'').slice(0,50)} ws=${getComputedStyle(e).whiteSpace}`); if (bad.length || true) return { ulRight: ulR.right, ulSW: ul.scrollWidth, bad: bad.slice(0, 12) }; const li = null; if (li) return { liSW: li.scrollWidth, liCW: li.clientWidth, wide: [...li.querySelectorAll('*')].filter((e) => e.scrollWidth > li.clientWidth || e.getBoundingClientRect().width > li.clientWidth).map((e) => `${e.tagName}.${String(e.className).slice(0,40)} sw=${e.scrollWidth} w=${Math.round(e.getBoundingClientRect().width)} ws=${getComputedStyle(e).whiteSpace} disp=${getComputedStyle(e).display}`).slice(0, 10), grid: getComputedStyle(li).gridTemplateColumns, kids: [...li.children].map((k) => `${k.className} w=${Math.round(k.getBoundingClientRect().width)} sw=${k.scrollWidth}`) };
  const W = innerWidth, docW = () => document.documentElement.scrollWidth;
  const path = []; let node = document.body;
  while (true) {
    const kids = [...node.children]; let culprit = null;
    for (const k of kids) { const d = k.style.display; k.style.display = 'none'; const ok = docW() <= W; k.style.display = d; if (ok) { culprit = k; break; } }
    if (!culprit) break;
    const r = culprit.getBoundingClientRect(); const cs = getComputedStyle(culprit);
    path.push(`${culprit.tagName}.${String(culprit.className).slice(0, 50)} [${Math.round(r.left)},${Math.round(r.right)}] w=${Math.round(r.width)} sw=${culprit.scrollWidth} ov=${cs.overflowX} pos=${cs.position} tf=${cs.transform}`);
    node = culprit;
    if (path.length > 25) break;
  }
  const after = node ? getComputedStyle(node, '::after') : null, before = node ? getComputedStyle(node, '::before') : null;
  return { docW: docW(), path, leaf: node?.outerHTML.slice(0, 300), after: after && [after.content, after.position, after.width, after.left, after.right], before: before && [before.content, before.position, before.width] };
}), null, 1));
await b.close();
