/**
 * **Paying for one thing, once.**
 *
 *   order summary → payment method (a saved one, or add one) → "Pay $349" → done
 *
 * The student never types a card here. Adding a method leaves for the payment provider's own secure page
 * and comes back; the method is then saved, and the student confirms the one-time amount on the return
 * screen (`pages/PaymentReturn.tsx`), which renders this same component for the same order.
 *
 * What this component may and may not do:
 *
 *   * it shows the **server's** amount and echoes it back when paying — the server compares it with the
 *     order and refuses a mismatch; the figure charged is never taken from here;
 *   * it says **one-time payment** next to the button, with the service, the amount, the selected method and
 *     the refund terms in view, because pressing the button is the student's consent to that one charge;
 *   * it never shows a payment-provider term. "Payment method", "card", "one-time payment" — nothing else.
 *
 * Design Preview: no order is created, no provider page opens and no charge is made. The same screen is
 * shown from sample data and the outcome panels can be previewed locally.
 */
import { useApi } from '@hangyul/auth';
import { Check, CreditCard, Globe, Lock, Plus, Wallet } from '@hangyul/icons';
import type { PaymentMethodKind, PaymentResult, StudentPaymentMethod } from '@hangyul/types';
import { Button, Callout, designPreviewVariant } from '@hangyul/ui';
import { formatMoney } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { failureCode, failureKey, KIND_LABEL, openPaymentMethodRegistration } from '../lib/billing';
import { useT } from '../lib/i18n';
import '../styles/payments.css';

