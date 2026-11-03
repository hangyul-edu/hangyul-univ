// PRIMARY QUESTION: Which applications are stuck between ready and received?
//
// V9 Submissions (REPORT §59 A7) — one queue across EVERY connector method (guided hand-off on the official portal,
// application providers, manual, authorised agency, APIs), in seven states derived only from submission records,
// authorisations and evidence (GET /agency/submissions/pipeline, services/submission.submission_pipeline):
// Issue · Confirmation missing · Authorized · Ready · Needs final review · Submitted (awaiting evidence) · University received.
// "Issue" and "Confirmation missing" come first. The V6 authorised-agency detail (consent, snapshot, record) opens for
// authorised rows; every other row opens the application. Hangyul stores no portal credentials and submits nothing.
import { useAuth } from '@hangyul/auth';
import { Card, DataTable, Drawer, EmptyState, ErrorState, PageHeader, StatusText, type ColumnDef } from '@hangyul/ui';
import { cx, formatDate, formatNumber } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';

import '../components/success/success.css';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { useT } from '../components/bits';
import { SubmissionDetail, useSubmissionQueue } from '../components/success/SubmissionQueue';
import { DeadlineCell } from './Applications';

const STATES = ['issue', 'confirmation_missing', 'authorized', 'ready', 'needs_final_review', 'submitted', 'received'] as const;
type State = (typeof STATES)[number];
const TONE: Record<State, 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = {
  issue: 'danger', confirmation_missing: 'danger', authorized: 'warning', ready: 'warning', needs_final_review: 'info', submitted: 'neutral', received: 'success',
};

export interface PipelineRow {
  application_id: string; state: State; status: string; method: string; student: { id: string; full_name: string | null }; university: string | null;
  program: string | null; deadline: string | null; since: string | null; days: number | null; reference: string | null; evidence: string;
  failure: string | null; counselor: { id: string; name: string | null } | null; link: string;
}
interface Pipeline { counts: Record<State, number>; definitions: Record<State, string>; items: PipelineRow[]; states: State[] }

export function useSubmissionPipeline() {
  const { api } = useAuth();
  return useQuery({ queryKey: ['submissions', 'pipeline'], queryFn: () => api.get<Pipeline>('/agency/submissions/pipeline'), refetchInterval: 60_000 });
}

