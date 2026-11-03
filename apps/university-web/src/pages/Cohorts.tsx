// PRIMARY QUESTION: "Are the students we admitted staying, progressing and graduating?" (V9 U4: no sideways tables on phones).
import { Download, GraduationCap, Plane, TriangleAlert } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { CohortStudent } from '@hangyul/types';
import { Badge, Button, Callout, Card, CardHeader, Chip, DataTable, Drawer, EmptyState, QueryState, SkeletonCard, Tabs, type ColumnDef } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { formatDate, formatPercent, type Tone } from '@hangyul/utils';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { Country } from '../components/common';
import { downloadCsv, intakeText, todayStamp } from '../lib/format';
import {
  cohortSummaries, compareTerm, latestTerm, MIN_N, RISK_FLAGS, riskCounts, riskWorklist, visaExpiring,
  type CohortSummary,
} from '../lib/metrics';
import { LifecycleSummary, OutcomesTable } from '../components/Outcomes';
import { Panel } from '../components/Panel';
import { useCohorts } from '../lib/queries';
import { useUniversity } from '../lib/university';
import { useNarrow } from '../lib/v9';
import { SummaryList } from '../components/v9/SummaryList';

// V23 §273 U5: the retention and graduation tabs (three KPI tiles over a column chart each) are gone — the cohort table
// answers both, per cohort, and each row now opens that cohort's students. Their old paths open the cohort table.
const TABS = ['outcomes', 'cohorts', 'risk', 'visa'] as const;
type Tab = (typeof TABS)[number];
const PATH: Record<Tab, string> = { outcomes: '/cohorts', cohorts: '/cohorts/list', risk: '/cohorts/risk', visa: '/cohorts/visa' };

export function tabFromPath(pathname: string, param?: string): Tab {
  if (param === 'list' || param === 'retention' || param === 'graduation') return 'cohorts';
  if (param && (TABS as readonly string[]).includes(param)) return param as Tab;
  const seg = pathname.split('/').filter(Boolean)[0];
  // /lifecycle (V2) is now the longitudinal outcomes view.
  if (seg === 'lifecycle') return 'outcomes';
  if (seg === 'retention' || seg === 'graduation') return 'cohorts';
  return (TABS as readonly string[]).includes(seg) && seg !== 'cohorts' ? (seg as Tab) : 'outcomes';
}

const statusTone = (s: string): Tone => (s === 'GRADUATED' ? 'success' : s === 'ENROLLED' ? 'info' : s === 'ON_LEAVE' ? 'warning' : s === 'WITHDRAWN' ? 'danger' : 'neutral');
const flagTone = (f: string): Tone => (f === 'ACADEMIC_STANDING' || f === 'NOT_REGISTERED' ? 'danger' : 'warning');

function RateCell({ r }: { r: CohortSummary['retention'] }) {
  const { t, locale } = useLocale(['university', 'common']);
  if (r.insufficient_data) return <span className="uc-lown" title={t('university:kpi.insufficientDetail', { n: r.denominator, min: MIN_N })}>{t('university:agencies.lowN')} <span className="hg-subtle">({r.numerator}/{r.denominator})</span></span>;
  return <span>{formatPercent(r.value, locale)} <span className="hg-subtle hg-xs">({r.numerator}/{r.denominator})</span></span>;
}

