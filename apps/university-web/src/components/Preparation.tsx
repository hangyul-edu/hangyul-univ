import { useLocale } from '@hangyul/i18n';
import type { Metric, RateKpi } from '@hangyul/types';
import { CalendarCheck, FileCheck2, Reply, ShieldCheck } from '@hangyul/icons';
import { Skeleton } from '@hangyul/ui';
import { formatNumber, formatPercent } from '@hangyul/utils';
import type { ReactNode } from 'react';

import { MIN_N } from '../lib/metrics';
import { useMetrics, usePreparation } from '../lib/queries';

type Rate = Pick<Metric, 'value' | 'numerator' | 'denominator'> | RateKpi | null | undefined;

/**
 * One measured fact: value, what it means, and the population it was measured on. Withheld below MIN_N
 * ("Too few to rate", with n) — never a noisy percentage. Laid out as a hairline row, not as KPI tiles.
 */
export function Fact({ label, value, context, withheld, icon, tone = 'primary' }: { label: ReactNode; value: ReactNode; context: ReactNode; withheld?: boolean; icon?: ReactNode; tone?: string }) {
  return (
    <div className="uc-mfact" data-withheld={withheld || undefined}>
      <dt className="uc-mfact__label">
        {icon ? <><span className={`avatar avatar-md avatar-rounded bg-${tone}-transparent uc-mfact__icon`} aria-hidden>{icon}</span><span>{label}</span></> : label}
      </dt>
      <dd className="uc-mfact__value">{value}</dd>
      <dd className="uc-mfact__ctx">{context}</dd>
    </div>
  );
}

export function useRateFact() {
  const { t, locale } = useLocale(['university', 'common']);
  return (r: Rate, unit: string) => {
    const num = r?.numerator ?? 0;
    const den = r?.denominator ?? 0;
    const withheld = !r || r.value === null || r.value === undefined || den < MIN_N;
    return {
      withheld,
      value: withheld ? t('university:af.lowN') : formatPercent(r!.value as number, locale, 0),
      context: t('university:v6.facts.ofUnit', { num: formatNumber(num, locale), den: formatNumber(den, locale), unit }),
    };
  };
}

/** "How Hangyul applications arrive": complete on first review, verified shared documents, days to a decision, request turnaround. */
export function PreparationFacts({ compact }: { compact?: boolean }) {
  const { t, locale } = useLocale(['university', 'common']);
  const m = useMetrics({});
  const prep = usePreparation();
  const rate = useRateFact();
  if (m.isLoading || prep.isLoading) return <Skeleton h={88} />;
  const pm = m.data?.pipeline.metrics;
  const first = rate(pm?.complete_on_first_review, t('university:v6.facts.unitApplications'));
  const docs = rate(prep.data?.documents_verified, t('university:v6.facts.unitDocuments'));
  const med = pm?.median_processing_days;
  const rq = prep.data?.requests;
  return (
    <dl className={`uc-mfacts${compact ? ' uc-mfacts--compact' : ''}`}>
      <Fact icon={<FileCheck2 />} tone="primary" label={t('university:v6.facts.firstReview')} value={first.value} context={first.context} withheld={first.withheld} />
      <Fact icon={<ShieldCheck />} tone="success" label={t('university:v6.facts.docsVerified')} value={docs.value} context={docs.context} withheld={docs.withheld} />
      <Fact icon={<CalendarCheck />} tone="purple" label={t('university:v6.facts.decisionDays')}
        value={med && med.value !== null ? t('university:v6.facts.days', { n: formatNumber(med.value, locale) }) : t('university:af.lowN')}
        context={t('university:v6.facts.decisionN', { count: med?.denominator ?? 0, n: formatNumber(med?.denominator ?? 0, locale) })}
        withheld={!med || med.value === null} />
      <Fact icon={<Reply />} tone="teal" label={t('university:v6.facts.requests')}
        value={rq && rq.median_days_to_answer !== null ? t('university:v6.facts.days', { n: formatNumber(rq.median_days_to_answer, locale) }) : rq && rq.total === 0 ? t('university:v6.facts.none') : t('university:af.lowN')}
        context={rq ? t('university:v6.facts.requestsCtx', { total: formatNumber(rq.total, locale), answered: formatNumber(rq.answered, locale), open: formatNumber(rq.open, locale) }) : '—'}
        withheld={!rq || rq.median_days_to_answer === null} />
    </dl>
  );
}

/** After admission: visa, arrival (Hangyul applications) and retention, graduation (enrolment records) — two populations, labelled. */
export function OutcomeFacts() {
  const { t } = useLocale(['university', 'common']);
  const m = useMetrics({});
  const rate = useRateFact();
  if (m.isLoading) return <Skeleton h={88} />;
  const pm = m.data?.pipeline.metrics;
  const c = m.data?.cohorts.total;
  const visa = rate(pm?.visa_conversion, t('university:v6.facts.unitTuition'));
  const arrival = rate(pm?.arrival_rate, t('university:v6.facts.unitVisas'));
  const ret = rate(c?.retention, t('university:v6.facts.unitSecondTerm'));
  const grad = rate(c?.graduation, t('university:v6.facts.unitDue'));
  return (
    <dl className="uc-mfacts">
      <Fact label={t('university:v6.facts.visa')} value={visa.value} context={visa.context} withheld={visa.withheld} />
      <Fact label={t('university:v6.facts.arrival')} value={arrival.value} context={arrival.context} withheld={arrival.withheld} />
      <Fact label={t('university:v6.facts.retention')} value={ret.value} context={ret.context} withheld={ret.withheld} />
      <Fact label={t('university:v6.facts.graduation')} value={grad.value} context={grad.context} withheld={grad.withheld} />
    </dl>
  );
}
