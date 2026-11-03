import { useAuth } from '@hangyul/auth';
import { ArrowRight, BarChart3 } from '@hangyul/icons';
import type { WritingQueueView } from '@hangyul/types';
import { Button, DataTable, EmptyState, ErrorState, PageHeader, StatusText, Tabs, type ColumnDef } from '@hangyul/ui';
import { daysUntil, formatDate, formatDateTime } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';

import { useT } from '../components/bits';
import { useHotkeys, usePerms, useUrlFilters } from '../lib/hooks';
import { ageLabel, hoursUntil, loadQueueMemory, saveQueueMemory, type V6QueueItem } from '../lib/writing';
import './writing.css';

/** Kept for other screens that link to "essays waiting for review". */
export const REVIEW_STATUSES = ['AGENCY_REVIEW', 'FINAL_REVIEW', 'SUBMITTED'];
const VIEWS: WritingQueueView[] = ['first', 'revised', 'final', 'due48', 'overdue', 'mine', 'team'];
const NEXT_TONE: Record<V6QueueItem['next_action'], 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = {
  OVERDUE: 'danger', FINAL_APPROVAL: 'success', REVIEW_REVISION: 'info', FIRST_REVIEW: 'neutral', WAITING_STUDENT: 'neutral', NONE: 'neutral',
};

/** Agency writing queue: one list per question a reviewer asks ("what needs a first read?", "what is late?").
 *  V6: the chosen view and the reviewer's position survive a reload (this browser, per user); "Open next essay"
 *  continues where they left off; decisions in the workspace open the next essay of the same view. */
