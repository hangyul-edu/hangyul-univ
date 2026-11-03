/**
 * V22 native sign-up — server error → i18n key (brief §19). No raw status, no provider code, no English fallback.
 * The keys live in `mobile:signup.err.*`; every one is translated across the exposed markets.
 */
export interface ApiLikeError { status?: number; body?: { detail?: { code?: string; retry_after?: number; attempts_left?: number; keys?: string[]; reason?: string; channel?: string } | string } }

export interface MappedError { key: string; params?: Record<string, string | number>; code: string | null; retryAfter?: number; attemptsLeft?: number; keys?: string[] }

const BY_CODE: Record<string, string> = {
  EMAIL_INVALID: 'signup.err.emailInvalid',
  PHONE_INVALID: 'signup.err.phoneInvalid',
  PHONE_NOT_MOBILE: 'signup.err.phoneInvalid',
  PASSWORD_MISMATCH: 'signup.err.passwordMismatch',
  CODE_INVALID: 'signup.err.codeInvalid',
  CODE_EXPIRED: 'signup.err.codeExpired',
  TOO_MANY_ATTEMPTS: 'signup.err.tooManyAttempts',
  OTP_RESEND_TOO_SOON: 'signup.err.resendSoon',
  OTP_SEND_LIMITED: 'signup.err.limited',
  OTP_VERIFY_LIMITED: 'signup.err.limited',
  REGISTER_LIMITED: 'signup.err.limited',
  SIGNUP_LIMITED: 'signup.err.limited',
  DELIVERY_FAILED: 'signup.err.deliveryFailed',
  SIGNUP_SESSION_REQUIRED: 'signup.err.sessionExpired',
  SIGNUP_SESSION_EXPIRED: 'signup.err.sessionExpired',
  VERIFICATION_EXPIRED: 'signup.err.verificationExpired',
  VERIFICATION_MISMATCH: 'signup.err.verificationExpired',
  EMAIL_NOT_VERIFIED: 'signup.err.verificationExpired',
  PHONE_NOT_VERIFIED: 'signup.err.verificationExpired',
  CONSENT_REQUIRED: 'signup.err.consentRequired',
  CONSENT_UNKNOWN: 'signup.err.generic',
  EMAIL_TAKEN: 'signup.err.emailTaken',
  CAPTCHA_REQUIRED: 'signup.err.captchaFailed',
  CAPTCHA_FAILED: 'signup.err.captchaFailed',
  CAPTCHA_SPENT: 'signup.err.captchaFailed',
  CAPTCHA_NOT_CONFIGURED: 'signup.err.captchaUnavailable',
  CAPTCHA_UNAVAILABLE: 'signup.err.captchaUnavailable',
  RATE_LIMITER_UNAVAILABLE: 'signup.err.generic',
};

export function mapSignupError(err: unknown): MappedError {
  const e = (err ?? {}) as ApiLikeError;
  const detail = typeof e.body?.detail === 'object' ? e.body?.detail : undefined;
  const code = detail?.code ?? null;
  // V27 (REPORT §358): a failed send says what failed and what to do — same reasons as the web.
  if (code === 'DELIVERY_FAILED' && detail?.reason) {
    const ch = detail.channel === 'EMAIL' ? 'email' : 'sms';
    const out: MappedError = { key: `signup.err.delivery.${detail.reason}.${ch}`, code, params: { seconds: detail.retry_after ?? 60 } };
    if (detail.retry_after) out.retryAfter = detail.retry_after;
    return out;
  }
  if (code && BY_CODE[code]) {
    const out: MappedError = { key: BY_CODE[code], code };
    if (detail?.retry_after) { out.retryAfter = detail.retry_after; out.params = { seconds: detail.retry_after }; }
    if (typeof detail?.attempts_left === 'number') { out.attemptsLeft = detail.attempts_left; out.params = { ...(out.params ?? {}), count: detail.attempts_left }; }
    if (detail?.keys) out.keys = detail.keys;
    return out;
  }
  if (e.status === 409) return { key: 'signup.err.emailTaken', code: code ?? 'CONFLICT' };
  if (e.status === 429) return { key: 'signup.err.limited', code: code ?? 'RATE_LIMITED', retryAfter: detail?.retry_after };
  if (e.status === 408 || e.status === undefined) return { key: 'signup.err.network', code: null };
  return { key: 'signup.err.generic', code };
}
