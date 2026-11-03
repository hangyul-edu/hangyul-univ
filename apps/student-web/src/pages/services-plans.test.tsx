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
import { describe, expect, it } from 'vitest';

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

  it('is the real payment path alone in a production build', () => {
    renderUI(<OrderBlock {...real} />);
    expect(screen.getByRole('button', { name: 'Pay and get started' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Test:/ })).toBeNull();
  });
});

