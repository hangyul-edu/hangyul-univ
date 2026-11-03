/**
 * V21 — the **real** Toss TEST transaction, through the product (brief §44).
 *
 * Not a unit test and not a mock: it signs in as a demo student over HTTP, creates an order through
 * the same endpoint the UI calls, posts a card to the same endpoint the form posts to, and then
 * checks the database and the plan. Every assertion is about what the running system did.
 *
 * **It prints no card number, no secret and no credential.** The card is a Toss sandbox test card and
 * is still redacted in the output, because a test card in a log is how a habit forms.
 *
 *   node scripts/qa/v21/toss-test-transaction.mjs [--plan all_in_one]
 */
import { readFileSync } from 'node:fs';

const API = process.env.HG_QA_API ?? 'http://localhost:8001/api/v1';
const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const PLAN = flag('--plan', 'ALL_IN_ONE');

/*
 * The sandbox PAN is **not** written down here. §58 requires that a scan of the tree find no full
 * card number, and a scanner cannot tell a published sandbox number from a real one — so the rule is
 * kept literally rather than argued with. The number lives in the untracked `server/.env` beside the
 * Toss keys, which is where the other secrets this script needs already are.
 */
const readEnvFile = () => {
  try {
    return Object.fromEntries(readFileSync(new URL('../../../server/.env', import.meta.url), 'utf8')
      .split('\n').filter((l) => /^[A-Z]/.test(l)).map((l) => {
        const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }));
  } catch { return {}; }
};
const PAN = process.env.HG_QA_TEST_CARD ?? readEnvFile().HG_QA_TEST_CARD;
if (!PAN) {
  console.error('HG_QA_TEST_CARD is not set. Put the Toss sandbox card number in server/.env (untracked):\n'
    + '  HG_QA_TEST_CARD=<the sandbox PAN from the Toss test documentation>');
  process.exit(2);
}
const TEST_CARD = { number: PAN, expiry_month: '12', expiry_year: '30', holder_name: 'HANGYUL TEST' };
// A number that fails Luhn, for the declined-card assertion: the same card with its check digit moved.
const BAD_PAN = PAN.slice(0, -1) + String((Number(PAN.slice(-1)) + 1) % 10);
const redact = (o) => JSON.parse(JSON.stringify(o, (k, v) =>
  (/number|card|secret|billing|token/i.test(k) && typeof v === 'string' && v.length > 6 ? '<redacted>' : v)));

let pass = 0; const fails = [];
const check = (name, ok, detail = '') => { if (ok) { pass += 1; console.log(`  ✓ ${name}`); } else { fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); } };

/*
 * The card endpoint allows 8 attempts per 300s per user *and* per IP (§30). This script spends about
 * five of them, so running the gate twice inside the window trips Hangyul's own limiter — and a red
 * line reading TOO_MANY_CARD_ATTEMPTS is the control working, not the payment path failing. The
 * limiter is not relaxed for the test; the test waits it out, and says so, so the run stays truthful.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { method = 'GET', token, body, headers = {}, waitOutLimiter = false } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await r.json(); } catch { /* empty body */ }
    const limited = r.status === 429 && json?.detail?.code === 'TOO_MANY_CARD_ATTEMPTS';
    if (!limited || !waitOutLimiter || attempt >= 6) return { status: r.status, body: json };
    console.log(`    … the card rate limiter is holding this run off; waiting 50s (${attempt + 1}/6)`);
    await sleep(50_000);
  }
}

/* ---------------------------------------------------------------- 1. a student, and a fresh account */

const email = `v21pay+${Date.now()}@demo.hangyul.kr`;
// V22: the account is created through the verified four-step flow (signup session → email + SMS codes read through
// the development-only peek route → register with both proofs and the required consents).
const sess = await call('/auth/signup/session', { method: 'POST', body: { captcha_token: null, locale: 'en' } });
const S = { 'X-Signup-Session': sess.body?.signup_session ?? '' };
const phone = `0912${String(Date.now()).slice(-6)}`;
const prove = async (channel, target) => {
  const sent = await call('/auth/verification/send', { method: 'POST', body: { channel, target, phone_country: 'VN', purpose: 'SIGNUP', locale: 'en' }, headers: S });
  const code = (await call(`/auth/verification/peek/${sent.body?.challenge_id}`)).body?.code;
  return (await call('/auth/verification/verify', { method: 'POST', body: { challenge_id: sent.body?.challenge_id, code } })).body?.proof;
};
const email_proof = await prove('EMAIL', email);
const phone_proof = await prove('SMS', phone);
const reg = await call('/auth/register', { method: 'POST', headers: S, body: { email, email_proof, phone, phone_country: 'VN', phone_proof, password: 'Hangyul!2026', password_confirm: 'Hangyul!2026', full_name: 'V21 Payment Probe', locale: 'en', nationality: 'VN', consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true, MARKETING: false } } });
check('a student account can be created (V22 verified flow)', reg.status < 300, `HTTP ${reg.status} ${JSON.stringify(reg.body).slice(0, 160)}`);
const token = reg.body?.access_token ?? (await call('/auth/login', { method: 'POST', body: { email, password: 'Hangyul!2026' } })).body?.access_token;
check('the student is signed in', !!token);
if (!token) { console.log('\ncannot continue without a session'); process.exit(1); }

/* --------------------------------------------------------------------- 2. the payment configuration */

