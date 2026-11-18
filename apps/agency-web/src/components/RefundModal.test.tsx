import { initI18n } from '@hangyul/i18n';
import type { AgencyOrderRow } from '@hangyul/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { canRefund, parseAmountMinor, refundable, refundFailure, validateRefund } from '../lib/refund';
import { RefundModal } from './RefundModal';

beforeAll(async () => {
  await initI18n({ namespaces: ['agency', 'common'], locale: 'en' });
});

const order: AgencyOrderRow = {
  id: 'o1', student: { id: 's1', full_name: 'Nguyễn Thị Lan' } as AgencyOrderRow['student'], product_code: 'ALL_IN_ONE', product_name: 'All-in-One', status: 'PAID',
  amount_minor: 34900, currency: 'USD', paid_at: '2026-09-15T02:00:00+09:00', created_at: '2026-09-15T02:00:00+09:00', provider: 'toss', is_demo_payment: false,
  payment_state: 'PARTIALLY_REFUNDED', one_time: true, refunded_amount_minor: 10000,
};

describe('refund arithmetic', () => {
  it('remaining refundable = amount − refunded, never negative', () => {
    expect(refundable(order)).toBe(24900);
    expect(refundable({ amount_minor: 100, refunded_amount_minor: 500 })).toBe(0);
    expect(refundable({ amount_minor: 100 })).toBe(100);
  });
  it('converts the typed amount to the currency’s minor units without floating point', () => {
    expect(parseAmountMinor('120', 'USD')).toBe(12000);
    expect(parseAmountMinor('120.5', 'USD')).toBe(12050);
    expect(parseAmountMinor('0.07', 'USD')).toBe(7);
    expect(parseAmountMinor('1,249.00', 'USD')).toBe(124900);
    expect(parseAmountMinor('120.505', 'USD')).toBeNull();
    expect(parseAmountMinor('abc', 'USD')).toBeNull();
    expect(parseAmountMinor('-5', 'USD')).toBeNull();
    expect(parseAmountMinor('50000', 'KRW')).toBe(50000);
    expect(parseAmountMinor('50000.5', 'KRW')).toBeNull();
  });
  it('requires an amount within the remaining refundable and a reason of at least 3 characters', () => {
    expect(validateRefund(order, '', '')).toMatchObject({ ok: false, amount: 'required', reason: 'required' });
    expect(validateRefund(order, '0', 'ok then')).toMatchObject({ ok: false, amount: 'zero' });
    expect(validateRefund(order, '249.01', 'Agreed with the student')).toMatchObject({ ok: false, amount: 'exceeds' });
    expect(validateRefund(order, '249', 'ab')).toMatchObject({ ok: false, amount: null, reason: 'short' });
    expect(validateRefund(order, '249', '  abc ')).toEqual({ ok: true, amount: null, reason: null, amountMinor: 24900 });
  });
  it('offers a refund only on a paid order with something left', () => {
    expect(canRefund(order)).toBe(true);
    expect(canRefund({ ...order, status: 'REFUNDED', refunded_amount_minor: 34900 })).toBe(false);
    expect(canRefund({ ...order, status: 'PENDING' })).toBe(false);
    expect(canRefund({ ...order, refunded_amount_minor: 34900 })).toBe(false);
  });
  it('reads the API refusal: object detail (402 / 409) and plain text', () => {
    expect(refundFailure({ status: 409, message: 'x', body: { detail: { code: 'AMOUNT_EXCEEDS_REMAINING', remaining_minor: 24900 } } }))
      .toEqual({ status: 409, code: 'AMOUNT_EXCEEDS_REMAINING', message: null, remainingMinor: 24900 });
    expect(refundFailure({ status: 402, message: 'x', body: { detail: { code: 'ALREADY_CANCELED_PAYMENT', message: 'Already cancelled' } } }))
      .toMatchObject({ status: 402, code: 'ALREADY_CANCELED_PAYMENT', message: 'Already cancelled' });
    expect(refundFailure({ status: 409, message: 'Only a paid order can be refunded.', body: { detail: 'Only a paid order can be refunded.' } }))
      .toMatchObject({ status: 409, code: null, message: 'Only a paid order can be refunded.' });
  });
});

describe('RefundModal', () => {
  const setup = (submit = vi.fn().mockResolvedValue({})) => {
    const onDone = vi.fn();
    render(<RefundModal order={order} onClose={() => undefined} submit={submit} onDone={onDone} />);
    return { submit, onDone, amount: screen.getByLabelText(/refund amount/i) as HTMLInputElement, reason: screen.getByLabelText(/^reason/i) as HTMLTextAreaElement };
  };

  it('never prefills the amount, offers no shortcut that fills it, and says the team decides it', () => {
    const { amount, reason } = setup();
    expect(amount.value).toBe('');
    expect(reason.value).toBe('');
    expect(screen.getByTestId('refund-remaining')).toHaveTextContent('$249');
    expect(screen.getAllByText(/decided by the team under the agreed terms/i).length).toBeGreaterThan(0);
    // The only buttons are close, cancel and review — nothing like "Full refund" or "Use remaining".
    const names = screen.getAllByRole('button').map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim());
    expect(names.some((n) => /full|all|max|remaining|suggest/i.test(n))).toBe(false);
    expect(amount.value).toBe('');
  });

  it('does not reach the confirm step without an amount and a reason', () => {
    const { submit } = setup();
    fireEvent.click(screen.getByRole('button', { name: /review refund/i }));
    expect(screen.getByText(/enter the amount to refund/i)).toBeInTheDocument();
    expect(screen.getByText(/enter the reason/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^refund \$/i })).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('refuses an amount above the remaining refundable and a reason under 3 characters', () => {
    const { amount, reason, submit } = setup();
    fireEvent.change(amount, { target: { value: '249.01' } });
    fireEvent.change(reason, { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /review refund/i }));
    expect(screen.getByText(/more than the \$249 that can still be refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(submit).not.toHaveBeenCalled();
  });

  it('sends exactly what was typed, in minor units, only after the confirm step', async () => {
    const { amount, reason, submit, onDone } = setup();
    fireEvent.change(amount, { target: { value: '120.50' } });
    fireEvent.change(reason, { target: { value: ' Agreed with the student on 18 Nov ' } });
    fireEvent.click(screen.getByRole('button', { name: /review refund/i }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Refund $120.50' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(12050));
    expect(submit).toHaveBeenCalledWith({ amount_minor: 12050, reason: 'Agreed with the student on 18 Nov' });
  });

  it('shows the API refusal with its code and returns to the form with the typed values intact', async () => {
    const submit = vi.fn().mockRejectedValue({ status: 402, message: 'x', body: { detail: { code: 'EXCEED_CANCEL_AMOUNT', message: 'The card company refused the cancellation.' } } });
    const { amount, reason, onDone } = setup(submit);
    fireEvent.change(amount, { target: { value: '100' } });
    fireEvent.change(reason, { target: { value: 'Agreed refund' } });
    fireEvent.click(screen.getByRole('button', { name: /review refund/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Refund $100' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The card company refused the cancellation.');
    expect(alert).toHaveTextContent('EXCEED_CANCEL_AMOUNT');
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/refund amount/i) as HTMLInputElement).value).toBe('100');
  });
});
