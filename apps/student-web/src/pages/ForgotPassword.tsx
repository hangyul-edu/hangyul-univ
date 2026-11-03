/** V22 — forgot / reset password through the same one-time-code model as sign-up (REPORT §244 R5; rate-limited server-side). */
import { useApi } from '@hangyul/auth';
import { ArrowRight, Check, KeyRound, Mail } from '@hangyul/icons';
import { Button, Callout, Field, Input, LocaleSelector, Logo, OtpInput, PasswordInput } from '@hangyul/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useT } from '../lib/i18n';

export default function ForgotPassword() {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const match = pw2 ? pw === pw2 : null;
  const code_of = (e: unknown) => (e as { body?: { detail?: { code?: string } } }).body?.detail?.code ?? null;

  const request = async () => {
    setBusy(true); setError(null);
    try { const r = await api.auth.forgotPassword(email.trim().toLowerCase(), locale); setChallenge(r.challenge_id ?? null); }
    catch (e) { setError(code_of(e) === 'FORGOT_LIMITED' ? t('register.verify.limited') : (e as Error).message); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!challenge) return;
    if (pw !== pw2) { setError(t('common:auth.passwordMismatch')); return; }
    setBusy(true); setError(null);
    try { await api.auth.resetPassword({ challenge_id: challenge, code, new_password: pw, new_password_confirm: pw2 }); setDone(true); }
    catch (e) {
      const c = code_of(e);
      setError(c === 'CODE_INVALID' ? t('register.verify.invalid') : c === 'TOO_MANY_ATTEMPTS' ? t('register.verify.tooMany') : c === 'PASSWORD_MISMATCH' ? t('common:auth.passwordMismatch') : t('register.verify.expired'));
    } finally { setBusy(false); }
  };

  return (
    <div className="st-auth">
      <header className="st-auth__head"><Logo tag={t('product')} /><LocaleSelector compact /></header>
      <main className="st-auth__main">
        <div className="st-auth__card hg-stack" style={{ '--hg-gap': '18px' } as React.CSSProperties}>
          <div>
            <h1 className="hg-title-xl">{t('forgot.title')}</h1>
            <p className="hg-muted" style={{ marginTop: 8 }}>{done ? t('forgot.doneText') : challenge ? t('forgot.codeText') : t('forgot.text')}</p>
          </div>
          {error && <Callout tone="danger">{error}</Callout>}
          {done ? (
            <Button variant="primary" size="lg" block onClick={() => nav('/login')} iconEnd={<ArrowRight className="hg-flip-rtl" />}>{t('common:actions.signIn')}</Button>
          ) : !challenge ? (
            <form className="hg-stack" noValidate onSubmit={(e) => { e.preventDefault(); request(); }}>
              <Field label={t('common:auth.email')} htmlFor="fp-email">
                <div className="hg-input-icon"><Mail aria-hidden /><Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </Field>
              <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!email.includes('@')}>{t('forgot.send')}</Button>
            </form>
          ) : (
            <form className="hg-stack" noValidate onSubmit={(e) => { e.preventDefault(); reset(); }}>
              <Field label={t('register.verify.codeLabel')} htmlFor="fp-code" hint={t('forgot.codeHint')}>
                <OtpInput id="fp-code" value={code} onChange={setCode} />
              </Field>
              <Field label={t('forgot.newPassword')} htmlFor="fp-pw" hint={t('register.passwordHint')}>
                <div className="hg-input-icon st-reg__pw"><KeyRound aria-hidden /><PasswordInput id="fp-pw" autoComplete="new-password" strength value={pw} onChange={(e) => setPw(e.target.value)} /></div>
              </Field>
              <Field label={t('register.passwordConfirmLabel')} htmlFor="fp-pw2">
                <PasswordInput id="fp-pw2" autoComplete="new-password" value={pw2} invalid={match === false} onChange={(e) => setPw2(e.target.value)} />
                {match !== null && <span className="hg-match" data-ok={match}>{match ? <Check size={14} aria-hidden /> : null}{match ? t('common:auth.passwordMatch') : t('common:auth.passwordMismatch')}</span>}
              </Field>
              <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={code.length !== 6 || pw.length < 10 || match !== true}>{t('forgot.reset')}</Button>
            </form>
          )}
          <p className="hg-muted hg-small" style={{ textAlign: 'center' }}><Link to="/login" className="hg-strong">{t('common:actions.back')}</Link></p>
        </div>
      </main>
    </div>
  );
}
