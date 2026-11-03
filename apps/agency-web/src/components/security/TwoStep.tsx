/**
 * V29 staff two-step verification (TOTP): the strings, the enrolment flow, the sign-in challenge and the Settings
 * panel. The same file lives in apps/agency-web and apps/university-web (only `NS` differs) — there is no shared
 * package the consoles may extend for this, and the component is small.
 *
 * Copy lives under `<NS>:v29.security.*` (source: scripts/i18n/v29/security_source.py). Every lookup passes the
 * English string as `defaultValue`, so nothing renders blank before the locale files carry the keys.
 */

import { mfaErrorCode, mfaErrorDetail, type MfaEnrollment } from '@hangyul/api-client';
import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import { Check, Copy, Download, KeyRound, ShieldCheck } from '@hangyul/icons';
import { Button, ButtonLink, Callout, Checkbox, Field, Input, Skeleton, StatusText } from '@hangyul/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';

const NS = 'agency';

const EN_DEFAULTS: Record<string, string> = {
  title: "Two-step verification",
  sub: "After your password, you also enter a code from an authenticator app.",
  "status.label": "Status",
  "status.on": "On",
  "status.off": "Off",
  "status.since": "On since {{date}}",
  "status.codesLeft": "Recovery codes left",
  "status.required": "Two-step verification is required for this account.",
  "status.notEligible": "Two-step verification isn't available for this account.",
  "status.requiredOff": "Your organisation requires two-step verification. If you don't set it up now, you'll be asked to at your next sign-in.",
  "status.resetNote": "Lost your authenticator? Ask a Hangyul Univ administrator to reset two-step verification for you.",
  "status.loadFailed": "Couldn't load your two-step verification status.",
  "actions.setUp": "Set up",
  "actions.regenerate": "Regenerate recovery codes",
  "actions.cancel": "Cancel",
  "actions.copy": "Copy",
  "actions.copied": "Copied",
  "actions.copyAll": "Copy all",
  "actions.download": "Download as .txt",
  "actions.continue": "Continue",
  "actions.back": "Back to sign-in",
  "actions.done": "Done",
  "challenge.title": "Two-step verification",
  "challenge.lede": "Enter the 6-digit code from your authenticator app.",
  "challenge.code": "6-digit code",
  "challenge.useRecovery": "Use a recovery code",
  "challenge.useApp": "Use your authenticator app",
  "challenge.recoveryLede": "Enter one of the recovery codes you saved when you set up two-step verification. Each code works once.",
  "challenge.recovery": "Recovery code",
  "challenge.submit": "Verify",
  "enroll.title": "Set up two-step verification",
  "enroll.lede": "Your account needs two-step verification before you can sign in.",
  "enroll.step1": "1. Add this account to your authenticator app",
  "enroll.step1Hint": "In Google Authenticator, Microsoft Authenticator, 1Password or similar, choose to add an account and enter the setup key below — or open the setup link if the app is on this device.",
  "enroll.account": "Account",
  "enroll.secret": "Setup key",
  "enroll.uri": "Setup link",
  "enroll.openApp": "Open in authenticator app",
  "enroll.step2": "2. Enter the 6-digit code the app shows",
  "enroll.activate": "Turn on",
  "enroll.loading": "Preparing your setup key…",
  "codes.title": "Save your recovery codes",
  "codes.lede": "If you can't use your authenticator, each code signs you in once. They're shown only now — keep them somewhere safe, such as a password manager.",
  "codes.saved": "I've saved these recovery codes somewhere safe",
  "codes.fileHeader": "Hangyul Univ recovery codes ({{account}})",
  "codes.fileNote": "Each code can be used once.",
  "regen.lede": "Enter a current code from your authenticator app. Your old recovery codes will stop working.",
  "regen.submit": "Generate new codes",
  "err.invalid": "That code isn't right. Check the code in your app and try again.",
  "err.expired": "This sign-in step has timed out. Please sign in again.",
  "err.limited": "Too many attempts. Try again in {{seconds}} seconds.",
  "err.limitedSoon": "Too many attempts. Please wait a moment and try again.",
  "err.already": "Two-step verification is already on for this account.",
  "err.format": "Enter the 6 digits from your app.",
  "err.recoveryFormat": "Enter a recovery code.",
  "err.generic": "Something went wrong. Please try again."

};

