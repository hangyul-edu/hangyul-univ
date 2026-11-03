import { useAuth } from '@hangyul/auth';
import type { AgencyPerformance, RateKpi } from '@hangyul/types';
import { Callout, DataTable, QueryState, Segmented, FilterSelect, type ColumnDef } from '@hangyul/ui';
import { Col, PageHeader, ProgressRow, Row, StatCard, YCard, type YxTone } from '@hangyul/ynex-ui';
import { CircleGauge, FileWarning, MessageSquareReply, Timer } from '@hangyul/icons';
import type { ReactNode } from 'react';
import { countryName, formatMoney, formatNumber, formatPercent } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';

import { useIntakeLabel } from '../components/Analytics';
import { Meter, Person, kvCard, useT } from '../components/bits';
import { OutcomeMetrics } from '../components/OutcomeMetrics';
import { ProcessQuality } from '../components/ProcessQuality';
import { PlanDelivery } from '../components/Plan';
import { PageFallback } from '../components/PageFallback';
import { usePerms, useUrlFilters } from '../lib/hooks';
import { OperationsView } from './Operations';
import { useCountries } from './Students';

type Row = AgencyPerformance['workload'][number];
const PERIODS = ['30', '90', '365'] as const;
const STEP_STATUS: Record<string, string | null> = {
  STARTED: null, SUBMITTED: 'SUBMITTED', OFFERED: 'OFFERED', ACCEPTED: 'OFFER_ACCEPTED', TUITION_PAID: 'TUITION_PAID', VISA_ISSUED: 'VISA_ISSUED', ENROLLED: 'ENROLLED',
};

/** "12 of 19 · 63%" — or "Too few to rate (2 of 3)" below the minimum sample. Never a bare percentage. */
function RateText({ r }: { r: RateKpi | null }) {
  const { t, locale } = useT();
  if (!r) return <span className="hg-subtle">—</span>;
  if (r.insufficient_data || r.value === null) return <span className="hg-subtle">{t('perf3.tooFew', { num: r.numerator, den: r.denominator })}</span>;
  return <span className="hg-num">{t('perf3.rate', { pct: formatPercent(r.value, locale, 0), num: formatNumber(r.numerator, locale), den: formatNumber(r.denominator, locale) })}</span>;
}

/** A rate as an HRM stat card: the % only when the sample is large enough, always with "n of N"; links to the records. */
function RateStat({ label, r, to, tone, icon, def }: { label: string; r: RateKpi; to?: string; tone: YxTone; icon: ReactNode; def?: string }) {
  const { t, locale } = useT();
  const insufficient = r.insufficient_data || r.value === null;
  return (
    <StatCard tone={tone} icon={icon} label={label} to={to}
      value={insufficient ? <span className="fs-14 text-muted">{t('states.insufficientData')}</span> : formatPercent(r.value, locale, 0)}
      caption={<>{insufficient ? t('perf3.tooFew', { num: r.numerator, den: r.denominator }) : t('perf3.fraction', { num: r.numerator, den: r.denominator })}{def && <span className="d-block">{def}</span>}</>} />
  );
}

