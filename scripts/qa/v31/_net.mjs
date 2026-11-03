// Logs failed/slow API calls on one page: node _net.mjs <base> <email> <path>
import { chromium } from '@playwright/test';
const [base, email, path] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const t0 = new Map();
p.on('request', (r) => { if (r.url().includes('/api/')) t0.set(r, Date.now()); });
p.on('requestfinished', async (r) => { if (!t0.has(r)) return; const res = await r.response(); const ms = Date.now() - t0.get(r); if (!res || res.status() >= 400 || ms > 3000) console.log(res?.status(), ms + 'ms', r.url().replace(base, '').slice(0, 140)); });
p.on('requestfailed', (r) => { if (r.url().includes('/api/')) console.log('FAILED', r.failure()?.errorText, r.url().replace(base, '').slice(0, 140)); });
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(2000);
await b.close();
