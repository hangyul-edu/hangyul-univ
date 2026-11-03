import { useAuth } from '@hangyul/auth';
import { ExternalLink, Radar, ShieldCheck, X } from '@hangyul/icons';
import type { FreshnessReviewItem, SourceRecord, VerificationStatus } from '@hangyul/types';
import { Button, Card, Checkbox, DataTable, EmptyState, ErrorState, Field, Modal, PageHeader, Popover, QueryState, FilterSelect, StatusText, Tabs, Textarea, useToast, type ColumnDef } from '@hangyul/ui';
import { formatDate, formatNumber, formatRelative, type Tone } from '@hangyul/utils';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FilterBar, SearchBox, useT, kvCard } from '../../components/bits';
import { useDebounced, usePerms, useUrlFilters } from '../../lib/hooks';

const STATUS: VerificationStatus[] = ['CURRENT', 'REVIEW_DUE', 'CHANGED', 'CONFLICT', 'ARCHIVED', 'DEMO'];
export const verTone = (s: string): Tone => (s === 'CURRENT' ? 'success' : s === 'REVIEW_DUE' ? 'warning' : s === 'CHANGED' || s === 'CONFLICT' ? 'danger' : 'neutral');

function CheckModal({ source, onClose }: { source: SourceRecord | null; onClose: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [changed, setChanged] = useState(false);
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.admin.checkSource(source!.id, changed, note.trim() || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sources'] }); qc.invalidateQueries({ queryKey: ['freshness'] }); toast.success(t('sources.checked')); setChanged(false); setNote(''); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={!!source} onClose={onClose} title={t('sources.markChecked')} description={source?.name}
      footer={<><Button onClick={onClose}>{t('actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>{t('actions.confirm')}</Button></>}>
      <div className="hg-stack" style={{ '--hg-gap': '12px' } as React.CSSProperties}>
        {source && <a href={source.url} target="_blank" rel="noreferrer noopener" className="hg-small">{source.url} <ExternalLink size={12} aria-hidden style={{ display: 'inline' }} /></a>}
        <Checkbox label={t('sources.changed')} checked={changed} onChange={(e) => setChanged(e.target.checked)} />
        <p className="hg-subtle hg-xs">{changed ? t('sources.changedHint') : t('sources.unchangedHint')}</p>
        <Field label={t('sources.note')} htmlFor="sc-note" optional><Textarea id="sc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} /></Field>
      </div>
    </Modal>
  );
}

function SourcesTable() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [checking, setChecking] = useState<SourceRecord | null>(null);
  const dq = useDebounced(q, 300);
  const query = { q: dq || undefined, status: status || undefined, page: pagination.pageIndex + 1, page_size: pagination.pageSize };
  const res = useQuery({ queryKey: ['sources', query], queryFn: () => api.catalog.sources({ ...query, include_internal: true }), placeholderData: keepPreviousData });
  const cols: ColumnDef<SourceRecord>[] = [
    { id: 'name', accessorKey: 'name', header: t('sources.source'), meta: { primary: true, label: t('sources.source') },
      cell: ({ row }) => <span className="ag-cell-2"><a href={row.original.url} target="_blank" rel="noreferrer noopener" className="hg-small hg-strong" onClick={(e) => e.stopPropagation()}>{row.original.name}</a><span className="hg-subtle hg-xs">{row.original.topic ?? row.original.key}</span></span> },
    { id: 'type', accessorKey: 'source_type', header: t('sources.type'), meta: { label: t('sources.type'), hideOnMobile: true }, cell: ({ getValue }) => <span className="hg-small hg-muted">{t(`hq.kind.${getValue<string>()}`, { defaultValue: getValue<string>() })}</span> },
    { id: 'status', accessorKey: 'status', header: t('apps.col.status'), meta: { label: t('apps.col.status') }, cell: ({ getValue }) => <StatusText tone={verTone(getValue<string>())}>{t(`sources.status.${getValue<string>()}`)}</StatusText> },
    { id: 'checked', accessorKey: 'last_checked_at', header: t('sources.lastChecked'), meta: { label: t('sources.lastChecked') },
      cell: ({ row }) => <span className="hg-small" title={formatDate(row.original.last_checked_at, locale)}>{row.original.last_checked_at ? formatRelative(row.original.last_checked_at, locale) : t('freshness.unverified')}</span> },
    { id: 'interval', accessorKey: 'review_interval_days', header: t('sources.interval'), meta: { numeric: true, label: t('sources.interval'), hideOnMobile: true }, cell: ({ getValue }) => t('misc.days', { count: getValue<number>() }) },
    { id: 'method', accessorKey: 'ingestion_method', header: t('sources.method'), meta: { label: t('sources.method'), hideOnMobile: true } },
    ...(perms.ops ? [{ id: 'act', header: '', enableSorting: false, enableHiding: false, meta: { label: t('sources.markChecked') },
      cell: ({ row }: { row: { original: SourceRecord } }) => <Button size="sm" variant="ghost" icon={<ShieldCheck />} onClick={(e) => { e.stopPropagation(); setChecking(row.original); }}>{t('sources.check')}</Button> } as ColumnDef<SourceRecord>] : []),
  ];
  return (
    <Card>
      <div className="ag-card-toolbar">
        <FilterBar active={status ? 1 : 0} onClear={() => setStatus('')} search={<SearchBox value={q} onChange={(v) => { setQ(v); setPagination((p) => ({ ...p, pageIndex: 0 })); }} placeholder={t('sources.searchPh')} label={t('actions.search')} />}>
          <FilterSelect size="sm" label={t('apps.col.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
            <option value="">{t('apps.allStatuses')}</option>
            {STATUS.map((s) => <option key={s} value={s}>{t(`sources.status.${s}`)}</option>)}
          </FilterSelect>
        </FilterBar>
      </div>
      {res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} /> : (
        <DataTable dense columns={cols} data={res.data?.items ?? []} loading={res.isLoading} getRowId={(r) => r.id} caption={t('nav.sources')} renderCard={kvCard((r: SourceRecord) => <a href={r.url} target="_blank" rel="noreferrer noopener">{r.name}</a>, [
          [t('apps.col.status'), (r) => <StatusText tone={verTone(r.status)}>{t(`sources.status.${r.status}`)}</StatusText>],
          [t('sources.lastChecked'), (r) => (r.last_checked_at ? formatRelative(r.last_checked_at, locale) : t('freshness.unverified'))],
          ...(perms.ops ? [[t('sources.check'), (r: SourceRecord) => <Button size="sm" variant="ghost" icon={<ShieldCheck />} onClick={() => setChecking(r)}>{t('sources.check')}</Button>] as [string, (r: SourceRecord) => React.ReactNode]] : [])])}
          server={{ total: res.data?.total ?? 0, pagination, onPaginationChange: setPagination }} empty={<EmptyState compact title={t('states.noResults')} />} />
      )}
      <CheckModal source={checking} onClose={() => setChecking(null)} />
    </Card>
  );
}

type QueueItem = FreshnessReviewItem & { source_type?: string | null };
/** Most urgent first: a conflict or a changed source can already be wrong on a student's screen; "review due" is only old. */
const RISK: string[] = ['CONFLICT', 'CHANGED', 'REVIEW_DUE'];
const kindOf = (r: QueueItem) => (r.entity_type === 'source' ? r.source_type ?? 'OTHER' : r.entity_type);

function ResolveMenu({ id, onResolve }: { id: string; onResolve: (id: string, r: 'CONFIRMED' | 'UPDATED' | 'ARCHIVED') => void }) {
  const { t } = useT();
  return (
    <Popover width={240} trigger={(p) => <Button size="sm" variant="ghost" {...p}>{t('sources.resolve')}</Button>}>
      {(close) => (
        <div role="menu">
          {(['CONFIRMED', 'UPDATED', 'ARCHIVED'] as const).map((r) => (
            <button key={r} role="menuitem" type="button" className="hg-menu-item" onClick={() => { close(); onResolve(id, r); }}>
              <span className="hg-grow"><span className="hg-small hg-strong">{t(`sources.res.${r}`)}</span><span className="hg-subtle hg-xs" style={{ display: 'block' }}>{t(`sources.resHint.${r}`)}</span></span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function ReviewQueue() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const f = useUrlFilters(['reason', 'kind', 'resolved'] as const);
  const openOnly = f.values.resolved !== '1';
  const q = useQuery({ queryKey: ['freshness', 'reviews', openOnly], queryFn: () => api.admin.reviews(openOnly) as Promise<QueueItem[]> });
  const resolve = useMutation({
    mutationFn: ({ id, r }: { id: string; r: 'CONFIRMED' | 'UPDATED' | 'ARCHIVED' }) => api.admin.resolveReview(id, r),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['freshness'] }); qc.invalidateQueries({ queryKey: ['sources'] }); qc.invalidateQueries({ queryKey: ['hq'] }); toast.success(t('sources.resolved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const kindLabel = (k: string) => t(`hq.kind.${k}`, { defaultValue: k });
  return (
    <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<div className="hg-panel"><EmptyState compact icon={<ShieldCheck />} title={t('sources.queueEmpty')} /></div>}>
      {(all) => {
        const rows = all.filter((r) => (!f.values.reason || r.reason === f.values.reason) && (!f.values.kind || kindOf(r) === f.values.kind));
        const open = rows.filter((r) => !r.resolved_at);
        const reasons = [...RISK, ...[...new Set(open.map((r) => r.reason))].filter((r) => !RISK.includes(r)).sort()];
        const groups = reasons.map((reason) => ({ reason, items: open.filter((r) => r.reason === reason) })).filter((g) => g.items.length);
        const done = rows.filter((r) => r.resolved_at);
        return (
          <div className="ag-src">
            <div className="ag-src__bar">
              <span className="ag-src__summary">
                {RISK.map((r) => {
                  const n = all.filter((x) => !x.resolved_at && x.reason === r).length;
                  return <button key={r} type="button" className="ag-src__count" data-reason={r} aria-pressed={f.values.reason === r} disabled={!n}
                    onClick={() => f.set({ reason: f.values.reason === r ? null : r, kind: null })}><span className="hg-num">{formatNumber(n, locale)}</span> {t(`hq.m.fresh.${r}`)}</button>;
                })}
              </span>
              {(f.values.reason || f.values.kind) && (
                <button type="button" className="ag-src__clear" onClick={() => f.set({ reason: null, kind: null })}>
                  {[f.values.reason && t(`hq.m.fresh.${f.values.reason}`, { defaultValue: f.values.reason }), f.values.kind && kindLabel(f.values.kind)].filter(Boolean).join(' · ')} <X aria-hidden size={14} />
                  <span className="hg-sr-only">{t('hq.src.clear')}</span>
                </button>
              )}
              <span className="hg-grow" />
              <Checkbox label={t('sources.openOnly')} checked={openOnly} onChange={(e) => f.set({ resolved: e.target.checked ? null : '1' })} />
            </div>
            {groups.length === 0 && !done.length && <div className="hg-panel"><EmptyState compact icon={<ShieldCheck />} title={t('sources.queueEmpty')} /></div>}
            {groups.map((g) => {
              const kinds = [...new Set(g.items.map(kindOf))].sort((a, b) => g.items.filter((x) => kindOf(x) === b).length - g.items.filter((x) => kindOf(x) === a).length);
              return (
                <section key={g.reason} className="ag-src__group" data-reason={g.reason} aria-labelledby={`risk-${g.reason}`}>
                  <h2 id={`risk-${g.reason}`} className="ag-src__head">
                    <span className="ag-src__dot" aria-hidden />{t(`hq.m.fresh.${g.reason}`, { defaultValue: g.reason })}<span className="hg-num ag-src__n">{formatNumber(g.items.length, locale)}</span>
                    <span className="ag-src__why">{t(`hq.src.why.${g.reason}`, { defaultValue: '' })}</span>
                  </h2>
                  <div className="hg-panel">
                    {kinds.map((k) => (
                      <div key={k} className="ag-src__kind">
                        <h3 className="ag-src__kindhead">{kindLabel(k)} <span className="hg-num">{g.items.filter((x) => kindOf(x) === k).length}</span></h3>
                        <ul className="ag-src__list">
                          {g.items.filter((x) => kindOf(x) === k).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => (
                            <li key={r.id} className="ag-src__row">
                              <span className="ag-src__main"><span className="ag-src__label">{r.entity_label}</span>{r.detail && <span className="ag-src__detail">{r.detail}</span>}</span>
                              <span className="ag-src__age" title={formatDate(r.created_at, locale)}>{formatRelative(r.created_at, locale)}</span>
                              <span className="ag-src__act">{perms.ops ? <ResolveMenu id={r.id} onResolve={(id, x) => resolve.mutate({ id, r: x })} /> : null}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            {done.length > 0 && (
              <section className="ag-src__group" aria-labelledby="risk-done">
                <h2 id="risk-done" className="ag-src__head ag-src__head--done">{t('hq.src.resolved')}<span className="hg-num ag-src__n">{formatNumber(done.length, locale)}</span></h2>
                <div className="hg-panel">
                  <ul className="ag-src__list">
                    {done.map((r) => (
                      <li key={r.id} className="ag-src__row">
                        <span className="ag-src__main"><span className="ag-src__label">{r.entity_label}</span><span className="ag-src__detail">{kindLabel(kindOf(r))} · {t(`hq.m.fresh.${r.reason}`, { defaultValue: r.reason })}</span></span>
                        <span className="ag-src__age">{r.resolved_at ? formatRelative(r.resolved_at, locale) : ''}</span>
                        <span className="ag-src__act hg-subtle hg-xs">{t(`sources.res.${r.resolution}`, { defaultValue: r.resolution ?? '' })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

export default function Sources() {
  const { api } = useAuth();
  const { t } = useT();
  const perms = usePerms();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'queue' | 'sources'>('queue');
  const scan = useMutation({
    mutationFn: () => api.admin.scan(),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['freshness'] }); qc.invalidateQueries({ queryKey: ['sources'] }); toast.success(t('sources.scanDone', { count: r.created })); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="hg-stack ag-page">
      <PageHeader title={t('nav.sources')} subtitle={t('sources.sub')}
        actions={perms.ops ? <Button size="sm" variant="primary" icon={<Radar />} loading={scan.isPending} onClick={() => scan.mutate()}>{t('sources.scan')}</Button> : undefined} />
      <Tabs label={t('nav.sources')} value={tab} onChange={setTab} tabs={[{ value: 'queue', label: t('sources.queue') }, { value: 'sources', label: t('sources.registry') }]} />
      {tab === 'queue' ? <ReviewQueue /> : <SourcesTable />}
    </div>
  );
}
