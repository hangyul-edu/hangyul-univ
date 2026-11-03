// PRIMARY QUESTION: Where does our process create rework?
// V9 Process quality (REPORT §59 A10, GET /agency/quality): correction loops, essay revision loops, completeness at
// submission, university extra-document rate, missed deadlines, review turnaround, student response time, visa
// extra-document rate, arrival issues — each with its definition, cohort, numerator/denominator or n, withheld below
// n = 5, and the records behind it. No causal claims, no ranking of people.
import { useAuth } from '@hangyul/auth';
import { Callout, Segmented, Skeleton } from '@hangyul/ui';
import { YCard } from '@hangyul/ynex-ui';
import { formatNumber, formatPercent } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { useT } from './bits';

export interface QualityMetric {
  key: string; unit: 'share' | 'ratio' | 'rounds' | 'hours' | 'count'; value: number | null; numerator: number | null; denominator: number | null; n: number;
  withheld: boolean; definition: string; cohort: string; lower_is_better: boolean; drill: { label: string | null; detail: string | null; count?: number; link: string }[];
}

export function useMetricText() {
  const { t, locale } = useT();
  return (m: QualityMetric) => {
    if (m.withheld || m.value === null) return t('v9.q.withheld', { n: m.n });
    switch (m.unit) {
      case 'share': return formatPercent(m.value, locale);
      case 'hours': return t('v9.q.hours', { n: formatNumber(m.value, locale) });
      case 'rounds': return t('v9.q.rounds', { n: formatNumber(m.value, locale) });
      case 'count': return formatNumber(m.value, locale);
      default: return formatNumber(m.value, locale);
    }
  };
}

export function ProcessQuality({ agencyId }: { agencyId?: string }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const [days, setDays] = useState('180');
  const [open, setOpen] = useState<string | null>(null);
  const text = useMetricText();
  const q = useQuery({ queryKey: ['agency', 'quality', days, agencyId ?? null],
    queryFn: () => api.get<{ days: number; min_n: number; students_in_scope: number; metrics: QualityMetric[] }>('/agency/quality', { days, ...(agencyId ? { agency_id: agencyId } : {}) }) });
  return (
    <YCard as="section" title={t('v9.q.title')} flush
      tools={<Segmented label={t('v9.q.period')} value={days} onChange={setDays} options={[{ value: '90', label: t('v9.q.d', { n: 90 }) }, { value: '180', label: t('v9.q.d', { n: 180 }) }, { value: '365', label: t('v9.q.d', { n: 365 }) }]} />}
      footer={<p className="text-muted fs-12 mb-0">{t('v9.q.foot', { n: q.data?.min_n ?? 5 })}</p>}>
      {q.isError ? <Callout tone="danger">{t('states.error')}</Callout> : !q.data ? <div className="p-3"><Skeleton h={300} /></div> : (
        <ul className="list-unstyled mb-0 ag9-ql">
          {q.data.metrics.map((m) => (
            <li key={m.key} className="ag9-ql__row" data-withheld={m.withheld || undefined}>
              <div className="ag9-ql__main">
                <span className="fw-semibold">{t(`v9.q.m.${m.key}`)}</span>
                <span className="fs-12 text-muted">{m.definition}</span>
              </div>
              <div className="ag9-ql__val">
                <span className="ag9-ql__num">{text(m)}</span>
                <span className="fs-11 text-muted">
                  {m.withheld ? null : <>{m.numerator !== null && m.denominator !== null ? t('v9.q.numden', { num: formatNumber(m.numerator, locale), den: formatNumber(m.denominator, locale) }) : t('v9.q.n', { n: formatNumber(m.n, locale) })}{' · '}</>}
                  {t('v9.q.cohort', { days })}
                </span>
              </div>
              <div className="ag9-ql__drill">
                {m.drill.length > 0 ? (
                  <button type="button" className="btn btn-sm btn-light" aria-expanded={open === m.key} onClick={() => setOpen(open === m.key ? null : m.key)}>
                    {t('v9.q.records', { count: m.drill.length })}
                  </button>
                ) : <span className="fs-12 text-muted">{t('v9.q.noRecords')}</span>}
              </div>
              {open === m.key && (
                <ul className="ag9-ql__list">
                  {m.drill.map((d, i) => <li key={i}><Link to={d.link}>{d.label ?? '—'}</Link>{d.detail && <span className="text-muted"> · {d.detail}</span>}{d.count != null && <span className="text-muted"> · {d.count}</span>}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </YCard>
  );
}
