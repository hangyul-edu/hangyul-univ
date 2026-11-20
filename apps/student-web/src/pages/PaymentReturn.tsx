/**
 * Where the student lands after the payment provider's secure page.
 *
 *   /services/payment-methods/return?registration=…&result=success&authKey=…&customerKey=…
 *   /services/payment-methods/return?registration=…&result=fail&code=…
 *
 * **Coming back is not paying.** A successful return means a payment method can be saved — the server
 * issues and seals the credential — and nothing else. If the student was in the middle of buying something,
 * this screen then shows the one-time amount and the method, and waits for them to press pay. If they were
 * only adding a method, it sends them back to where methods are managed.
 *
 * **The browser decides nothing here.** The URL is a URL; anyone can type one. What it carries is handed to
 * the server, which checks that the registration is the caller's and still open, and that the customer key
 * is theirs, before it asks the provider for anything.
 *
 * **It is safe to arrive twice.** A reload completes nothing a second time (the server answers with the
 * method already saved), and the one-time parameters are removed from the address bar as soon as they are
 * read so they are not left in history. React's double-invoked effects are guarded by a ref.
 */
import { useApi } from '@hangyul/auth';
import { ArrowRight, CircleAlert, CircleCheck } from '@hangyul/icons';
import type { PaymentResult } from '@hangyul/types';
import { Button, ButtonLink, FullPageLoader } from '@hangyul/ui';
import { formatMoney } from '@hangyul/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { PaymentCheckout } from '../components/PaymentCheckout';
import { appReturn, clearAppReturn, clearPurchaseReturn, purchaseReturnTarget } from '../lib/apphandoff';
import { failureCode, failureKey, WINDOW_CLOSED } from '../lib/billing';
import { tr, useT } from '../lib/i18n';

/** Everything that changes the moment an order is paid. */
const INVALIDATE = ['services', 'dashboard', 'conversations', 'notifications', 'tasks', 'applications', 'plan', 'profile', 'payment-options'];

type Phase =
  | { at: 'working' }
  | { at: 'confirm'; orderId: string }
  | { at: 'paid'; result: PaymentResult }
  | { at: 'failed'; code: string | null };

export default function PaymentReturn() {
  const api = useApi();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const ran = useRef(false);
  const [phase, setPhase] = useState<Phase>({ at: 'working' });

  // Read once, at mount: the address bar is cleaned immediately afterwards.
  const [params] = useState(() => ({
    registration: sp.get('registration'), result: sp.get('result'),
    authKey: sp.get('authKey'), customerKey: sp.get('customerKey'), code: sp.get('code'),
  }));

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const { registration, result, authKey, customerKey, code } = params;
    // The one-time authorisation does not stay in the URL, the history entry or a copied link.
    window.history.replaceState(null, '', registration ? `/services/payment-methods/return?registration=${registration}` : '/services');
    if (!registration) { nav('/services', { replace: true }); return; }

    if (result === 'success' && authKey && customerKey) {
      api.me.completePaymentMethod(registration, { auth_key: authKey, customer_key: customerKey })
        .then((r) => {
          void qc.invalidateQueries({ queryKey: ['payment-options'] });
          if (r.order_id) setPhase({ at: 'confirm', orderId: r.order_id });
          else nav('/services?method=added#payment-methods', { replace: true });
        })
        .catch((e) => setPhase({ at: 'failed', code: failureCode(e) }));
      return;
    }
    // The student closed the page, or the provider reported a failure. Either way nothing was saved or
    // charged; the server is told so the registration is closed rather than left open.
    api.me.failPaymentMethod(registration, code)
      .then((r) => {
        // The order was created so the method could be attached to it; a fresh attempt makes a fresh one.
        if (r.order_id) api.me.cancelOrder(r.order_id).catch(() => undefined);
        if (!code || WINDOW_CLOSED.has(code) || r.code === 'AUTH_CANCELLED') nav('/services?payment=cancelled', { replace: true });
        else setPhase({ at: 'failed', code: r.code });
      })
      .catch((e) => setPhase({ at: 'failed', code: failureCode(e) ?? 'AUTH_FAILED' }));
  }, [api, nav, params, qc]);

  if (phase.at === 'working') return <FullPageLoader />;
  if (phase.at === 'failed') return <Failed code={phase.code} />;
  if (phase.at === 'paid') return <Paid result={phase.result} />;
  return (
    <ConfirmOrder orderId={phase.orderId}
      onPaid={(result) => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setPhase({ at: 'paid', result }); }} />
  );
}

