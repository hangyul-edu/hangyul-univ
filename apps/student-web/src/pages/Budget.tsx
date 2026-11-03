import { Users } from '@hangyul/icons';
import type { FxTable, HangyulFee, ProgramBudget } from '@hangyul/types';
import { ButtonLink, EmptyState, QueryState, Segmented, Select, Skeleton, StatusText } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { FundsToShowBlock, MoneyTimeline, PaymentGuard, PlanCoverage } from '../components/MoneyPlan';
import type { FundsToShow, ProgramPlan } from '../lib/money';
import { range, useBudget, useDisplayCurrency, useFx } from '../lib/budget';
import { tr, useT } from '../lib/i18n';
import { budgetRedirect } from '../lib/nav';

function BudgetDetail({ b, cur, fx, open }: { b: ProgramBudget & { plan?: ProgramPlan | null }; cur: string; fx: FxTable | undefined; open: boolean }) {
  const { t, locale } = useT();
  const plan = b.plan;
  const rates = fx?.krw_per_unit;
  const eligible = b.scholarships.filter((s) => s.status === 'ELIGIBLE');
  const possible = b.scholarships.filter((s) => s.status === 'POSSIBLE');
  return (
    <section className="bd-prog" aria-labelledby={`bd-${b.program_id}`}>
      <header className="bd-prog__head">
        <div style={{ minWidth: 0 }}>
          <h2 id={`bd-${b.program_id}`} className="hg-title-sm">{b.university_name}</h2>
          <p className="hg-small hg-muted">{b.program_name} · {b.city}</p>
        </div>
        <Link to={`/universities/${b.university_slug}?program=${b.program_id}`} className="hg-link-arrow">{t('budget.program')}</Link>
      </header>
      <dl className="bd-totals">
        <div><dt>{t('v4.cost.firstYear')}</dt><dd>{range(b.first_year_gross_min ?? b.first_year_min, b.first_year_gross_max ?? b.first_year_max, cur, rates, locale)}</dd>
          {b.scholarship_best_max ? <dd className="bd-hint bd-hint--schol">{t('v4.budget.withScholarship', { range: range(b.first_year_min, b.first_year_max, cur, rates, locale) })}</dd> : null}
          {/* V9: included vs separate comes from the same money plan as the timeline below — never a second answer. */}
          {plan ? <dd className="bd-cover"><PlanCoverage lines={plan.lines} /></dd>
            : b.unknown_keys.length > 0 && <dd className="bd-hint">{t('v4.budget.notIncluded', { list: b.unknown_keys.map((k) => t(`budget.line.${k}`).toLowerCase()).join(', ') })}</dd>}</div>
        <div><dt>{t('budget.beforeArrival')}</dt><dd>{range(b.cash_before_arrival_min, b.cash_before_arrival_max, cur, rates, locale)}</dd><dd className="bd-hint">{t('budget.beforeArrivalHint')}</dd></div>
        <div><dt>{t('budget.monthly')}</dt><dd>{range(b.monthly_living_min, b.monthly_living_max, cur, rates, locale)}</dd><dd className="bd-hint">{t(`budget.monthlyHint.${b.housing}`)}</dd></div>
      </dl>
      <details className="bd-more" open={open || undefined}>
      <summary>{t('v9.money.whenTitle')}</summary>
      {/* V9 S2: one money plan — who is paid, when, refundable or not, and where each figure comes from. */}
      {plan ? <MoneyTimeline lines={plan.lines} /> : null}
      {eligible.length > 0 && (
        <ul className="v9-lines bd-schol-list">
          {eligible.map((s, i) => (
            <li key={s.id} className="v9-line">
              <div className="v9-line__main"><span className="v9-line__name">{s.name}</span><span className="v9-line__note">{i === 0 ? t('budget.scholarshipCounted') : t('budget.scholarshipAlternative')}</span></div>
              <div className="v9-line__end"><span className="v9-line__amount hg-num">{s.amount_min === null ? t('budget.unknownAmount') : `− ${range(s.amount_min, s.amount_max, cur, rates, locale)}`}</span><StatusText tone="success">{t('budget.eligible')}</StatusText></div>
            </li>
          ))}
        </ul>
      )}
      {possible.length > 0 && (
        <p className="hg-small hg-muted">{t('budget.possible', { count: possible.length, names: possible.map((s) => s.name).join(', ') })}</p>
      )}
      </details>
    </section>
  );
}

