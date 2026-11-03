import { chromium } from '@playwright/test';
const [,, base, email, path, w] = process.argv;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 1024 } })).newPage();
await p.goto(base + '/login'); await p.evaluate(() => localStorage.setItem('hg.locale', 'en'));
await p.fill('#email', email); await p.fill('#password', 'Hangyul!2026'); await p.click('button[type=submit]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'));
await p.goto(base + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > vw + 1).slice(0, 8).map((e) => [e.tagName, (e.parentElement?.className?.toString() || '').slice(0, 40) + ' < ' + (e.parentElement?.parentElement?.className?.toString() || '').slice(0, 40), Math.round(e.getBoundingClientRect().right), e.textContent.trim().slice(0, 40)]); })));
await b.close();
