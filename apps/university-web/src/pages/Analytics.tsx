// PRIMARY QUESTIONS, in order (V22, REPORT §250 V4): 지원자는 어디에서 오나요? · 어디에서 이탈하나요? · 어떤 학생이 합격하고
// 입학하나요? · 입학 후 잘 정착하고 있나요? The page is those four sections — not a card grid, not tabs. Horizontal bars,
// funnel bars and one paired-bar chart; every bar and every number opens the applicant table filtered to exactly the
// records it counts. Rates below the minimum sample are text ("n < 5"), never a bar. One ink; tangerine only for the one
// highlighted bar in a section.
import { useLocale } from '@hangyul/i18n';
import type { AdmissionsFunnel as AdmissionsFunnelData, RateKpi } from '@hangyul/types';
import { PageHeader, QueryState, Skeleton, SkeletonCard } from '@hangyul/ui';
import { countryName, formatNumber, formatPercent } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { largestDrop } from '../components/AdmissionsFunnel';
import { FilterBar, useUrlFilters } from '../components/FilterBar';
import { PopulationLine } from '../components/Population';
import { GlossaryButton } from '../components/v8/Glossary';
import { CountryFlag } from '../components/common';
import { Figure, HeatMatrix, MatrixLegend, MonthTrend, monthOverMonth, RankBars, RateNote, StepFunnel, withheld, type FunnelStep, type MatrixRow, type RankRow } from '../components/viz/charts';
import { applicantsLink, type AnalyticsFilters, type ReachedStep } from '../lib/filters';
import { intakeText } from '../lib/format';
import { MIN_N } from '../lib/metrics';
import { useAdmissionsFunnel, useAnalytics, useMetrics } from '../lib/queries';
import { useQuestions } from '../lib/v9';
import { CLOSED_STATUSES } from '../lib/workflow';

/** Drill-downs are always exact — the applicant table filters by the same intake, degree, programme, country and agency. */
export function drillParams(f: AnalyticsFilters) {
  return { intake: f.intake, degree: f.degree, program_id: f.program_id, nationality: f.nationality, agency_id: f.agency_id };
}

function useDrill(filters: AnalyticsFilters) {
  const base = drillParams(filters);
  return (p: Parameters<typeof applicantsLink>[0]) => applicantsLink({ ...base, ...p });
}

/** Conversion rates computed from the same admissions-funnel population, so they always agree with the funnel. */
export function funnelRate(f: AdmissionsFunnelData, num: string, den: string, min = MIN_N) {
  const n = f.steps.find((s) => s.key === num)?.count ?? 0;
  const d = f.steps.find((s) => s.key === den)?.count ?? 0;
  return { numerator: n, denominator: d, value: d >= min ? n / d : null };
}

type Rate = { value: number | null; numerator: number; denominator: number } | null | undefined;

/** A rate as text: the percentage when it may be shown, otherwise the reason it may not. Never a number below `min`. */
function useRateText(min: number) {
  const { t, locale } = useLocale(['university', 'common']);
  return (r: Rate): { display: ReactNode; sub: ReactNode; withheld: boolean; value: number | null } => {
    if (!r || r.denominator === 0) return { display: '—', sub: null, withheld: true, value: null };
    const withheld = r.value === null || r.denominator < min;
    return {
      withheld,
      value: withheld ? null : r.value,
      display: withheld ? t('university:v22.in.lowN', { min }) : formatPercent(r.value!, locale, 0),
      sub: t('university:metric.ofN', { num: formatNumber(r.numerator, locale), den: formatNumber(r.denominator, locale) }),
    };
  };
}