export type SecT = (key: string, opts?: Record<string, unknown>) => string;

/** `t()` bound to `<NS>:v29.security`, with the English source as the fallback. */
export function useSecurityT() {
  const { t, locale } = useLocale([NS, 'common']);
  const tx = useCallback<SecT>(
    (key, opts) => t(`${NS}:v29.security.${key}`, { defaultValue: EN_DEFAULTS[key] ?? key, ...(opts ?? {}) }) as string,
    [t],
  );
  return { tx, t, locale };
}

/** One readable sentence for an MFA API error. */
export function mfaMessage(tx: SecT, err: unknown): string {
  const code = mfaErrorCode(err);
  if (code === 'MFA_CODE_INVALID') return tx('err.invalid');
  if (code === 'MFA_TOKEN_EXPIRED') return tx('err.expired');
  if (code === 'MFA_ALREADY_ENABLED') return tx('err.already');
  if (code === 'MFA_LIMITED' || (err as { status?: number })?.status === 429) {
    const s = Number(mfaErrorDetail(err)?.retry_after);
    return Number.isFinite(s) && s > 0 ? tx('err.limited', { seconds: Math.ceil(s) }) : tx('err.limitedSoon');
  }
  return (err as Error)?.message || tx('err.generic');
}

const mono: CSSProperties = { fontFamily: 'var(--hg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', letterSpacing: '0.04em' };
const well: CSSProperties = {
  background: 'var(--hg-bg-muted)', border: '1px solid var(--hg-border-subtle)', borderRadius: 'var(--hg-radius-md)', padding: '10px 12px',
  wordBreak: 'break-all',
};
const gap = (px: number) => ({ '--hg-gap': `${px}px` } as CSSProperties);

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure origins: a hidden textarea + execCommand.
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

export function CopyButton({ text, label, size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const { tx } = useSecurityT();
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return undefined; const id = setTimeout(() => setDone(false), 1800); return () => clearTimeout(id); }, [done]);
  return (
    <Button size={size} variant="secondary" icon={done ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      onClick={() => { void copyText(text).then(setDone); }}>
      <span aria-live="polite">{done ? tx('actions.copied') : label ?? tx('actions.copy')}</span>
    </Button>
  );
}

/** A 6-digit authenticator code field. */
export function TotpInput({ id, value, onChange, error, autoFocus }: { id: string; value: string; onChange: (v: string) => void; error?: string | null; autoFocus?: boolean }) {
  const { tx } = useSecurityT();
  return (
    <Field label={tx('challenge.code')} htmlFor={id} error={error ?? undefined}>
      <Input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus={autoFocus}
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} invalid={!!error}
        style={{ ...mono, fontSize: 'var(--hg-text-lg)', letterSpacing: '0.3em' }} />
    </Field>
  );
}

const groupSecret = (s: string) => s.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

/**
 * The recovery codes, shown once: copy, download as .txt, and an explicit "I saved them" before continuing.
 */