function Outcomes({ switcher }: { switcher?: ReactNode }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const intakeLabel = useIntakeLabel();
  const countries = useCountries();
  const f = useUrlFilters(['intake', 'days', 'nationality', 'agency_id'] as const);
  const days = ((PERIODS as readonly string[]).includes(f.values.days) ? f.values.days : '90') as (typeof PERIODS)[number];
  const query = { intake: f.values.intake || undefined, days, nationality: f.values.nationality || undefined, agency_id: f.values.agency_id || undefined };
  const q = useQuery({ queryKey: ['agency', 'performance', query], queryFn: () => api.agency.performance(query), placeholderData: keepPreviousData });
  const agencies = useQuery({ queryKey: ['agency', 'agencies'], queryFn: () => api.agency.agencies(), enabled: perms.isHangyul });
  const team = useQuery({ queryKey: ['agency', 'team'], queryFn: () => api.agency.team(), staleTime: 5 * 60_000, enabled: !perms.isHangyul });
  const capacity = team.data?.organization.capacity_active_cases ?? null;
  const perHead = capacity ? Math.round(capacity / (team.data?.members.length || 1)) : null;

  const cols: ColumnDef<Row>[] = [
    { id: 'name', accessorKey: 'name', header: t('dash.workload.member'), meta: { primary: true, label: t('dash.workload.member') }, cell: ({ row }) => <Person name={row.original.name} sub={t(`role.${row.original.role}`)} to={`/students?counselor=${row.original.user_id}`} /> },
    { id: 'active', accessorKey: 'active_students', header: t('dash.workload.students'), meta: { numeric: true, label: t('dash.workload.students') } },
    { id: 'load', accessorFn: (r) => r.active_students, header: t('perf.load'), enableSorting: false, meta: { label: t('perf.load') },
      cell: ({ row }) => perHead ? <span className="ag-mini-progress" style={{ minWidth: 110 }}><Meter value={row.original.active_students} max={perHead} label={t('perf.load')} /><span className="hg-xs hg-num">{Math.round((row.original.active_students / perHead) * 100)}%</span></span> : <span className="hg-subtle">—</span> },
    { id: 'open', accessorKey: 'open_tasks', header: t('dash.workload.open'), meta: { numeric: true, label: t('dash.workload.open') } },
    { id: 'overdue', accessorKey: 'overdue_tasks', header: t('dash.workload.overdue'), meta: { numeric: true, label: t('dash.workload.overdue') },
      cell: ({ getValue }) => (getValue<number>() ? <span className="ag-overdue hg-num">{getValue<number>()}</span> : <span className="hg-subtle">0</span>) },
  ];

  return (
    <div className="ag7 ag7-perf">
      <PageHeader title={t('nav.performance')} sub={t('perf3.subV4')}
        actions={<div className="ag-perf-filters">
          {switcher}
          {perms.isHangyul && (
            <FilterSelect size="sm" label={t('perf.agency')} value={f.values.agency_id} onChange={(e) => f.set({ agency_id: e.target.value })} style={{ width: 'auto' }}>
              <option value="">{t('perf.allAgencies')}</option>
              {(agencies.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </FilterSelect>
          )}
          <FilterSelect size="sm" label={t('perf3.intake')} value={q.data?.intake ?? f.values.intake} onChange={(e) => f.set({ intake: e.target.value })} style={{ width: 'auto' }}>
            {(q.data?.intakes ?? []).map((i) => <option key={i.intake} value={i.intake}>{t('perf3.intakeOption', { intake: intakeLabel(i.intake), count: i.applications })}</option>)}
          </FilterSelect>
          <FilterSelect size="sm" label={t('students.col.nationality')} value={f.values.nationality} onChange={(e) => f.set({ nationality: e.target.value })} style={{ width: 'auto' }}>
            <option value="">{t('students.f.allNationalities')}</option>
            {(countries.data ?? []).map((c) => <option key={c.code} value={c.code}>{countryName(c.code, locale)}</option>)}
          </FilterSelect>
          <span className="d-inline-flex align-items-center gap-2"><span className="text-muted fs-12">{t('perf3.opsPeriod')}</span><Segmented label={t('dash.period')} value={days} onChange={(v) => f.set({ days: v === '90' ? null : v })} options={PERIODS.map((p) => ({ value: p, label: t('dash.days', { count: Number(p) }) }))} /></span>
        </div>} />
      {perms.isHangyul && !f.values.agency_id && <Callout tone="info">{t('perf.allAgenciesNote')}</Callout>}
      <QueryState query={q} skeleton={<PageFallback />}>
        {(d) => {
          const max = Math.max(1, ...d.cohort.funnel.map((s) => s.count));
          const step = (k: string) => d.cohort.funnel.find((s) => s.step === k)?.count ?? 0;
          const natMax = Math.max(1, ...d.cohort.by_nationality.map((r) => r.count));
          return (
            <div style={{ opacity: q.isPlaceholderData ? 0.6 : 1 }}>
              <div className="ag7-stats">
                <RateStat tone="success" icon={<CircleGauge />} label={t('perf3.enrollConversion')} r={d.cohort.enrollment_conversion} to="/applications?status=ENROLLED" />
                <RateStat tone="primary" icon={<Timer />} label={t('perf3.sla')} r={d.operations.sla} to="/students?sla=1" />
                <RateStat tone="warning" icon={<FileWarning />} label={t('perf3.correction')} r={d.operations.document_correction} to="/documents" />
                <StatCard tone="danger" icon={<MessageSquareReply />} label={t('perf3.unanswered')} value={formatNumber(d.operations.sla.unanswered, locale)}
                  caption={t('perf3.lastDays', { count: d.operations.period_days })} to="/students?sla=1" />
              </div>
              <Row>
                <Col xl={8}>
                  <YCard title={t('perf3.cohortTitle', { intake: d.intake ? intakeLabel(d.intake) : t('perf.allIntakes') })} flush
                    footer={<p className="text-muted fs-12 mb-0">{t('perf3.cohortSummary', {
                      intake: d.intake ? intakeLabel(d.intake) : t('perf.allIntakes'),
                      started: formatNumber(step('STARTED'), locale), submitted: formatNumber(step('SUBMITTED'), locale),
                      offers: formatNumber(step('OFFERED'), locale), enrolled: formatNumber(step('ENROLLED'), locale),
                    })}</p>}>
                    <div className="table-responsive">
                      <table className="hg-table ag-funnel-table ag7-table">
                        <caption className="hg-sr-only">{t('perf3.cohortTitle', { intake: d.intake ?? '' })}</caption>
                        <thead><tr><th scope="col">{t('perf3.step')}</th><th scope="col" className="hg-table__num">{t('perf3.applications')}</th><th aria-hidden /><th scope="col">{t('perf3.fromPrevious')}</th></tr></thead>
                        <tbody>
                          {d.cohort.funnel.map((s) => {
                            const st = STEP_STATUS[s.step];
                            return (
                              <tr key={s.step}>
                                <td>{st ? <Link className="hg-link" to={`/applications?status=${st}${d.intake ? `&intake=${d.intake}` : ''}`}>{t(`perf3.funnel.${s.step}`)}</Link> : t(`perf3.funnel.${s.step}`)}</td>
                                <td className="hg-table__num fw-semibold">{formatNumber(s.count, locale)}</td>
                                <td className="ag-funnel-table__bar"><span style={{ width: `${(s.count / max) * 100}%` }} /></td>
                                <td><RateText r={s.from_previous} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </YCard>
                </Col>
                <Col xl={4}>
                  <YCard title={t('perf3.processing')} flush className="ag7-fill" footer={<p className="text-muted fs-12 mb-0">{t('perf3.processingSub')}</p>}>
                    <table className="hg-table ag7-table">
                      <thead><tr><th scope="col">{t('perf3.stage')}</th><th scope="col" className="hg-table__num">{t('perf3.median')}</th><th scope="col" className="hg-table__num">{t('perf3.basedOn')}</th></tr></thead>
                      <tbody>
                        {d.cohort.processing.map((p) => (
                          <tr key={p.stage}>
                            <td>{t(`perf3.stages.${p.stage}`)}</td>
                            <td className="hg-table__num fw-semibold">{p.insufficient_data || p.median_days === null ? <span className="text-muted fw-normal">{t('states.insufficientData')}</span> : t('perf3.days', { n: formatNumber(p.median_days, locale) })}</td>
                            <td className="hg-table__num text-muted">{t('perf3.n', { count: p.n })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </YCard>
                </Col>
              </Row>
              <Row>
                <Col xl={8}><OutcomeMetrics days={Number(days)} /></Col>
                <Col xl={4}>
                  <YCard title={t('perf3.byNationality')} footer={<p className="text-muted fs-12 mb-0">{t('v7.perf.natHint')}</p>}>
                    {d.cohort.by_nationality.length === 0 ? <p className="text-muted mb-0">{t('perf3.noCohort')}</p> : d.cohort.by_nationality.map((r) => (
                      <button key={r.key} type="button" className="ag7-prio" aria-pressed={f.values.nationality === r.key}
                        onClick={() => f.set({ nationality: f.values.nationality === r.key ? null : r.key })}>
                        <ProgressRow label={countryName(r.key, locale)} value={r.count} max={natMax} display={formatNumber(r.count, locale)} />
                      </button>
                    ))}
                  </YCard>
                </Col>
              </Row>

              {d.workload.length > 0 && (
                <YCard title={t('perf.board')} flush className="ag7-wl" footer={<p className="text-muted fs-12 mb-0">{t('perf.boardSub')}</p>}>
                  <DataTable dense columns={cols} data={d.workload} getRowId={(r) => r.user_id} exportName="counselor-workload" caption={t('perf.board')}
                    renderCard={kvCard((r: Row) => <Person name={r.name} sub={t(`role.${r.role}`)} to={`/students?counselor=${r.user_id}`} />, [
                      [t('dash.workload.students'), (r) => r.active_students], [t('dash.workload.open'), (r) => r.open_tasks], [t('dash.workload.overdue'), (r) => r.overdue_tasks]])} />
                </YCard>
              )}

              {d.revenue && (
                <YCard title={t('perf3.revenue')} flush footer={<p className="text-muted fs-12 mb-0">{t('perf3.revenueSub', { count: d.revenue.period_days })}</p>}>
                  {d.revenue.by_currency.length === 0 ? <p className="text-muted p-3 mb-0">{t('perf3.noRevenue')}</p> : (
                    <table className="hg-table ag7-table">
                      <thead><tr><th scope="col">{t('perf3.currency')}</th><th scope="col" className="hg-table__num">{t('perf3.orders')}</th><th scope="col" className="hg-table__num">{t('perf3.amount')}</th></tr></thead>
                      <tbody>
                        {d.revenue.by_currency.map((r) => (
                          <tr key={r.currency}><td>{r.currency}</td><td className="hg-table__num">{r.orders}</td><td className="hg-table__num fw-semibold">{formatMoney(r.amount_minor, r.currency, locale, { minor: true })}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </YCard>
              )}

              <YCard title={t('perf.definitions')}>
                <dl className="ag-defs">
                  {(['funnel', 'fromPrevious', 'enroll', 'sla', 'correction', 'processing', 'withheld'] as const).map((k) => (
                    <div key={k}><dt>{t(`perf3.def.${k}.term`)}</dt><dd>{t(`perf3.def.${k}.text`, { min: d.min_denominator })}</dd></div>
                  ))}
                </dl>
              </YCard>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

/** V22 통계 / Insights: Operations, Quality and Outcomes are sections of one area for every administrator (REPORT §249 G2). */
export default function Performance() {
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'outcomes' ? 'outcomes' : sp.get('tab') === 'quality' ? 'quality' : 'ops';
  const switcher = (
    <Segmented label={t('v8.ops.switch')} value={tab}
      onChange={(v) => setSp((p) => { const n = new URLSearchParams(p); if (v === 'ops') n.delete('tab'); else n.set('tab', v); return n; }, { replace: true })}
      options={[{ value: 'ops', label: t('v8.nav.operations') }, { value: 'quality', label: t('v9.q.tab') }, { value: 'outcomes', label: t('v8.ops.outcomes') }]} />
  );
  if (tab === 'outcomes') return <Outcomes switcher={switcher} />;
  // V9 (REPORT §59 A10): process quality sits next to Outcomes — where the process creates rework.
  if (tab === 'quality') return (
    <div className="ag7 ag7-perf">
      <PageHeader title={t('v9.q.title')} sub={t('v9.q.question')} actions={switcher} />
      <ProcessQuality />
      {/*
        V15, brief Part 15 — the fourth and last of the manager's operational visuals: how much of what was
        sold has been delivered, and where the caseload presses against what was promised. It sits beside
        process quality because both are "is the work we are doing the right size", and it is **not** on
        Today: putting leadership metrics on the practitioner's home screen is the failure mode the
        benchmark records for this product category (docs/qa/v15/COMPETITIVE_OPERATIONS_AUDIT.md §4).
      */}
      <div className="card custom-card"><div className="card-body"><PlanDelivery /></div></div>
    </div>
  );
  return (
    <div className="ag7 ag7-perf">
      <PageHeader title={t('v22.nav.insights')} sub={t('v8.ops.sub')} actions={switcher} />
      <OperationsView />
    </div>
  );
}
