import { useAuth } from '@hangyul/auth';
import { ArrowLeft } from '@hangyul/icons';
import type { WritingInsights as Insights } from '@hangyul/types';
import { Metrics, PageHeader, QueryState, Section, Segmented, Skeleton } from '@hangyul/ui';
import { formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { useT } from '../components/bits';
import './writing.css';

const PERIODS = ['30', '90', '365'] as const;

/** Managers only (the API returns 403 otherwise): review speed and internal outcome patterns — n per group, n<5 withheld. */
export default function WritingInsights() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('90');
  const q = useQuery({ queryKey: ['writing', 'insights', period], queryFn: () => api.writing.insights(Number(period)) });
  const num = (v: number | null | undefined, digits = 0) => (v == null ? '—' : formatNumber(v, locale, { maximumFractionDigits: digits }));
  /*
   * This page is managers-only and the API answers 403 to everyone else, which `QueryState` renders as a
   * clear "you don't have access to this · ask your organization's admin". V19: the period picker used to
   * sit above that message, because it lives in the header and the header did not know. Three date ranges
   * a counsellor can press, each of which fetches another 403 and changes nothing on screen, is a row of
   * dead controls on top of an explanation of why the page is empty — found by the V19 console sweep
   * (REPORT §195). A control that cannot do anything should not be offered.
   */
  const forbidden = (q.error as { status?: number } | null)?.status === 403;
  return (
    <div className="hg-stack ag-page">
      <PageHeader crumbs={<Link to="/essays"><ArrowLeft size={13} aria-hidden className="hg-flip-rtl" style={{ display: 'inline' }} /> {t('nav.essayReviews')}</Link>}
        title={t('writing:insights.title')} subtitle={t('writing:insights.sub')}
        actions={forbidden ? undefined : (
          <Segmented label={t('writing:insights.period')} value={period} onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p, label: t('writing:insights.days', { count: Number(p) }) }))} />
        )} />
      <QueryState query={q} skeleton={<Skeleton h={300} />}>
        {(d: Insights) => (
          <>
            <Metrics items={[
              { label: t('writing:insights.turnaround'), value: d.metrics.median_turnaround_hours == null ? '—' : t('writing:time.hours', { count: Math.round(d.metrics.median_turnaround_hours) }),
                foot: t('writing:insights.reviewsN', { count: d.metrics.reviews }), definition: t('writing:insights.turnaroundDef') },
              { label: t('writing:insights.rounds'), value: num(d.metrics.median_revision_rounds, 1), foot: t('writing:insights.approvedN', { count: d.metrics.approved_essays }),
                definition: t('writing:insights.roundsDef') },
              { label: t('writing:insights.breaches'), value: num(d.metrics.sla_breaches), foot: t('writing:insights.breachesFoot'), definition: t('writing:insights.breachesDef') },
            ]} />
            <Section title={t('writing:insights.patternsTitle')} sub={t('writing:insights.patternsSub')}>
              {(['rounds', 'sla', 'override'] as const).map((dim) => (
                <div key={dim} className="hg-panel" style={{ marginBlockStart: 12, overflowX: 'auto' }}>
                  <table className="wr-patterns">
                    <caption className="hg-sr-only">{t(`writing:insights.dim.${dim}`)}</caption>
                    <thead><tr><th scope="col">{t(`writing:insights.dim.${dim}`)}</th><th scope="col" className="num">n</th>
                      <th scope="col" className="num">{t('writing:insights.offers')}</th><th scope="col" className="num">{t('writing:insights.notAdmitted')}</th><th scope="col" className="num">{t('writing:insights.waitlisted')}</th></tr></thead>
                    <tbody>
                      {d.patterns.groups[dim].length === 0 ? <tr><td colSpan={5} className="hg-subtle">{t('writing:insights.none')}</td></tr> : d.patterns.groups[dim].map((g) => (
                        <tr key={g.group}>
                          <th scope="row" className="hg-medium">{t(`writing:insights.group.${dim}.${g.group}`)}</th>
                          <td className="num">{g.n}</td>
                          {g.withheld ? <td colSpan={3} className="num hg-subtle">{t('writing:insights.withheld')}</td> : <>
                            <td className="num">{g.offers}</td><td className="num">{g.not_admitted}</td><td className="num">{g.waitlisted}</td></>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="hg-xs hg-subtle" style={{ marginBlockStart: 12 }}>
                {t('writing:insights.population')} {d.patterns.period && t('writing:insights.intakes', { from: d.patterns.period.from, to: d.patterns.period.to })} {t('writing:insights.caveat')}
              </p>
            </Section>
          </>
        )}
      </QueryState>
    </div>
  );
}
