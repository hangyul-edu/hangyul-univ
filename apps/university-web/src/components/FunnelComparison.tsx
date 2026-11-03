import { useAuth } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import type { AdmissionsFunnel } from '@hangyul/types';
import { Chip, Segmented, SkeletonCard } from '@hangyul/ui';
import { countryName, formatNumber, formatPercent } from '@hangyul/utils';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { applicantsLink, type AnalyticsFilters, type ReachedStep } from '../lib/filters';
import { intakeText } from '../lib/format';
import { useUniversity } from '../lib/university';
import { useFilterOptions } from './FilterBar';
import { Panel } from './Panel';

type Dim = 'nationality' | 'program_id' | 'agency_id' | 'intake';
/**
 * Steps compared per segment — all from ONE population (submitted applications, unified metrics service), so a later
 * step can never exceed an earlier one (V3 mixed application- and arrival-based counts: "China admitted 1 / arrived 3").
 */
export const COMPARABLE = ['SUBMITTED', 'OFFERED', 'ACCEPTED', 'VISA_ISSUED', 'ENROLLED'] as const;

/** Count and conversion from the segment's first step, withheld below the minimum sample. */
export function segmentCell(f: AdmissionsFunnel | undefined, step: string) {
  const count = f?.steps.find((s) => s.key === step)?.count ?? 0;
  const base = f?.steps[0]?.count ?? 0;
  const min = f?.min_denominator ?? 5;
  return { count, base, rate: step === 'SUBMITTED' || base < min ? null : count / base };
}

export function FunnelComparison({ base }: { base: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { scopeId } = useUniversity();
  const o = useFilterOptions();
  const [dim, setDim] = useState<Dim>('nationality');
  const [picked, setPicked] = useState<Record<Dim, string[] | null>>({ intake: null, nationality: null, program_id: null, agency_id: null });
  const options = dim === 'intake' ? o.intakes : dim === 'nationality' ? o.nationalities : dim === 'program_id' ? o.programs.map((p) => p.id) : o.agencies.map((a) => a.id);
  const labelOf = (v: string) => (dim === 'intake' ? intakeText(v, t) : dim === 'nationality' ? countryName(v, locale)
    : dim === 'program_id' ? o.programs.find((p) => p.id === v)?.name ?? v : o.agencies.find((a) => a.id === v)?.name ?? v);
  const selected = (picked[dim] ?? options.slice(0, 4)).filter((v) => options.includes(v)).slice(0, 4);
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : selected.length >= 4 ? selected : [...selected, v];
    setPicked({ ...picked, [dim]: next });
  };
  const results = useQueries({
    queries: selected.map((v) => {
      const f = { ...base, [dim]: v };
      return { queryKey: ['university', 'admissions-funnel', scopeId ?? 'own', f], queryFn: () => api.university.admissionsFunnel({ ...f, university_id: scopeId }), staleTime: 60_000 };
    }),
  });
  const loading = results.some((r) => r.isLoading);
  const min = results[0]?.data?.min_denominator ?? 5;
  return (
    <Panel id="cmp-h" title={t('university:v4.an.compareTitle')} sub={t('university:v4.an.compareSub')}
      action={<Segmented label={t('university:funnel.compareBy')} value={dim} onChange={(v) => setDim(v)}
        options={[
          { value: 'nationality', label: t('university:filters.nationality') },
          { value: 'program_id', label: t('university:filters.program') },
          { value: 'agency_id', label: t('university:filters.agency') },
          { value: 'intake', label: t('university:filters.intake') },
        ]} />}
      foot={t('university:v4.an.compareFoot', { min })}>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
        <div className="hg-row-wrap" role="group" aria-label={t('university:funnel.pickSegments')}>
          {options.map((v) => <Chip key={v} pressed={selected.includes(v)} onClick={() => toggle(v)}>{labelOf(v)}</Chip>)}
          {options.length === 0 && <span className="hg-subtle hg-small">{t('university:funnel.noSegments')}</span>}
        </div>
        {selected.length > 0 && (loading ? <SkeletonCard lines={3} /> : (
          <div className="uc-table-scroll" tabIndex={0}>
            <table className="hg-table hg-table--dense uc-simple-table uc-cmp">
              <caption className="hg-sr-only">{t('university:v4.an.compareTitle')}</caption>
              <thead>
                <tr><th scope="col">{t('university:funnel.stage')}</th>{selected.map((v) => <th key={v} scope="col" className="hg-table__num">{labelOf(v)}</th>)}</tr>
              </thead>
              <tbody>
                {COMPARABLE.map((step) => (
                  <tr key={step}>
                    <th scope="row" className="uc-cmp__step">{t(`university:af.stepName.${step}`)}</th>
                    {selected.map((v, j) => {
                      const c = segmentCell(results[j]?.data, step);
                      return (
                        <td key={v} className="hg-table__num">
                          {c.count > 0
                            ? <Link className="hg-num hg-medium" to={applicantsLink({ intake: base.intake, degree: base.degree, program_id: base.program_id, nationality: base.nationality, agency_id: base.agency_id, [dim]: v, reached: step as ReachedStep })}>{formatNumber(c.count, locale)}</Link>
                            : <span className="hg-num hg-medium">{formatNumber(c.count, locale)}</span>}
                          {step !== 'SUBMITTED' && c.rate !== null && (
                            <span className="uc-af__of">{t('university:v4.an.ofSubmitted', { pct: formatPercent(c.rate, locale, 0) })}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Panel>
  );
}
