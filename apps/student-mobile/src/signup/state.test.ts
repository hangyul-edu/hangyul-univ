import { describe, expect, it } from 'vitest';

import { bothVerified, codeExpired, emptyChannel, expiresSeconds, initialState, missingRequired, nextStepAfterAccount, passwordMatch, persistable, reduce, resendSeconds, type SignupState } from './state';

const sent = (s: SignupState, channel: 'email' | 'sms', now = 1_000_000) =>
  reduce(s, { type: 'chan-sent', channel, challengeId: `c-${channel}`, expiresIn: 300, resendIn: 60, targetMasked: 'x', delivery: 'sent', now });

describe('sign-up state machine', () => {
  it('starts on the account step with the nationality as the phone country', () => {
    const s = initialState('NP');
    expect(s.step).toBe('account');
    expect(s.account.phoneCountry).toBe('NP');
    expect(s.account.nationality).toBe('NP');
  });

  it('password confirmation feedback is silent until something is typed, then exact', () => {
    let s = initialState();
    expect(passwordMatch(s.account)).toBeNull();
    s = reduce(s, { type: 'account', patch: { password: 'a sentence i remember', passwordConfirm: 'a sentence i rememb' } });
    expect(passwordMatch(s.account)).toBe(false);
    s = reduce(s, { type: 'account', patch: { passwordConfirm: 'a sentence i remember' } });
    expect(passwordMatch(s.account)).toBe(true);
  });

  it('goes to the CAPTCHA step only when the server requires one', () => {
    expect(nextStepAfterAccount(false)).toBe('verify');
    expect(nextStepAfterAccount(true)).toBe('challenge');
  });

  it('resend and expiry timers count down from the server-provided windows', () => {
    const s = sent(initialState(), 'email', 1_000_000);
    expect(resendSeconds(s.email, 1_000_000)).toBe(60);
    expect(resendSeconds(s.email, 1_030_000)).toBe(30);
    expect(resendSeconds(s.email, 1_061_000)).toBe(0);
    expect(expiresSeconds(s.email, 1_000_000)).toBe(300);
    expect(codeExpired(s.email, 1_299_000)).toBe(false);
    expect(codeExpired(s.email, 1_301_000)).toBe(true);
  });

  it('a wrong code keeps the challenge; too many attempts or expiry drop it; the right code stores the proof', () => {
    let s = sent(initialState(), 'sms');
    s = reduce(s, { type: 'chan-error', channel: 'sms', error: { key: 'signup.err.codeInvalid' }, attemptsLeft: 3 });
    expect(s.sms.challengeId).toBe('c-sms');
    expect(s.sms.attemptsLeft).toBe(3);
    s = reduce(s, { type: 'chan-error', channel: 'sms', error: { key: 'signup.err.tooManyAttempts' }, attemptsLeft: 0, reset: true });
    expect(s.sms.challengeId).toBeNull();
    s = sent(s, 'sms');
    s = reduce(s, { type: 'chan-verified', channel: 'sms', proof: 'p' });
    expect(s.sms.proof).toBe('p');
    expect(bothVerified(s)).toBe(false);
    s = reduce(sent(s, 'email'), { type: 'chan-verified', channel: 'email', proof: 'q' });
    expect(bothVerified(s)).toBe(true);
  });

  it('going back never discards a verified channel, never resends and skips the CAPTCHA step when none is required', () => {
    let s = reduce(sent(initialState(), 'email'), { type: 'chan-verified', channel: 'email', proof: 'p' });
    s = reduce(s, { type: 'step', step: 'consent' });
    s = reduce(s, { type: 'back' });
    expect(s.step).toBe('verify');
    expect(s.email.proof).toBe('p');
    s = reduce(s, { type: 'back' });
    expect(s.step).toBe('account');
    s = reduce({ ...s, captchaRequired: true, step: 'verify' }, { type: 'back' });
    expect(s.step).toBe('challenge');
  });

  it('required consents are enforced individually; "agree to all" is only a controller', () => {
    const items = [{ key: 'TERMS', required: true }, { key: 'PRIVACY', required: true }, { key: 'MARKETING', required: false }];
    let s = initialState();
    expect(missingRequired(s.consents, items)).toEqual(['TERMS', 'PRIVACY']);
    s = reduce(s, { type: 'consent', key: 'TERMS', value: true });
    expect(missingRequired(s.consents, items)).toEqual(['PRIVACY']);
    s = reduce(s, { type: 'consent-all', keys: items.map((i) => i.key), value: true });
    expect(missingRequired(s.consents, items)).toEqual([]);
    s = reduce(s, { type: 'consent', key: 'MARKETING', value: false });
    expect(missingRequired(s.consents, items)).toEqual([]);
  });

  it('persists only safe draft fields — never the password, a code, a proof or the signup session', () => {
    let s = initialState('VN');
    s = reduce(s, { type: 'account', patch: { fullName: 'A', email: 'a@b.co', phoneLocal: '0912', password: 'secret-secret', passwordConfirm: 'secret-secret' } });
    s = reduce(s, { type: 'session', token: 'SESSION', expiresIn: 1800 });
    s = reduce(sent(s, 'email'), { type: 'chan-verified', channel: 'email', proof: 'PROOF' });
    const d = persistable(s);
    const json = JSON.stringify(d);
    expect(json).not.toContain('secret-secret');
    expect(json).not.toContain('SESSION');
    expect(json).not.toContain('PROOF');
    expect(d.account.email).toBe('a@b.co');
    expect((d as { account: Record<string, unknown> }).account.password).toBeUndefined();
    // a verified channel's challenge handle is not kept either: the proof is gone, so the code must be re-sent
    expect(d.email.challengeId).toBeNull();
    expect(emptyChannel().proof).toBeNull();
  });

  it('a lost signup session resets to the account step and clears both channels', () => {
    let s = reduce(initialState(), { type: 'session', token: 'S', expiresIn: 10 });
    s = reduce(sent(s, 'email'), { type: 'step', step: 'verify' });
    s = reduce(s, { type: 'session-expired' });
    expect(s.step).toBe('account');
    expect(s.session).toBeNull();
    expect(s.email.challengeId).toBeNull();
    expect(s.formError?.key).toBe('signup.err.sessionExpired');
  });
});