/** The method is saved. Now the student sees the one-time amount and decides. Nothing has been charged. */
function ConfirmOrder({ orderId, onPaid }: { orderId: string; onPaid: (r: PaymentResult) => void }) {
  const { t } = useT();
  const api = useApi();
  const q = useQuery({ queryKey: ['payment-options', orderId], queryFn: () => api.me.paymentOptions({ orderId }) });
  if (q.isLoading) return <FullPageLoader />;
  const order = q.data?.order;
  if (!order) return <Failed code={null} />;
  if (order.status === 'PAID') return <Paid result={order} />;
  const name = order.kind === 'ADD_ON' ? t('v29.services.history.addOn') : tr(t, `services.${order.product_code}.name`, order.product_name);
  return (
    <div className="st-page pay-return">
      <div className="pay-return__note" role="status">
        <CircleCheck aria-hidden />
        <div>
          <p className="hg-strong">{t('billing.return.savedTitle')}</p>
          <p className="hg-small hg-muted">{t('billing.return.savedText')}</p>
        </div>
      </div>
      <PaymentCheckout serviceName={name} amountMinor={order.amount_minor} currency={order.currency}
        order={{ order_id: order.order_id, amount_minor: order.amount_minor, currency: order.currency }}
        heading={t('billing.return.confirmTitle')} onPaid={onPaid} />
      <Link to="/services" className="hg-link hg-small pay-return__back">{t('billing.return.notNow')}</Link>
    </div>
  );
}

export function Paid({ result }: { result: PaymentResult }) {
  const { t, locale } = useT();
  const name = result.kind === 'ADD_ON' ? t('v29.services.history.addOn') : tr(t, `services.${result.product_code}.name`, result.product_name);
  const back = appReturn();
  const [next] = useState(() => purchaseReturnTarget());
  return (
    <div className="st-page sv16-return">
      <div className="sv16-return__mark" aria-hidden><CircleCheck /></div>
      <h1 className="hg-title-lg">{t('v16.pay.success.title')}</h1>
      {/* The plan by name, not "your purchase": the words they chose, not a generic confirmation. */}
      <p className="sv16-return__lede">{t(result.kind === 'ADD_ON' ? 'billing.return.paidAddOn' : 'v16.pay.success.text', { name })}</p>
      <dl className="sv16-return__facts">
        <div><dt>{t('v16.pay.amount')}</dt><dd className="hg-num">{formatMoney(result.amount_minor, result.currency, locale, { minor: true, gap: true })}</dd></div>
        <div><dt>{t('billing.return.type')}</dt><dd>{t('billing.oneTime')}</dd></div>
        <div><dt>{t('v16.pay.orderNo')}</dt><dd className="hg-num sv16-return__ref">{`HG-${result.order_id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}</dd></div>
      </dl>
      {/* One action, and it goes to the work. Unless the student came from the native app, in which case
          the one action is going back to it — offered, never followed automatically. */}
      {back ? (
        <ButtonLink as="a" href={back} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />} onClick={() => clearAppReturn()}>
          {t('v17.pay.backToApp')}
        </ButtonLink>
      ) : (
        // 261119: back to the page that sent them to the plan — `/match` for the marketing `유학 준비` path.
        <ButtonLink as={Link} to={next ?? '/'} replace variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />} onClick={() => clearPurchaseReturn()}
          data-purchase-return={next ?? undefined}>
          {next?.startsWith('/match') ? t('billing.return.toMatch') : t('v16.pay.success.cta')}
        </ButtonLink>
      )}
      {result.receipt_url && (
        <a className="hg-link hg-xs" href={result.receipt_url} target="_blank" rel="noopener noreferrer">{t('v16.pay.receipt')}</a>
      )}
    </div>
  );
}

function Failed({ code }: { code: string | null }) {
  const { t } = useT();
  const nav = useNavigate();
  return (
    <div className="st-page sv16-return" data-failed="">
      <div className="sv16-return__mark" aria-hidden><CircleAlert /></div>
      <h1 className="hg-title-lg">{t('billing.return.failedTitle')}</h1>
      <p className="sv16-return__lede">{t(failureKey(code))}</p>
      <Button variant="primary" size="lg" onClick={() => nav('/services')}>{t('billing.return.tryAgain')}</Button>
      <p className="hg-subtle hg-xs">{t('v16.pay.notCharged')}</p>
    </div>
  );
}
