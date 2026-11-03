/**
 * V22 native sign-up state — one reducer, pure, testable (brief §5, §17, §23).
 *
 * Steps: account → (challenge when the server requires a CAPTCHA) → verify → consent → done.
 * Nothing sensitive is kept in persisted state: the password, the codes, the proofs and the signup session
 * live only in memory; `persistable()` strips them, so an app that is killed and reopened restores the
 * typed email / phone / nationality / step and the live challenge handles, never a secret.
 */
export type Step = 'account' | 'challenge' | 'verify' | 'consent' | 'done';
export const STEP_ORDER: Step[] = ['account', 'challenge', 'verify', 'consent', 'done'];
/** The dots the UI shows (the challenge is a gate inside the account step, not a milestone). */
export const PROGRESS_STEPS: Exclude<Step, 'challenge'>[] = ['account', 'verify', 'consent', 'done'];

export interface Channel {
  challengeId: string | null;
  /** epoch ms */
  sentAt: number | null;
  expiresAt: number | null;
  resendAt: number | null;
  targetMasked: string | null;
  delivery: 'sent' | 'console' | null;
  proof: string | null;
  attemptsLeft: number | null;
  error: { key: string; params?: Record<string, string | number> } | null;
  busy: boolean;
}
export const emptyChannel = (): Channel => ({ challengeId: null, sentAt: null, expiresAt: null, resendAt: null, targetMasked: null, delivery: null, proof: null, attemptsLeft: null, error: null, busy: false });

export interface Account { fullName: string; email: string; phoneCountry: string; phoneLocal: string; nationality: string; password: string; passwordConfirm: string }

export interface SignupState {
  step: Step;
  account: Account;
  session: string | null;
  sessionExpiresAt: number | null;
  captchaRequired: boolean;
  email: Channel;
  sms: Channel;
  consents: Record<string, boolean>;
  formError: { key: string; params?: Record<string, string | number> } | null;
  busy: boolean;
}

export const initialState = (nationality = 'KR'): SignupState => ({
  step: 'account',
  account: { fullName: '', email: '', phoneCountry: nationality || 'KR', phoneLocal: '', nationality: nationality === 'KR' ? '' : nationality, password: '', passwordConfirm: '' },
  session: null, sessionExpiresAt: null, captchaRequired: false,
  email: emptyChannel(), sms: emptyChannel(), consents: {}, formError: null, busy: false,
});

export type Action =
  | { type: 'account'; patch: Partial<Account> }
  | { type: 'captcha'; required: boolean }
  | { type: 'session'; token: string; expiresIn: number }
  | { type: 'session-expired' }
  | { type: 'step'; step: Step }
  | { type: 'busy'; busy: boolean }
  | { type: 'error'; error: SignupState['formError'] }
  | { type: 'chan-busy'; channel: 'email' | 'sms'; busy: boolean }
  | { type: 'chan-sent'; channel: 'email' | 'sms'; challengeId: string; expiresIn: number; resendIn: number; targetMasked: string; delivery: 'sent' | 'console'; now: number }
  | { type: 'chan-error'; channel: 'email' | 'sms'; error: Channel['error']; attemptsLeft?: number | null; reset?: boolean }
  | { type: 'chan-verified'; channel: 'email' | 'sms'; proof: string }
  | { type: 'chan-reset'; channel: 'email' | 'sms' }
  | { type: 'consent'; key: string; value: boolean }
  | { type: 'consent-all'; keys: string[]; value: boolean }
  | { type: 'restore'; state: Partial<SignupState> }
  | { type: 'back' };

