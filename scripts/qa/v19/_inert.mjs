import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:3101/login',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.setItem('hg.locale','ko')}catch{}});
await p.fill('#email','student@demo.hangyul.kr'); await p.fill('#password','Hangyul!2026');
await p.click('button[type=submit]'); await p.waitForURL(u=>!u.pathname.startsWith('/login'));

await p.goto('http://localhost:3101/services',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const btn = p.getByRole('button',{name:/프리미엄으로 변경/}).first();
console.log('services upgrade button present:', await btn.count());
const before = await p.evaluate(()=> (document.querySelector('#main')||document.body).innerText.length);
await btn.click(); await p.waitForTimeout(2500);
const after = await p.evaluate(()=> ({len:(document.querySelector('#main')||document.body).innerText.length,
  tail:(document.querySelector('#main')||document.body).innerText.slice(-320), url:location.pathname+location.search}));
console.log('before len', before, '-> after', after.len, 'url', after.url);
console.log('TAIL:', after.tail.replace(/\n+/g,' | '));
console.log('console errors:', errs.slice(0,3));
await p.screenshot({path:'docs/qa/v19/screenshots/student/services-upgrade-click@1440.png'});
await b.close();