const cfg = await call('/me/payments/config', { token });
const fc = cfg.body?.foreign_card ?? {};
console.log('\npayment config:', JSON.stringify({ env: cfg.body?.env, foreign_card: fc, contract: cfg.body?.contract }));
check('the foreign-card configuration is reported', !!fc.mid, JSON.stringify(fc));
check('foreign billing TEST is ready', fc.test_ready === true, `test_ready=${fc.test_ready}`);
check('the card form is Hangyul\'s, not a provider window', fc.card_form === 'hangyul');
check('no domestic or easy-pay method is offered for the plan purchase',
  !(cfg.body?.methods_offered ?? []).some((m) => /EASY|DOMESTIC|TOSSPAY|NAVER|KAKAO|TRANSFER/i.test(m)),
  JSON.stringify(cfg.body?.methods_offered));

/* ------------------------------------------------------------------------------- 3. an order in USD */

const order = await call('/me/orders', { method: 'POST', token, body: { product_code: PLAN } });
check('a USD order is created (the old gate refused this with 503)', order.status === 201,
  `HTTP ${order.status} ${JSON.stringify(order.body).slice(0, 200)}`);
const orderId = order.body?.order_id ?? order.body?.id;
const amount = order.body?.amount_minor;
const currency = order.body?.currency;
console.log(`  order ${orderId} · ${currency} ${amount} minor`);
check('the order is priced in USD by the server', currency === 'USD' && amount > 0,
  JSON.stringify({ currency, amount }));

/* ---------------------------------------------------------------- 4. the card, and the real charge */

const paid = await call(`/me/orders/${orderId}/pay-with-card`, { method: 'POST', token, body: { card: TEST_CARD, save_card: true }, waitOutLimiter: true });
console.log('\ncharge response:', JSON.stringify(redact(paid.body)).slice(0, 420));
check('the charge is accepted by Toss', paid.status === 200, `HTTP ${paid.status} ${JSON.stringify(paid.body).slice(0, 220)}`);
check('the order is PAID', paid.body?.status === 'PAID' || paid.body?.order?.status === 'PAID',
  JSON.stringify(paid.body?.status ?? paid.body?.order?.status));
const method = paid.body?.payment_method;
check('a payment method was recorded', !!method?.id);
check('the stored card shows only the last four digits', !!method?.last4 && !/\d{5,}/.test(method?.masked_number ?? ''),
  JSON.stringify({ last4: method?.last4, masked: method?.masked_number }));
check('the response contains no credential', !JSON.stringify(paid.body).match(/billingKey|billing_key_ciphertext/i));
check('the stored card is honest about not being reusable', method?.reusable === false);

/* ------------------------------------------------------------------------------- 5. the plan is on */

const plan = await call('/me/plan', { token });
check('the plan is active', !!plan.body?.plan || !!plan.body?.code || !!plan.body?.name_en,
  JSON.stringify(plan.body).slice(0, 180));

/* --------------------------------------------------------------------------- 6. idempotency / replay */

const replay = await call(`/me/orders/${orderId}/pay-with-card`, { method: 'POST', token, body: { card: TEST_CARD, save_card: true }, waitOutLimiter: true });
check('a replayed charge does not charge again', replay.status === 200 && replay.body?.already_paid === true,
  `HTTP ${replay.status} already_paid=${replay.body?.already_paid}`);

/* ---------------------------------------------------------------------- 7. saved card list / delete */

const list = await call('/me/payment-methods', { token });
check('the saved card is listed', (list.body?.items ?? []).length >= 1);
check('the list contains no credential', !JSON.stringify(list.body).match(/billingKey|ciphertext/i));

const saved = await call(`/me/orders/${orderId}/pay-with-saved-card`, { method: 'POST', token, waitOutLimiter: true });
check('paying an already-paid order with a saved card returns the order, not a second charge',
  saved.status === 200 && saved.body?.already_paid === true, `HTTP ${saved.status}`);

const del = await call(`/me/payment-methods/${method?.id}`, { method: 'DELETE', token });
check('the card can be deleted', del.status === 200 && del.body?.deleted === true, `HTTP ${del.status}`);
const after = await call('/me/payment-methods', { token });
check('the deleted card is gone from the list', (after.body?.items ?? []).length === 0);

/* ------------------------------------------------------------------------------------- 8. rejection */

const order2 = await call('/me/orders', { method: 'POST', token, body: { product_code: 'BASIC' } });
// V26 (REPORT §330, RC-24): the precondition first. Before V26 a refused order made `order2.body?.id` undefined, the request went
// to /me/orders/undefined/pay-with-card, and its 422 "passed" the invalid-card check without the card ever being examined.
check('precondition: a second order exists to pay against (else the checks below would test /orders/undefined)', !!order2.body?.id, `HTTP ${order2.status}`);
const bad = await call(`/me/orders/${order2.body?.id}/pay-with-card`, {
  method: 'POST', token, body: { card: { ...TEST_CARD, number: BAD_PAN }, save_card: true }, waitOutLimiter: true,
});
check('an invalid card number is refused before reaching Toss', bad.status === 422, `HTTP ${bad.status}`);

const noauth = await call(`/me/orders/${order2.body?.id}/pay-with-card`, { method: 'POST', body: { card: TEST_CARD } });
check('the card endpoint refuses an unauthenticated caller', noauth.status === 401 || noauth.status === 403, `HTTP ${noauth.status}`);

console.log(`\nV21 Toss TEST transaction — ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  ✖ ${f}`);
console.log(`\norder id for the record: ${orderId}`);
// V26: teardown — this gate writes on seeded data (accounts, a reply on a seeded thread). Purge its residue before exiting
// so the demo data never depends on someone remembering to run server/scripts/purge_e2e.py (REPORT §331 H).
try { (await import('node:child_process')).execSync('.venv/bin/python scripts/purge_e2e.py', { cwd: new URL('../../../server/', import.meta.url).pathname, stdio: 'ignore', env: { ...process.env, HG_ENV: 'development' } }); } catch { console.log('  (teardown: purge_e2e.py failed — run it by hand)'); }
process.exit(fails.length ? 1 : 0);
