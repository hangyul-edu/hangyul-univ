import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const lang of ['ja','ko','en','de']) {
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  await p.goto(`http://localhost:3100/start?lang=${lang}`,{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
  const r = await p.evaluate(() => {
    const de=document.documentElement;
    const over=[];
    document.querySelectorAll('body *').forEach(el=>{
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const cs=getComputedStyle(el);
        if (cs.overflowX==='visible')
          over.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0,40)} sw=${el.scrollWidth} cw=${el.clientWidth} "${(el.textContent||'').trim().slice(0,34)}"`);
      }
    });
    return { docSW: de.scrollWidth, vw: window.innerWidth, over: over.slice(0,6) };
  });
  console.log(`\n=== ${lang}: docScrollWidth=${r.docSW} viewport=${r.vw} ${r.docSW>r.vw+1?'*** OVERFLOW ***':'ok'}`);
  r.over.forEach(o=>console.log('   ', o));
  await p.close();
}
await b.close();
