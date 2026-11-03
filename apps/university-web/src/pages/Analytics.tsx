import { useEffect, useRef, useState } from 'react';
// PRIMARY QUESTIONS, in order (V22, REPORT §250 V4): 지원자는 어디에서 오나요? · 어디에서 이탈하나요? · 어떤 학생이 합격하고
// 입학하나요? · 입학 후 잘 정착하고 있나요? The page is those four sections — not a card grid, not tabs. Horizontal bars,
// funnel bars and one paired-bar chart; every bar and every number opens the applicant table filtered to exactly the
// records it counts. Rates below the minimum sample are text ("n < 5"), never a bar. One ink; tangerine only for the one
// highlighted bar in a section.
import { useLocale } from '@hangyul/i18n';
import type { AdmissionsFunnel as AdmissionsFunnelData, RateKpi } from '@hangyul/types';
import { QueryState, Skeleton, SkeletonCard } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { countryName, formatNumber, formatPercent } from '@hangyul/utils';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { largestDrop } from '../components/AdmissionsFunnel';
import { FilterBar, useUrlFilters } from '../components/FilterBar';
import { PopulationLine } from '../components/Population';
import { GlossaryButton } from '../components/v8/Glossary';
import { HBars, PairedBars, type BarRow } from '../components/v22/Bars';
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
    <section className="uv22-q" data-question={id} aria-labelledby={`q-${id}`}>
      <header className="uv22-q__head">
        <h2 className="uv22-q__title" id={`q-${id}`}>{title}</h2>
        {lead && <p className="uv22-q__lead">{lead}</p>}
        {aside && <div className="uv22-q__aside">{aside}</div>}
      </header>
      <div className="uv22-q__body">{children}</div>
    </section>
  );
}

function Chart({ title, children, foot }: { title: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="uv22-chart">
      <h3 className="uv22-chart__title">{title}</h3>
      {children}
      {foot && <p className="uv22-chart__foot">{foot}</p>}
    </div>
  );
}


/* ------------------------------------------------------------------ 0 · the headline and what changes over time (V25) */

/**
 * V25 (REPORT §315 U3): one concise metric row before the questions — submitted, offer rate, yield, visa → enrolment — every
 * figure with its denominator, the n < min honesty rule from the same funnel population, and a link to its applicants.
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
    { k: 'offer', label: t('university:v25.in.offerRate'), title: d.metrics?.offer_rate?.definition, ...(() => { const r = rate(asRate(d.metrics?.offer_rate)); return { value: r.display, sub: r.sub }; })(), to: drill({ reached: 'OFFERED' }) },
    { k: 'yield', label: t('university:v25.in.yield'), title: d.metrics?.yield?.definition, ...(() => { const r = rate(asRate(d.metrics?.yield)); return { value: r.display, sub: r.sub }; })(), to: drill({ reached: 'ENROLLED' }) },
    { k: 'visa', label: t('university:v25.in.visaToEnrol'), ...(() => { const r = rate(funnelRate(d, 'ENROLLED', 'VISA_ISSUED', min)); return { value: r.display, sub: r.sub }; })(), to: drill({ reached: 'VISA_ISSUED' }) },
  ];
  return (
    <section className="uv25-summary" aria-label={t('university:v25.in.summary')}>
      {items.map((it) => (
        <Link key={it.k} to={it.to} className="uv25-summary__item" data-metric={it.k} title={'title' in it ? (it.title as string | undefined) : undefined}>
          <span className="uv25-summary__k">{it.label}</span>
          <span className="uv25-summary__v hg-num">{it.value}</span>
          {it.sub && <span className="uv25-summary__s">{it.sub}</span>}
        </Link>
      ))}
    </section>
  );
}

/**
 * V25 (REPORT §315 U3, brief §41 "what changes over time?"): submissions per calendar month, last 12 months, from the
 * applications themselves (`series.submitted_monthly`). One ink line, a marker per month, the latest month labelled; every
 * point carries its value on hover and in an accessible table. Nothing is projected or smoothed.
 */
