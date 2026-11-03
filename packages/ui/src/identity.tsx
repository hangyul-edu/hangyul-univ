/**
 * V22 identity components (REPORT §244, brief §6, §11–§13): the pieces a trustworthy sign-up is made of.
 *
 *   PhoneInput       country (flag + calling code, searchable) + local number; the server owns E.164 normalisation.
 *   OtpInput         one six-digit field — a single `<input>` with `inputmode=numeric`, not six boxes, so paste,
 *                    autofill (`one-time-code`) and screen readers all work.
 *   PasswordInput    show/hide, paste allowed, password-manager compatible; compact strength hint, no rule checklist.
 *   ConsentList      granular consents from the server catalogue; `전체 동의` is a convenience controller only.
 *   TurnstileWidget  Cloudflare Turnstile; loads the script only when a site key is configured.
 *   StepRail         01 · 02 · 03 · 04 — done / current / upcoming.
 */
import { Check, ChevronDown, Eye, EyeOff, Search } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { ConsentCatalogueItem } from '@hangyul/types';
import { countryName, cx, dialCode, flagEmoji, phoneCountries } from '@hangyul/utils';
import { forwardRef, useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

// ---------------------------------------------------------------------------------------------- phone
export interface PhoneValue { country: string; local: string }

export function PhoneInput({ value, onChange, invalid, id, disabled, autoFocus }: {
  value: PhoneValue; onChange: (v: PhoneValue) => void; invalid?: boolean; id?: string; disabled?: boolean; autoFocus?: boolean;
}) {
  const { t, locale } = useLocale('common');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const uid = useId();
  const inputId = id ?? `${uid}-local`;
  const listId = `${uid}-list`;
  const wrap = useRef<HTMLDivElement>(null);
  const all = useMemo(() => phoneCountries((iso) => countryName(iso, locale)), [locale]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^\+/, '');
    if (!s) return all;
    return all.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase() === s || c.dial.startsWith(s) || countryName(c.code, 'en').toLowerCase().includes(s));
  }, [all, q]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const dial = dialCode(value.country) ?? '';
  return (
    <div className={cx('hg-phone', invalid && 'is-invalid')} ref={wrap}>
      <button type="button" className="hg-phone__country" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={t('auth.phoneCountry', { country: countryName(value.country, locale), dial })} onClick={() => setOpen((o) => !o)} disabled={disabled}>
        <span className="hg-phone__flag" aria-hidden>{flagEmoji(value.country)}</span>
        <span className="hg-phone__dial hg-num">+{dial}</span>
        <ChevronDown aria-hidden size={14} />
      </button>
      <input id={inputId} className="hg-input hg-phone__local" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={t('auth.phonePlaceholder')}
        value={value.local} onChange={(e) => onChange({ ...value, local: e.target.value })} aria-invalid={invalid || undefined} disabled={disabled} autoFocus={autoFocus} />
      {open && (
        <div className="hg-phone__menu hg-popover" role="dialog" aria-label={t('auth.phoneCountryPick')}>
          <div className="hg-phone__search hg-input-icon">
            <Search aria-hidden />
            <input className="hg-input hg-input--sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('auth.phoneSearch')} aria-label={t('auth.phoneSearch')} />
          </div>
          <ul id={listId} role="listbox" className="hg-phone__list" aria-label={t('auth.phoneCountryPick')}>
            {shown.slice(0, 260).map((c) => (
              <li key={c.code} role="option" aria-selected={c.code === value.country}>
                <button type="button" className={cx('hg-phone__opt', c.code === value.country && 'is-selected')} onClick={() => { onChange({ ...value, country: c.code }); setOpen(false); setQ(''); }}>
                  <span aria-hidden className="hg-phone__flag">{flagEmoji(c.code)}</span>
                  <span className="hg-grow hg-truncate">{c.name}</span>
                  <span className="hg-num hg-subtle">+{c.dial}</span>
                  {c.code === value.country && <Check aria-hidden size={14} />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="hg-subtle hg-small" style={{ padding: 10 }}>{t('form.noOptions')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- one-time code
export const OtpInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string; onChange: (v: string) => void; invalid?: boolean; length?: number;
}>(function OtpInput({ value, onChange, invalid, length = 6, className, ...rest }, ref) {
  return (
    <input ref={ref} className={cx('hg-input hg-otp hg-num', className)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={length}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))} aria-invalid={invalid || undefined} {...rest} />
  );
});

// ---------------------------------------------------------------------------------------------- password
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 14 && classes >= 3) return 3;
  if (pw.length >= 12 || (pw.length >= 10 && classes >= 2)) return 2;
  return 1;
}

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; strength?: boolean }>(
  function PasswordInput({ invalid, strength, className, value, ...rest }, ref) {
    const { t } = useLocale('common');
    const [show, setShow] = useState(false);
    const level = strength ? passwordStrength(String(value ?? '')) : 0;
    return (
      <div className="hg-pw">
        <div className="hg-pw__row">
          <input ref={ref} type={show ? 'text' : 'password'} className={cx('hg-input', className)} value={value} aria-invalid={invalid || undefined} spellCheck={false} {...rest} />
          <button type="button" className="hg-pw__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={show}>
            {show ? <EyeOff aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
          </button>
        </div>
        {strength && String(value ?? '').length > 0 && (
          <div className="hg-pw__meter" data-level={level} aria-live="polite">
            <span /><span /><span />
            <em>{t(`auth.strength.${level}`)}</em>
          </div>
        )}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------------------------- consents
export function ConsentList({ items, value, onChange, labels, errorKeys = [] }: {
  items: ConsentCatalogueItem[]; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void;
  /** Rendered label and (optional) summary per consent key — localised by the caller. */
  labels: Record<string, { label: ReactNode; summary?: ReactNode; href?: string }>;
  errorKeys?: string[];
}) {
  const { t } = useLocale('common');
  const all = items.every((i) => value[i.key]);
  const required = items.filter((i) => i.required);
  const optional = items.filter((i) => !i.required);
  const set = (k: string, v: boolean) => onChange({ ...value, [k]: v });
  const row = (i: ConsentCatalogueItem) => {
    const l = labels[i.key];
    const bad = errorKeys.includes(i.key);
    return (
      <li key={i.key} className={cx('hg-consent', bad && 'is-invalid')}>
        <label className="hg-check">
          <input type="checkbox" checked={!!value[i.key]} onChange={(e) => set(i.key, e.target.checked)} aria-invalid={bad || undefined} aria-describedby={l?.summary ? `${i.key}-sum` : undefined} />
          <span>
            <span className={cx('hg-consent__tag', i.required ? 'is-required' : 'is-optional')}>{i.required ? t('auth.consentRequired') : t('auth.consentOptional')}</span>
            {' '}{l?.label ?? i.key}
            {l?.href && <> · <a href={l.href} target="_blank" rel="noreferrer" className="hg-link">{t('auth.consentView')}</a></>}
          </span>
        </label>
        {l?.summary && <p id={`${i.key}-sum`} className="hg-consent__sum">{l.summary}</p>}
      </li>
    );
  };
  return (
    <div className="hg-consents">
      <label className="hg-check hg-consents__all">
        <input type="checkbox" checked={all} onChange={(e) => onChange(Object.fromEntries(items.map((i) => [i.key, e.target.checked])))} />
        <span className="hg-strong">{t('auth.consentAll')}</span>
      </label>
      <ul className="hg-consents__list">{required.map(row)}{optional.map(row)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Turnstile
declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void } }
}
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function TurnstileWidget({ siteKey, onToken, onExpire, locale, nonce }: { siteKey: string; onToken: (t: string) => void; onExpire?: () => void; locale?: string; nonce?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widget.current) window.turnstile.remove(widget.current);
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey, language: locale ?? 'auto', theme: 'light', appearance: 'always',
        callback: (token: string) => onToken(token), 'expired-callback': () => onExpire?.(), 'error-callback': () => onExpire?.(),
      });
    };
    if (window.turnstile) render();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SRC}"]`);
      if (!s) { s = document.createElement('script'); s.src = TURNSTILE_SRC; s.async = true; s.defer = true; document.head.appendChild(s); }
      s.addEventListener('load', render, { once: true });
    }
    return () => { cancelled = true; if (widget.current && window.turnstile) { window.turnstile.remove(widget.current); widget.current = null; } };
  }, [siteKey, locale, nonce, onToken, onExpire]);
  return <div ref={ref} className="hg-turnstile" />;
}

// ---------------------------------------------------------------------------------------------- steps
export function StepRail({ steps, current }: { steps: { key: string; label: ReactNode }[]; current: number }) {
  const { t } = useLocale('common');
  return (
    <ol className="hg-steps" aria-label={t('auth.stepsLabel')}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s.key} className="hg-steps__item" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="hg-steps__num hg-num" aria-hidden>{state === 'done' ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span>
            <span className="hg-steps__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
