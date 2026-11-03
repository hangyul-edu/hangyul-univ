// PRIMARY QUESTION: Where does each application stand, and who has to act on it?
import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import { Flag as FlagIcon } from '@hangyul/icons';
import { APPLICATION_STATUSES, type AgencyWaitingParty, type Application, type ApplicationStatus } from '@hangyul/types';
import { Card, Checkbox, DataTable, Drawer, EmptyState, ErrorState, PageHeader, FilterSelect, type ColumnDef } from '@hangyul/ui';
import { daysUntil, flagEmoji, formatDate, formatRelative } from '@hangyul/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { ApplicationPanel } from '../components/ApplicationPanel';
import { AppStatusBadge, FilterBar, SearchBox, useT, WaitingOn } from '../components/bits';
import { useDebounced, useUrlFilters } from '../lib/hooks';

const SORTS = ['updated', 'deadline', 'submitted'] as const;

export function DeadlineCell({ date }: { date: string }) {
  const { t, locale } = useT();
  const d = daysUntil(date);
  return (
    <span className={d !== null && d >= 0 && d <= 7 ? 'ag-soon hg-num' : d !== null && d < 0 ? 'hg-subtle hg-num' : 'hg-num'} style={{ whiteSpace: 'nowrap' }}>
      {formatDate(date, locale, { month: 'short', day: 'numeric', year: d !== null && d < 0 ? 'numeric' : undefined })}
      {d !== null && d <= 30 && <span className="hg-subtle"> · {d < 0 ? t('apps.closed') : t('students.dShort', { count: d })}</span>}
    </span>
  );
}