function Trend({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const an = useAnalytics(filters);
  const nav = useNavigate();
  const pts = an.data?.series.submitted_monthly ?? [];
  // V26 (REPORT §352 → fixed): the SVG is drawn at the container's pixel width, so text keeps its CSS size on a phone
  // instead of shrinking with the viewBox (the month labels were ≈ 5 px at 390). Fewer month labels when narrow.
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  // Re-run when the chart appears: on the first render the component is still loading and the wrapper does not exist yet.
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver((es) => { const w = Math.round(es[0].contentRect.width); if (w > 0) setW(Math.max(280, Math.min(820, w))); });
    ro.observe(el); return () => ro.disconnect();
  }, [an.isLoading, pts.length]);
  if (an.isLoading) return <Skeleton h={180} />;
  if (!pts.length || pts.every((p) => p.value === 0)) return null;
  const H = 180; const L = 28; const R = 12; const T = 16; const B = 28;
  const labelEvery = W < 420 ? 3 : 2;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const monthLabel = (m: string) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(`${m}-15T00:00:00`));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const total = pts.reduce((a, p) => a + p.value, 0);
  return (
    <Question id="trend" title={t('university:v25.in.q.trend')} lead={t('university:v25.in.trendLead', { n: formatNumber(total, locale) })}>
      <div className="uv25-trend" ref={wrap}>
        {/* V26 (REPORT §348): a group, not an image — each month is a link (focusable), and role="img" hid those links from assistive tech (axe nested-interactive). */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('university:v25.in.trendAria', { n: formatNumber(total, locale) })}>
          {[0, 0.5, 1].map((g) => <line key={g} className="uv25-trend__grid" x1={L} x2={W - R} y1={y(max * g)} y2={y(max * g)} />)}
          <text className="uv25-trend__axis" x={L - 8} y={y(max) + 4} textAnchor="end">{formatNumber(max, locale)}</text>
          <text className="uv25-trend__axis" x={L - 8} y={y(0) + 4} textAnchor="end">0</text>
          <path className="uv25-trend__line" d={path} />
          {pts.map((p, i) => (
            <g key={p.month} className={`uv25-trend__pt${p.value ? ' is-link' : ''}`} role={p.value ? 'link' : undefined} tabIndex={p.value ? 0 : undefined}
              aria-label={p.value ? `${p.month} · ${formatNumber(p.value, locale)}` : undefined}
              onClick={p.value ? () => nav(applicantsLink({ ...drillParams(filters), submitted_month: p.month })) : undefined}
              onKeyDown={p.value ? (e) => { if (e.key === 'Enter') nav(applicantsLink({ ...drillParams(filters), submitted_month: p.month })); } : undefined}>
              <rect className="uv25-trend__hit" x={x(i) - 18} y={T} width={36} height={H - T - B} />
              <circle cx={x(i)} cy={y(p.value)} r={4} />
              <text className="uv25-trend__tip" x={x(i)} y={y(p.value) - 10} textAnchor="middle">{formatNumber(p.value, locale)}</text>
              <title>{`${p.month} · ${formatNumber(p.value, locale)}`}</title>
              {((pts.length - 1 - i) % labelEvery === 0) && <text className="uv25-trend__axis" x={x(i)} y={H - 8} textAnchor="middle">{monthLabel(p.month)}</text>}
            </g>
          ))}
          <text className="uv25-trend__last" x={x(pts.length - 1)} y={y(last.value) - 10} textAnchor="end">{formatNumber(last.value, locale)}</text>
        </svg>
        <table className="hg-sr-only">
          <caption>{t('university:v25.in.q.trend')}</caption>
          <tbody>{pts.map((p) => <tr key={p.month}><th scope="row">{p.month}</th><td>{p.value}</td></tr>)}</tbody>
        </table>
        <p className="uv22-chart__foot"><Link to={applicantsLink({ ...drillParams(filters), submitted_within: 30 })}>{t('university:v25.in.trendLink')}</Link></p>
      </div>
    </Question>
  );
}

/* ------------------------------------------------------------------ 1 · where do applicants come from? */

