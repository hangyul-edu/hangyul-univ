import { useLocale } from '@hangyul/i18n';
import type { OutcomeStep, RateKpi, UniversityOutcomes } from '@hangyul/types';
import { EmptyState, InfoTip, Segmented, Skeleton } from '@hangyul/ui';
import { countryName, formatNumber, formatPercent } from '@hangyul/utils';
import { useState } from 'react';

import { useMetrics, useOutcomes } from '../lib/queries';
import { useNarrow } from '../lib/v9';
import { SummaryList } from './v9/SummaryList';

const ADMISSION: OutcomeStep[] = ['ADMITTED', 'VISA_ISSUED', 'ARRIVED'];
const AFTER: OutcomeStep[] = ['ENROLLED', 'RETAINED', 'GRADUATED'];

function Rate({ r, min }: { r: RateKpi | null; min: number }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (!r) return <span className="hg-subtle">—</span>;
  if (r.value === null) {
    return <span className="hg-subtle" title={t('university:kpi.insufficientDetail', { n: r.denominator, min })}>{r.denominator ? t('university:af.lowN') : '—'}</span>;
  }
  return <span>{formatPercent(r.value, locale, 0)}<span className="uc-af__of">{t('university:metric.ofN', { num: formatNumber(r.numerator, locale), den: formatNumber(r.denominator, locale) })}</span></span>;
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
        <div className="uc-table-scroll" tabIndex={0} aria-busy={q.isPlaceholderData || undefined}>
          <table className="hg-table uc-outcomes">
            <caption className="hg-sr-only">{t('university:outcomes.title')}</caption>
            <thead>
              <tr className="uc-outcomes__group">
                <th rowSpan={2} scope="col">{t(`university:outcomes.byOption.${by}`)}</th>
                <th colSpan={3} scope="colgroup">{t('university:outcomes.groupAdmission')}</th>
                <th colSpan={3} scope="colgroup" className="uc-outcomes__sep">{t('university:outcomes.groupAfter')}</th>
                <th colSpan={3} scope="colgroup" className="uc-outcomes__sep">{t('university:outcomes.groupRates')}</th>
              </tr>
              <tr>
                {ADMISSION.map((s) => <th key={s} className="hg-table__num" scope="col">{t(`university:outcomes.step.${s}`)}</th>)}
                {AFTER.map((s, i) => <th key={s} className={`hg-table__num${i === 0 ? ' uc-outcomes__sep' : ''}`} scope="col">{t(`university:outcomes.step.${s}`)}</th>)}
                <th className="hg-table__num uc-outcomes__sep" scope="col"><span className="hg-row" style={{ gap: 4, justifyContent: 'flex-end' }}>{t('university:outcomes.visaRate')}<InfoTip text={d.definitions.visa_rate} /></span></th>
                <th className="hg-table__num" scope="col"><span className="hg-row" style={{ gap: 4, justifyContent: 'flex-end' }}>{t('university:outcomes.retention')}<InfoTip text={d.definitions.retention} /></span></th>
                <th className="hg-table__num" scope="col"><span className="hg-row" style={{ gap: 4, justifyContent: 'flex-end' }}>{t('university:outcomes.graduation')}<InfoTip text={d.definitions.graduation} /></span></th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.key ?? 'unknown'}>
                  <th scope="row" className="uc-outcomes__name">{label(r)}</th>
                  {ADMISSION.map((s) => <td key={s} className="hg-table__num">{cell(r.counts[s])}</td>)}
                  {AFTER.map((s, i) => <td key={s} className={`hg-table__num${i === 0 ? ' uc-outcomes__sep' : ''}`}>{cell(r.counts[s])}</td>)}
                  <td className="hg-table__num uc-outcomes__sep"><Rate r={r.visa_rate} min={d.min_denominator} /></td>
                  <td className="hg-table__num"><Rate r={r.retention} min={d.min_denominator} /></td>
                  <td className="hg-table__num"><Rate r={r.graduation} min={d.min_denominator} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
  if (m.isLoading || !m.data) return <Skeleton h={120} />;
  const c = m.data.pipeline.counts;
  const min = m.data.pipeline.min_denominator;
  const steps: { key: string; n: number }[] = [
    { key: 'ADMITTED', n: c.OFFERED ?? 0 }, { key: 'VISA_ISSUED', n: c.VISA_ISSUED ?? 0 }, { key: 'ARRIVED', n: c.ARRIVED ?? 0 }, { key: 'ENROLLED', n: c.ENROLLED ?? 0 },
  ];
  const tot = m.data.cohorts.total;
  const rate = (r: RateKpi) => (r.value === null
    ? <><span className="hg-subtle">{t('university:af.lowN')}</span> <span className="uc-af__of">{t('university:metric.ofN', { num: formatNumber(r.numerator, locale), den: formatNumber(r.denominator, locale) })}</span></>
    : <><b>{formatPercent(r.value, locale, 0)}</b> <span className="uc-af__of">{t('university:metric.ofN', { num: formatNumber(r.numerator, locale), den: formatNumber(r.denominator, locale) })}</span></>);
  return (
    <section className="uc-life" aria-labelledby="life-h">
      <h2 id="life-h" className="hg-sr-only">{t('university:outcomes.title')}</h2>
      <div className="uc-life__part">
        <p className="uc-life__pop">{t('university:v4.life.popApps', { n: formatNumber(m.data.pipeline.population.size, locale) })}</p>
        <ol className="uc-life__steps">
          {steps.map((s, i) => (
            <li key={s.key}>
              <span className="uc-life__n hg-num">{formatNumber(s.n, locale)}</span>
              <span className="uc-life__label">{t(`university:outcomes.step.${s.key}`)}</span>
              {i > 0 && <span className="uc-af__of">{steps[i - 1].n >= min ? t('university:v4.life.ofPrev', { pct: formatPercent(steps[i - 1].n ? s.n / steps[i - 1].n : 0, locale, 0) }) : t('university:af.lowN')}</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="uc-life__part">
        <p className="uc-life__pop">{t('university:v4.life.popEnrol', { n: formatNumber(tot.enrolled, locale) })}</p>
        <dl className="uc-life__rates">
          <div><dt>{t('university:v4.life.retained')}</dt><dd>{rate(tot.retention)}</dd></div>
          <div><dt>{t('university:v4.life.graduated')}</dt><dd>{rate(tot.graduation)}</dd></div>
        </dl>
      </div>
    </section>
  );
}