export function reduce(s: SignupState, a: Action): SignupState {
  switch (a.type) {
    case 'account': return { ...s, account: { ...s.account, ...a.patch }, formError: null };
    case 'captcha': return { ...s, captchaRequired: a.required };
    case 'session': return { ...s, session: a.token, sessionExpiresAt: Date.now() + a.expiresIn * 1000 };
    case 'session-expired': return { ...s, session: null, sessionExpiresAt: null, step: 'account', email: emptyChannel(), sms: emptyChannel(), formError: { key: 'signup.err.sessionExpired' } };
    case 'step': return { ...s, step: a.step, formError: null };
    case 'busy': return { ...s, busy: a.busy };
    case 'error': return { ...s, formError: a.error, busy: false };
    case 'chan-busy': return { ...s, [a.channel]: { ...s[a.channel], busy: a.busy, error: a.busy ? null : s[a.channel].error } };
    case 'chan-sent': return { ...s, [a.channel]: { ...emptyChannel(), challengeId: a.challengeId, sentAt: a.now, expiresAt: a.now + a.expiresIn * 1000, resendAt: a.now + a.resendIn * 1000, targetMasked: a.targetMasked, delivery: a.delivery } };
    case 'chan-error': return { ...s, [a.channel]: { ...s[a.channel], busy: false, error: a.error, attemptsLeft: a.attemptsLeft ?? s[a.channel].attemptsLeft, ...(a.reset ? { challengeId: null, expiresAt: null } : {}) } };
    case 'chan-verified': return { ...s, [a.channel]: { ...s[a.channel], busy: false, error: null, proof: a.proof } };
    case 'chan-reset': return { ...s, [a.channel]: emptyChannel() };
    case 'consent': return { ...s, consents: { ...s.consents, [a.key]: a.value }, formError: null };
    case 'consent-all': return { ...s, consents: Object.fromEntries(a.keys.map((k) => [k, a.value])), formError: null };
    case 'restore': return { ...s, ...a.state, account: { ...s.account, ...(a.state.account ?? {}) }, email: { ...emptyChannel(), ...(a.state.email ?? {}) }, sms: { ...emptyChannel(), ...(a.state.sms ?? {}) } };
    case 'back': {
      // Going back never discards a verified value, never resends a code and never duplicates a consent:
      // the channel records stay; the user simply sees the previous screen.
      const i = STEP_ORDER.indexOf(s.step);
      const prev = STEP_ORDER[Math.max(0, i - 1)];
      return { ...s, step: prev === 'challenge' && !s.captchaRequired ? 'account' : prev, formError: null };
    }
    default: return s;
  }
}

export const bothVerified = (s: SignupState) => !!s.email.proof && !!s.sms.proof;
export const resendSeconds = (c: Channel, now: number) => (c.resendAt ? Math.max(0, Math.ceil((c.resendAt - now) / 1000)) : 0);
export const expiresSeconds = (c: Channel, now: number) => (c.expiresAt ? Math.max(0, Math.ceil((c.expiresAt - now) / 1000)) : 0);
export const codeExpired = (c: Channel, now: number) => !!c.expiresAt && c.expiresAt <= now && !c.proof;

export function passwordMatch(a: Account): boolean | null {
  return a.passwordConfirm.length ? a.password === a.passwordConfirm : null;
}

export function missingRequired(consents: Record<string, boolean>, items: { key: string; required: boolean }[]): string[] {
  return items.filter((i) => i.required && !consents[i.key]).map((i) => i.key);
}

export function nextStepAfterAccount(captchaRequired: boolean): Step {
  return captchaRequired ? 'challenge' : 'verify';
}

/** What may be written to device storage. Secrets and single-use proofs never are. */
export function persistable(s: SignupState) {
  const chan = (c: Channel) => ({ challengeId: c.proof ? null : c.challengeId, sentAt: c.sentAt, expiresAt: c.expiresAt, resendAt: c.resendAt, targetMasked: c.targetMasked, delivery: c.delivery });
  return {
    step: s.step === 'challenge' || s.step === 'done' ? 'account' : s.step,
    account: { fullName: s.account.fullName, email: s.account.email, phoneCountry: s.account.phoneCountry, phoneLocal: s.account.phoneLocal, nationality: s.account.nationality },
    email: chan(s.email), sms: chan(s.sms), consents: s.consents, savedAt: Date.now(),
  };
}
export const PERSIST_TTL_MS = 30 * 60 * 1000;
