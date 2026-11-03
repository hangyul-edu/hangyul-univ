/**
 * Where Toss sends the student back (V16, REPORT §136).
 *
 * Two routes, one component, because they are two outcomes of one moment rather than two screens:
 *
 *   /services/payment/success   ?paymentKey&orderId&amount   → confirm with the server, then say what now
 *   /services/payment/fail      ?code&message&orderId        → say what happened, offer one way forward
 *
 * **The browser does not decide anything here.** The success URL is a URL: anyone can type it. What this
 * component does with it is hand `paymentKey`, `orderId` and `amount` to the server, which checks the order
 * is the caller's, compares the amount with the figure it stored *before* the window opened, and only then
 * asks Toss to approve. The plan switches on in that request or it does not switch on at all.
 *
 * **It is safe to arrive twice.** A refresh, the back button, a second tab and a double-submitted request
 * all reach the same server endpoint, which returns the already-paid order rather than paying again (and
 * Toss itself is given an order-derived idempotency key). The one thing this file has to get right is not
 * firing the request twice from one mount — React 18's double-invoked effects in development make that a
 * real hazard rather than a theoretical one — hence the ref guard.
 */
import { useApi } from '@hangyul/auth';
import { ArrowRight, CircleAlert, CircleCheck } from '@hangyul/icons';
import type { PaymentResult } from '@hangyul/types';
import { Button, ButtonLink, FullPageLoader } from '@hangyul/ui';
import { formatMoney } from '@hangyul/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { appReturn, clearAppReturn } from '../lib/apphandoff';
import { tr, useT } from '../lib/i18n';
import { CANCEL_CODES, failureKey } from '../lib/toss';

const INVALIDATE = ['services', 'dashboard', 'conversations', 'notifications', 'tasks', 'applications', 'plan'];

export function PaymentSuccess() {
  const { t, locale } = useT();
  const api = useApi();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const ran = useRef(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const paymentKey = sp.get('paymentKey');
  const orderId = sp.get('orderId');
  const amount = Number(sp.get('amount'));

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!paymentKey || !orderId || !Number.isFinite(amount)) {
      setError({ code: 'MISSING', message: t('v16.pay.fail.default') });
      return;
    }
    api.me.confirmToss({ payment_key: paymentKey, order_id: orderId, amount })
      .then((r) => { setResult(r); INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); })
      .catch((e: Error & { body?: { detail?: { code?: string; message?: string } } }) => {
        const d = e.body?.detail;
        setError({ code: d?.code ?? 'UNKNOWN', message: d?.message ?? e.message });
      });
  }, [api, qc, t, paymentKey, orderId, amount]);

  if (error) return <Failed code={error.code} message={error.message} />;
  if (!result) return <FullPageLoader />;

  const name = tr(t, `services.${result.product_code}.name`, result.product_name);
  const back = appReturn();
  return (
    <div className="st-page sv16-return">
      <div className="sv16-return__mark" aria-hidden><CircleCheck /></div>
      <h1 className="hg-title-lg">{t('v16.pay.success.title')}</h1>
      {/* The plan by name, not "your purchase". A student who has just paid ₩499,000 should see the words
          they chose on the homepage, not a generic confirmation. */}
      <p className="sv16-return__lede">{t('v16.pay.success.text', { name })}</p>
      <dl className="sv16-return__facts">
        <div><dt>{t('v16.pay.amount')}</dt><dd className="hg-num">{formatMoney(result.amount_minor, result.currency, locale, { minor: true, gap: true })}</dd></div>
        <div><dt>{t('v16.pay.method')}</dt><dd>{result.method ?? t('v16.pay.methodCard')}</dd></div>
        <div><dt>{t('v16.pay.orderNo')}</dt><dd className="hg-num sv16-return__ref">{`HG-${result.order_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`}</dd></div>
      </dl>
      {/* **One** action, and it goes to the work rather than to a dashboard. "What happens next" is a
          question with an answer in this product: the student's next unresolved task.

          V17: unless the student came from the native app, in which case the one action is going back to
          it. The link is offered rather than followed — a confirmation page that navigates itself to a
          custom scheme is blocked by most browsers, and in the rest it looks like a hijack. */}
      {back ? (
        <ButtonLink as="a" href={back} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}
          onClick={() => clearAppReturn()}>
          {t('v17.pay.backToApp')}
        </ButtonLink>
      ) : (
        <ButtonLink as={Link} to="/" variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>
          {t('v16.pay.success.cta')}
        </ButtonLink>
      )}
      {result.assignment && <p className="hg-small hg-muted">{t('services.success.assigned', { agency: result.assignment.organization })}</p>}
      {result.receipt_url && (
        <a className="hg-link hg-xs" href={result.receipt_url} target="_blank" rel="noopener noreferrer">{t('v16.pay.receipt')}</a>
      )}
    </div>
  );
}

/**
 * Failure, and the one case that is not a failure.
 *
 * Toss reports "the buyer closed the window" through the same fail URL as "the card was declined". They are
 * not the same event and must not look the same: a cancellation goes quietly back to the plan screen with
 * the plan still chosen (brief Part 15), and only a real refusal gets a message.
 */
export function PaymentFail() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const code = sp.get('code');
  const cancelled = !code || CANCEL_CODES.has(code);
  const api = useApi();
  const orderId = sp.get('orderId');
  const released = useRef(false);

  useEffect(() => {
    // The order was created before the window opened; if the student backed out it should not stay PENDING
    // and be picked up by the recovery sweep. Best effort — the sweep is correct either way.
    if (!orderId || released.current) return;
    released.current = true;
    api.me.cancelOrder(orderId).catch(() => undefined);
  }, [api, orderId]);

  useEffect(() => {
    if (cancelled) nav('/services?payment=cancelled', { replace: true });
  }, [cancelled, nav]);

  if (cancelled) return <FullPageLoader />;
  return <Failed code={code!} message={sp.get('message') ?? ''} />;
}

function Failed({ code, message }: { code: string; message: string }) {
  const { t } = useT();
  const nav = useNavigate();
  return (
    <div className="st-page sv16-return" data-failed="">
      <div className="sv16-return__mark" aria-hidden><CircleAlert /></div>
      <h1 className="hg-title-lg">{t('v16.pay.fail.title')}</h1>
      {/* The provider's own sentence where there is a translated one, and its raw message only as a last
          resort. A student cannot act on `REJECT_CARD_COMPANY`; they can act on "your card issuer declined
          this payment — try another card". */}
      <p className="sv16-return__lede">{t(failureKey(code), { defaultValue: message || t('v16.pay.fail.default') })}</p>
      <Button variant="primary" size="lg" onClick={() => nav('/services')}>{t('v16.pay.retry')}</Button>
      <p className="hg-subtle hg-xs">{t('v16.pay.notCharged')}</p>
    </div>
  );
}

export default PaymentSuccess;
