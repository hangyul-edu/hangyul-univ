import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3102/login'); await p.fill('#email','manager@lotus.demo.hangyul.kr'); await p.fill('#password','Hangyul!2026'); await p.click('button[type=submit]');
await p.waitForURL((u) => !u.pathname.startsWith('/login')); await p.goto('http://localhost:3102/pipeline', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
console.log(await p.evaluate(() => { let e=document.querySelector('.ag-kanban'); const o=[]; while(e){const r=e.getBoundingClientRect(); o.push(e.tagName+'.'+[...e.classList].slice(0,2).join('.')+' w='+Math.round(r.width)+' sw='+e.scrollWidth+' ox='+getComputedStyle(e).overflowX+' disp='+getComputedStyle(e).display); e=e.parentElement;} return o.join('\n'); }));
await b.close();