function StudentDrawer({ s, onClose }: { s: CohortStudent; onClose: () => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const terms = [...s.terms].sort((a, b) => compareTerm(a.term, b.term));
  const narrow = useNarrow();
  return (
    <Drawer open onClose={onClose} title={s.student} width={560}>
      <div className="hg-stack">
        <div className="hg-row-wrap" style={{ gap: 6 }}>
          <Badge tone={statusTone(s.status)}>{t(`university:enrollment.${s.status}`, { defaultValue: s.status })}</Badge>
          {s.risk?.flags.map((f) => <Badge key={f} size="sm" tone={flagTone(f)}>{t(`university:risk.${f}`)}</Badge>)}
        </div>
        <dl className="uc-program__facts">
          <div><dt>{t('university:cohorts.cohort')}</dt><dd>{intakeText(s.cohort, t)}</dd></div>
          <div><dt>{t('university:applicants.col.nationality')}</dt><dd><Country code={s.nationality} /></dd></div>
          <div><dt>{t('university:applicants.col.program')}</dt><dd>{s.program ?? '—'}</dd></div>
          <div><dt>{t('university:applicants.col.agency')}</dt><dd>{s.agency ?? t('university:agencies.direct')}</dd></div>
          <div><dt>{t('university:cohorts.enrolledOn')}</dt><dd>{formatDate(s.enrolled_on, locale)}</dd></div>
          <div><dt>{t('university:cohorts.expectedGrad')}</dt><dd>{formatDate(s.expected_graduation, locale)}</dd></div>
          <div><dt>{t('university:cohorts.visaExpires')}</dt><dd>{formatDate(s.visa_expires_on, locale)}</dd></div>
        </dl>
        <h3 className="uc-h3">{t('university:cohorts.terms')}</h3>
        {terms.length === 0 ? <p className="hg-subtle hg-small">{t('university:cohorts.noTerms')}</p> : narrow ? (
          <SummaryList label={t('university:cohorts.terms')} items={terms.map((x) => ({
            key: x.term, title: intakeText(x.term, t), summary: x.registered ? t('university:common.yes') : t('university:common.no'), meta: t('university:cohorts.registered'),
            fields: [
              { label: t('university:cohorts.gpa'), value: x.gpa_percent !== null ? `${x.gpa_percent}%` : '—' },
              { label: t('university:cohorts.attendance'), value: x.attendance_percent !== null ? `${x.attendance_percent}%` : '—' },
              { label: t('university:cohorts.standing'), value: x.academic_standing ? t(`university:standing.${x.academic_standing}`, { defaultValue: x.academic_standing }) : '—' },
              { label: t('university:cohorts.source'), value: t(`university:source.${x.data_source}`, { defaultValue: x.data_source }) },
            ],
          }))} />
        ) : (
          <div className="uc-table-scroll" tabIndex={0}>
            <table className="hg-table hg-table--dense uc-simple-table">
              <thead><tr><th>{t('university:cohorts.term')}</th><th>{t('university:cohorts.registered')}</th><th className="hg-table__num">{t('university:cohorts.gpa')}</th><th className="hg-table__num">{t('university:cohorts.attendance')}</th><th>{t('university:cohorts.standing')}</th><th>{t('university:cohorts.source')}</th></tr></thead>
              <tbody>
                {terms.map((x) => (
                  <tr key={x.term}>
                    <td>{intakeText(x.term, t)}</td>
                    <td>{x.registered ? t('university:common.yes') : <Badge size="sm" tone="danger">{t('university:common.no')}</Badge>}</td>
                    <td className="hg-table__num">{x.gpa_percent !== null ? `${x.gpa_percent}%` : '—'}</td>
                    <td className={`hg-table__num ${x.attendance_percent !== null && x.attendance_percent < 70 ? 'uc-danger-text' : ''}`}>{x.attendance_percent !== null ? `${x.attendance_percent}%` : '—'}</td>
                    <td>{x.academic_standing ? t(`university:standing.${x.academic_standing}`, { defaultValue: x.academic_standing }) : '—'}</td>
                    <td><Badge size="sm" tone={x.data_source === 'UNIVERSITY_FEED' ? 'success' : 'warning'} outline>{t(`university:source.${x.data_source}`, { defaultValue: x.data_source })}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hg-subtle hg-xs">{t('university:cohorts.riskExplain')}</p>
      </div>
    </Drawer>
  );
}

function useStudentColumns(extra: ColumnDef<CohortStudent, unknown>[] = []) {
  const { t, locale } = useLocale(['university', 'common']);
  return useMemo<ColumnDef<CohortStudent, unknown>[]>(() => [
    { id: 'student', header: t('university:cohorts.student'), enableSorting: false, meta: { primary: true, label: t('university:cohorts.student'), exportValue: (r: CohortStudent) => r.student }, cell: ({ row }) => <span className="hg-strong">{row.original.student}</span> },
    { id: 'cohort', header: t('university:cohorts.cohort'), accessorFn: (r) => r.cohort, meta: { label: t('university:cohorts.cohort') }, cell: ({ row }) => intakeText(row.original.cohort, t) },
    { id: 'nat', header: t('university:applicants.col.nationality'), enableSorting: false, meta: { label: t('university:applicants.col.nationality'), exportValue: (r: CohortStudent) => r.nationality ?? '' }, cell: ({ row }) => <Country code={row.original.nationality} /> },
    { id: 'program', header: t('university:applicants.col.program'), enableSorting: false, meta: { label: t('university:applicants.col.program'), hideOnMobile: true, exportValue: (r: CohortStudent) => r.program ?? '' }, cell: ({ row }) => <span className="hg-truncate" style={{ display: 'block', maxWidth: 220 }}>{row.original.program ?? '—'}</span> },
    { id: 'status', header: t('university:cohorts.status'), enableSorting: false, meta: { label: t('university:cohorts.status'), exportValue: (r: CohortStudent) => r.status }, cell: ({ row }) => <Badge size="sm" tone={statusTone(row.original.status)}>{t(`university:enrollment.${row.original.status}`, { defaultValue: row.original.status })}</Badge> },
    ...extra,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, locale]);
}

function CohortTab({ data, onOpen }: { data: CohortStudent[]; onOpen: (s: CohortStudent) => void }) {
  const { t } = useLocale(['university', 'common']);
  const { perms } = useUniversity();
  // V23 §273 U5: a cohort row (here or on Insights) opens that cohort's students; `?cohort=` is the filter.
  const [sp, setSp] = useSearchParams();
  const cohort = sp.get('cohort');
  const shown = cohort ? data.filter((s) => s.cohort === cohort) : data;
  const pickCohort = (c: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (c) n.set('cohort', c); else n.delete('cohort'); return n; }, { replace: true });
  const sums = cohortSummaries(data);
  const narrow = useNarrow();
  const cols = useStudentColumns([
    { id: 'risk', header: t('university:cohorts.flags'), enableSorting: false, meta: { label: t('university:cohorts.flags'), exportValue: (r: CohortStudent) => r.risk?.flags.join(' ') ?? '' },
      cell: ({ row }) => row.original.risk ? <span className="hg-row-wrap" style={{ gap: 4 }}>{row.original.risk.flags.map((f) => <Badge key={f} size="sm" tone={flagTone(f)}>{t(`university:risk.${f}`)}</Badge>)}</span> : <span className="hg-subtle">—</span> },
  ]);
  const exportCohorts = () => downloadCsv(sums.map((s) => ({
    cohort: s.cohort, total: s.total, enrolled: s.enrolled, on_leave: s.onLeave, withdrawn: s.withdrawn, transferred: s.transferred, graduated: s.graduated,
    retention_rate: s.retention.insufficient_data ? '' : s.retention.value, retention_n: s.retention.denominator,
    graduation_rate: s.graduation.insufficient_data ? '' : s.graduation.value, graduation_n: s.graduation.denominator, at_risk: s.atRisk,
  })), `cohorts-${todayStamp()}`);
  return (
    <div className="hg-stack">
      <Card as="section" aria-labelledby="ct-h">
        <CardHeader id="ct-h" title={t('university:cohorts.tableTitle')} subtitle={t('university:cohorts.tableSub', { min: MIN_N })}
          actions={perms.canExport ? <Button size="sm" variant="ghost" icon={<Download />} onClick={exportCohorts}>{t('common:actions.exportCsv')}</Button> : undefined} />
        {narrow ? (
          <div className="uc-section__body">
            <SummaryList label={t('university:cohorts.tableTitle')} items={sums.map((s) => ({
              key: s.cohort, title: intakeText(s.cohort, t), meta: t('university:v9.co.total', { count: s.total }), summary: <RateCell r={s.retention} />,
              extra: <Button size="sm" variant="ghost" onClick={() => pickCohort(s.cohort)}>{t('university:v23.co.openCohort')}</Button>,
              fields: [
                { label: t('university:enrollment.ENROLLED'), value: s.enrolled }, { label: t('university:enrollment.ON_LEAVE'), value: s.onLeave },
                { label: t('university:enrollment.WITHDRAWN'), value: s.withdrawn }, { label: t('university:enrollment.GRADUATED'), value: s.graduated },
                { label: t('university:kpi.retention'), value: <RateCell r={s.retention} /> }, { label: t('university:kpi.graduationRate'), value: <RateCell r={s.graduation} /> },
                { label: t('university:cohorts.atRisk'), value: s.atRisk },
              ],
            }))} />
          </div>
        ) : (
        <div className="uc-section__body uc-table-scroll" tabIndex={0}>
          <table className="hg-table hg-table--dense uc-simple-table">
            <caption className="hg-sr-only">{t('university:cohorts.tableTitle')}</caption>
            <thead><tr>
              <th>{t('university:cohorts.cohort')}</th><th className="hg-table__num">{t('university:cohorts.total')}</th>
              <th className="hg-table__num">{t('university:enrollment.ENROLLED')}</th><th className="hg-table__num">{t('university:enrollment.ON_LEAVE')}</th>
              <th className="hg-table__num">{t('university:enrollment.WITHDRAWN')}</th><th className="hg-table__num">{t('university:enrollment.GRADUATED')}</th>
              <th className="hg-table__num">{t('university:kpi.retention')}</th><th className="hg-table__num">{t('university:kpi.graduationRate')}</th>
              <th className="hg-table__num">{t('university:cohorts.atRisk')}</th>
            </tr></thead>
            <tbody>
              {sums.map((s) => (
                <tr key={s.cohort} aria-selected={cohort === s.cohort || undefined}>
                  <td className="hg-strong"><button type="button" className="uc23-cohortlink" onClick={() => pickCohort(s.cohort)}>{intakeText(s.cohort, t)}</button></td>
                  <td className="hg-table__num">{s.total}</td>
                  <td className="hg-table__num">{s.enrolled}</td>
                  <td className="hg-table__num">{s.onLeave}</td>
                  <td className="hg-table__num">{s.withdrawn}</td>
                  <td className="hg-table__num">{s.graduated}</td>
                  <td className="hg-table__num"><RateCell r={s.retention} /></td>
                  <td className="hg-table__num"><RateCell r={s.graduation} /></td>
                  <td className="hg-table__num">{s.atRisk ? <Badge size="sm" tone="warning">{s.atRisk}</Badge> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      <Card>
        <CardHeader title={cohort ? `${t('university:cohorts.studentsTitle')} · ${intakeText(cohort, t)}` : t('university:cohorts.studentsTitle')} subtitle={t('university:cohorts.studentsSub')}
          actions={cohort ? <Button size="sm" variant="ghost" onClick={() => pickCohort(null)}>{t('common:actions.clearFilters')}</Button> : undefined} />
        <DataTable<CohortStudent> columns={cols} data={shown} getRowId={(r) => r.id} onRowClick={onOpen} exportName={perms.canExport ? `students-${todayStamp()}` : undefined} caption={t('university:cohorts.studentsTitle')} />
      </Card>
    </div>
  );
}

function RiskTab({ data, onOpen }: { data: CohortStudent[]; onOpen: (s: CohortStudent) => void }) {
  const { t } = useLocale(['university', 'common']);
  const [flag, setFlag] = useState<string | null>(null);
  const counts = riskCounts(data);
  const list = riskWorklist(data).filter((s) => !flag || s.risk?.flags.includes(flag));
  const cols = useStudentColumns([
    { id: 'flags', header: t('university:cohorts.flags'), enableSorting: false, meta: { label: t('university:cohorts.flags'), exportValue: (r: CohortStudent) => r.risk?.flags.join(' ') ?? '' },
      cell: ({ row }) => <span className="hg-row-wrap" style={{ gap: 4 }}>{row.original.risk?.flags.map((f) => <Badge key={f} size="sm" tone={flagTone(f)}>{t(`university:risk.${f}`)}</Badge>)}</span> },
    { id: 'att', header: t('university:cohorts.attendance'), enableSorting: false, meta: { numeric: true, label: t('university:cohorts.attendance') }, cell: ({ row }) => { const l = latestTerm(row.original); return l?.attendance_percent != null ? `${l.attendance_percent}%` : '—'; } },
  ]);
  return (
    <div className="hg-stack">
      <Callout tone="info" title={t('university:cohorts.riskTitle')}>{t('university:cohorts.riskExplain')}</Callout>
      <div className="hg-row-wrap" role="group" aria-label={t('university:cohorts.flags')}>
        <Chip pressed={!flag} onClick={() => setFlag(null)}>{t('university:filters.all')} ({riskWorklist(data).length})</Chip>
        {RISK_FLAGS.map((f) => <Chip key={f} pressed={flag === f} onClick={() => setFlag(flag === f ? null : f)}>{t(`university:risk.${f}`)} ({counts[f] ?? 0})</Chip>)}
      </div>
      <Card>
        <DataTable<CohortStudent> columns={cols} data={list} getRowId={(r) => r.id} onRowClick={onOpen} caption={t('university:nav.earlyWarnings')}
          empty={<EmptyState compact icon={<TriangleAlert />} title={t('university:cohorts.noRisk')} />} />
      </Card>
    </div>
  );
}

function VisaTab({ data, onOpen }: { data: CohortStudent[]; onOpen: (s: CohortStudent) => void }) {
  const { t, locale } = useLocale(['university', 'common']);
  const list = visaExpiring(data, 60);
  const cols = useStudentColumns([
    { id: 'visa', header: t('university:cohorts.visaExpires'), enableSorting: false, meta: { label: t('university:cohorts.visaExpires') },
      cell: ({ row }) => {
        const d = (row.original as CohortStudent & { daysLeft: number }).daysLeft;
        return <span>{formatDate(row.original.visa_expires_on, locale)} <Badge size="sm" tone={d < 0 ? 'danger' : d <= 30 ? 'warning' : 'info'}>{d < 0 ? t('common:time.overdueBy', { count: -d }) : t('common:time.daysLeft', { count: d })}</Badge></span>;
      } },
  ]);
  return (
    <div className="hg-stack">
      <Callout tone="info" icon={<Plane aria-hidden />}>{t('university:cohorts.visaExplain')}</Callout>
      <Card>
        <DataTable<CohortStudent> columns={cols} data={list} getRowId={(r) => r.id} onRowClick={onOpen} caption={t('university:cohorts.visaTitle')}
          empty={<EmptyState compact icon={<Plane />} title={t('university:cohorts.noVisa')} />} />
      </Card>
    </div>
  );
}

export default function Cohorts() {
  const { t } = useLocale(['university', 'common']);
  const { tab: param } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const tab = tabFromPath(loc.pathname, param);
  const q = useCohorts();
  const [open, setOpen] = useState<CohortStudent | null>(null);
  const titles: Record<Tab, string> = {
    outcomes: t('university:outcomes.title'), cohorts: t('university:cohorts.listTab'),
    risk: t('university:nav.earlyWarnings'), visa: t('university:cohorts.visaTitle'),
  };
  const riskN = q.data ? riskWorklist(q.data).length : undefined;
  const visaN = q.data ? visaExpiring(q.data, 60).length : undefined;
  return (
    <div className="hg-stack uc-page uv7">
      <PageHeader title={t('university:nav.students')} sub={tab === 'outcomes' ? t('university:outcomes.sub') : t(`university:cohorts.sub.${tab}`)} />
      <div style={{ overflowX: 'auto' }}>
        <Tabs label={t('common:nav.cohorts')} value={tab} onChange={(v) => nav(PATH[v])}
          tabs={TABS.map((k) => ({ value: k, label: titles[k], count: k === 'risk' ? riskN : k === 'visa' ? visaN : undefined }))} />
      </div>
      <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={<GraduationCap />} title={t('university:cohorts.empty')} text={t('university:cohorts.emptyText')} />}>
        {(data) => (
          <>
            {tab === 'outcomes' && <>
              <Panel id="co-life" title={t('university:v7.ov.lifeTitle')}><LifecycleSummary /></Panel>
              <Panel id="co-outcomes" title={t('university:outcomes.title')}><OutcomesTable /></Panel>
            </>}
            {tab === 'cohorts' && <CohortTab data={data} onOpen={setOpen} />}
            {tab === 'risk' && <RiskTab data={data} onOpen={setOpen} />}
            {tab === 'visa' && <VisaTab data={data} onOpen={setOpen} />}
          </>
        )}
      </QueryState>
      {open && <StudentDrawer s={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