function Origin({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const qs = useQuestions(filters);
  const an = useAnalytics(filters);
  const countries = (qs.data?.countries ?? []).filter((c) => c.submitted > 0).sort((a, b) => b.submitted - a.submitted).slice(0, 8);
  const agencies = (an.data?.by_agency ?? []).filter((a) => a.applications > 0).sort((a, b) => b.applications - a.applications).slice(0, 8);
  const cRows: BarRow[] = countries.map((c) => ({
    key: c.key ?? 'none',
    label: c.key ? countryName(c.key, locale) : t('university:v8.an.noCountry'),
    value: c.submitted,
    highlight: countries.indexOf(c) === 0,
    // V23 §273 U4: a row with no country cannot be filtered to, so it is a static row rather than a link to everyone.
    to: c.key ? drill({ nationality: c.key }) : undefined,
    title: t('university:v22.in.countryTitle', { n: c.submitted, offered: c.offered, enrolled: c.enrolled }),
    sub: c.enrolled > 0 ? t('university:v15.ov.enrolledN', { n: formatNumber(c.enrolled, locale) }) : undefined,
  }));
  const aRows: BarRow[] = agencies.map((a) => ({
    key: a.agency_id ?? a.agency,
    label: a.agency,
    value: a.applications,
    highlight: agencies.indexOf(a) === 0,
    to: a.agency_id ? drill({ agency_id: a.agency_id }) : undefined,
    title: t('university:v22.in.agencyTitle', { n: a.applications, offers: a.offers, enrolled: a.enrolled }),
    sub: a.enrolled > 0 ? t('university:v15.ov.enrolledN', { n: formatNumber(a.enrolled, locale) }) : undefined,
  }));
  const pop = qs.data?.population;
  return (
    <Question id="origin" title={t('university:v22.in.q.origin')} lead={pop ? <PopulationLine pop={{ ...pop, filters: {}, period: { from: null, to: null } }} /> : undefined}>
      <div className="uv22-q__grid">
        <Chart title={t('university:v22.in.byCountry')} foot={t('university:v22.in.byCountryFoot')}>
          {qs.isLoading ? <Skeleton h={160} /> : cRows.length ? <HBars rows={cRows} label={t('university:v22.in.byCountry')} /> : <p className="uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Chart>
        <Chart title={t('university:v22.in.byAgency')} foot={<>{t('university:v22.in.byAgencyFoot')} <Link to="/agencies">{t('common:nav.partnerAgencies')}</Link></>}>
          {an.isLoading ? <Skeleton h={160} /> : aRows.length ? <HBars rows={aRows} label={t('university:v22.in.byAgency')} /> : <p className="uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Chart>
      </div>
    </Question>
  );
}

/* ------------------------------------------------------------------ 2 · where do we lose them? */

function Dropoff({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const f = useAdmissionsFunnel(filters);
  const rate = useRateText(f.data?.min_denominator ?? MIN_N);
  return (
    <Question id="dropoff" title={t('university:v22.in.q.dropoff')}>
      <QueryState query={f} skeleton={<SkeletonCard lines={8} />}>
        {(d) => {
          if (d.total === 0) return <p className="uv22-empty">{t('university:dash.noApplicants')}</p>;
          const drop = largestDrop(d);
          const dropStep = d.steps.find((s) => s.key === drop);
          const prev = dropStep ? d.steps[d.steps.indexOf(dropStep) - 1] : undefined;
          const max = d.steps[0]?.count ?? 1;
          const rows: BarRow[] = d.steps.map((s) => {
            const r = rate(s.conversion);
            return {
              key: s.key,
              label: t(`university:af.stepName.${s.key}`),
              value: s.count,
              display: formatNumber(s.count, locale),
              sub: s.conversion ? <>{r.display}{!r.withheld && <> {t('university:v22.in.ofPrevious')}</>}</> : undefined,
              highlight: s.key === drop,
              to: s.count > 0 ? drill({ reached: s.key as ReachedStep }) : undefined,
              title: s.definition ?? t(`university:af.stepDef.${s.key}`),
            };
          });
          const closed = d.rejected + d.withdrawn;
          return (
            <div className="uv22-q__grid uv22-q__grid--wide">
              <Chart title={t('university:v22.in.funnel')} foot={<>{d.population && <PopulationLine pop={d.population} />}{' · '}{t('university:af.foot', { rejected: formatNumber(d.rejected, locale), withdrawn: formatNumber(d.withdrawn, locale), min: d.min_denominator })}</>}>
                <HBars rows={rows} label={t('university:v22.in.funnel')} max={max} />
              </Chart>
              <div className="uv22-callout" data-drop={drop ?? ''}>
                {dropStep && prev && dropStep.conversion && dropStep.conversion.value !== null ? (
                  <>
                    <p className="uv22-callout__k">{t('university:v22.in.largestDrop')}</p>
                    <p className="uv22-callout__v">
                      <Link to={drill({ reached: prev.key as ReachedStep })}>{t(`university:af.stepName.${prev.key}`)}</Link>
                      {' → '}
                      <Link to={drill({ reached: dropStep.key as ReachedStep })}>{t(`university:af.stepName.${dropStep.key}`)}</Link>
                    </p>
                    <p className="uv22-callout__d">
                      {t('university:v22.in.dropText', {
                        pct: formatPercent(1 - dropStep.conversion.value, locale, 0),
                        lost: formatNumber(dropStep.conversion.denominator - dropStep.conversion.numerator, locale),
                        of: formatNumber(dropStep.conversion.denominator, locale),
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="uv22-callout__k">{t('university:v22.in.largestDrop')}</p>
                    <p className="uv22-callout__d">{t('university:v22.in.noDrop', { min: d.min_denominator })}</p>
                  </>
                )}
                {closed > 0 && (
                  <p className="uv22-callout__d">
                    <Link to={drill({ status: CLOSED_STATUSES })}>{t('university:v22.in.closedN', { n: formatNumber(closed, locale) })}</Link>
                  </p>
                )}
              </div>
            </div>
          );
        }}
      </QueryState>
    </Question>
  );
}

/* ------------------------------------------------------------------ 3 · who gets admitted and enrols? */

function Admit({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  const drill = useDrill(filters);
  const f = useAdmissionsFunnel(filters);
  const qs = useQuestions(filters);
  const min = f.data?.min_denominator ?? MIN_N;
  const rate = useRateText(min);
  const d = f.data;
  const steps: { key: ReachedStep; rate?: ReturnType<typeof funnelRate> }[] = d ? [
    { key: 'OFFERED' },
    { key: 'ACCEPTED', rate: funnelRate(d, 'ACCEPTED', 'OFFERED', min) },
    { key: 'ENROLLED', rate: funnelRate(d, 'ENROLLED', 'OFFERED', min) },
  ] : [];
  const chain: BarRow[] = steps.map((s) => {
    const count = d?.steps.find((x) => x.key === s.key)?.count ?? 0;
    const r = s.rate ? rate(s.rate) : null;
    return {
      key: s.key, label: t(`university:af.stepName.${s.key}`), value: count, display: formatNumber(count, locale),
      sub: r ? <>{r.display} {t('university:v22.in.ofOffers')}</> : undefined,
      to: count > 0 ? drill({ reached: s.key }) : undefined,
      title: t(`university:af.stepDef.${s.key}`),
    };
  });
  const programs = (qs.data?.programs ?? []).filter((p) => p.submitted > 0).sort((a, b) => (b.offer_rate.value ?? -1) - (a.offer_rate.value ?? -1) || b.submitted - a.submitted).slice(0, 8);
  const qmin = qs.data?.min_denominator ?? MIN_N;
  const prate = useRateText(qmin);
  const best = programs.find((p) => p.offer_rate.value !== null && p.offer_rate.denominator >= qmin);
  const pRows: BarRow[] = programs.map((p) => {
    const r = prate(p.offer_rate);
    return {
      key: p.id,
      label: <>{p.key}{p.degree ? <span className="uv22-bar__deg"> · {t(`common:degreeShort.${p.degree}`)}</span> : null}</>,
      value: (r.value ?? 0) * 100,
      display: r.display,
      sub: r.sub,
      withheld: r.withheld,
      highlight: !!best && p.id === best.id,
      to: drill({ program_id: p.id, reached: 'OFFERED' }),
      title: qs.data?.definitions.offer_rate,
    };
  });
  return (
    <Question id="admit" title={t('university:v22.in.q.admit')}>
      <div className="uv22-q__grid">
        <Chart title={t('university:v22.in.chain')} foot={t('university:v22.in.chainFoot', { min })}>
          {f.isLoading ? <Skeleton h={120} /> : <HBars rows={chain} label={t('university:v22.in.chain')} max={d?.steps.find((x) => x.key === 'OFFERED')?.count || 1} />}
        </Chart>
        <Chart title={t('university:v22.in.byProgram')} foot={t('university:v22.in.byProgramFoot', { min: qmin })}>
          {qs.isLoading ? <Skeleton h={160} /> : pRows.length ? <HBars rows={pRows} label={t('university:v22.in.byProgram')} max={100} /> : <p className="uv22-empty">{t('university:dash.noApplicants')}</p>}
        </Chart>
      </div>
    </Question>
  );
}

/* ------------------------------------------------------------------ 4 · do they settle in after enrolment? */

function Settle({ filters }: { filters: AnalyticsFilters }) {
  const { t, locale } = useLocale(['university', 'common']);
  // V23 §273 U4: the page's filter bar applies here too (it was ignored).
  const m = useMetrics(filters);
  const c = m.data?.cohorts;
  const min = c?.min_denominator ?? MIN_N;
  const rate = useRateText(min);
  const kpi = (r: RateKpi) => rate({ value: r.value, numerator: r.numerator, denominator: r.denominator });
  const cohorts = (c?.cohorts ?? []).filter((x) => x.enrolled > 0).sort((a, b) => a.cohort.localeCompare(b.cohort));
  const rows = cohorts.map((x) => {
    const r = kpi(x.retention);
    const g = kpi(x.graduation);
    return {
      key: x.cohort,
      label: <>{intakeText(x.cohort, t)}<span className="uv22-bar__deg"> · {t('university:v22.in.enrolledN', { n: formatNumber(x.enrolled, locale) })}</span></>,
      to: `/cohorts/list?cohort=${encodeURIComponent(x.cohort)}`,
      title: `${t('university:v4.life.retained')}: ${r.sub ?? '—'} · ${t('university:v4.life.graduated')}: ${g.sub ?? '—'}`,
      a: { value: r.value, display: r.display },
      b: { value: g.value, display: g.display },
    };
  });
  const tot = c?.total;
  return (
    <Question id="settle" title={t('university:v22.in.q.settle')}
      lead={tot ? t('university:v4.life.popEnrol', { n: formatNumber(tot.enrolled, locale) }) : undefined}
      aside={tot ? (
        <dl className="uv22-totals">
          <div><dt>{t('university:v4.life.retained')}</dt><dd><Link to="/cohorts/list">{kpi(tot.retention).display}</Link> <span className="uv22-bar__sub">{kpi(tot.retention).sub}</span></dd></div>
          <div><dt>{t('university:v4.life.graduated')}</dt><dd><Link to="/cohorts/list">{kpi(tot.graduation).display}</Link> <span className="uv22-bar__sub">{kpi(tot.graduation).sub}</span></dd></div>
        </dl>
      ) : undefined}>
      <Chart title={t('university:v22.in.byCohort')} foot={<>{t('university:v22.in.byCohortFoot', { min })} <Link to="/cohorts">{t('university:nav.students')}</Link></>}>
        {m.isLoading ? <Skeleton h={160} /> : rows.length ? (
          <PairedBars rows={rows} label={t('university:v22.in.byCohort')} legend={[t('university:v4.life.retained'), t('university:v4.life.graduated')]} />
        ) : <p className="uv22-empty">{t('university:outcomes.empty')}</p>}
      </Chart>
    </Question>
  );
}

export default function Analytics() {
  const { t } = useLocale(['university', 'common']);
  const [filters, setFilters] = useUrlFilters();
  return (
    <div className="uv7 uv7-analytics uv22-insights">
      <PageHeader title={t('university:v22.nav.insights')} sub={t('university:v24.in.subtitle')} actions={<GlossaryButton />} />
      <div className="uv22-insights__filters"><FilterBar value={filters} onChange={setFilters} /></div>
      <Summary filters={filters} />
      <Dropoff filters={filters} />
      <Origin filters={filters} />
      <Trend filters={filters} />
      <Admit filters={filters} />
      <Settle filters={filters} />
    </div>
  );
}
