/**
 * The plan screen's two V21 b requirements (REPORT §243).
 *
 * 1  **Parity.** The three cards show the *approved* plan content — the same description and the same five
 *    lines the homepage shows — resolved from `PLAN_PRESENTATION`. The defect this replaces was a card that
 *    listed two to four lines interpolated from entitlement numbers, so Basic's 입학 조건 비교, 서류 체크 and
 *    비자 절차 안내 never appeared on the screen where Basic is paid for.
 *
 * 2  **The local paid-state action is additive.** The real payment CTA must still be the one primary action
 *    in the order block, with or without the test button beside it.
 */
import type { ServiceProduct } from '@hangyul/types';
import { PLANS, planPresentationByCode, planText } from '@hangyul/types';
import { screen } from '@testing-library/react';
import { i18next } from '@hangyul/i18n';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderUI } from '../test/utils';

const api = vi.hoisted(() => ({ me: { paymentOptions: vi.fn(), payOrder: vi.fn(), startPaymentMethod: vi.fn(), order: vi.fn() } }));
vi.mock('@hangyul/auth', () => ({ useApi: () => api }));

import { OrderBlock, PlanCard } from './Services';

/** A product as `/me/services` serves it, priced from the manifest. */
const product = (code: string): ServiceProduct => {
  const plan = PLANS.find((p) => p.code === code)!;
  return {
    code: plan.code, name_key: `services.${plan.code}.name`, name_en: plan.name_en, name_ko: plan.name_ko,
    tagline_en: null, features: [], entitlements: plan.entitlements, recommended: plan.recommended,
    price: { id: `price-${plan.slug}`, currency: plan.currency, amount_minor: plan.amount_minor, is_demo: false },
  } as unknown as ServiceProduct;
};

const t = (key: string) => i18next.t(key) as string;

describe('the plan cards show the approved plan content', () => {
  it.each(PLANS.map((p) => p.code))('%s shows its description and all five lines', (code) => {
    const copy = planText(t, planPresentationByCode(code)!);
    renderUI(<PlanCard p={product(code)} owned={false} preselected={false} selected={false} hasPlan={false} onBuy={() => {}} />);
    expect(screen.getByText(copy.description)).toBeInTheDocument();
    for (const line of copy.benefits) expect(screen.getByText(line)).toBeInTheDocument();
    // Exactly the approved list — not a subset of it, and not a longer one.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(copy.benefits);
  });

  it('shows the price the manifest holds', () => {
    renderUI(<PlanCard p={product('PREMIUM')} owned={false} preselected={false} selected={false} hasPlan={false} onBuy={() => {}} />);
    expect(screen.getByText('$599')).toBeInTheDocument();
  });
});

describe('the order block', () => {
  const saved = {
    id: 'pm-1', kind: 'FOREIGN_CARD', brand: 'Visa', masked_number: '•••• 4242', last4: '4242', issuer_code: null, card_type: null,
    is_default: true, status: 'ACTIVE', created_at: '2026-11-18T00:00:00Z', usable: true, unavailable_reason: null,
  };
  const options = (over: Record<string, unknown> = {}) => ({
    provider: 'toss', mode: 'test', live_payment_enabled: false, one_time: true, recurring: false, rail: 'BILLING_KEY',
    methods: [
      { kind: 'DOMESTIC_CARD', available: false, reason: 'CURRENCY_MISMATCH', currency: 'KRW' },
      { kind: 'FOREIGN_CARD', available: true, reason: null, currency: 'USD' },
      { kind: 'TOSS_PAY', available: false, reason: 'PROVIDER_SPEC_REQUIRED', currency: 'KRW' },
      { kind: 'NAVER_PAY', available: false, reason: 'PROVIDER_SPEC_REQUIRED', currency: 'KRW' },
    ],
    saved: [saved], order: null, ...over,
  });
  const order = { order_id: '11111111-1111-1111-1111-111111111111', amount_minor: 34_900, currency: 'USD' };

  beforeEach(() => { Object.values(api.me).forEach((f) => f.mockReset()); });

  it('is one one-time payment with a saved method: the amount on the button, no card fields, no provider jargon', async () => {
    api.me.paymentOptions.mockResolvedValue(options());
    const { container } = renderUI(<OrderBlock p={product('ALL_IN_ONE')} createOrder={async () => order} onPaid={() => {}} />);
    expect(await screen.findByRole('radio', { name: /Visa •••• 4242/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Pay $349' })).toBeEnabled();
    expect(screen.getByText(/one-time payment of \$349/i)).toBeInTheDocument();
    expect(screen.getByText(/no subscription and no automatic renewal/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull(); // Hangyul has no card form
    expect(container.textContent).not.toMatch(/billing ?key|auth ?key|\bMID\b|customer ?key/i);
    expect(screen.queryByRole('button', { name: /^Test:/ })).toBeNull();
  });

  it('charges the order the server priced, with the confirmation', async () => {
    api.me.paymentOptions.mockResolvedValue(options());
    api.me.payOrder.mockResolvedValue({ ...order, status: 'PAID', payment_state: 'PAID' });
    const onPaid = vi.fn();
    renderUI(<OrderBlock p={product('ALL_IN_ONE')} createOrder={async () => order} onPaid={onPaid} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pay $349' }));
    expect(api.me.payOrder).toHaveBeenCalledWith(order.order_id, {
      payment_method_id: 'pm-1', amount_minor: 34_900, currency: 'USD', one_time_confirmed: true,
    });
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it('offers only the payment methods the server says are available, and cannot pay without one', async () => {
    api.me.paymentOptions.mockResolvedValue(options({ saved: [] }));
    renderUI(<OrderBlock p={product('ALL_IN_ONE')} createOrder={async () => order} onPaid={() => {}} />);
    expect(await screen.findByRole('button', { name: 'International card' })).toBeInTheDocument();
    for (const hidden of ['Korean card', 'Toss Pay', 'Naver Pay']) expect(screen.queryByRole('button', { name: hidden })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pay $349' })).toBeDisabled();
    expect(api.me.payOrder).not.toHaveBeenCalled();
  });

  it('says so plainly when no payment method is available, instead of improvising another way to pay', async () => {
    api.me.paymentOptions.mockResolvedValue(options({ saved: [], methods: options().methods.map((m) => ({ ...m, available: false })) }));
    renderUI(<OrderBlock p={product('ALL_IN_ONE')} createOrder={async () => order} onPaid={() => {}} />);
    expect(await screen.findByText(/Payment isn't available yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay $349' })).toBeDisabled();
  });
});
