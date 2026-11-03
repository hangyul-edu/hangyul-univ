/**
 * Opening the Toss payment window (V16, REPORT §135–136).
 *
 * This module is the *only* place in the student app that touches a payment SDK, and it is deliberately
 * thin: it loads the script, calls `requestPayment`, and gets out of the way. Everything that decides
 * anything — the amount, whether the payment succeeded, whether the plan switches on — is on the server.
 *
 * **Which SDK, and why this one.** Toss issues one client key per MID per product and the key's prefix is
 * the product: `test_gck_…` drives the current order-form / payment-window product through `widgets()`,
 * while `test_ck_…` is the "API 개별 연동" family — 결제창(구버전), 브랜드페이, 자동결제 — and drives
 * `payment()`. Hangyul's one-time merchant configuration (MID `HANGYUL`) issues a `ck` key, so the correct
 * call for it is `TossPayments(key).payment({ customerKey }).requestPayment({ method: 'CARD', … })` on the
 * **v2** SDK (`js.tosspayments.com/v2/standard`). That is a current v2 integration of an older product,
 * not a v1 integration: mixing the two SDKs is an error Toss raises by name.
 *
 * None of those strings are hard-coded here. The SDK URL, the client key, the order id, the amount and both
 * return URLs arrive from `POST /me/orders`, so the server owns which merchant configuration is in use and
 * a reader of this file cannot accidentally point it at one of the `bill_*` billing MIDs.
 */
import type { TossCheckout } from '@hangyul/types';

type RequestPayment = (args: Record<string, unknown>) => Promise<void>;
type TossPaymentsFn = (clientKey: string) => { payment: (o: { customerKey: string }) => { requestPayment: RequestPayment } };

declare global {
  interface Window { TossPayments?: TossPaymentsFn }
}

const loading = new Map<string, Promise<void>>();

/** One `<script>` per URL, shared by every caller, and never re-added on a re-render. */
function loadSdk(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.TossPayments) return Promise.resolve();
  const existing = loading.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { loading.delete(src); reject(new Error('payment_sdk_unavailable')); };
    document.head.appendChild(el);
  });
  loading.set(src, p);
  return p;
}

export type TossMethod = 'CARD' | 'TRANSFER' | 'EASY_PAY';

/**
 * Open the window. Resolves only if it could not be opened — on success the browser leaves this page for
 * Toss and comes back at `successUrl`, so there is nothing to await.
 *
 * `useInternationalCardOnly` is not set: the same 일반 결제 MID takes overseas cards through the multilingual
 * window, and forcing it would exclude the domestic cards a student already in Korea would use. The
 * foreign-card `bill_*` MID is a *billing-key* configuration and is not an alternative to this (REPORT §135).
 */
export async function openTossCheckout(c: TossCheckout, customer?: { name?: string; email?: string } | null, method: TossMethod = 'CARD') {
  await loadSdk(c.sdk);
  const toss = window.TossPayments;
  if (!toss) throw new Error('payment_sdk_unavailable');
  const payment = toss(c.client_key).payment({ customerKey: c.customer_key });
  await payment.requestPayment({
    method,
    amount: c.amount,
    orderId: c.order_id,
    orderName: c.order_name,
    successUrl: c.success_url,
    failUrl: c.fail_url,
    ...(customer?.name ? { customerName: customer.name.slice(0, 100) } : {}),
    ...(customer?.email ? { customerEmail: customer.email.slice(0, 100) } : {}),
    card: { flowMode: 'DEFAULT', useEscrow: false, useCardPoint: false },
  });
}

/**
 * Toss's failure codes, as sentences a student can act on.
 *
 * The ones that mean "you closed the window" are not failures and are handled as a cancellation before this
 * is reached; what is left is the small set worth naming. Anything else falls back to one honest sentence
 * rather than printing a provider code at somebody who cannot do anything with it.
 */
export const CANCEL_CODES = new Set([
  'USER_CANCEL',
  'PAY_PROCESS_CANCELED',
  'USER_CANCELED',
]);

export function failureKey(code: string | null | undefined): string {
  switch (code) {
    case 'REJECT_CARD_COMPANY':
    case 'INVALID_CARD_EXPIRATION':
    case 'INVALID_STOPPED_CARD':
    case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
    case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT':
    case 'EXCEED_MAX_PAYMENT_AMOUNT':
    case 'NOT_AVAILABLE_PAYMENT':
      return `v16.pay.fail.${code}`;
    default:
      return 'v16.pay.fail.default';
  }
}
