// node _shot.mjs <url> <width> <out.png> — waits for an h1, reports main text length
import { chromium } from '@playwright/test';
const [url, w, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 900 } })).newPage();
await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForSelector('h1', { timeout: 30000 }).catch(() => {});
console.log(JSON.stringify(await p.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1')?.innerText, main: (document.querySelector('main')?.innerText ?? '').length }))));
await p.screenshot({ path: out }); await b.close();