/** V8: Hangyul's own fee in the same budget — paid, due or optional — so no cost of the journey lives on another page. */
function HangyulFeeRow({ fee }: { fee: HangyulFee }) {
  const { t, locale } = useT();
  if (fee.amount_minor === null || !fee.currency) return null;
  const amount = formatMoney(fee.amount_minor, fee.currency, locale, { minor: true });
  const name = fee.product_name_key ? tr(t, fee.product_name_key, fee.product_name_en ?? '') : fee.product_name_en ?? '';
  return (
    <section className="bd-fee" aria-labelledby="bd-fee-title">
      <div className="bd-fee__main">
        <h2 id="bd-fee-title" className="hg-title-sm">{t('v8.budget.fee.title')}</h2>
        <p className="hg-small hg-muted">{t(`v8.budget.fee.text.${fee.status}`, { name, date: fee.paid_at ? formatDate(fee.paid_at, locale) : '' })}</p>
      </div>
      <div className="bd-fee__amount">
        <span className="bd-fee__value">{fee.status === 'NONE' ? t('v8.budget.fee.from', { amount }) : amount}</span>
        <StatusText tone={fee.status === 'PAID' ? 'success' : fee.status === 'DUE' ? 'warning' : 'neutral'} hollow={fee.status === 'NONE'}>{t(`v8.budget.fee.status.${fee.status}`)}</StatusText>
        {fee.is_demo && <span className="hg-small hg-subtle">{t('common:freshness.unverified')}</span>}
        {fee.status !== 'PAID' && <Link to="/services" className="hg-link-arrow">{t('v8.budget.fee.cta')}</Link>}
      </div>
    </section>
  );
}

/**
 * "How much will everything cost, who do we pay, and when?" (V9 S2 — one money plan).
 *
 * V22 (REPORT §248 S4): no longer a page of its own. Cost is a question asked while comparing, so this renders as
 * the `#budget` section of `/compare` with the compared programs (or the shortlist when nothing is compared).
 */
export function BudgetSection({ ids }: { ids: string[] }) {
  const { t, locale } = useT();
  const [housing, setHousing] = useState<'DORM' | 'OFF_CAMPUS' | ''>('');
  const q = useBudget(ids, housing || undefined);
  const fx = useFx();
  const [cur, setCur] = useDisplayCurrency();
  const rates = fx.data?.krw_per_unit;
  return (
    <section className="bd-page v22-budget" id="budget" aria-labelledby="budget-title">
      <header className="v22-budget__head">
        <h2 id="budget-title" className="hg-title-md">{t('v22.compare.budget')}</h2>
        <p className="hg-muted hg-small">{t('v22.compare.budgetSub')}</p>
      </header>
      <div className="bd-controls">
        <Segmented label={t('budget.housing')} value={housing} onChange={setHousing}
          options={[{ value: '', label: t('budget.housingAuto') }, { value: 'DORM', label: t('budget.housingDorm') }, { value: 'OFF_CAMPUS', label: t('budget.housingOff') }]} />
        <label className="bd-cur">
          <span className="hg-small hg-muted">{t('budget.showIn')}</span>
          <Select compact value={cur} onChange={(e) => setCur(e.target.value)} style={{ width: 'auto' }} aria-label={t('budget.showIn')}>
            <option value="KRW">KRW ₩</option>
            {Object.keys(rates ?? {}).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </label>
      </div>
      {cur !== 'KRW' && fx.data && <p className="hg-small hg-muted">{t('budget.fxNote', { date: formatDate(fx.data.as_of, locale) })}</p>}
      <QueryState query={q} skeleton={<Skeleton h={320} r={10} />}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title={t('budget.empty')} text={t('budget.emptyText')} action={<ButtonLink as={Link} to="/explore?tab=foryou" variant="primary">{t('budget.emptyCta')}</ButtonLink>} />}>
        {(d) => (
          <>
            {d.source === 'shortlist' && d.items.length > 1 && <p className="hg-small hg-muted">{t('budget.fromShortlist')}</p>}
            {d.items.map((b) => <BudgetDetail key={b.program_id} b={b} cur={cur} fx={fx.data} open={d.items.length === 1} />)}
            {/* V8: the university's numbers first; Hangyul's own fee right after, in the same budget. */}
            {d.hangyul_fee && <HangyulFeeRow fee={d.hangyul_fee} />}
            {/* V9 S2: the biggest money question for parents — what must be in the account for the visa — before the visa stage. */}
            {(d as typeof d & { funds_to_show?: FundsToShow }).funds_to_show && <FundsToShowBlock data={(d as typeof d & { funds_to_show: FundsToShow }).funds_to_show} />}
            <PaymentGuard source={(d as typeof d & { guard?: { source_url: string } }).guard} />
            <Link to="/family" className="v9-family-cta"><Users aria-hidden /> <span><strong>{t('v9.family.ctaTitle')}</strong> <span className="hg-small hg-muted">{t('v9.family.ctaText')}</span></span></Link>
            <p className="hg-small hg-subtle">{t('budget.tuitionNote')}</p>
          </>
        )}
      </QueryState>
    </section>
  );
}

/** `/budget` → `/compare#budget`, carrying `?programs=` over as `?ids=`. The route stays so no old link 404s. */
export default function Budget() {
  const { search } = useLocation();
  return <Navigate to={budgetRedirect(search)} replace />;
}