export default function Submissions() {
  const { t, locale } = useT();
  const [sp, setSp] = useSearchParams();
  const q = useSubmissionPipeline();
  const v6 = useSubmissionQueue();
  const counts = q.data?.counts;
  const firstNonEmpty = STATES.find((s) => (counts?.[s] ?? 0) > 0) ?? 'ready';
  const tab = (STATES.includes(sp.get('state') as State) ? sp.get('state') : firstNonEmpty) as State;
  const appId = sp.get('application') ?? sp.get('app');
  const rows = useMemo(() => (q.data?.items ?? []).filter((r) => r.state === tab), [q.data, tab]);
  const selected = (q.data?.items ?? []).find((r) => r.application_id === appId);
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'state') { n.delete('application'); n.delete('app'); } setSp(n, { replace: k === 'state' }); };

  const columns = useMemo<ColumnDef<PipelineRow>[]>(() => [
    { id: 'student', accessorFn: (r) => r.student.full_name ?? '', header: t('misc.student'), meta: { primary: true, label: t('misc.student'), priority: 1, minWidth: 160 },
      cell: ({ row }) => <span className="ag-cell-2"><Link to={`/students/${row.original.student.id}`} className="hg-medium" onClick={(e) => e.stopPropagation()}>{row.original.student.full_name}</Link>
        <span className="hg-subtle hg-xs">{row.original.counselor?.name ?? t('misc.unassigned')}</span></span> },
    { id: 'university', accessorFn: (r) => `${r.university} — ${r.program}`, header: t('apps.col.program'), meta: { label: t('apps.col.program'), priority: 1, minWidth: 200 },
      cell: ({ row }) => <span className="ag-cell-2 ag8-clampcell"><span className="hg-truncate">{row.original.university}</span><span className="hg-subtle hg-xs hg-truncate">{row.original.program}</span></span> },
    { id: 'method', accessorKey: 'method', header: t('v9.sub.method'), meta: { label: t('v9.sub.method'), priority: 3, minWidth: 140, exportValue: (r) => t(`v9.sub.methods.${r.method}`, { defaultValue: r.method }) },
      cell: ({ row }) => <span className="hg-small">{t(`v9.sub.methods.${row.original.method}`, { defaultValue: row.original.method })}</span> },
    { id: 'since', accessorFn: (r) => r.days ?? -1, header: t('v9.sub.since'), meta: { label: t('v9.sub.since'), priority: 1, minWidth: 110 },
      cell: ({ row }) => row.original.since ? (
        <span className={cx('hg-num hg-small', row.original.state === 'confirmation_missing' && 'text-danger fw-semibold')} title={formatDate(row.original.since, locale)}>
          {t('v9.sub.days', { count: row.original.days ?? 0 })}</span>
      ) : <span className="hg-subtle">—</span> },
    { id: 'deadline', accessorFn: (r) => r.deadline ?? '', header: t('apps.deadline'), meta: { label: t('apps.deadline'), priority: 2, minWidth: 110 },
      cell: ({ row }) => row.original.deadline ? <DeadlineCell date={row.original.deadline} /> : <span className="hg-subtle">—</span> },
    { id: 'evidence', accessorFn: (r) => r.reference ?? r.failure ?? '', header: t('v9.sub.evidence'), enableSorting: false, meta: { label: t('v9.sub.evidence'), priority: 2, minWidth: 150 },
      cell: ({ row }) => row.original.failure ? <StatusText tone="danger">{row.original.failure}</StatusText>
        : row.original.reference ? <span className="hg-num hg-small">{row.original.reference}</span>
          : <span className="hg-subtle hg-small">{t('v9.sub.noEvidence')}</span> },
  ], [t, locale]);

  return (
    <div className="hg-stack ag-page ag9-subs">
      <PageHeader title={t('v9.sub.title')} subtitle={t('v9.sub.question')} />
      <Card>
        <nav className="ag9-chips" aria-label={t('v9.sub.title')}>
          {STATES.filter((s) => (counts?.[s] ?? 0) > 0 || s === tab).map((s) => (
            <button key={s} type="button" className="ag9-chip" aria-pressed={tab === s} data-tone={TONE[s]} onClick={() => set('state', s)}>
              {t(`v9.sub.state.${s}`)}<span className="ag9-chip__n">{formatNumber(counts?.[s] ?? 0, locale)}</span>
            </button>
          ))}
        </nav>
        {q.data && <p className="ag8-viewdef mb-0 px-3 pt-2">{t(`v9.sub.def.${tab}`)}</p>}
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable dense columns={columns} data={rows} loading={q.isLoading} getRowId={(r) => r.application_id}
            onRowClick={(r) => set('application', r.application_id)} caption={t('v9.sub.title')} exportName="submissions"
            empty={<EmptyState compact title={t('v9.sub.empty', { state: t(`v9.sub.state.${tab}`) })} />} />
        )}
      </Card>
      <p className="hg-subtle hg-xs">{t('v9.sub.honest')}</p>
      <Drawer open={!!appId} onClose={() => set('application', null)} width={selected?.method === 'AUTHORIZED_AGENCY' ? 560 : 620}
        title={selected ? `${selected.student.full_name} · ${selected.university}` : t('v9.sub.title')}>
        {appId && (selected?.method === 'AUTHORIZED_AGENCY'
          ? <SubmissionDetail appId={appId} row={v6.data?.items.find((r) => r.application_id === appId)} canRecord={!!v6.data?.can_record} />
          : <ApplicationPanel id={appId} showStudent={false} />)}
      </Drawer>
    </div>
  );
}
