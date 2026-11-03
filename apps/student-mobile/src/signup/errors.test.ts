import { describe, expect, it } from 'vitest';

import { mapSignupError } from './errors';

const api = (status: number, detail: unknown) => ({ status, body: { detail } });

describe('server error → localised message key (no raw codes, no provider text)', () => {
  it('maps every V22 code to a key and keeps the useful numbers', () => {
    expect(mapSignupError(api(400, { code: 'CODE_INVALID', attempts_left: 3 }))).toMatchObject({ key: 'signup.err.codeInvalid', attemptsLeft: 3, params: { count: 3 } });
    expect(mapSignupError(api(429, { code: 'OTP_RESEND_TOO_SOON', retry_after: 42 }))).toMatchObject({ key: 'signup.err.resendSoon', retryAfter: 42, params: { seconds: 42 } });
    expect(mapSignupError(api(502, { code: 'DELIVERY_FAILED', channel: 'SMS' })).key).toBe('signup.err.deliveryFailed');
    // V27: with a reason, the message is specific and carries the resend time.
    const m = mapSignupError(api(502, { code: 'DELIVERY_FAILED', channel: 'SMS', reason: 'REGION_UNSUPPORTED' }));
    expect(m.key).toBe('signup.err.delivery.REGION_UNSUPPORTED.sms');
    const u = mapSignupError(api(502, { code: 'DELIVERY_FAILED', channel: 'EMAIL', reason: 'UNREACHABLE', retry_after: 30 }));
    expect(u).toMatchObject({ key: 'signup.err.delivery.UNREACHABLE.email', retryAfter: 30, params: { seconds: 30 } });
    expect(mapSignupError(api(400, { code: 'CONSENT_REQUIRED', keys: ['CROSS_BORDER_VERIFICATION'] }))).toMatchObject({ key: 'signup.err.consentRequired', keys: ['CROSS_BORDER_VERIFICATION'] });
    expect(mapSignupError(api(503, { code: 'CAPTCHA_NOT_CONFIGURED' })).key).toBe('signup.err.captchaUnavailable');
    expect(mapSignupError(api(400, { code: 'SIGNUP_SESSION_EXPIRED' })).key).toBe('signup.err.sessionExpired');
    expect(mapSignupError(api(409, { code: 'EMAIL_TAKEN' })).key).toBe('signup.err.emailTaken');
  });
  it('never surfaces a provider error code or an HTTP status', () => {
    for (const e of [api(502, { code: 'SMS_PROVIDER_30007' }), api(500, 'Twilio error 30007'), api(429, 'Too Many Requests'), { status: 408 }, {}]) {
      const m = mapSignupError(e);
      expect(m.key.startsWith('signup.err.')).toBe(true);
      expect(JSON.stringify(m.params ?? {})).not.toMatch(/30007|Twilio|HTTP/);
    }
    expect(mapSignupError({ status: 408 }).key).toBe('signup.err.network');
    expect(mapSignupError({}).key).toBe('signup.err.network');
  });
});
