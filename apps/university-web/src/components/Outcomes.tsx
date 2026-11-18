import { useLocale } from '@hangyul/i18n';
import type { OutcomeStep, RateKpi, UniversityOutcomes } from '@hangyul/types';
import { EmptyState, Segmented, Skeleton } from '@hangyul/ui';
import { countryName, formatNumber } from '@hangyul/utils';
import { useState } from 'react';

import { useMetrics, useOutcomes } from '../lib/queries';
import { useNarrow } from '../lib/v9';
import { CountryFlag } from './common';
import { SummaryList } from './v9/SummaryList';
import { Figure, HeatMatrix, MatrixLegend, RateNote, StepFunnel, type FunnelStep, type MatrixRow } from './viz/charts';

const ADMISSION: OutcomeStep[] = ['ADMITTED', 'VISA_ISSUED', 'ARRIVED'];
const AFTER: OutcomeStep[] = ['ENROLLED', 'RETAINED', 'GRADUATED'];

function Rate({ r, min }: { r: RateKpi | null; min: number }) {
  const { t } = useLocale(['university', 'common']);
  if (!r || !r.denominator) return <span className="hg-subtle">—</span>;
  return <span title={r.value === null ? t('university:kpi.insufficientDetail', { n: r.denominator, min }) : undefined}><RateNote r={r} /></span>;
}

/**
 * Longitudinal outcomes for the same people over time — Hangyul's distinctive B2B view.
 * Two populations are shown side by side and never mixed: Hangyul applications (admitted → visa → arrived) and
 * enrolment records (enrolled → retained → graduated). Groups without tracked admissions show "—", not zero.
 */
export function OutcomesTable({ initial = 'cohort' }: { initial?: UniversityOutcomes['by'] }) {
  const { t, locale } = useLocale(['university', 'common']);
  const [by, setBy] = useState<UniversityOutcomes['by']>(initial);
  const q = useOutcomes(by);
  const narrow = useNarrow();
  const d = q.data;
  const label = (row: UniversityOutcomes['rows'][number]) => (by === 'nationality' && row.key ? countryName(row.key, locale) : row.key === null ? t('university:outcomes.unknown') : row.label);
  const cell = (v: number | null) => (v === null ? <span className="hg-subtle" title={t('university:outcomes.untracked')}>—</span> : formatNumber(v, locale));
  return (
    <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
      <Segmented label={t('university:outcomes.by')} value={by} onChange={setBy}
        options={(['cohort', 'nationality', 'program', 'agency'] as const).map((k) => ({ value: k, label: t(`university:outcomes.byOption.${k}`) }))} />
      {q.isLoading ? <Skeleton h={220} /> : !d || d.rows.length === 0 ? <EmptyState compact title={t('university:outcomes.empty')} /> : narrow ? (
        <SummaryList label={t('university:outcomes.title')} items={d.rows.map((r) => ({
          key: r.key ?? 'unknown', title: label(r),
          meta: `${t('university:outcomes.step.ADMITTED')} ${r.counts.ADMITTED ?? '—'} · ${t('university:outcomes.step.ENROLLED')} ${r.counts.ENROLLED ?? '—'}`,
          summary: <Rate r={r.tracked_admissions ? r.visa_rate : r.retention} min={d.min_denominator} />,
          fields: [
            ...[...ADMISSION, ...AFTER].map((st) => ({ label: t(`university:outcomes.step.${st}`), value: cell(r.counts[st]) })),
            { label: t('university:outcomes.visaRate'), value: <Rate r={r.visa_rate} min={d.min_denominator} /> },
            { label: t('university:outcomes.retention'), value: <Rate r={r.retention} min={d.min_denominator} /> },
            { label: t('university:outcomes.graduation'), value: <Rate r={r.graduation} min={d.min_denominator} /> },
          ],
        }))} />
      ) : (
        <div aria-busy={q.isPlaceholderData || undefined} className="un-outcomes">
          <HeatMatrix caption={t(`university:outcomes.byOption.${by}`)}
            groups={[{ label: t('university:outcomes.groupAdmission'), span: 3 }, { label: t('university:outcomes.groupAfter'), span: 3, sep: true }, { label: t('university:outcomes.groupRates'), span: 3, sep: true }]}
            cols={[...ADMISSION.map((st) => ({ key: st, label: t(`university:outcomes.step.${st}`) })), ...AFTER.map((st, i) => ({ key: st, label: t(`university:outcomes.step.${st}`), sep: i === 0 }))]}
            tailCols={[{ key: 'v', label: t('university:outcomes.visaRate') }, { key: 'r', label: t('university:outcomes.retention') }, { key: 'g', label: t('university:outcomes.graduation') }]}
            rows={d.rows.map((r): MatrixRow => {
              // A cell is shaded by its share of the row's own base (admitted, or enrolled) only when that base
              // meets the minimum sample; the base column itself is never shaded.
              const share = (st: OutcomeStep, base: OutcomeStep) => {
                const n = r.counts[st]; const b = r.counts[base];
                return n === null || b === null || b < d.min_denominator || st === base ? null : n / b;
              };
              return {
                key: r.key ?? 'unknown',
                label: by === 'nationality' && r.key ? <span className="uc-country"><CountryFlag code={r.key} /><span className="uc-country__name">{label(r)}</span></span> : label(r),
                cells: [
                  ...ADMISSION.map((st) => ({ count: r.counts[st], share: share(st, 'ADMITTED'), title: r.counts[st] === null ? t('university:outcomes.untracked') : undefined })),
                  ...AFTER.map((st) => ({ count: r.counts[st], share: share(st, 'ENROLLED') })),
                ],
                tail: [<Rate key="v" r={r.visa_rate} min={d.min_denominator} />, <Rate key="r" r={r.retention} min={d.min_denominator} />, <Rate key="g" r={r.graduation} min={d.min_denominator} />],
              };
            })} />
          <MatrixLegend low={t('university:v33.viz.groupLow')} high={t('university:v33.viz.shareHigh')} note={t('university:v33.viz.unshaded', { min: d.min_denominator })} />
        </div>
      )}
      <p className="uc-note">{t('university:outcomes.note', { min: d?.min_denominator ?? 5 })}</p>
    </div>
  );
}

