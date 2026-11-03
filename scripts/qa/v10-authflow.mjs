/** V10 acceptance: the public site's personalised actions must resume inside the Student Platform after login. */
import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const log = (k, v) => console.log(`${k.padEnd(46)} ${v}`);

// 1. Anonymous visitor: the header offers Login, not "Get started".
await p.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
log('header account action (anonymous)', JSON.stringify(await p.locator('.kn-header__right a.kn-btn').first().innerText()));
log('header account href', await p.locator('.kn-header__right a.kn-btn').first().getAttribute('href'));
log('"Apply now"-style CTA present?', await p.getByRole('link', { name: /apply now|신청하기|application form/i }).count());
log('B2B links in primary nav?', await p.locator('.kn-nav a').filter({ hasText: /agenc|universit.*partner|partner/i }).count());
log('primary nav items', JSON.stringify(await p.locator('.kn-nav a').allInnerTexts()));

// 2. A personalised action carries a return path.
await p.locator('#services').scrollIntoViewIfNeeded();
const svc = p.locator('.kn-rows a.kn-btn').first();
log('service action href (anonymous)', await svc.getAttribute('href'));

// 3. Follow it: we should land on the student login with ?next=, then return to that destination after signing in.
const href = await svc.getAttribute('href');
await p.goto(href, { waitUntil: 'networkidle' });
log('landed on', p.url());
await p.locator('input[type=email]').fill('student@demo.hangyul.kr');
await p.locator('input[type=password]').fill('Hangyul!2026');
await p.getByRole('button', { name: /sign in|log ?in/i }).first().click();
await p.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(2500);
log('after login, landed on', p.url());

// 4. Back on the marketing site the same browser is now recognised.
await p.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
log('header account action (signed in)', JSON.stringify(await p.locator('.kn-header__right a.kn-btn').first().innerText()));
log('header account href (signed in)', await p.locator('.kn-header__right a.kn-btn').first().getAttribute('href'));
await p.locator('#services').scrollIntoViewIfNeeded();
log('service action href (signed in)', await p.locator('.kn-rows a.kn-btn').first().getAttribute('href'));

// 5. The "create an account" hop must not lose the return path.
const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const q = await c2.newPage();
await q.goto('http://localhost:3101/login?next=%2Fvisa&nationality=VN', { waitUntil: 'networkidle' });
log('register link from login', await q.getByRole('link', { name: /create an account|account/i }).first().getAttribute('href'));
await c2.close();

// 6. An open-redirect attempt must not leave the app.
await p.goto('http://localhost:3101/login?next=https://example.com/evil', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
log('?next=https://example.com → landed on', p.url());

await b.close();