export function RecoveryCodes({ codes, account, onDone, doneLabel }: { codes: string[]; account?: string; onDone: () => void; doneLabel?: string }) {
  const { tx } = useSecurityT();
  const [saved, setSaved] = useState(false);
  const fileText = [tx('codes.fileHeader', { account: account ?? '' }), tx('codes.fileNote'), '', ...codes, ''].join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([fileText], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'hangyul-univ-recovery-codes.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="hg-stack" style={gap(14)}>
      <div className="hg-stack" style={gap(4)}>
        <h2 className="hg-title-sm hg-strong">{tx('codes.title')}</h2>
        <p className="hg-small hg-muted">{tx('codes.lede')}</p>
      </div>
      <ol aria-label={tx('codes.title')} style={{ ...well, ...mono, listStyle: 'none', margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px 16px' }}>
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <CopyButton text={codes.join('\n')} label={tx('actions.copyAll')} />
        <Button size="sm" variant="secondary" icon={<Download aria-hidden size={14} />} onClick={download}>{tx('actions.download')}</Button>
      </div>
      <Checkbox label={tx('codes.saved')} checked={saved} onChange={(e) => setSaved(e.target.checked)} />
      <Button variant="primary" size="lg" block disabled={!saved} onClick={onDone}>{doneLabel ?? tx('actions.continue')}</Button>
    </div>
  );
}

/**
 * Enrolment: setup key (+ setup link) → first code → recovery codes. With `enrollmentToken` it runs before a session
 * exists (sign-in), and `activate` sets the session the login was waiting for; without it, it uses the signed-in session.
 */
export function MfaEnroll({ enrollmentToken, onDone, onCancel, onExpired, intro }: {
  enrollmentToken?: string; onDone: () => void; onCancel?: () => void; onExpired?: (message: string) => void; intro?: ReactNode;
}) {
  const { tx } = useSecurityT();
  const { api } = useAuth();
  const [setup, setSetup] = useState<MfaEnrollment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  // One enrol call per mount (StrictMode re-runs effects; a second call would issue a different secret).
  const started = useRef<Promise<MfaEnrollment> | null>(null);

  useEffect(() => {
    if (!started.current) started.current = api.mfa.enroll(enrollmentToken);
    let alive = true;
    started.current.then(
      (s) => { if (alive) setSetup(s); },
      (e) => {
        if (!alive) return;
        if (mfaErrorCode(e) === 'MFA_TOKEN_EXPIRED' || (enrollmentToken && (e as { status?: number })?.status === 401)) { onExpired?.(tx('err.expired')); return; }
        setLoadError(mfaMessage(tx, e));
      },
    );
    return () => { alive = false; };
  }, [api, enrollmentToken, onExpired, tx]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError(tx('err.format')); return; }
    setError(null); setBusy(true);
    try {
      const res = await api.mfa.activate(code, enrollmentToken);
      setCodes(res.recovery_codes);
    } catch (err) {
      if (enrollmentToken && (mfaErrorCode(err) === 'MFA_TOKEN_EXPIRED' || (err as { status?: number })?.status === 401)) { onExpired?.(tx('err.expired')); return; }
      setError(mfaMessage(tx, err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (codes) return <RecoveryCodes codes={codes} account={setup?.account} onDone={onDone} doneLabel={enrollmentToken ? tx('actions.continue') : tx('actions.done')} />;

  return (
    <div className="hg-stack" style={gap(16)}>
      {intro}
      {loadError ? (
        <Callout tone="danger">{loadError}</Callout>
      ) : !setup ? (
        <div className="hg-stack" style={gap(8)} aria-busy="true">
          <span className="hg-small hg-muted">{tx('enroll.loading')}</span>
          <Skeleton w={240} h={12} /><Skeleton w={180} h={12} />
        </div>
      ) : (
        <>
          <div className="hg-stack" style={gap(8)}>
            <div className="hg-strong hg-small">{tx('enroll.step1')}</div>
            <p className="hg-xs hg-subtle">{tx('enroll.step1Hint')}</p>
            <div className="hg-xs hg-subtle">{tx('enroll.account')}: <span className="hg-medium" style={{ color: 'var(--hg-text)' }}>{setup.issuer ? `${setup.issuer} · ` : ''}{setup.account}</span></div>
            <div className="hg-xs hg-subtle">{tx('enroll.secret')}</div>
            <div className="hg-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ ...well, ...mono, fontSize: 'var(--hg-text-md)', flex: '1 1 220px' }}>{groupSecret(setup.secret)}</code>
              <CopyButton text={setup.secret.replace(/\s+/g, '')} />
            </div>
            <details>
              <summary className="hg-xs hg-subtle" style={{ cursor: 'pointer' }}>{tx('enroll.uri')}</summary>
              <div className="hg-stack" style={{ ...gap(8), marginTop: 8 }}>
                <code className="hg-xs" style={{ ...well, ...mono }}>{setup.otpauth_uri}</code>
                <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <CopyButton text={setup.otpauth_uri} />
                  <ButtonLink size="sm" href={setup.otpauth_uri} icon={<KeyRound aria-hidden size={14} />}>{tx('enroll.openApp')}</ButtonLink>
                </div>
              </div>
            </details>
          </div>
          <form onSubmit={submit} noValidate className="hg-stack" style={gap(12)}>
            <div className="hg-strong hg-small">{tx('enroll.step2')}</div>
            <TotpInput id="mfa-enroll-code" value={code} onChange={setCode} error={error} />
            <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Button type="submit" variant="primary" loading={busy} icon={<ShieldCheck aria-hidden size={16} />}>{tx('enroll.activate')}</Button>
              {onCancel && <Button variant="ghost" onClick={onCancel}>{enrollmentToken ? tx('actions.back') : tx('actions.cancel')}</Button>}
            </div>
          </form>
        </>
      )}
      {loadError && onCancel && <Button variant="ghost" onClick={onCancel}>{enrollmentToken ? tx('actions.back') : tx('actions.cancel')}</Button>}
    </div>
  );
}

/** Sign-in step two: a 6-digit code, or (switchable) one recovery code. `verify` sets the session on success. */
export function MfaChallenge({ mfaToken, expiresAt, methods, onDone, onExpired, onBack }: {
  mfaToken: string; expiresAt: number; methods: string[]; onDone: () => void; onExpired: (message: string) => void; onBack: () => void;
}) {
  const { tx } = useSecurityT();
  const { api } = useAuth();
  const [mode, setMode] = useState<'totp' | 'recovery'>(methods.includes('totp') || !methods.includes('recovery_code') ? 'totp' : 'recovery');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (Date.now() >= expiresAt) { onExpired(tx('err.expired')); return; }
    if (mode === 'totp' && code.length !== 6) { setError(tx('err.format')); return; }
    if (mode === 'recovery' && !recovery.trim()) { setError(tx('err.recoveryFormat')); return; }
    setError(null); setBusy(true);
    try {
      await api.mfa.verify(mfaToken, mode === 'totp' ? { code } : { recovery_code: recovery.trim() });
      onDone();
    } catch (err) {
      if (mfaErrorCode(err) === 'MFA_TOKEN_EXPIRED' || (err as { status?: number })?.status === 401) { onExpired(tx('err.expired')); return; }
      setError(mfaMessage(tx, err));
      if (mode === 'totp') setCode('');
    } finally {
      setBusy(false);
    }
  };

  const canSwitch = methods.includes('recovery_code') && methods.includes('totp');
  return (
    <form onSubmit={submit} noValidate className="hg-stack" style={gap(14)}>
      <p className="hg-small hg-muted">{mode === 'totp' ? tx('challenge.lede') : tx('challenge.recoveryLede')}</p>
      {mode === 'totp' ? (
        <TotpInput id="mfa-code" value={code} onChange={setCode} error={error} autoFocus />
      ) : (
        <Field label={tx('challenge.recovery')} htmlFor="mfa-recovery" error={error ?? undefined}>
          <Input id="mfa-recovery" name="recovery_code" autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus
            value={recovery} onChange={(e) => setRecovery(e.target.value)} invalid={!!error} style={mono} />
        </Field>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={busy}>{tx('challenge.submit')}</Button>
      <div className="hg-row hg-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        {canSwitch ? (
          <Button variant="link" size="sm" onClick={() => { setMode(mode === 'totp' ? 'recovery' : 'totp'); setError(null); }}>
            {mode === 'totp' ? tx('challenge.useRecovery') : tx('challenge.useApp')}
          </Button>
        ) : <span />}
        <Button variant="link" size="sm" onClick={onBack}>{tx('actions.back')}</Button>
      </div>
    </form>
  );
}

/** Regenerate recovery codes: asks for a current authenticator code, then shows the new codes once. */
function RegenerateCodes({ account, onClose }: { account?: string; onClose: () => void }) {
  const { tx } = useSecurityT();
  const { api } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  if (codes) return <RecoveryCodes codes={codes} account={account} onDone={onClose} doneLabel={tx('actions.done')} />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError(tx('err.format')); return; }
    setError(null); setBusy(true);
    try {
      setCodes((await api.mfa.regenerateRecoveryCodes(code)).recovery_codes);
    } catch (err) {
      setError(mfaMessage(tx, err)); setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="hg-stack" style={gap(12)}>
      <p className="hg-small hg-muted">{tx('regen.lede')}</p>
      <TotpInput id="mfa-regen-code" value={code} onChange={setCode} error={error} autoFocus />
      <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button type="submit" variant="primary" loading={busy}>{tx('regen.submit')}</Button>
        <Button variant="ghost" onClick={onClose}>{tx('actions.cancel')}</Button>
      </div>
    </form>
  );
}

/**
 * Settings → Two-step verification: status, set up, regenerate recovery codes. There is deliberately no "turn off":
 * a reset is done by a Hangyul super admin. Renders body content only — each console wraps it in its own card/section.
 */
export function TwoStepPanel() {
  const { tx, t, locale } = useSecurityT();
  const { api, session } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'enroll' | 'regen'>('idle');
  const q = useQuery({ queryKey: ['mfa', 'status'], queryFn: () => api.mfa.status(), staleTime: 30_000 });
  const close = () => { setMode('idle'); void qc.invalidateQueries({ queryKey: ['mfa', 'status'] }); };

  if (q.isLoading) return <div className="hg-stack" style={gap(8)} aria-busy="true"><Skeleton w={200} h={12} /><Skeleton w={140} h={12} /></div>;
  if (q.isError || !q.data) return <Callout tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>{t('common:actions.retry')}</Button>}>{tx('status.loadFailed')}</Callout>;
  const s = q.data;
  if (!s.eligible) return <p className="hg-small hg-muted">{tx('status.notEligible')}</p>;
  if (mode === 'enroll') return <MfaEnroll onDone={close} onCancel={close} />;
  if (mode === 'regen') return <RegenerateCodes account={session?.user.email} onClose={close} />;

  let since: string | null = null;
  if (s.enabled_at) {
    try { since = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(s.enabled_at)); } catch { since = s.enabled_at.slice(0, 10); }
  }
  return (
    <div className="hg-stack" style={gap(12)}>
      <p className="hg-small hg-muted">{tx('sub')}</p>
      <div className="hg-row hg-between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="hg-small">{tx('status.label')}</span>
        {s.enrolled ? <StatusText tone="success">{since ? tx('status.since', { date: since }) : tx('status.on')}</StatusText> : <StatusText tone="neutral">{tx('status.off')}</StatusText>}
      </div>
      {s.enrolled && (
        <div className="hg-row hg-between" style={{ gap: 8 }}>
          <span className="hg-small">{tx('status.codesLeft')}</span>
          <StatusText tone={s.recovery_codes_remaining <= 2 ? 'warning' : 'neutral'}>{s.recovery_codes_remaining}</StatusText>
        </div>
      )}
      {!s.enrolled && s.required && <Callout tone="warning">{tx('status.requiredOff')}</Callout>}
      {s.enrolled && s.required && <p className="hg-xs hg-subtle">{tx('status.required')}</p>}
      <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {s.enrolled
          ? <Button size="sm" variant="secondary" icon={<KeyRound aria-hidden size={14} />} onClick={() => setMode('regen')}>{tx('actions.regenerate')}</Button>
          : <Button size="sm" variant="primary" icon={<ShieldCheck aria-hidden size={14} />} onClick={() => setMode('enroll')}>{tx('actions.setUp')}</Button>}
      </div>
      {s.enrolled && <p className="hg-xs hg-subtle">{tx('status.resetNote')}</p>}
    </div>
  );
}
