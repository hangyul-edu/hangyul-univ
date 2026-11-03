/**
 * V29 staff sign-in with two-step verification.
 *
 * The shared `LoginScreen` (@hangyul/ui) signs in through `useAuth().login`, which cannot surface the server's
 * `MFA_REQUIRED` / `MFA_ENROLLMENT_REQUIRED` answers, and it takes no prop to intercept submit. So the console renders
 * this instead: the password step is the same markup and classes as `LoginScreen` (same `#email` / `#password` ids,
 * so `?demo=` and the university SSO lookup keep working), followed — only when the server asks for it — by the
 * code step or the enrolment flow. The session is set by the api-client (`setSession`), which the AuthProvider
 * hears through `onSessionChange`, so the auth context is authenticated before we navigate on.
 *
 * Same file in apps/agency-web and apps/university-web.
 */
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { Button, Callout, Field, Input, LocaleSelector, Logo, safeNext, useDemoParamLogin } from '@hangyul/ui';
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { MfaChallenge, MfaEnroll, useSecurityT } from './TwoStep';

type Step =
  | { kind: 'password' }
  | { kind: 'mfa'; token: string; expiresAt: number; methods: string[] }
  | { kind: 'enroll'; token: string };

export function StaffLoginScreen({ product, title, subtitle, footer, afterLogin = '/' }: {
  product: string; title: ReactNode; subtitle?: ReactNode; footer?: ReactNode; afterLogin?: string;
}) {
  const { api, status } = useAuth();
  const { t } = useLocale('common');
  const { tx } = useSecurityT();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const next = safeNext(new URLSearchParams(loc.search).get('next'), afterLogin);

  // As LoginScreen — except while enrolling: `activate` sets the session *before* the recovery codes are shown,
  // and the reader must see (and confirm) them before the console opens.
  useEffect(() => { if (status === 'authenticated' && step.kind !== 'enroll') nav(next, { replace: true }); }, [status, step.kind, nav, next]);

  const backToPassword = useCallback((message?: string) => {
    setStep({ kind: 'password' });
    setPassword('');
    setFormError(message ?? null);
  }, []);
  const finish = useCallback(() => nav(next, { replace: true }), [nav, next]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    // Same plain checks and messages as LoginScreen.
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'validation.required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'validation.email';
    if (!password) errs.password = 'validation.required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const res = await api.mfa.loginStaff(email, password);
      if (res.kind === 'session') finish();
      else if (res.kind === 'mfa') setStep({ kind: 'mfa', token: res.mfa_token, expiresAt: Date.now() + res.expires_in * 1000, methods: res.methods });
      else setStep({ kind: 'enroll', token: res.enrollment_token });
    } catch (err) {
      const s = (err as { status?: number }).status;
      setFormError(s === 401 ? t('auth.invalid') : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const demoError = useDemoParamLogin(finish);

  return (
    <div className="hg-login">
      <header className="hg-login__top">
        <Logo tag={product} />
        <LocaleSelector compact />
      </header>
      <main className="hg-login__main">
        <div className="hg-login__panel">
          {step.kind === 'password' && (
            <>
              <div className="hg-login__intro">
                <h1 className="hg-title-lg">{title}</h1>
                {subtitle && <p className="hg-muted">{subtitle}</p>}
              </div>
              <form onSubmit={submit} noValidate className="hg-stack" style={{ '--hg-gap': '14px' } as CSSProperties}>
                {(formError || demoError) && <Callout tone="danger">{formError || demoError}</Callout>}
                <Field label={t('auth.email')} htmlFor="email" error={errors.email}>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
                </Field>
                <Field label={t('auth.password')} htmlFor="password" error={errors.password}>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
                </Field>
                <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('actions.signIn')}</Button>
              </form>
              {footer}
            </>
          )}
          {step.kind === 'mfa' && (
            <>
              <div className="hg-login__intro">
                <h1 className="hg-title-lg">{tx('challenge.title')}</h1>
                <p className="hg-muted">{email}</p>
              </div>
              <MfaChallenge mfaToken={step.token} expiresAt={step.expiresAt} methods={step.methods}
                onDone={finish} onExpired={backToPassword} onBack={() => backToPassword()} />
            </>
          )}
          {step.kind === 'enroll' && (
            <>
              <div className="hg-login__intro">
                <h1 className="hg-title-lg">{tx('enroll.title')}</h1>
                <p className="hg-muted">{tx('enroll.lede')}</p>
              </div>
              <MfaEnroll enrollmentToken={step.token} onDone={finish} onExpired={backToPassword}
                onCancel={status === 'authenticated' ? undefined : () => backToPassword()} />
            </>
          )}
        </div>
      </main>
      <footer className="hg-login__foot hg-subtle hg-xs">{t('footer.rights', { year: new Date().getFullYear() })}</footer>
    </div>
  );
}
