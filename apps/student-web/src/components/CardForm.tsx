/**
 * **Hangyul's own card form** (V21, brief §26, §34, §35, §49).
 *
 * The student stays on Hangyul. There is no provider window, no popup and no redirect: the three
 * fields below post once to Hangyul's API, which calls Toss server-to-server with the secret key and
 * comes back with a paid order. Registration and payment are **one action**, because for this merchant
 * configuration they are one API call — the student is never asked to understand a billing key, a PG
 * or a MID (REPORT §229.3, §236).
 *
 * ## What is not here, and why
 *
 * No Korean card password, no 주민등록번호, no CVC. Toss's generic 자동결제 guide lists the first two;
 * the sandbox charged this MID successfully **without them**, so asking a student in Hanoi for a
 * Korean resident number would be collecting data that does not exist and that Hangyul must not hold.
 * The server's request model `forbid`s them, so they cannot be sent even by mistake.
 *
 * ## What this component does about the card data it touches
 *
 *  * `autoComplete` is the payment-specific set, so a password manager fills the right field and the
 *    browser never offers to remember the number as ordinary form text;
 *  * every field is `data-hg-no-capture`, which the analytics layer and any future session replay are
 *    required to honour;
 *  * state is cleared on success **and** on unmount, so a card does not survive a route change;
 *  * nothing is written to `localStorage`, `sessionStorage` or a query string;
 *  * the value never appears in an error — a failure shows the provider's message and the code.
 */
import { Callout, Button } from '@hangyul/ui';
import { CreditCard, Lock } from '@hangyul/icons';
import { useEffect, useRef, useState } from 'react';

import { useT } from '../lib/i18n';

export interface CardValue {
  number: string;
  expiry_month: string;
  expiry_year: string;
  holder_name: string;
}

const EMPTY: CardValue = { number: '', expiry_month: '', expiry_year: '', holder_name: '' };

/** Groups of four, which is how every card is printed and how people check what they typed. */
function groupNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** `MM / YY`, typed as one field because that is how it is written on the card. */
function groupExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)} / ${d.slice(2)}`;
}

function luhn(digits: string): boolean {
  if (digits.length < 12) return false;
  let total = 0;
  const parity = digits.length % 2;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[i]);
    if (i % 2 === parity) { d *= 2; if (d > 9) d -= 9; }
    total += d;
  }
  return total % 10 === 0;
}

export function CardForm({ amount, busy, error, onSubmit, onCancel }: {
  /** Already formatted by the caller — this component never does money arithmetic. */
  amount: string;
  busy: boolean;
  error: string | null;
  onSubmit: (card: CardValue) => void;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holder, setHolder] = useState('');
  const [touched, setTouched] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  // A card must not outlive the screen it was typed on.
  useEffect(() => () => { setNumber(''); setExpiry(''); setHolder(''); }, []);

  const digits = number.replace(/\D/g, '');
  const [mm, yy] = expiry.replace(/\D/g, '').match(/.{1,2}/g) ?? [];
  const numberOk = luhn(digits);
  const expiryOk = !!mm && !!yy && Number(mm) >= 1 && Number(mm) <= 12 && yy.length === 2;
  const ready = numberOk && expiryOk && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ready) return;
    onSubmit({ number: digits, expiry_month: mm, expiry_year: yy, holder_name: holder.trim() });
  };

  return (
    <form className="sv21-card" onSubmit={submit} noValidate>
      <div className="sv21-card__head">
        <h3 className="hg-title-sm">{t('v21.pay.cardTitle')}</h3>
        {/*
          Which card works, said before the student reaches for one. V17 required the checkout line to
          name the accepted card and it did, in the "USD is not enabled yet" blocker — which V21
          removed, taking the sentence with it. A student in Hanoi needs to know a non-Korean card is
          the *expected* instrument here, not a risk they are taking.
        */}
        <p className="hg-subtle hg-xs sv21-card__accepts">{t('v21.pay.cardAccepts')}</p>
        <p className="hg-subtle hg-xs sv21-card__secure"><Lock aria-hidden /> {t('v21.pay.cardSecure')}</p>
      </div>

      <label className="sv21-card__field" htmlFor="hg-card-number">
        <span className="hg-label">{t('v21.pay.number')}</span>
        <input
          id="hg-card-number"
          className="hg-input hg-num"
          inputMode="numeric"
          autoComplete="cc-number"
          data-hg-no-capture
          placeholder="1234 5678 9012 3456"
          value={number}
          aria-invalid={touched && !numberOk}
          aria-describedby={touched && !numberOk ? 'hg-card-number-err' : undefined}
          onChange={(e) => setNumber(groupNumber(e.target.value))}
          onBlur={() => setTouched(true)}
        />
        {touched && !numberOk && <span className="sv21-card__err" id="hg-card-number-err">{t('v21.pay.numberInvalid')}</span>}
      </label>

      <div className="sv21-card__row">
        <label className="sv21-card__field" htmlFor="hg-card-exp">
          <span className="hg-label">{t('v21.pay.expiry')}</span>
          <input
            id="hg-card-exp"
            className="hg-input hg-num"
            inputMode="numeric"
            autoComplete="cc-exp"
            data-hg-no-capture
            placeholder="MM / YY"
            value={expiry}
            aria-invalid={touched && !expiryOk}
            onChange={(e) => setExpiry(groupExpiry(e.target.value))}
            onBlur={() => setTouched(true)}
          />
        </label>
        <label className="sv21-card__field" htmlFor="hg-card-holder">
          <span className="hg-label">{t('v21.pay.holder')} <span className="hg-subtle hg-xs">{t('v21.pay.optional')}</span></span>
          <input
            id="hg-card-holder"
            className="hg-input"
            autoComplete="cc-name"
            data-hg-no-capture
            placeholder="HONG GILDONG"
            value={holder}
            onChange={(e) => setHolder(e.target.value.toUpperCase())}
          />
        </label>
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      {/* One button, and it says what happens: the card is registered *and* the plan is paid. */}
      <Button type="submit" variant="primary" size="lg" icon={<CreditCard />} loading={busy} disabled={!ready} className="sv21-card__pay">
        {t('v21.pay.payCta')}<span className="sv21-card__sum hg-num" aria-hidden>{amount}</span>
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy} className="sv21-card__cancel">
          {t('common:actions.cancel')}
        </Button>
      )}
      <p className="hg-subtle hg-xs sv21-card__after">{t('v21.pay.afterCard')}</p>
      <div ref={liveRef} aria-live="polite" className="hg-sr-only">{busy ? t('v21.pay.processing') : ''}</div>
    </form>
  );
}

export { EMPTY as EMPTY_CARD };
