import { chromium } from '@playwright/test';
const [base, email, path] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
p.on('response', (r) => { if (r.status() >= 500) console.log(r.status(), r.request().method(), r.url()); });
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForURL((u) => !u.pathname.startsWith('/login')).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForTimeout(1000);
await b.close();
