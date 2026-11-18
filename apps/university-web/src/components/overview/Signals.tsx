/**
 * The two supporting signals of the applicant home: where applicants come from and how submissions move month to month.
 * Loaded lazily (React.lazy in pages/Dashboard.tsx) so the work table never waits for a chart.
 *
 * Both read responses Insights already uses (`/university/analytics/questions`, `/university/analytics`), with the same
 * scope filters as the page. Countries print "n of N" on every row; the month-over-month sentence compares the last two
 * COMPLETE months and names the month still in progress separately, so a part-month is never read as a fall.
 */
import { useLocale } from '@hangyul/i18n';
import { Skeleton } from '@hangyul/ui';
import { countryName, formatNumber } from '@hangyul/utils';
import { Link } from 'react-router';

import { applicantsLink, type AnalyticsFilters, type ApplicantParams } from '../../lib/filters';
import { useAnalytics, useApplicationCount } from '../../lib/queries';
import { useQuestions } from '../../lib/v9';
import { CountryFlag } from '../common';
import { Figure, MonthTrend, monthOverMonth, RankBars, type RankRow } from '../viz/charts';

const TOP = 5;

export default function OverviewSignals({ base, set }: { base: AnalyticsFilters; set: (patch: Partial<ApplicantParams>) => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const qs = useQuestions(base);
  const an = useAnalytics(base);
  const fresh = useApplicationCount({ ...base, status: [], submitted_within: 7 });
  const moved = useApplicationCount({ ...base, status: [], updated_within: 7 });

  const all = (qs.data?.countries ?? []).filter((c) => c.submitted > 0).sort((x, y) => y.submitted - x.submitted);
  const total = qs.data?.population.size ?? 0;
  const min = qs.data?.min_denominator ?? 5;
  const rows: RankRow[] = all.slice(0, TOP).map((c, i) => ({
    key: c.key ?? 'none',
    label: c.key ? <span className="uc-country"><CountryFlag code={c.key} /><span className="uc-country__name">{countryName(c.key, locale)}</span></span> : t('university:v8.an.noCountry'),
    value: c.submitted,
    highlight: i === 0,
    to: c.key ? applicantsLink({ ...base, nationality: c.key }) : undefined,
    title: t('university:v22.in.countryTitle', { n: c.submitted, offered: c.offered, enrolled: c.enrolled }),
  }));
  const rest = all.length - rows.length;

  const pts = an.data?.series.submitted_monthly ?? [];
  const mom = monthOverMonth(pts);
  const monthName = (m: string) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(`${m}-15T00:00:00`));
  const momText = mom ? t(mom.delta > 0 ? 'university:v33.sig.momUp' : mom.delta < 0 ? 'university:v33.sig.momDown' : 'university:v33.sig.momSame', {
    last: monthName(mom.last.month), n: formatNumber(mom.last.value, locale), prev: monthName(mom.prev.month), m: formatNumber(mom.prev.value, locale), d: formatNumber(Math.abs(mom.delta), locale),
  }) : null;
  const week = (k: 'fresh' | 'moved', n: number | undefined, label: string, patch: Partial<ApplicantParams>) => {
    const inner = <><b className="hg-num">{n === undefined ? '–' : formatNumber(n, locale)}</b> {label}</>;
    return n ? <button type="button" className="un-sig__week uv25-head__item" data-head={k} data-count={n} onClick={() => set(patch)}>{inner}</button>
      : <span className="un-sig__week uv25-head__item is-zero" data-head={k} data-count={n ?? ''}>{inner}</span>;
  };

  return (
    <div className="un-sig">
      <Figure title={t('university:v33.sig.countries')} sub={total ? t('university:v33.sig.countriesSub', { n: formatNumber(total, locale), count: all.length }) : undefined}
        action={<Link className="un-figure__more" to="/analytics#origin">{rest > 0 ? t('university:v33.sig.moreCountries', { count: rest }) : t('university:v22.nav.insights')}</Link>}>
        {qs.isLoading ? <Skeleton h={132} /> : rows.length ? <RankBars rows={rows} total={total} min={min} label={t('university:v33.sig.countries')} dense /> : <p className="un-empty">{t('university:dash.noApplicants')}</p>}
      </Figure>
      <Figure title={t('university:v33.sig.trend')}
        sub={momText ? <>{momText}{mom?.partial ? <> {t('university:v33.sig.momPartial', { month: monthName(mom.partial.month), n: formatNumber(mom.partial.value, locale) })}</> : null}</> : undefined}
        action={<Link className="un-figure__more" to="/analytics#trend">{t('university:v22.nav.insights')}</Link>}
        foot={<span className="un-sig__weeks">
          {week('fresh', fresh.count, t('university:v33.sig.fresh'), { stage: undefined, status: [], submitted_within: 7 })}
          {week('moved', moved.count, t('university:v33.sig.moved'), { stage: undefined, status: [], updated_within: 7 })}
        </span>}>
        {an.isLoading ? <Skeleton h={112} /> : pts.length && pts.some((x) => x.value > 0)
          ? <MonthTrend points={pts} title={t('university:v33.sig.trend')} height={112} compact linkFor={(m) => applicantsLink({ ...base, submitted_month: m })} />
          : <p className="un-empty">{t('university:dash.noApplicants')}</p>}
      </Figure>
    </div>
  );
}