function Question({ id, title, lead, children, aside }: { id: string; title: string; lead?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="un-q uv22-q" id={id} data-question={id} aria-labelledby={`q-${id}`}>
      <header className="un-q__head">
        <div className="un-q__titles">
          <h2 className="un-q__title" id={`q-${id}`}>{title}</h2>
          {lead && <p className="un-q__lead">{lead}</p>}
        </div>
        {aside && <div className="un-q__aside">{aside}</div>}
      </header>
      <div className="un-q__body">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ 0 · the headline */

/**
 * One concise metric row before the questions — submitted, offer rate, yield, visa → enrolment — every figure with its
 * denominator, the small-sample rule from the same funnel population, and a link to its applicants.
 */
function Summary({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const f = useAdmissionsFunnel(filters);
  const d = f.data;
  const min = d?.min_denominator ?? MIN_N;
  const rate = useRateText(min);
  if (!d || d.total === 0) return null;
  const count = (k: string) => d.steps.find((s) => s.key === k)?.count ?? 0;
  const asRate = (m?: { value: number | null; numerator: number | null; denominator: number | null } | null): Rate =>
    (m ? { value: m.value, numerator: m.numerator ?? 0, denominator: m.denominator ?? 0 } : null);
  const items = [
    { k: 'submitted', label: t('university:v25.in.submitted'), value: formatNumber(count('SUBMITTED'), locale), sub: t('university:v25.in.submittedSub'), to: drill({ reached: 'SUBMITTED' }) },
    // The glossary's own definitions, from the same response (offers ÷ decided; enrolled ÷ offers) — not re-derived here.
    { k: 'offer', label: t('university:v25.in.offerRate'), title: t('university:v30.def.offerRate', { defaultValue: d.metrics?.offer_rate?.definition ?? '' }), ...(() => { const r = rate(asRate(d.metrics?.offer_rate)); return { value: r.display, sub: r.sub, low: r.withheld }; })(), to: drill({ reached: 'OFFERED' }) },
    { k: 'yield', label: t('university:v25.in.yield'), title: t('university:v30.def.yield', { defaultValue: d.metrics?.yield?.definition ?? '' }), ...(() => { const r = rate(asRate(d.metrics?.yield)); return { value: r.display, sub: r.sub, low: r.withheld }; })(), to: drill({ reached: 'ENROLLED' }) },
    { k: 'visa', label: t('university:v25.in.visaToEnrol'), ...(() => { const r = rate(funnelRate(d, 'ENROLLED', 'VISA_ISSUED', min)); return { value: r.display, sub: r.sub, low: r.withheld }; })(), to: drill({ reached: 'VISA_ISSUED' }) },
  ];
  return (
    <section className="un-kpis uv25-summary" aria-label={t('university:v25.in.summary')}>
      {items.map((it) => (
        <Link key={it.k} to={it.to} className="un-kpi uv25-summary__item" data-metric={it.k} title={'title' in it ? (it.title as string | undefined) : undefined}>
          <span className="un-kpi__k">{it.label}</span>
          <span className={'low' in it && it.low ? 'un-kpi__v is-low' : 'un-kpi__v hg-num'}>{it.value}</span>
          {it.sub && <span className="un-kpi__s hg-num">{it.sub}</span>}
        </Link>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ 1 · where do we lose them? */

function Dropoff({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const f = useAdmissionsFunnel(filters);
  return (
    <Question id="dropoff" title={t('university:v22.in.q.dropoff')}>
      <QueryState query={f} skeleton={<SkeletonCard lines={8} />}>
        {(d) => {
          if (d.total === 0) return <p className="un-empty uv22-empty">{t('university:dash.noApplicants')}</p>;
          const drop = largestDrop(d);
          const dropStep = d.steps.find((s) => s.key === drop);
          const prev = dropStep ? d.steps[d.steps.indexOf(dropStep) - 1] : undefined;
          const steps: FunnelStep[] = d.steps.map((s) => ({
            key: s.key,
            label: t(`university:af.stepName.${s.key}`),
            count: s.count,
            conversion: s.conversion,
            to: s.count > 0 ? drill({ reached: s.key as ReachedStep }) : undefined,
            title: t(`university:af.stepDef.${s.key}`, { defaultValue: s.definition ?? '' }),
          }));
          const closed = d.rejected + d.withdrawn;
          return (
            <Figure title={t('university:v33.in.funnelTitle')}
              sub={(
                <span className="uv22-callout" data-drop={drop ?? ''}>
                  {dropStep && prev && dropStep.conversion && dropStep.conversion.value !== null ? (
                    <>
                      <b>{t('university:v22.in.largestDrop')}:</b>{' '}
                      <Link to={drill({ reached: prev.key as ReachedStep })}>{t(`university:af.stepName.${prev.key}`)}</Link>
                      {' → '}
                      <Link to={drill({ reached: dropStep.key as ReachedStep })}>{t(`university:af.stepName.${dropStep.key}`)}</Link>
                      {'. '}
                      {t('university:v22.in.dropText', {
                        pct: formatPercent(1 - dropStep.conversion.value, locale, 0),
                        lost: formatNumber(dropStep.conversion.denominator - dropStep.conversion.numerator, locale),
                        of: formatNumber(dropStep.conversion.denominator, locale),
                      })}
                    </>
                  ) : t('university:v22.in.noDrop', { min: d.min_denominator })}
                </span>
              )}
              foot={<>
                {d.population && <><PopulationLine pop={d.population} />{' · '}</>}
                {t('university:af.foot', { rejected: formatNumber(d.rejected, locale), withdrawn: formatNumber(d.withdrawn, locale), min: d.min_denominator })}
                {closed > 0 && <>{' '}<Link to={drill({ status: CLOSED_STATUSES })}>{t('university:v22.in.closedN', { n: formatNumber(closed, locale) })}</Link></>}
              </>}>
              <div className="un-funnel__head" aria-hidden>
                <span>{t('university:af.step')}</span><span /><span>{t('university:af.applications')}</span><span>{t('university:af.fromPrevious')}</span>
              </div>
              <StepFunnel steps={steps} label={t('university:v33.in.funnelTitle')} dropKey={drop} />
            </Figure>
          );
        }}
      </QueryState>
    </Question>
  );
}

/* ------------------------------------------------------------------ 2 · where do applicants come from? */

function Origin({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const qs = useQuestions(filters);
  const an = useAnalytics(filters);
  const all = (qs.data?.countries ?? []).filter((c) => c.submitted > 0).sort((a, b) => b.submitted - a.submitted);
  const countries = all.slice(0, 8);
  const total = qs.data?.population.size ?? 0;
  const min = qs.data?.min_denominator ?? MIN_N;
  const agencies = (an.data?.by_agency ?? []).filter((a) => a.applications > 0).sort((a, b) => b.applications - a.applications).slice(0, 8);
  const name = (c: { key: string | null }) => (c.key
    ? <span className="uc-country"><CountryFlag code={c.key} /><span className="uc-country__name">{countryName(c.key, locale)}</span></span>
    : t('university:v8.an.noCountry'));
  const cRows: RankRow[] = countries.map((c, i) => ({
    key: c.key ?? 'none',
    label: name(c),
    value: c.submitted,
    highlight: i === 0,
    // A row with no country cannot be filtered to, so it is a static row rather than a link to everyone.
    to: c.key ? drill({ nationality: c.key }) : undefined,
    title: t('university:v22.in.countryTitle', { n: c.submitted, offered: c.offered, enrolled: c.enrolled }),
  }));
  // Stage movement per country: counts are always printed; a cell is shaded by its share of that country's submitted
  // applications only when the country has at least `min` of them, and the offer rate keeps the API's own flag.
  const mRows: MatrixRow[] = countries.map((c) => {
    const ok = c.submitted >= min;
    return {
      key: c.key ?? 'none', label: name(c), to: c.key ? drill({ nationality: c.key }) : undefined,
      cells: [
        { count: c.submitted, share: null },
        { count: c.offered, share: ok ? c.offered / c.submitted : null },
        { count: c.enrolled, share: ok ? c.enrolled / c.submitted : null },
      ],
      tail: [<RateNote key="r" r={c.offer_rate} />],
    };
  });
  const aRows: RankRow[] = agencies.map((a, i) => ({
    key: a.agency_id ?? a.agency, label: a.agency, value: a.applications, highlight: i === 0,
    to: a.agency_id ? drill({ agency_id: a.agency_id }) : undefined,
    title: t('university:v22.in.agencyTitle', { n: a.applications, offers: a.offers, enrolled: a.enrolled }),
  }));
  const pop = qs.data?.population;
  const rest = all.length - countries.length;
  return (
    <Question id="origin" title={t('university:v22.in.q.origin')} lead={pop ? <PopulationLine pop={{ ...pop, filters: {}, period: { from: null, to: null } }} /> : undefined}>
      <div className="un-q__grid">
        <Figure title={t('university:v33.in.countryShare')} foot={rest > 0 ? t('university:v33.in.countryRest', { count: rest, shown: countries.length }) : undefined}>
          {qs.isLoading ? <Skeleton h={240} /> : cRows.length ? <RankBars rows={cRows} total={total} min={min} label={t('university:v33.in.countryShare')} /> : <p className="un-empty uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Figure>
        <Figure title={t('university:v33.in.countryStages')}
          foot={<MatrixLegend low={t('university:v33.viz.shareLow')} high={t('university:v33.viz.shareHigh')} note={t('university:v33.viz.unshaded', { min })} />}>
          {qs.isLoading ? <Skeleton h={240} /> : mRows.length ? (
            <HeatMatrix caption={t('university:v8.aq.country')} rows={mRows}
              cols={[{ key: 's', label: t('university:af.stepName.SUBMITTED') }, { key: 'o', label: t('university:af.stepName.OFFERED') }, { key: 'e', label: t('university:af.stepName.ENROLLED') }]}
              tailCols={[{ key: 'r', label: t('university:kpi.offerRate') }]} />
          ) : <p className="un-empty uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Figure>
      </div>
      {/* One team sending everything is a sentence, not a chart: bars are drawn only when there is something to compare. */}
      {aRows.length > 1 && (
        <Figure title={t('university:v22.in.byAgency')} foot={<>{t('university:v22.in.byAgencyFoot')} <Link to="/agencies">{t('common:nav.partnerAgencies')}</Link></>}>
          <RankBars rows={aRows} total={total} min={min} label={t('university:v22.in.byAgency')} />
        </Figure>
      )}
    </Question>
  );
}

/* ------------------------------------------------------------------ 3 · what changes over time? */

/**
 * Submissions per calendar month, last 12 months, from the applications themselves (`series.submitted_monthly`), beside
 * the intakes they were submitted for. Nothing is projected or smoothed; the month in progress is drawn hollow.
 */
function Trend({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const an = useAnalytics(filters);
  const pts = an.data?.series.submitted_monthly ?? [];
  if (an.isLoading) return <Question id="trend" title={t('university:v25.in.q.trend')}><Skeleton h={220} /></Question>;
  if (!pts.length || pts.every((p) => p.value === 0)) return null;
  const total = pts.reduce((a, p) => a + p.value, 0);
  const mom = monthOverMonth(pts);
  const monthName = (m: string) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(`${m}-15T00:00:00`));
  const intakes = [...(an.data?.by_intake ?? [])].filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  const intakeTotal = intakes.reduce((a, i) => a + i.count, 0);
  const iRows: RankRow[] = intakes.map((i, idx) => ({ key: i.key, label: intakeText(i.key, t), value: i.count, highlight: idx === 0, to: applicantsLink({ ...drillParams(filters), intake: i.key }) }));
  return (
    <Question id="trend" title={t('university:v25.in.q.trend')}>
      <div className="un-q__grid un-q__grid--lead">
        <Figure title={t('university:v33.sig.trend')}
          sub={<>
            {t('university:v25.in.trendLead', { n: formatNumber(total, locale) })}
            {mom && <>{' '}{t(mom.delta > 0 ? 'university:v33.sig.momUp' : mom.delta < 0 ? 'university:v33.sig.momDown' : 'university:v33.sig.momSame', {
              last: monthName(mom.last.month), n: formatNumber(mom.last.value, locale), prev: monthName(mom.prev.month), m: formatNumber(mom.prev.value, locale), d: formatNumber(Math.abs(mom.delta), locale),
            })}{mom.partial ? <>{' '}{t('university:v33.sig.momPartial', { month: monthName(mom.partial.month), n: formatNumber(mom.partial.value, locale) })}</> : null}</>}
          </>}
          foot={<Link to={applicantsLink({ ...drillParams(filters), submitted_within: 30 })}>{t('university:v25.in.trendLink')}</Link>}>
          <MonthTrend points={pts} title={t('university:v33.sig.trend')} height={220} linkFor={(m) => applicantsLink({ ...drillParams(filters), submitted_month: m })} />
        </Figure>
        {iRows.length > 0 && (
          <Figure title={t('university:v33.in.byIntake')} foot={t('university:v33.in.byIntakeFoot')}>
            <RankBars rows={iRows} total={intakeTotal} label={t('university:v33.in.byIntake')} />
          </Figure>
        )}
      </div>
    </Question>
  );
}

/* ------------------------------------------------------------------ 4 · who gets admitted and enrols? */

function Admit({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const f = useAdmissionsFunnel(filters);
  const qs = useQuestions(filters);
  const min = f.data?.min_denominator ?? MIN_N;
  const d = f.data;
  const count = (k: string) => d?.steps.find((x) => x.key === k)?.count ?? 0;
  const ofOffers = (k: string) => { const r = d ? funnelRate(d, k, 'OFFERED', min) : null; return r ? { ...r, insufficient_data: r.value === null } : null; };
  const chain: FunnelStep[] = d ? (['OFFERED', 'ACCEPTED', 'ENROLLED'] as ReachedStep[]).map((k, i) => ({
    key: k, label: t(`university:af.stepName.${k}`), count: count(k), conversion: i === 0 ? null : ofOffers(k),
    to: count(k) > 0 ? drill({ reached: k }) : undefined, title: t(`university:af.stepDef.${k}`),
  })) : [];
  const programs = (qs.data?.programs ?? []).filter((p) => p.submitted > 0).sort((a, b) => b.submitted - a.submitted).slice(0, 8);
  const qmin = qs.data?.min_denominator ?? MIN_N;
  const pTotal = qs.data?.population.size ?? 0;
  const pRows: RankRow[] = programs.map((p, i) => ({
    key: p.id,
    label: p.key,
    sub: p.degree ? t(`common:degreeShort.${p.degree}`) : undefined,
    value: p.submitted,
    highlight: i === 0,
    note: (
      <span className="un-prograte">
        <span className="un-rank__of hg-num">{t('university:metric.ofN', { num: formatNumber(p.submitted, locale), den: formatNumber(pTotal, locale) })}</span>
        <span className="un-prograte__r"><span className="un-prograte__k">{t('university:kpi.offerRate')}</span><RateNote r={p.offer_rate} /></span>
      </span>
    ),
    to: drill({ program_id: p.id }),
    title: t('university:v30.def.offerRate', { defaultValue: qs.data?.definitions.offer_rate ?? '' }),
  }));
  return (
    <Question id="admit" title={t('university:v22.in.q.admit')}>
      <div className="un-q__grid">
        <Figure title={t('university:v33.in.chainTitle')} foot={t('university:v22.in.chainFoot', { min })}>
          {f.isLoading ? <Skeleton h={120} /> : <StepFunnel steps={chain} label={t('university:v33.in.chainTitle')} base={count('OFFERED') || 1} />}
        </Figure>
        <Figure title={t('university:v33.in.programTitle')} foot={t('university:v22.in.byProgramFoot', { min: qmin })}>
          {qs.isLoading ? <Skeleton h={160} /> : pRows.length ? <RankBars rows={pRows} label={t('university:v33.in.programTitle')} /> : <p className="un-empty uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Figure>
      </div>
    </Question>
  );
}

/* ------------------------------------------------------------------ 5 · do they settle in after enrolment? */

function Settle({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  // The page's filter bar applies here too.
  const m = useMetrics(filters);
  const c = m.data?.cohorts;
  const min = c?.min_denominator ?? MIN_N;
  const cohorts = (c?.cohorts ?? []).filter((x) => x.enrolled > 0).sort((a, b) => a.cohort.localeCompare(b.cohort));
  const rateCell = (r: RateKpi) => {
    const low = withheld(r);
    return {
      count: r.denominator ? r.numerator : null,
      share: low ? null : r.value,
      text: r.denominator ? <RateNote r={r} /> : undefined,
    };
  };
  const rows: MatrixRow[] = cohorts.map((x) => ({
    key: x.cohort,
    label: intakeText(x.cohort, t),
    to: `/cohorts/list?cohort=${encodeURIComponent(x.cohort)}`,
    cells: [{ count: x.enrolled, share: null }, rateCell(x.retention), rateCell(x.graduation)],
  }));
  const tot = c?.total;
  return (
    <Question id="settle" title={t('university:v22.in.q.settle')}
      lead={tot ? t('university:v4.life.popEnrol', { n: formatNumber(tot.enrolled, locale) }) : undefined}
      aside={tot ? (
        <dl className="un-totals uv22-totals">
          <div><dt>{t('university:v4.life.retained')}</dt><dd><Link to="/cohorts/list"><RateNote r={tot.retention} /></Link></dd></div>
          <div><dt>{t('university:v4.life.graduated')}</dt><dd><Link to="/cohorts/list"><RateNote r={tot.graduation} /></Link></dd></div>
        </dl>
      ) : undefined}>
      <Figure title={t('university:v22.in.byCohort')}
        foot={<>
          <MatrixLegend low={t('university:v33.viz.rateLow')} high={t('university:v33.viz.rateHigh')} note={t('university:v33.viz.unshaded', { min })} />
          <span className="un-figure__note">{t('university:v22.in.byCohortFoot', { min })} <Link to="/cohorts">{t('university:nav.students')}</Link></span>
        </>}>
        {m.isLoading ? <Skeleton h={160} /> : rows.length ? (
          <HeatMatrix caption={t('university:cohorts.cohort')} rows={rows}
            cols={[{ key: 'n', label: t('university:enrollment.ENROLLED') }, { key: 'r', label: t('university:v4.life.retained'), sep: true }, { key: 'g', label: t('university:v4.life.graduated') }]} />
        ) : <p className="un-empty uv22-empty">{t('university:outcomes.empty')}</p>}
      </Figure>
    </Question>
  );
}

export default function Analytics() {
  const { t } = useLocale(['university', 'common']);
  const [filters, setFilters] = useUrlFilters();
  return (
    <div className="uv7 uv7-analytics uv22-insights un-page un-insights">
      <PageHeader title={t('university:v22.nav.insights')} subtitle={t('university:v24.in.subtitle')} actions={<GlossaryButton />} />
      <div className="un-insights__filters"><FilterBar value={filters} onChange={setFilters} /></div>
      <Summary filters={filters} />
      <Dropoff filters={filters} />
      <Origin filters={filters} />
      <Trend filters={filters} />
      <Admit filters={filters} />
      <Settle filters={filters} />
    </div>
  );
}
