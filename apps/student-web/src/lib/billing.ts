/**
 * Opening Toss's hosted **payment-method registration** window, and reading its answer.
 *
 * This is the only place in the student app that touches a payment SDK, and it does exactly one thing:
 * `requestBillingAuth`. It cannot take a payment — there is no `requestPayment` call in this app at all.
 * Every purchase is: register a method here → the server issues and seals the credential → the student
 * confirms the one-time amount → the server charges it once. Hangyul renders no card field; the card is
 * typed into Toss's window and never reaches this origin.
 *
 * Nothing is hard-coded: the SDK URL, the merchant's public client key, the customer key and both return
 * URLs come from `POST /me/payment-methods/registrations`, so the server owns which merchant is in use.
 */
import type { PaymentMethodKind, PaymentRegistration } from '@hangyul/types';

type BillingAuth = (args: Record<string, unknown>) => Promise<void>;
type TossPaymentsFn = (clientKey: string) => { payment: (o: { customerKey: string }) => { requestBillingAuth: BillingAuth } };

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

/**
 * Leave for the registration window. Resolves only if it could not be opened — on success the browser
 * navigates to Toss and comes back at `success_url` (or `fail_url`).
 */
export async function openPaymentMethodRegistration(r: PaymentRegistration): Promise<void> {
  await loadSdk(r.sdk);
  const toss = window.TossPayments;
  if (!toss) throw new Error('payment_sdk_unavailable');
  await toss(r.client_key).payment({ customerKey: r.customer_key }).requestBillingAuth({
    method: r.method,
    successUrl: r.success_url,
    failUrl: r.fail_url,
    // The current tab, on every device: an iframe cannot host an issuer's 3-D Secure page reliably, and the
    // return page is where the student confirms the one-time amount.
    windowTarget: 'self',
    ...(r.customer_name ? { customerName: r.customer_name } : {}),
    ...(r.customer_email ? { customerEmail: r.customer_email } : {}),
  });
}

/** The i18n key for each kind of payment method. Customer words only — never the provider's vocabulary. */
export const KIND_LABEL: Record<PaymentMethodKind, string> = {
  DOMESTIC_CARD: 'billing.kind.domesticCard',
  FOREIGN_CARD: 'billing.kind.internationalCard',
  TOSS_PAY: 'billing.kind.tossPay',
  NAVER_PAY: 'billing.kind.naverPay',
};

/**
 * The server's failure categories, as sentences a student can act on. The server never sends the
 * provider's own code or message to the browser; anything unrecognised gets one honest sentence.
 */
const FAILURES = new Set([
  'AUTH_CANCELLED', 'AUTH_FAILED', 'KEY_ISSUE_FAILED', 'METHOD_UNAVAILABLE', 'CARD_DECLINED', 'INSUFFICIENT_FUNDS',
  'EXPIRED_CARD', 'SUSPENDED_CARD', 'LIMIT_EXCEEDED', 'PROVIDER_TEMPORARY', 'DUPLICATE_REQUEST', 'CURRENCY_MISMATCH',
  'PAYMENT_IN_PROGRESS', 'PAYMENT_METHOD_REQUIRED', 'AMOUNT_MISMATCH', 'TOO_MANY_PAYMENT_ATTEMPTS', 'PAYMENT_UNAVAILABLE',
  'ORDER_NOT_PAYABLE', 'REGISTRATION_CLOSED', 'DESIGN_PREVIEW',
]);

export function failureKey(code: string | null | undefined): string {
  return code && FAILURES.has(code) ? `billing.fail.${code}` : 'billing.fail.default';
}

type ApiError = Error & { status?: number; body?: { detail?: { code?: string } | string; code?: string } };

/** The failure category out of an API error, or `null` when it carried none (a transport failure). */
export function failureCode(e: unknown): string | null {
  const err = e as ApiError;
  if (err?.message === 'payment_sdk_unavailable') return 'PROVIDER_TEMPORARY';
  const detail = err?.body?.detail;
  return (typeof detail === 'object' && detail?.code) || err?.body?.code || null;
}

/** Toss's own codes for "the student closed the window" — a cancellation, not a failure. */
export const WINDOW_CLOSED = new Set(['PAY_PROCESS_CANCELED', 'USER_CANCEL', 'USER_CANCELED']);