/** V11: rendered as the "Writing" mode of `/review`; see DocumentQueue for why the header is conditional. */
export default function Essays({ embedded }: { embedded?: boolean } = {}) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const nav = useNavigate();
  const perms = usePerms();
  const f = useUrlFilters(['view', 'tab'] as const);
  const memory = useMemo(() => loadQueueMemory(perms.userId), [perms.userId]);
  const legacyTab = f.values.tab;
  const fromUrl = VIEWS.includes(f.values.view as WritingQueueView) ? f.values.view : legacyTab === 'waiting' ? 'revised' : null;
  const view = (fromUrl ?? (VIEWS.includes(memory?.view as WritingQueueView) ? memory!.view : 'first')) as WritingQueueView;
  const q = useQuery({ queryKey: ['writing', 'queue', view], queryFn: () => api.writing.queue(view), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const items = (q.data?.view === view ? q.data.items : []) as V6QueueItem[];

  // Remember the view and the order the reviewer sees (the workspace's "next" / "previous" use it).
  useEffect(() => {
    if (perms.userId && q.data?.view === view) saveQueueMemory(perms.userId, { view, ids: q.data.items.map((i) => i.id) });
  }, [perms.userId, view, q.data]);

  const resumeIdx = memory?.at ? items.findIndex((i) => i.id === memory.at) : -1;
  const nextItem = resumeIdx >= 0 ? items[resumeIdx + 1] ?? items[resumeIdx] : items[0];
  const openNext = () => { if (nextItem) nav(`/essays/${nextItem.id}`); };
  useHotkeys({ ']': openNext }, !!nextItem);

  // V10: every column declares its real `minWidth` and a `priority`. Without them the shared DataTable assumes
  // 140 px each, so its folding estimate was wrong and `table-layout: fixed` crushed the Essay column to a few
  // pixels at ~992 px instead of folding it into the row details. Priority order for a reviewer's job:
  // 1 student · 2 university/programme and the SLA clock · 3 deadline and next action · 4 type and reviewer.
  const columns = useMemo<ColumnDef<V6QueueItem>[]>(() => [
    { id: 'student', accessorFn: (r) => r.student.name, header: t('misc.student'), size: 170, meta: { primary: true, label: t('misc.student'), priority: 1, minWidth: 170 },
      cell: ({ row }) => <span className="hg-truncate ag-cell-block hg-medium">{row.original.student.name}</span> },
    { id: 'uni', accessorFn: (r) => `${r.university ?? ''} ${r.program ?? ''}`, header: t('writing:queue.col.universityProgram'), size: 220, meta: { label: t('writing:queue.col.universityProgram'), priority: 2, minWidth: 220 },
      cell: ({ row }) => <span className="ag-cell-block" title={`${row.original.university ?? ''} · ${row.original.program ?? ''}`}>
        <span className="hg-truncate" style={{ display: 'block' }}>{row.original.university ?? '—'}</span>
        <span className="hg-subtle hg-xs hg-truncate" style={{ display: 'block' }}>{row.original.program ?? ''}</span></span> },
    { id: 'type', accessorKey: 'essay_type', header: t('writing:queue.col.type'), size: 150, meta: { label: t('writing:queue.col.type'), priority: 4, minWidth: 150 },
      cell: ({ row }) => <span className="ag-cell-block"><span className="hg-truncate" style={{ display: 'block' }}>{t(`essayType.${row.original.essay_type}`)}</span>
        <span className="hg-subtle hg-xs hg-num">v{row.original.version}{row.original.round > 1 && ` · ${t('writing:queue.round', { n: row.original.round })}`}</span></span> },
    { id: 'deadline', accessorKey: 'deadline', header: t('writing:queue.col.deadline'), size: 100, meta: { label: t('writing:queue.col.deadline'), hideOnMobile: true, priority: 3, minWidth: 100 },
      cell: ({ getValue }) => { const d = getValue<string | null>(); const n = daysUntil(d); return d ? <span className={n !== null && n <= 7 ? 'ag-soon hg-num' : 'hg-num'}>{formatDate(d, locale, { month: 'short', day: 'numeric' })}</span> : <span className="hg-subtle">—</span>; } },
    { id: 'age', accessorKey: 'review_age_hours', header: t('writing:v6.reviewDue'), size: 190, meta: { label: t('writing:v6.reviewDue'), priority: 2, minWidth: 190 },
      cell: ({ row }) => {
        const r = row.original;
        const left = hoursUntil(r.expected_review_by);
        return <span className={`ag-cell-block wr-sla ${r.overdue ? 'wr-sla--late' : left !== null && left < 12 ? 'wr-sla--soon' : ''}`} title={r.expected_review_by ? t('writing:queue.dueAt', { at: formatDateTime(r.expected_review_by, locale) }) : undefined}>
          {r.expected_review_by && <span className="wr-sla__main hg-num">{r.overdue ? t('writing:queue.late', { age: ageLabel(t, -(left ?? 0)) }) : t('writing:queue.left', { age: ageLabel(t, left) })}</span>}
          {r.escalated ? <span className="wr-escalated">{t('writing:v6.escalatedTo', { name: r.escalated_to ?? t('writing:v6.manager') })}</span>
            : <span className="hg-subtle hg-xs hg-num">{t('writing:queue.waited', { age: ageLabel(t, r.review_age_hours) })}</span>}
        </span>;
      } },
    { id: 'reviewer', accessorFn: (r) => r.reviewer?.full_name ?? '', header: t('essaysPage.col.reviewer'), size: 140, meta: { label: t('essaysPage.col.reviewer'), hideOnMobile: true, priority: 4, minWidth: 140 },
      cell: ({ row }) => row.original.reviewer ? <span className="ag-cell-block hg-truncate" title={row.original.reviewer.org ?? undefined}>
        {row.original.reviewer.full_name}{row.original.reviewer.kind === 'HANGYUL' && <span className="hg-subtle"> · {t('writing:kind.HANGYUL')}</span>}</span>
        : <span className="hg-subtle">{t('misc.unassigned')}</span> },
    { id: 'next', accessorKey: 'next_action', header: t('writing:queue.col.next'), size: 130, meta: { label: t('writing:queue.col.next'), priority: 3, minWidth: 130 },
      cell: ({ row }) => <StatusText tone={NEXT_TONE[row.original.next_action]}>{t(`writing:queue.next.${row.original.next_action}`)}</StatusText> },
  ], [t, locale]);

  return (
    <div className="hg-stack ag-page">
      {embedded
        ? (
          <div className="ag-revhub__actions">
            {<Link to="/essays/insights" className="hg-btn hg-btn--ghost hg-btn--sm"><BarChart3 size={15} aria-hidden /> {t('writing:insights.link')}</Link>}
            {nextItem && <Button size="sm" variant="primary" iconEnd={<ArrowRight className="hg-flip-rtl" />} onClick={openNext} title="]">{t('writing:v6.openNext')}</Button>}
          </div>
        )
        : (
          <PageHeader title={t('sidebar.essays')} subtitle={t('writing:queue.sub')}
            actions={<>
              {<Link to="/essays/insights" className="hg-btn hg-btn--ghost hg-btn--sm"><BarChart3 size={15} aria-hidden /> {t('writing:insights.link')}</Link>}
              {nextItem && <Button size="sm" variant="primary" iconEnd={<ArrowRight className="hg-flip-rtl" />} onClick={openNext} title="]">{t('writing:v6.openNext')}</Button>}
            </>} />
        )}
      <Tabs label={t('nav.essayReviews')} value={view} onChange={(v) => { f.set({ view: v }); if (perms.userId) saveQueueMemory(perms.userId, { view: v, at: null }); }}
        tabs={VIEWS.map((v) => ({ value: v, label: t(`writing:queue.view.${v}`), count: q.data?.counts?.[v] }))} />
      {resumeIdx >= 0 && nextItem && (
        <div className="wr-resume" role="status">
          <span>{t('writing:v6.resume', { name: items[resumeIdx].student.name, n: resumeIdx + 1, total: items.length })}</span>
        </div>
      )}
      <p className="hg-subtle hg-xs">{t('writing:v6.queueKeys')}</p>
      <div className="hg-panel ag-table-panel">
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable dense columns={columns} data={items} loading={q.isLoading || q.data?.view !== view} getRowId={(r) => r.id}
            onRowClick={(r) => nav(`/essays/${r.id}`)}
            caption={t(`writing:queue.view.${view}`)}
            empty={<EmptyState compact title={t(`writing:queue.empty.${view}`)} text={t('writing:queue.emptyText')} />} />
        )}
      </div>
    </div>
  );
}
