// Screenshots of a page in a given locale/theme: node scripts/qa/lang-shots.mjs <url> <lang> <width> <out> [loginEmail] [dark]
import { chromium } from '@playwright/test';
const [url, lang, w, out, email, dark] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 900 } });
const u = new URL(url);
if (email) { await p.goto(`${u.origin}/login`); await p.fill('#email', email); await p.fill('#password', 'Hangyul!2026'); await p.click('button[type=submit]'); await p.waitForURL((x) => !x.pathname.startsWith('/login')); }
await p.goto(u.origin); await p.evaluate(([l, d]) => { localStorage.setItem('hg.locale', l); if (d) { for (const k of ['hg.agency.theme', 'hg.university.theme']) localStorage.setItem(k, 'dark'); } }, [lang, dark]);
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
const info = await p.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, overflow: document.documentElement.scrollWidth - innerWidth }));
console.log(out, JSON.stringify(info)); await p.screenshot({ path: out }); await b.close();
