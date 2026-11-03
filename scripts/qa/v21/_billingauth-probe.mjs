/**
 * V21 — can `bill_talkoab1` open Toss's billing-key registration window at all? (brief §45)
 *
 * The server-side probe established that `POST /v1/billing/authorizations/card` (card-direct billing-key
 * issuance) is refused on this MID. The other route to a billing key is the SDK window:
 * `payment().requestBillingAuth()` → Toss's own card form → `successUrl?authKey&customerKey` →
 * `POST /v1/billing/authorizations/issue`. This asks whether that route is contracted, which decides
 * whether Hangyul can store a reusable card credential for this merchant configuration at all.
 *
 * It prints what Toss does with the request. It never prints the client key beyond its prefix.
 *
 *   node scripts/qa/v21/_billingauth-probe.mjs <clientKey>
 */
import { chromium } from '@playwright/test';

const CK = process.argv[2];
if (!CK) { console.error('usage: _billingauth-probe.mjs <clientKey>'); process.exit(2); }
console.log(`client key prefix ${CK.slice(0, 10)}…`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
// A real, stable origin that never touches the network: everything under it is fulfilled locally.
// The origin has to be one Toss will accept as a `successUrl`; a made-up TLD is rejected with
// INCORRECT_SUCCESS_URL_FORMAT before the contract is ever consulted, which is a false negative.
// The student app's own dev origin is the real one this product would use.
const ORIGIN = process.env.HG_PROBE_ORIGIN ?? 'http://localhost:3101';
const page = await ctx.newPage();
const seen = [];
page.on('console', (m) => seen.push(`${m.type()}: ${m.text().slice(0, 180)}`));
page.on('pageerror', (e) => seen.push(`pageerror: ${String(e).slice(0, 180)}`));
page.on('response', async (r) => {
  if (!/tosspayments/.test(r.url())) return;
  let body = '';
  if (r.status() >= 400) { body = ' ← ' + (await r.text().catch(() => '')).slice(0, 300); }
  seen.push(`net ${r.status()} ${r.url().split('?')[0].slice(0, 100)}${body}`);
});

await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.addScriptTag({ url: 'https://js.tosspayments.com/v2/standard' }).catch((e) => seen.push(`sdk load failed: ${String(e).slice(0, 120)}`));
console.log('SDK present:', await page.evaluate(() => typeof window.TossPayments));

await page.evaluate((o) => { window.__hgOrigin = o; }, ORIGIN);
const result = await page.evaluate(async (ck) => {
  const out = { steps: [] };
  try {
    const tp = window.TossPayments(ck);
    out.steps.push('TossPayments() ok');
    const pay = tp.payment({ customerKey: `hgprobe${Math.random().toString(36).slice(2, 14)}` });
    out.steps.push('payment() ok');
    const p = pay.requestBillingAuth({
      method: 'CARD',
      successUrl: `${window.__hgOrigin}/services/card/success`,
      failUrl: `${window.__hgOrigin}/services/card/fail`,
      customerEmail: 'probe@hangyul.test',
      customerName: 'Probe',
    });
    // The window either navigates (contracted) or the promise rejects (not contracted / bad params).
    const raced = await Promise.race([p.then(() => 'resolved'), new Promise((r) => setTimeout(() => r('pending-after-6s'), 6000))]);
    out.steps.push(`requestBillingAuth: ${raced}`);
  } catch (e) {
    out.error = { name: e?.name, code: e?.code, message: String(e?.message ?? e).slice(0, 400) };
  }
  return out;
}, CK).catch((e) => ({ thrown: String(e).slice(0, 400) }));

console.log('result:', JSON.stringify(result, null, 1));
await page.waitForTimeout(2500);
console.log('final url:', page.url().slice(0, 140));
console.log('observed:');
for (const s of seen.slice(0, 14)) console.log('  ', s);
await browser.close();
