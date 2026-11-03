import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
await p.goto('http://localhost:3100/start?lang=ja',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
console.log(await p.evaluate(() => {
  const out=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect();
    if (r.width>0 && r.right > window.innerWidth+1)
      out.push({tag:el.tagName.toLowerCase(), cls:String(el.className).slice(0,52),
        right:Math.round(r.right), w:Math.round(r.width), left:Math.round(r.left),
        text:(el.textContent||'').trim().slice(0,40)});
  });
  return out.slice(0,10);
}));
await p.screenshot({path:'docs/qa/v19/screenshots/locales/_overflow-ja-start@390.png'});
await b.close();
