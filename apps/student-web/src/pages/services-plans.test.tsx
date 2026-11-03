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
import { describe, expect, it, vi } from 'vitest';

import { bypassEnabled, PAID_STATE_QUERY_KEYS } from '../lib/devpay';
import { renderUI } from '../test/utils';
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
  const real = { p: product('ALL_IN_ONE'), busy: false, error: null, onPay: () => {}, cardMode: false };

  it('keeps the real payment CTA as the only primary action when the test action is present', () => {
    const onTestActivate = vi.fn();
    renderUI(<OrderBlock {...real} onTestActivate={onTestActivate} />);
    // The amount rides on the button but is `aria-hidden`, so it is not part of the accessible name.
    const pay = screen.getByRole('button', { name: 'Pay and get started' });
    expect(pay).toHaveClass('hg-btn--primary');
    expect(pay).toHaveTextContent('$349');
    const test = screen.getByRole('button', { name: 'Test: start on the selected plan' });
    expect(test).toHaveClass('hg-btn--ghost');
    expect(test).not.toHaveClass('hg-btn--primary');
    test.click();
    expect(onTestActivate).toHaveBeenCalledOnce();
  });

  it('is the real payment path alone in a production build', () => {
    renderUI(<OrderBlock {...real} />);
    expect(screen.getByRole('button', { name: 'Pay and get started' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Test:/ })).toBeNull();
  });
});

describe('the local paid-state gate', () => {
  it('is on in a dev server, off in a production build, and overridable either way', () => {
    expect(bypassEnabled({ DEV: true })).toBe(true);
    expect(bypassEnabled({ DEV: false })).toBe(false);
    expect(bypassEnabled({})).toBe(false);
    expect(bypassEnabled({ DEV: false, VITE_ENABLE_TEST_PAYMENT_BYPASS: 'true' })).toBe(true);
    // What a QA sweep that must see the production composition sets.
    expect(bypassEnabled({ DEV: true, VITE_ENABLE_TEST_PAYMENT_BYPASS: 'false' })).toBe(false);
  });

  it('refreshes the plan the route paywall reads', () => {
    // `services` carries the plan (`lib/queries.ts` → `useMyPlan`); without it the app would navigate to a
    // home page that bounces straight back to `/services?gate=…`.
    expect(PAID_STATE_QUERY_KEYS).toContain('services');
    expect(PAID_STATE_QUERY_KEYS).toContain('dashboard');
    expect(PAID_STATE_QUERY_KEYS).toContain('tasks');
  });
});