export default function Applications({ embedded }: { embedded?: boolean } = {}) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const nav = useNavigate();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const f = useUrlFilters(['q', 'status', 'flagged', 'sort', 'page', 'uni', 'intake'] as const);
  const [search, setSearch] = useState(f.values.q);
  const dq = useDebounced(search, 300);
  useEffect(() => { if (dq !== f.values.q) f.set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pageSize, setPageSize] = useState(20);
  const pageIndex = Math.max(0, Number(f.values.page || 1) - 1);
  const query = {
    q: (f.values.uni || f.values.q) || undefined, status: f.values.status || undefined, flagged: f.values.flagged === '1' ? true : undefined,
    sort: f.values.sort || 'updated', page: pageIndex + 1, page_size: pageSize,
    // V23 §272 A3: Insights' cohort-funnel links carry `&intake=`; the list honours it (the API always did).
    intake: f.values.intake || undefined,
  };
  const q = useQuery({ queryKey: ['applications', query], queryFn: () => api.applications.list(query), placeholderData: keepPreviousData });
  const unis = useQuery({ queryKey: ['agency', 'analytics', { days: 365 }], queryFn: () => api.agency.analytics({ days: 365 }), staleTime: 5 * 60_000 });

  // V8: "N items remain" instead of a readiness percentage (same count the student sees), one batch call per page.
  const ids = (q.data?.items ?? []).map((a) => a.id);
  const remaining = useQuery({
    queryKey: ['agency', 'applications', 'remaining', ids], enabled: ids.length > 0,
    queryFn: () => api.get<Record<string, { items_remaining: number | null; items_in_review: number | null; waiting_on: AgencyWaitingParty | null; waiting_reason: string | null }>>('/agency/applications/remaining', { ids }),
  });
  const rem = remaining.data;
  const columns = useMemo<ColumnDef<Application>[]>(() => [
    { id: 'student', accessorFn: (r) => r.student?.full_name ?? '', header: t('apps.col.student'), meta: { primary: true, priority: 1, minWidth: 170, label: t('apps.col.student') },
      cell: ({ row }) => <span className="hg-medium" style={{ whiteSpace: 'nowrap' }}><span aria-hidden>{flagEmoji(row.original.student?.nationality ?? '')} </span>{row.original.student?.full_name}</span> },
    { id: 'university', accessorFn: (r) => `${localName(r.university)} — ${localName(r.program)}`, header: t('apps.col.program'), meta: { label: t('apps.col.program'), priority: 1, minWidth: 200 },
      cell: ({ row }) => <span className="ag-cell-2 ag8-clampcell"><span className="hg-truncate">{localName(row.original.university)}</span><span className="hg-subtle hg-xs hg-truncate">{localName(row.original.program)} · {t(`degreeShort.${row.original.program.degree_level}`)}</span></span> },
    { id: 'intake', accessorFn: (r) => `${r.intake.year}-${r.intake.term}`, header: t('apps.col.intake'), meta: { label: t('apps.col.intake'), hideOnMobile: true, priority: 4, minWidth: 110 },
      cell: ({ row }) => <span style={{ whiteSpace: 'nowrap' }}>{t('intakeLabel', { term: t(`term.${row.original.intake.term}`), year: row.original.intake.year })}</span> },
    { id: 'status', accessorKey: 'status', header: t('apps.col.status'), meta: { label: t('apps.col.status'), priority: 1, minWidth: 150, exportValue: (r) => t(`appStatus.${r.status}`) },
      cell: ({ row }) => <span className="hg-row" style={{ gap: 4 }}><AppStatusBadge status={row.original.status} />{row.original.flagged && <FlagIcon size={14} aria-label={t('apps.flagged')} style={{ color: 'var(--hg-status-danger-fg)' }} />}</span> },
    { id: 'remaining', accessorFn: (r) => rem?.[r.id]?.items_remaining ?? '', header: t('v8.apps.remaining'), enableSorting: false,
      meta: { label: t('v8.apps.remaining'), priority: 2, minWidth: 130, exportValue: (r) => rem?.[r.id]?.items_remaining ?? '' },
      cell: ({ row }) => {
        const v = rem?.[row.original.id];
        if (!v) return <span className="hg-subtle">…</span>;
        if ((v as { guide_review?: boolean }).guide_review) return <span className="hg-small">{t('v27.guide.missingTitle')}</span>;
        if (v.items_remaining === null) return <span className="hg-subtle">—</span>;
        if (v.items_remaining === 0) return <span className="text-success hg-small fw-semibold">{t('ws.itemsNone')}</span>;
        return <span className="hg-small"><span className="fw-semibold">{t('ws.itemsRemain', { count: v.items_remaining })}</span>{v.items_in_review ? <span className="hg-subtle"> · {t('ws.itemsInReview', { count: v.items_in_review })}</span> : null}</span>;
      } },
    // V9 (REPORT §59 A1): the same waiting-on party + reason as the caseload (live submission signals included).
    { id: 'waiting', accessorFn: (r) => rem?.[r.id]?.waiting_on ?? '', header: t('v9.waiting.title'), enableSorting: false,
      meta: { label: t('v9.waiting.title'), priority: 2, minWidth: 150, exportValue: (r) => rem?.[r.id]?.waiting_on ?? '' },
      cell: ({ row }) => {
        const v = rem?.[row.original.id];
        return <WaitingOn on={v?.waiting_on ?? null} reason={v?.waiting_reason ? { code: v.waiting_reason, status: row.original.status } : null} />;
      } },
    { id: 'deadline', accessorFn: (r) => r.intake.application_deadline, header: t('apps.deadline'), meta: { label: t('apps.deadline'), priority: 2, minWidth: 120 },
      cell: ({ row }) => <DeadlineCell date={row.original.intake.application_deadline} /> },
    { id: 'updated', accessorKey: 'updated_at', header: t('students.col.updated'), meta: { label: t('students.col.updated'), hideOnMobile: true, priority: 5, minWidth: 100 },
      cell: ({ getValue }) => <span className="hg-subtle hg-small">{formatRelative(getValue<string>(), locale)}</span> },
  ], [t, locale, rem]);

  const close = () => nav({ pathname: embedded ? '/review' : '/applications', search: sp.toString() });

  return (
    <div className="hg-stack ag-page">
      {!embedded && <PageHeader title={t('nav.applications')} subtitle={t('v8.apps.sub')} />}
      <Card>
        <div className="ag-card-toolbar">
          <FilterBar active={[f.values.status, f.values.flagged, f.values.uni, f.values.intake].filter(Boolean).length} onClear={() => { setSearch(''); f.clear(); }}
            search={<SearchBox value={search} onChange={setSearch} placeholder={t('apps.searchPh')} label={t('actions.search')} />}>
            <FilterSelect size="sm" label={t('apps.col.status')} value={f.values.status} onChange={(e) => f.set({ status: e.target.value })}>
              <option value="">{t('apps.allStatuses')}</option>
              {APPLICATION_STATUSES.map((s: ApplicationStatus) => <option key={s} value={s}>{t(`appStatus.${s}`)}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('apps.university')} value={f.values.uni} onChange={(e) => f.set({ uni: e.target.value })} title={t('apps.uniHint')}>
              <option value="">{t('apps.allUniversities')}</option>
              {(unis.data?.by_university ?? []).map((u) => <option key={u.key} value={u.key}>{u.key}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('apps.sort')} value={f.values.sort || 'updated'} onChange={(e) => f.set({ sort: e.target.value === 'updated' ? null : e.target.value })}>
              {SORTS.map((s) => <option key={s} value={s}>{t(`apps.sortBy.${s}`)}</option>)}
            </FilterSelect>
            <Checkbox label={t('apps.onlyFlagged')} checked={f.values.flagged === '1'} onChange={(e) => f.set({ flagged: e.target.checked ? '1' : null })} />
          </FilterBar>
        </div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable dense columns={columns} data={q.data?.items ?? []} loading={q.isLoading} getRowId={(r) => r.id}
            onRowClick={(r) => nav({ pathname: `/applications/${r.id}`, search: sp.toString() })} exportName="applications" caption={t('nav.applications')}
            server={{
              total: q.data?.total ?? 0, pagination: { pageIndex, pageSize },
              onPaginationChange: (u) => { const n = typeof u === 'function' ? u({ pageIndex, pageSize }) : u; setPageSize(n.pageSize); f.set({ page: n.pageIndex ? String(n.pageIndex + 1) : null }, false); },
            }}
            empty={<EmptyState compact title={t('states.noResults')} text={t('apps.empty')} />} />
        )}
      </Card>
      <Drawer open={!!id} onClose={close} title={t('apps.detail')} width={620}>
        {id && <ApplicationPanel id={id} />}
      </Drawer>
    </div>
  );
}
