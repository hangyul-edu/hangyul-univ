/**
 * Refund arithmetic for Operations (pages/Payments, components/RefundModal).
 *
 * There is deliberately nothing here that *proposes* an amount. No refund schedule has been approved, so the amount is
 * a decision the team makes under the agreed terms and types in; this module only turns what was typed into the
 * order's minor units and says whether it can be sent (server: `RefundIn` — amount ≥ 1, reason 3–200 characters, and
 * 409 `AMOUNT_EXCEEDS_REMAINING` above what is left).
 */
import type { AgencyOrderRow } from '@hangyul/types';

export const REASON_MIN = 3;
export const REASON_MAX = 200;

/** Currencies whose minor unit is the unit itself (mirrors `formatMoney` in @hangyul/utils). */
const ZERO_DECIMAL = new Set(['KRW', 'JPY', 'VND']);
export const minorDigits = (currency: string) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2);

/** What can still go back: the order amount less what has already been refunded. Never negative. */
export function refundable(order: Pick<AgencyOrderRow, 'amount_minor' | 'refunded_amount_minor'>): number {
  return Math.max(0, order.amount_minor - (order.refunded_amount_minor ?? 0));
}

/** Only a paid order with something left can be refunded (a fully refunded order has status REFUNDED). */
export function canRefund(order: Pick<AgencyOrderRow, 'status' | 'amount_minor' | 'refunded_amount_minor'>): boolean {
  return order.status === 'PAID' && refundable(order) > 0;
}

/**
 * "120", "120.5", "1,200.50" → minor units in the order's currency; `null` when it is not a plain positive amount or
 * carries more decimals than the currency has. Integer arithmetic on the digits — no floating point.
 */
export function parseAmountMinor(input: string, currency: string): number | null {
  const s = input.trim().replace(/[\s,]/g, '');
  const digits = minorDigits(currency);
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > digits) return null;
  const minor = Number(m[1]) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

export type RefundAmountError = 'required' | 'invalid' | 'zero' | 'exceeds';
export type RefundReasonError = 'required' | 'short';
export interface RefundCheck { amountMinor: number | null; amount: RefundAmountError | null; reason: RefundReasonError | null; ok: boolean }

export function validateRefund(order: Pick<AgencyOrderRow, 'amount_minor' | 'refunded_amount_minor' | 'currency'>, amountText: string, reasonText: string): RefundCheck {
  let amount: RefundAmountError | null = null;
  let amountMinor: number | null = null;
  if (!amountText.trim()) amount = 'required';
  else {
    amountMinor = parseAmountMinor(amountText, order.currency);
    if (amountMinor === null) amount = 'invalid';
    else if (amountMinor < 1) amount = 'zero';
    else if (amountMinor > refundable(order)) amount = 'exceeds';
  }
  const r = reasonText.trim();
  const reason: RefundReasonError | null = !r ? 'required' : r.length < REASON_MIN ? 'short' : null;
  return { amountMinor: amount ? null : amountMinor, amount, reason, ok: !amount && !reason };
}

/** The API's refusal, reduced to what the modal shows: a known code, the provider's own message, or the plain text. */
export function refundFailure(e: unknown): { status: number; code: string | null; message: string | null; remainingMinor: number | null } {
  const err = e as { status?: number; message?: string; body?: unknown };
  const body = (err?.body ?? null) as { detail?: unknown; code?: unknown } | null;
  const detail = body && typeof body === 'object' ? body.detail : null;
  if (detail && typeof detail === 'object') {
    const d = detail as { code?: unknown; message?: unknown; remaining_minor?: unknown };
    return { status: err.status ?? 0, code: typeof d.code === 'string' ? d.code : null, message: typeof d.message === 'string' ? d.message : null,
      remainingMinor: typeof d.remaining_minor === 'number' ? d.remaining_minor : null };
  }
  return { status: err?.status ?? 0, code: body && typeof body.code === 'string' ? body.code : null, message: typeof detail === 'string' ? detail : err?.message ?? null, remainingMinor: null };
}
