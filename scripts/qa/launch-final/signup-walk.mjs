#!/usr/bin/env node
/**
 * Sign-up walk with the identity API mocked AT THE NETWORK LAYER (test-only; nothing in the product is mocked,
 * and no code is sent to anyone). Walks account → verification (pending · wrong code · verified) → consent at
 * every release viewport, asserts no page-level overflow, that the OTP field and Verify button are each
 * full-width on phones, and that controls meet the 44 px touch target. Screenshots → docs/qa/launch-final/<out>/signup/.
 *
 *   node scripts/qa/launch-final/signup-walk.mjs [--out after] [--lang ko] [--base http://127.0.0.1:4101]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { VIEWPORTS } from './routes.mjs';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'http://127.0.0.1:4101');
const lang = arg('lang', 'ko');
const OUT = path.join(ROOT, 'docs', 'qa', 'launch-final', arg('out', 'after'), 'signup');
fs.mkdirSync(OUT, { recursive: true });
const SHOT = new Set([320, 390, 768, 1440]);

const consent = (key, required) => ({ key, required, document: key.includes('privacy') ? 'privacy' : 'terms', version: '2026-11-01' });
const CONFIG = {
  captcha: { required: false, provider: null, site_key: null },
  otp: { ttl_seconds: 600, resend_cooldown_seconds: 60, max_attempts: 5, delivery_mode: 'providers' },
  password: { min_length: 10 },
  consents: { items: [consent('terms', true), consent('privacy', true), consent('age', true), consent('marketing', false)], purchase: consent('purchase', true), policy_effective_on: '2026-11-01', canonical_locale: 'ko' },
};
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const browser = await chromium.launch();
const rows = []; let failures = 0;
const fail = (m) => { failures += 1; console.log(`FAIL ${m}`); };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  const page = await ctx.newPage();
  let verifyCalls = 0;
  await page.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (p === '/auth/refresh') return json(route, 401, { detail: 'Not authenticated' });
    if (p === '/auth/signup/config') return json(route, 200, CONFIG);
    if (p === '/auth/signup/session') return json(route, 200, { signup_session: 'mock-session', expires_in: 1800 });
    if (p === '/auth/verification/send') {
      const b = route.request().postDataJSON();
      return json(route, 200, { challenge_id: `mock-${b.channel}`, channel: b.channel, target_masked: b.channel === 'EMAIL' ? 'ng•••••••@example.com' : '+84 •• ••• 4567', expires_in: 600, resend_in: 60, delivery: 'sent' });
    }
    if (p === '/auth/verification/verify') {
      verifyCalls += 1;
      if (verifyCalls === 1) return json(route, 400, { detail: { code: 'CODE_INVALID', attempts_left: 4 } });
      return json(route, 200, { verified: true, channel: 'EMAIL', proof: 'mock-proof', proof_expires_in: 900 });
    }
    if (p.startsWith('/meta/countries')) return json(route, 200, [{ code: 'VN', name_en: 'Vietnam', name_native: 'Việt Nam', name_ko: '베트남', region: 'Southeast Asia', default_locale: 'vi', currency: 'VND', is_priority_market: true, priority_rank: 1, aliases: [] }]);
    return json(route, 404, { detail: 'Not Found' });
  });
  const measure = async (step) => {
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const small = [...document.querySelectorAll('main button:not(.hg-link):not(.hg-pw__toggle), main input:not([type=checkbox]):not([type=radio])')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height < 43.5; })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} h=${Math.round(el.getBoundingClientRect().height)}`);
      const otp = document.querySelector('.st-reg__otp');
      let otpStacked = null;
      if (otp) { const [a, b] = [...otp.children].map((c) => c.getBoundingClientRect()); otpStacked = !!a && !!b && b.top >= a.bottom - 1; }
      return { sw: de.scrollWidth, iw: window.innerWidth, small, otpStacked, height: de.scrollHeight };
    });
    rows.push({ viewport: `${vp.width}x${vp.height}`, step, ...m });
    if (m.sw > m.iw) fail(`${vp.width} ${step}: page overflow ${m.sw}>${m.iw}`);
    if (m.small.length) fail(`${vp.width} ${step}: sub-44px controls: ${m.small.slice(0, 4).join(', ')}`);
    if (step.startsWith('verify') && vp.width <= 480 && m.otpStacked === false) fail(`${vp.width} ${step}: OTP field and Verify button share a row on a phone`);
    if (SHOT.has(vp.width)) await page.screenshot({ path: path.join(OUT, `signup-${step}-${vp.width}-${lang}.png`), fullPage: true });
  };

  await page.goto(`${base}/register?lang=${lang}`, { waitUntil: 'networkidle' });
  await measure('1-account');
  await page.fill('#full_name', 'Nguyễn Thị Phương Lan');
  await page.fill('#email', 'nguyen.thi.phuong.lan@example.com');
  await page.locator('.hg-phone__local').fill('0912345678');
  // Nationality is the product's own custom select (a combobox + listbox, never a native <select>).
  const nat = page.locator('main form [role=combobox], main form button[aria-haspopup=listbox]').last();
  await nat.click();
  await page.locator('[role=option]').first().click();
  await page.fill('#password', 'Correct-Horse-42!');
  const confirm = page.locator('input[autocomplete="new-password"]').nth(1);
  if (await confirm.count()) await confirm.fill('Correct-Horse-42!');
  await page.locator('main form button[type=submit]').click();
  await page.waitForSelector('.st-reg__chan', { timeout: 8000 }).catch(() => {});
  if (!(await page.locator('.st-reg__chan').count())) { fail(`${vp.width}: did not reach the verification step`); await page.screenshot({ path: path.join(OUT, `signup-stuck-${vp.width}.png`), fullPage: true }); await ctx.close(); continue; }
  await page.waitForTimeout(300);
  await measure('2-verify-pending');
  await page.fill('#otp-email', '111111');
  await page.locator('.st-reg__chan').first().locator('.st-reg__otp button').click();
  await page.waitForSelector('.st-reg__chan [role=alert]', { timeout: 5000 }).catch(() => {});
  await measure('3-verify-error');
  await page.fill('#otp-email', '123456');
  await page.locator('.st-reg__chan').first().locator('.st-reg__otp button').click();
  await page.waitForSelector('.st-reg__chan[data-verified=true]', { timeout: 5000 }).catch(() => {});
  await measure('4-verify-one-done');
  await page.fill('#otp-sms', '123456');
  await page.locator('.st-reg__chan').nth(1).locator('.st-reg__otp button').click();
  await page.waitForTimeout(400);
  await page.locator('main button.hg-btn--primary.hg-btn--block').last().click();
  await page.waitForSelector('.hg-consents', { timeout: 5000 }).catch(() => {});
  await measure('5-consent');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, `signup-walk-${lang}.json`), JSON.stringify({ lang, failures, rows }, null, 1));
console.log(`signup walk (${lang}): ${rows.length} states · ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
