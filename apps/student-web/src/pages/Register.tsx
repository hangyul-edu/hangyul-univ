/**
 * V22 registration — Account → Verify → Consent → Complete (REPORT §244, §254).
 *
 * The browser never decides anything that matters: the CAPTCHA token is verified by the server, the codes are
 * checked by the server, the proofs are bound to the verified values by the server, and the account exists only
 * after `POST /auth/register` succeeds. What this page owns is the order of the steps and the words.
 */
import { useApi, useAuth } from '@hangyul/auth';
import { ArrowRight, Check, KeyRound, Mail, ShieldCheck, Smartphone, User } from '@hangyul/icons';
import type { SignupConfig, VerificationSent } from '@hangyul/types';
import { Button, Callout, Card, ConsentList, CountrySelect, Field, Input, LocaleSelector, Logo, OtpInput, PasswordInput, PhoneInput, safeNext, Skeleton, StepRail, TurnstileWidget } from '@hangyul/ui';
import { registerSchema } from '@hangyul/validation';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useT } from '../lib/i18n';
import { useCountries } from '../lib/queries';
import { applyQuickToProfile, PRIOR_FOR, readFit, readQuick, type PriorAnswer } from '../lib/quick';

// Same variable the review build, the e2e runner and the university console use; no localhost survives a production build.
const MARKETING = (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3100' : '');
const legalHref = (doc: string | null, locale: string) => (doc ? `${MARKETING}${doc}${doc.includes('#') ? '' : ''}${doc.includes('?') ? '&' : '?'}lang=${locale}` : undefined);

type Step = 0 | 1 | 2 | 3;
type Account = { full_name: string; email: string; phone_country: string; phone_local: string; password: string; password_confirm: string; nationality: string };
type Channel = { sent: VerificationSent | null; code: string; proof: string | null; error: string | null; attemptsLeft: number | null; busy: boolean; resendAt: number };
const freshChannel = (): Channel => ({ sent: null, code: '', proof: null, error: null, attemptsLeft: null, busy: false, resendAt: 0 });

function apiCode(err: unknown): string | null {
  const body = (err as { body?: { detail?: { code?: string } } }).body;
  return body?.detail?.code ?? null;
}

/** V27 (REPORT §358): what a failed send means for the person — what failed, what to do, when to resend. */
function deliveryMessage(err: unknown, channel: 'EMAIL' | 'SMS', t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = (err as { body?: { detail?: { reason?: string; retry_after?: number } } }).body?.detail;
  const ch = channel === 'EMAIL' ? 'email' : 'sms';
  if (!d?.reason) return channel === 'EMAIL' ? t('register.verify.deliveryFailedEmail') : t('register.verify.deliveryFailedSms');
  return t(`register.verify.delivery.${d.reason}.${ch}`, { seconds: d.retry_after ?? 60, defaultValue: t(`register.verify.delivery.SERVICE_CONFIG.${ch}`, { seconds: d.retry_after ?? 60 }) });
}

export default function Register() {
  const { t, locale } = useT();
  const api = useApi();
  const { status } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const quick = readQuick(sp);
  const fromCheck = !!quick.degree;
  const priorLevel = quick.degree ? PRIOR_FOR[quick.degree] : undefined;
  const countries = useCountries();
  const config = useQuery({ queryKey: ['signup-config'], queryFn: () => api.auth.signupConfig(), staleTime: 5 * 60_000 });

  const [step, setStep] = useState<Step>(0);
  const [acct, setAcct] = useState<Account>({ full_name: '', email: '', phone_country: quick.nationality || 'KR', phone_local: '', password: '', password_confirm: '', nationality: quick.nationality || '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Account, string>>>({});
  const [prior, setPrior] = useState<PriorAnswer>('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [session, setSession] = useState<string | null>(null);
  const [email, setEmail] = useState<Channel>(freshChannel());
  const [phone, setPhone] = useState<Channel>(freshChannel());
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [consentErrors, setConsentErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneName, setDoneName] = useState('');
  const creating = useRef(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (status === 'authenticated' && !creating.current && step !== 3) nav('/', { replace: true }); }, [status, nav, step]);

  const cfg: SignupConfig | undefined = config.data;
  const captchaNeeded = !!cfg?.captcha.required && cfg.captcha.provider === 'turnstile' && !!cfg.captcha.site_key;
  const onToken = useCallback((tok: string) => setCaptcha(tok), []);
  const onExpire = useCallback(() => setCaptcha(null), []);

  const match = acct.password_confirm.length > 0 ? acct.password === acct.password_confirm : null;

  // ----------------------------------------------------------------------------------- step 0 → 1
  const startVerification = async () => {
    setFormError(null);
    const parsed = registerSchema.safeParse(acct);
    if (!parsed.success) {
      const e: Partial<Record<keyof Account, string>> = {};
      for (const issue of parsed.error.issues) e[issue.path[0] as keyof Account] = issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    if (cfg?.captcha.required && !cfg.captcha.site_key) { setFormError(t('register.captcha.unavailable')); return; }
    if (captchaNeeded && !captcha) { setFormError(t('register.captcha.failed')); return; }
    setBusy(true);
    try {
      const s = await api.auth.signupSession(captcha, locale);
      setSession(s.signup_session);
      setStep(1);
      await Promise.all([send('EMAIL', s.signup_session), send('SMS', s.signup_session)]);
    } catch (err) {
      const code = apiCode(err);
      setFormError(code === 'CAPTCHA_NOT_CONFIGURED' || code === 'CAPTCHA_UNAVAILABLE' ? t('register.captcha.unavailable') : code?.startsWith('CAPTCHA') ? t('register.captcha.failed') : (err as Error).message || t('register.errors.generic'));
      setCaptcha(null); setCaptchaNonce((n) => n + 1);
    } finally { setBusy(false); }
  };

  // ----------------------------------------------------------------------------------- codes
  const send = async (channel: 'EMAIL' | 'SMS', sess = session) => {
    const set = channel === 'EMAIL' ? setEmail : setPhone;
    set((c) => ({ ...c, busy: true, error: null }));
    try {
      const target = channel === 'EMAIL' ? acct.email : acct.phone_local;
      const r = await api.auth.sendCode(sess, { channel, target, phone_country: acct.phone_country, purpose: 'SIGNUP', locale });
      set((c) => ({ ...c, sent: r, code: '', proof: null, attemptsLeft: null, busy: false, resendAt: Date.now() + r.resend_in * 1000 }));
    } catch (err) {
      const code = apiCode(err);
      const msg = code === 'SIGNUP_SESSION_EXPIRED' || code === 'SIGNUP_SESSION_REQUIRED' ? t('register.errors.session')
        : code === 'DELIVERY_FAILED' ? deliveryMessage(err, channel, t)
          : code === 'OTP_RESEND_TOO_SOON' ? t('register.verify.tooSoon') : code === 'OTP_SEND_LIMITED' ? t('register.verify.limited')
            : code === 'EMAIL_INVALID' ? t('common:validation.email') : code === 'PHONE_INVALID' || code === 'PHONE_NOT_MOBILE' ? t('common:validation.phone')
              : (err as Error).message || t('register.errors.generic');
      set((c) => ({ ...c, busy: false, error: msg }));
      if (code?.startsWith('SIGNUP_SESSION')) { setSession(null); setStep(0); setCaptcha(null); setCaptchaNonce((n) => n + 1); setFormError(t('register.errors.session')); }
    }
  };
  const verify = async (channel: 'EMAIL' | 'SMS') => {
    const ch = channel === 'EMAIL' ? email : phone;
    const set = channel === 'EMAIL' ? setEmail : setPhone;
    if (!ch.sent || ch.code.length !== 6) { set((c) => ({ ...c, error: t('common:validation.code') })); return; }
    set((c) => ({ ...c, busy: true, error: null }));
    try {
      const r = await api.auth.verifyCode(ch.sent.challenge_id, ch.code);
      set((c) => ({ ...c, proof: r.proof, busy: false, error: null }));
    } catch (err) {
      const code = apiCode(err);
      const left = (err as { body?: { detail?: { attempts_left?: number } } }).body?.detail?.attempts_left ?? null;
      set((c) => ({ ...c, busy: false, attemptsLeft: left, code: '',
        error: code === 'CODE_INVALID' ? t('register.verify.invalid') : code === 'TOO_MANY_ATTEMPTS' ? t('register.verify.tooMany')
          : code === 'OTP_VERIFY_LIMITED' ? t('register.verify.limited') : t('register.verify.expired') }));
    }
  };
  const bothVerified = !!email.proof && !!phone.proof;

  // ----------------------------------------------------------------------------------- step 2 → 3
  const submit = async () => {
    if (!cfg || !session) return;
    const missing = cfg.consents.items.filter((i) => i.required && !consents[i.key]).map((i) => i.key);
    setConsentErrors(missing);
    if (missing.length) { setFormError(t('register.consent.missing')); return; }
    setFormError(null); setBusy(true); creating.current = true;
    try {
      const tr = await api.auth.register({
        email: acct.email, email_proof: email.proof!, phone: acct.phone_local, phone_country: acct.phone_country, phone_proof: phone.proof!,
        password: acct.password, password_confirm: acct.password_confirm, full_name: acct.full_name, locale, nationality: acct.nationality || undefined,
        consents: Object.fromEntries(cfg.consents.items.map((i) => [i.key, !!consents[i.key]])),
      }, session);
      setDoneName(tr.user.preferred_name || tr.user.full_name.split(' ')[0] || tr.user.full_name);
      if (fromCheck) { try { await applyQuickToProfile(api, { ...quick, nationality: acct.nationality }, prior, readFit(sp)); } catch { /* profile can be completed later */ } }
      setStep(3);
    } catch (err) {
      creating.current = false;
      const code = apiCode(err);
      const s = (err as { status?: number }).status;
      if (s === 409 || code === 'EMAIL_TAKEN') setFormError(t('register.exists'));
      else if (code === 'CONSENT_REQUIRED') { setConsentErrors(((err as { body?: { detail?: { keys?: string[] } } }).body?.detail?.keys) ?? []); setFormError(t('register.consent.missing')); }
      else if (code?.startsWith('SIGNUP_SESSION')) { setFormError(t('register.errors.session')); setStep(0); setSession(null); setCaptcha(null); setCaptchaNonce((n) => n + 1); }
      else if (code === 'VERIFICATION_EXPIRED' || code === 'VERIFICATION_MISMATCH' || code === 'EMAIL_NOT_VERIFIED' || code === 'PHONE_NOT_VERIFIED') { setFormError(t('register.verify.expired')); setEmail(freshChannel()); setPhone(freshChannel()); setStep(1); }
      else setFormError((err as Error).message || t('register.errors.generic'));
    } finally { setBusy(false); }
  };
  const finish = () => {
    const next = safeNext(sp.get('next'), '');
    nav(next || (fromCheck ? '/explore?tab=foryou&welcome=1' : '/'), { replace: true });
  };

  const steps = useMemo(() => (['account', 'verify', 'consent', 'done'] as const).map((k) => ({ key: k, label: t(`register.steps.${k}`) })), [t]);
  const consentLabels = useMemo(() => Object.fromEntries((cfg?.consents.items ?? []).map((i) => [i.key, {
    label: t(`register.consent.${i.key}.label`, { defaultValue: i.key }),
    summary: t(`register.consent.${i.key}.summary`, { defaultValue: '' }) || undefined,
    href: legalHref(i.document, locale),
  }])), [cfg, t, locale]);

  const channelBlock = (channel: 'EMAIL' | 'SMS') => {
    const ch = channel === 'EMAIL' ? email : phone;
    const set = channel === 'EMAIL' ? setEmail : setPhone;
    const target = channel === 'EMAIL' ? acct.email : `+${ch.sent?.target_masked ?? ''}`.replace('++', '+');
    const wait = Math.max(0, Math.ceil((ch.resendAt - now) / 1000));
    const id = `otp-${channel.toLowerCase()}`;
    return (
      <section className="st-reg__chan" aria-labelledby={`${id}-h`} data-verified={!!ch.proof}>
        <div className="st-reg__chanhead">
          <span className="st-reg__chanicon" aria-hidden>{channel === 'EMAIL' ? <Mail size={16} /> : <Smartphone size={16} />}</span>
          <div className="hg-grow" style={{ minWidth: 0 }}>
            <h3 className="hg-title-sm" id={`${id}-h`}>{channel === 'EMAIL' ? t('register.verify.emailTitle') : t('register.verify.phoneTitle')}</h3>
            <div className="hg-small hg-muted hg-truncate">{ch.sent ? t('register.verify.sentTo', { target: ch.sent.target_masked }) : target}</div>
          </div>
          {ch.proof ? <span className="st-reg__ok"><Check size={14} aria-hidden /> {t('register.verify.verified')}</span>
            : <button type="button" className="hg-link hg-small" onClick={() => setStep(0)}>{t('register.verify.change')}</button>}
        </div>
        {!ch.proof && (
          <>
            <div className="st-reg__otp">
              <OtpInput id={id} value={ch.code} onChange={(v) => set((c) => ({ ...c, code: v, error: null }))} invalid={!!ch.error} aria-label={t('register.verify.codeLabel')} disabled={!ch.sent || ch.busy}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verify(channel); } }} />
              <Button variant="primary" onClick={() => verify(channel)} loading={ch.busy} disabled={!ch.sent || ch.code.length !== 6}>{t('register.verify.verify')}</Button>
            </div>
            <div className="st-reg__chanfoot">
              {ch.error && <span className="hg-error" role="alert">{ch.error}{ch.attemptsLeft != null && ch.attemptsLeft > 0 ? ` · ${t('register.verify.attemptsLeft', { count: ch.attemptsLeft })}` : ''}</span>}
              <button type="button" className="hg-link hg-small" disabled={wait > 0 || ch.busy} onClick={() => send(channel)}>
                {wait > 0 ? t('register.verify.resendIn', { seconds: wait }) : ch.sent ? t('register.verify.resend') : channel === 'EMAIL' ? t('register.verify.sendEmail') : t('register.verify.sendPhone')}
              </button>
            </div>
            {ch.sent?.delivery === 'console' && <p className="hg-subtle hg-xs">{t('register.verify.consoleHint')}</p>}
          </>
        )}
      </section>
    );
  };

  return (
    <div className="st-auth">
      <header className="st-auth__head">
        <Logo tag={t('product')} />
        <LocaleSelector compact />
      </header>
      <main className="st-auth__main">
        <div className="st-auth__card st-reg hg-stack" style={{ '--hg-gap': '20px' } as React.CSSProperties}>
          <div>
            <div className="hg-eyebrow" style={{ marginBottom: 8 }}>{t('register.eyebrow')}</div>
            <h1 className="hg-title-xl">{step === 3 ? t('register.done.title', { name: doneName }) : t('register.title')}</h1>
            {step !== 3 && <p className="hg-muted" style={{ marginTop: 8 }}>{fromCheck && step === 0 ? t('register.fromCheck') : t('register.subtitle')}</p>}
          </div>
          <StepRail steps={steps} current={step} />
          {formError && <Callout tone="danger">{formError}</Callout>}

          {step === 0 && (
            <form className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties} noValidate onSubmit={(e) => { e.preventDefault(); startVerification(); }}>
              <Field label={t('common:auth.fullName')} htmlFor="full_name" error={errors.full_name} hint={t('register.nameHint')}>
                <div className="hg-input-icon"><User aria-hidden /><Input id="full_name" autoComplete="name" value={acct.full_name} invalid={!!errors.full_name} onChange={(e) => setAcct({ ...acct, full_name: e.target.value })} /></div>
              </Field>
              <Field label={t('common:auth.email')} htmlFor="email" error={errors.email}>
                <div className="hg-input-icon"><Mail aria-hidden /><Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={acct.email} invalid={!!errors.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} onBlur={(e) => setAcct({ ...acct, email: e.target.value.trim().toLowerCase() })} /></div>
              </Field>
              <Field label={t('register.phoneLabel')} htmlFor="phone_local" error={errors.phone_local} hint={t('register.phoneHint')}>
                <PhoneInput id="phone_local" value={{ country: acct.phone_country, local: acct.phone_local }} onChange={(v) => setAcct({ ...acct, phone_country: v.country, phone_local: v.local })} invalid={!!errors.phone_local} />
              </Field>
              <Field label={t('common:auth.nationality')} error={errors.nationality} hint={t('register.nationalityHint')}>
                {countries.isLoading ? <Skeleton h={44} /> : (
                  <CountrySelect countries={countries.data ?? []} value={acct.nationality} onChange={(v) => setAcct((a) => ({ ...a, nationality: v, phone_country: a.phone_local ? a.phone_country : v || a.phone_country }))} label={t('common:auth.nationality')} invalid={!!errors.nationality} />
                )}
              </Field>
              <Field label={t('register.passwordLabel')} htmlFor="password" error={errors.password} hint={t('register.passwordHint')}>
                <div className="hg-input-icon st-reg__pw"><KeyRound aria-hidden /><PasswordInput id="password" autoComplete="new-password" strength value={acct.password} invalid={!!errors.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} /></div>
              </Field>
              <Field label={t('register.passwordConfirmLabel')} htmlFor="password_confirm" error={errors.password_confirm}>
                <PasswordInput id="password_confirm" autoComplete="new-password" value={acct.password_confirm} invalid={match === false} onChange={(e) => setAcct({ ...acct, password_confirm: e.target.value })} />
                {match !== null && <span className="hg-match" data-ok={match} aria-live="polite">{match ? <Check size={14} aria-hidden /> : null}{match ? t('common:auth.passwordMatch') : t('common:auth.passwordMismatch')}</span>}
              </Field>
              {fromCheck && priorLevel && (
                <fieldset className="st-group">
                  <legend className="st-group__label">{t('register.prior.question', { level: t(`register.prior.level.${priorLevel}`) })}</legend>
                  <p className="st-group__hint">{t('register.prior.why')}</p>
                  <div className="hg-options" style={{ '--hg-min': '160px' } as React.CSSProperties} role="radiogroup" aria-label={t('register.prior.question', { level: t(`register.prior.level.${priorLevel}`) })}>
                    {(['GRADUATED', 'EXPECTED', 'NO'] as const).map((v) => (
                      <button key={v} type="button" className="hg-option" role="radio" aria-checked={prior === v} onClick={() => setPrior(v)}>{t(`register.prior.${v}`)}</button>
                    ))}
                  </div>
                </fieldset>
              )}
              {captchaNeeded && cfg?.captcha.site_key && (
                <div className="st-reg__captcha">
                  <div className="hg-small hg-muted">{t('register.captcha.text')}</div>
                  <TurnstileWidget siteKey={cfg.captcha.site_key} onToken={onToken} onExpire={onExpire} locale={locale} nonce={captchaNonce} />
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" block loading={busy || config.isLoading} disabled={captchaNeeded && !captcha} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('register.continue')}</Button>
            </form>
          )}

          {step === 1 && (
            <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
              <p className="hg-small hg-muted">{t('register.verify.text')}</p>
              {channelBlock('EMAIL')}
              {channelBlock('SMS')}
              <Button variant="primary" size="lg" block disabled={!bothVerified} onClick={() => setStep(2)} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('register.continue')}</Button>
            </div>
          )}

          {step === 2 && cfg && (
            <div className="hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
              <div>
                <h2 className="hg-title-sm">{t('register.consent.title')}</h2>
                <p className="hg-small hg-muted" style={{ marginTop: 4 }}>{t('register.consent.text')}</p>
              </div>
              <ConsentList items={cfg.consents.items} value={consents} onChange={(v) => { setConsents(v); setConsentErrors([]); }} labels={consentLabels} errorKeys={consentErrors} />
              {locale !== 'ko' && <p className="hg-subtle hg-xs">{t('register.consent.canonical')}</p>}
              <div className="hg-row" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
                <Button variant="ghost" onClick={() => setStep(1)}>{t('register.back')}</Button>
                <Button variant="primary" size="lg" className="hg-grow" loading={busy} onClick={submit} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('register.submit')}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="hg-stack" style={{ '--hg-gap': '16px' } as React.CSSProperties}>
              <div className="st-reg__done"><ShieldCheck size={28} aria-hidden /><p>{t('register.done.text')}</p></div>
              <Button variant="primary" size="lg" block onClick={finish} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('register.done.cta')}</Button>
            </div>
          )}

          {step < 3 && (
            <>
              <Card pad warm flat>
                <div className="hg-row" style={{ alignItems: 'flex-start' }}>
                  <ShieldCheck size={20} aria-hidden style={{ color: 'var(--hg-status-success-fg)', flex: 'none', marginTop: 2 }} />
                  <p className="hg-muted hg-small">{t('register.privacyNote')}</p>
                </div>
              </Card>
              <p className="hg-muted hg-small" style={{ textAlign: 'center' }}>
                {t('common:auth.haveAccount')} <Link to="/login" className="hg-strong">{t('common:actions.signIn')}</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
