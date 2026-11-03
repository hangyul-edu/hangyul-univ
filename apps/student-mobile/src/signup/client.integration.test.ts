/**
 * Integration: the native client functions against the real API (`HG_QA_API`, default http://localhost:8001/api/v1).
 * Request email OTP → verify → request SMS OTP → verify → (CAPTCHA token hand-off when the server requires one) →
 * create account → authenticated session → the profile carry-over the onboarding uses. Fails — never skips — when the
 * API is down: the suite is only meaningful against the running stack.
 */
import { createApiClient } from '@hangyul/api-client';
import { execFileSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';

import { applyQuickProfile, fetchConfig, register, sendCode, startSession, verifyCode } from './client';

const ORIGIN = (process.env.HG_QA_API ?? 'http://localhost:8001/api/v1').replace(/\/api\/v1$/, '');
const peek = async (id: string) => ((await (await fetch(`${ORIGIN}/api/v1/auth/verification/peek/${id}`)).json()) as { code: string }).code;

// V26 (REPORT §349, RC-19): the account this suite registers is QA residue on the development database and the `qa:v26`
// hygiene gate counts it. Tear down the way every gate does — the shared purge script, which knows the `native-…` pattern.
afterAll(() => {
  if (process.env.HG_E2E_KEEP) return; // on the isolated e2e stack the whole database is dropped afterwards
  const server = decodeURIComponent(new URL('../../../../server/', import.meta.url).pathname);
  try { execFileSync(`${server}.venv/bin/python`, ['-m', 'scripts.purge_e2e'], { cwd: server, env: { ...process.env, HG_ENV: 'development' }, stdio: 'ignore', timeout: 60_000 }); }
  catch { /* nothing to do here: the hygiene gate reports whatever is left */ }
});

describe('native sign-up against the real API', () => {
  it('registers a verified account through the same endpoints the web uses and signs in', async () => {
    const api = createApiClient({ baseUrl: ORIGIN, client: 'student', tokenStore: { getRefreshToken: async () => null, setRefreshToken: async () => undefined } });
    const cfg = await fetchConfig(api);
    expect(cfg.consents.items.map((i) => i.key)).toEqual(['TERMS', 'PRIVACY', 'CROSS_BORDER_VERIFICATION', 'MARKETING']);
    // CAPTCHA hand-off: when the server requires Turnstile, a token must be presented; the dev server does not,
    // and the same code path is used either way (the token is simply null).
    const token = cfg.captcha.required ? process.env.HG_QA_TURNSTILE_TOKEN ?? null : null;
    if (cfg.captcha.required && !token) throw new Error('server requires a CAPTCHA token; set HG_QA_TURNSTILE_TOKEN');
    const sess = await startSession(api, token, 'ne');
    expect(sess.signup_session.length).toBeGreaterThan(20);
    const email = `native-${Date.now()}@example.com`;
    const e = await sendCode(api, sess.signup_session, { channel: 'EMAIL', target: email, locale: 'ne' });
    expect(e.expires_in).toBe(300);
    expect(e.resend_in).toBe(60);
    const ev = await verifyCode(api, e.challenge_id, await peek(e.challenge_id));
    expect(ev.verified).toBe(true);
    // One number for the whole run (V23): it used to be recomputed from Date.now() at register time, which differed by a
    // millisecond under load and sent the test into a fallback that re-texted a fixed number inside its 60-s cooldown.
    const phone = `9841${String(Date.now()).slice(-6)}`;
    const p = await sendCode(api, sess.signup_session, { channel: 'SMS', target: phone, phone_country: 'NP', locale: 'ne' });
    expect(p.target_masked.startsWith('+977')).toBe(true);
    // a wrong code is refused with attempts left, then the right one verifies
    await expect(verifyCode(api, p.challenge_id, '000000')).rejects.toMatchObject({ status: 400 });
    const pv = await verifyCode(api, p.challenge_id, await peek(p.challenge_id));
    // registering without the required consent is refused; with it, the account exists and the client is signed in
    await expect(register(api, { email, email_proof: ev.proof, phone: '9841234567', phone_country: 'NP', phone_proof: pv.proof, password: 'a sentence i remember', password_confirm: 'a sentence i remember', full_name: 'Aarati Native', locale: 'ne', nationality: 'NP', consents: { TERMS: true, PRIVACY: true } }, sess.signup_session)).rejects.toMatchObject({ status: 400 });
    const tr = await register(api, { email, email_proof: ev.proof, phone, phone_country: 'NP', phone_proof: pv.proof, password: 'a sentence i remember', password_confirm: 'a sentence i remember', full_name: 'Aarati Native', locale: 'ne', nationality: 'NP', consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true, MARKETING: false } }, sess.signup_session);
    expect(tr.verified).toEqual({ email: true, phone: true });
    expect(api.isAuthenticated).toBe(true);
    // onboarding carry-over, then the recommendations the first screen shows
    await applyQuickProfile(api, { nationality: 'NP', degree: 'BACHELOR', kind: 'TOPIK', level: 3 });
    const me = await api.me.profile();
    expect(me.nationality).toBe('NP');
    expect(me.target_degree).toBe('BACHELOR');
  });
});