const MARKETING_URL = (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3100' : '');

export interface CheckoutOrder { order_id: string; amount_minor: number; currency: string }

const KIND_ICON: Record<PaymentMethodKind, ReactNode> = {
  DOMESTIC_CARD: <CreditCard aria-hidden />,
  FOREIGN_CARD: <Globe aria-hidden />,
  TOSS_PAY: <Wallet aria-hidden />,
  NAVER_PAY: <Wallet aria-hidden />,
};

/** "Visa •••• 4242", or the wallet's name. Built from what the provider reported — nothing inferred. */
export function methodLabel(m: StudentPaymentMethod, t: (k: string) => string): string {
  if (m.masked_number) return [m.brand, m.masked_number].filter(Boolean).join(' ');
  return m.brand ?? t(KIND_LABEL[m.kind]);
}

export function PaymentCheckout({ serviceName, amountMinor, currency, order: initialOrder, createOrder, onPaid, heading, embedded }: {
  /** What is being bought, in the student's language. */
  serviceName: string;
  /** The server's price, for display before an order exists. */
  amountMinor: number;
  currency: string;
  /** An order that already exists (an approved add-on, or the return from adding a method). */
  order?: CheckoutOrder | null;
  /** Creates the order when the student commits (plan purchase). The server prices it. */
  createOrder?: () => Promise<CheckoutOrder>;
  onPaid: (r: PaymentResult) => void;
  heading?: ReactNode;
  /** Inside an order block that already states the service and the amount: no second heading or summary. */
  embedded?: boolean;
}) {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const uid = useId();
  const preview = designPreviewVariant() !== null;

  const [order, setOrder] = useState<CheckoutOrder | null>(initialOrder ?? null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<'pay' | 'add' | 'confirming' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  const amount = order?.amount_minor ?? amountMinor;
  const cur = order?.currency ?? currency;
  const money = formatMoney(amount, cur, locale, { minor: true, gap: true, symbolOnly: true });

  const options = useQuery({
    queryKey: ['payment-options', order?.order_id ?? `cur:${cur}`],
    queryFn: () => api.me.paymentOptions({ orderId: order?.order_id, currency: cur }),
    staleTime: 30_000,
  });
  const saved = (options.data?.saved ?? []).filter((m) => m.usable);
  const kinds = (options.data?.methods ?? []).filter((m) => m.available).map((m) => m.kind);
  const chosen = saved.find((m) => m.id === methodId) ?? saved.find((m) => m.is_default) ?? saved[0] ?? null;
  const canAdd = kinds.length > 0;
  // Nothing saved yet: the first thing to do is add a method, so the choices are simply open.
  const showAdd = canAdd && (adding || saved.length === 0);

  useEffect(() => () => { polling.current = false; }, []);

  const ensureOrder = async (): Promise<CheckoutOrder> => {
    if (order) return order;
    if (!createOrder) throw new Error('no_order');
    const o = await createOrder();
    setOrder(o);
    return o;
  };

  const fail = (e: unknown) => {
    const code = failureCode(e);
    setError(t(failureKey(code)));
    if (code === 'PAYMENT_METHOD_REQUIRED') setAdding(true);
    void options.refetch();
  };

  /** A charge whose outcome the server is still confirming: ask until it is known, never charge again. */
  const waitForOutcome = async (orderId: string) => {
    polling.current = true;
    setBusy('confirming');
    for (let i = 0; i < 30 && polling.current; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const r = await api.me.order(orderId);
        if (r.status === 'PAID') { polling.current = false; setBusy(null); onPaid(r); return; }
        if (r.payment_state !== 'CHARGING') { polling.current = false; setBusy(null); setError(t('billing.fail.default')); return; }
      } catch { /* keep asking */ }
    }
    polling.current = false;
    setBusy(null);
    setError(t('billing.confirmLater'));
  };

  const pay = async () => {
    if (busy || !chosen) return;
    if (preview) { setError(t('billing.fail.DESIGN_PREVIEW')); return; }
    setBusy('pay');
    setError(null);
    try {
      const o = await ensureOrder();
      const r = await api.me.payOrder(o.order_id, {
        payment_method_id: chosen.id, amount_minor: o.amount_minor, currency: o.currency, one_time_confirmed: true,
      });
      if (r.status === 'PAID') { onPaid(r); return; }
      if (r.code === 'PAYMENT_PENDING_CONFIRMATION' || r.payment_state === 'CHARGING') { await waitForOutcome(o.order_id); return; }
      setError(t('billing.fail.default'));
    } catch (e) {
      if (failureCode(e) === 'PAYMENT_IN_PROGRESS' && order) { await waitForOutcome(order.order_id); return; }
      fail(e);
    } finally {
      setBusy((b) => (b === 'pay' ? null : b));
    }
  };

  const add = async (kind: PaymentMethodKind) => {
    if (busy) return;
    if (preview) { setError(t('billing.fail.DESIGN_PREVIEW')); return; }
    setBusy('add');
    setError(null);
    try {
      const o = await ensureOrder();
      const reg = await api.me.startPaymentMethod(kind, o.order_id);
      qc.removeQueries({ queryKey: ['payment-options'] });
      await openPaymentMethodRegistration(reg); // the browser leaves for the provider's secure page
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  };

  return (
    <section className="pay" aria-labelledby={`${uid}-h`}>
      {embedded
        ? <h3 className="hg-sr-only" id={`${uid}-h`}>{t('billing.title')}</h3>
        : (
          <>
            <h2 className="hg-title-sm" id={`${uid}-h`}>{heading ?? t('billing.title')}</h2>
            <div className="pay__summary">
              <div>
                <p className="pay__service">{serviceName}</p>
                <p className="pay__once"><Check aria-hidden />{t('billing.oneTime')}</p>
              </div>
              <strong className="pay__amount hg-num">{money}</strong>
            </div>
          </>
        )}

      <div className="pay__methods" role="radiogroup" aria-labelledby={`${uid}-m`}>
        <h3 className="pay__label" id={`${uid}-m`}>{t('billing.method')}</h3>
        {options.isLoading && <div className="pay__skeleton" aria-hidden />}
        {saved.map((m) => {
          const on = chosen?.id === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} className="pay__method" data-on={on || undefined}
              onClick={() => { setMethodId(m.id); setAdding(false); setError(null); }}>
              <span className="pay__radio" aria-hidden />
              <span className="pay__icon">{KIND_ICON[m.kind]}</span>
              <span className="pay__name">
                <span className="hg-num">{methodLabel(m, t)}</span>
                <span className="hg-subtle hg-xs">{t(KIND_LABEL[m.kind])}</span>
              </span>
              {m.is_default && <span className="pay__tag">{t('billing.default')}</span>}
            </button>
          );
        })}
        {canAdd && saved.length > 0 && !adding && (
          <button type="button" className="pay__addtoggle" onClick={() => setAdding(true)}>
            <Plus aria-hidden />{t('billing.addAnother')}
          </button>
        )}
        {showAdd && (
          <div className="pay__add">
            <p className="hg-small pay__addlede">{t(saved.length ? 'billing.addChoose' : 'billing.addFirst')}</p>
            <div className="pay__kinds">
              {kinds.map((k) => (
                <button key={k} type="button" className="pay__kind" disabled={busy !== null} onClick={() => add(k)}>
                  <span className="pay__icon">{KIND_ICON[k]}</span>
                  <span>{t(KIND_LABEL[k])}</span>
                </button>
              ))}
            </div>
            <p className="hg-subtle hg-xs pay__secure"><Lock aria-hidden />{t('billing.secure')}</p>
          </div>
        )}
        {!options.isLoading && !canAdd && saved.length === 0 && (
          <Callout tone="info">{t('billing.unavailable')}</Callout>
        )}
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {busy === 'confirming' && <Callout tone="info">{t('billing.confirming')}</Callout>}

      {/* The consent, where the decision is made: what, how much, that it is charged once, and the terms. */}
      <p className="pay__consent hg-small">
        {t('billing.consent', { service: serviceName, amount: money })}{' '}
        <a href={`${MARKETING_URL}/terms?lang=${locale}#refunds`} target="_blank" rel="noreferrer" className="hg-link">{t('billing.refundTerms')}</a>
      </p>
      <Button variant="primary" size="lg" className="pay__cta" loading={busy === 'pay' || busy === 'confirming'}
        disabled={!chosen || busy !== null} onClick={pay}>
        {t('billing.payCta', { amount: money })}
      </Button>
      {saved.length > 0 && <p className="hg-subtle hg-xs pay__after">{t('billing.afterPay')}</p>}
    </section>
  );
}
