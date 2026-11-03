// V9 university: interactive states (remove-access modal, rule impact preview, select all matching preview). Usage: node scripts/qa/_v9uni-interact.mjs <outdir>
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
async function as(email) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:3103/login?demo=${encodeURIComponent(email)}`);
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  return p;
}
const admin = await as('admin@pusan.univ.demo.hangyul.kr');
await admin.goto('http://localhost:3103/settings', { waitUntil: 'networkidle' });
await admin.getByRole('button', { name: 'Remove access' }).first().click();
await admin.waitForTimeout(1200);
await admin.screenshot({ path: `${out}/u8-remove-modal-1024.png` });
await admin.keyboard.press('Escape');
await admin.goto('http://localhost:3103/programs?program=95c9e4c1-b9de-4b2c-9c7a-a6372bc41aef&edit=1', { waitUntil: 'networkidle' });
await admin.fill('#r-topik', '5');
await admin.waitForTimeout(1500);
await admin.locator('.uv9-impact').scrollIntoViewIfNeeded();
await admin.screenshot({ path: `${out}/u6-impact-topik-1024.png` });
await admin.fill('#r-topik', '3');
await admin.fill('#r-ielts', '6.5');
await admin.waitForTimeout(1500);
await admin.locator('.uv9-impact').scrollIntoViewIfNeeded();
await admin.screenshot({ path: `${out}/u6-impact-insufficient-1024.png` });
const adm = await as('admissions@pusan.univ.demo.hangyul.kr');
await adm.goto('http://localhost:3103/applicants?page_size=10', { waitUntil: 'networkidle' });
await adm.locator('thead input[type=checkbox]').first().check();
await adm.waitForTimeout(400);
await adm.getByRole('button', { name: /Select all \d+ matching/ }).click();
await adm.waitForTimeout(300);
await adm.screenshot({ path: `${out}/u3-allmatching-1024.png` });
await adm.getByRole('button', { name: /Request document/ }).first().click();
await adm.waitForTimeout(1500);
await adm.screenshot({ path: `${out}/u3-preview-1024.png` });
await b.close();
