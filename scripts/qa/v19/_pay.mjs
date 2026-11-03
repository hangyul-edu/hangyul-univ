import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
await p.goto('http://localhost:3101/login',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.setItem('hg.locale','ko')}catch{}});
await p.fill('#email','student@demo.hangyul.kr'); await p.fill('#password','Hangyul!2026');
await p.click('button[type=submit]'); await p.waitForURL(u=>!u.pathname.startsWith('/login'));
await p.goto('http://localhost:3101/services?upgrade=premium',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const main = () => p.evaluate(()=> (document.querySelector('#main')||document.body).innerText);
console.log('order block visible:', /프리미엄/.test(await main()) && (await p.locator('.sv16-order, [class*="order"]').count()) > 0);
const pay = p.locator('button').filter({hasText:/결제|시작|진행/}).first();
console.log('pay button:', await pay.count() ? await pay.innerText() : 'NONE');
if (await pay.count()) { await pay.click(); await p.waitForTimeout(3000);
  const t = await main(); const i = t.indexOf('프리미엄');
  console.log('AFTER PAY >>>', t.slice(Math.max(0,i-80), i+420).replace(/\n+/g,' | ')); }
await p.screenshot({path:'docs/qa/v19/screenshots/student/services-upgrade-pay@1440.png'});
await b.close();