/**
 * The differentiator in one glance (V4): what happens after admission, from two explicitly named populations.
 * 1. Hangyul applications (all intakes): admitted → visa issued → arrived → enrolled — one population, monotonic.
 * 2. Enrolment records by entry cohort: retained past the second term, graduated — a separate population.
 * Rates below the minimum sample are withheld; every rate shows numerator and denominator inline.
 */
export function LifecycleSummary() {
  const { t, locale } = useLocale(['university', 'common']);
  const m = useMetrics({});
  if (m.isLoading || !m.data) return <Skeleton h={160} />;
  const c = m.data.pipeline.counts;
  const min = m.data.pipeline.min_denominator;
  const chain: { key: string; n: number }[] = [
    { key: 'ADMITTED', n: c.OFFERED ?? 0 }, { key: 'VISA_ISSUED', n: c.VISA_ISSUED ?? 0 }, { key: 'ARRIVED', n: c.ARRIVED ?? 0 }, { key: 'ENROLLED', n: c.ENROLLED ?? 0 },
  ];
  // Conversion from the step before, withheld when that step has fewer than the minimum sample (the rule this panel has
  // always applied); the "n of N" pair is printed either way.
  const steps: FunnelStep[] = chain.map((s, i) => {
    const prev = i > 0 ? chain[i - 1].n : 0;
    return {
      key: s.key, label: t(`university:outcomes.step.${s.key}`), count: s.n,
      conversion: i === 0 ? null : { numerator: s.n, denominator: prev, value: prev >= min ? s.n / prev : null, insufficient_data: prev < min },
    };
  });
  const tot = m.data.cohorts.total;
  return (
    <div className="un-life">
      <Figure title={t('university:v33.co.chainTitle')} sub={t('university:v4.life.popApps', { n: formatNumber(m.data.pipeline.population.size, locale) })}>
        <StepFunnel steps={steps} label={t('university:v33.co.chainTitle')} dense />
      </Figure>
      <Figure title={t('university:v33.co.ratesTitle')} sub={t('university:v4.life.popEnrol', { n: formatNumber(tot.enrolled, locale) })}>
        <dl className="un-life__rates">
          <div><dt>{t('university:v4.life.retained')}</dt><dd><RateNote r={tot.retention} /></dd></div>
          <div><dt>{t('university:v4.life.graduated')}</dt><dd><RateNote r={tot.graduation} /></dd></div>
        </dl>
      </Figure>
    </div>
  );
}
