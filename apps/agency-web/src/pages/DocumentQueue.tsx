import { useAuth } from '@hangyul/auth';
import { CheckCircle2, ChevronLeft, FileCheck, Keyboard, Upload, UserCheck } from '@hangyul/icons';
import { Button, EmptyState, ErrorState, Modal, Popover, FilterSelect, Skeleton, useToast } from '@hangyul/ui';
import { PageHeader } from '@hangyul/ynex-ui';
import { countryName, cx, flagEmoji } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Kbd, useT } from '../components/bits';
import { UploadOnBehalf } from '../components/UploadOnBehalf';
import { DocumentReviewPanel } from '../components/DocumentReviewPanel';
import { YAvatar } from '../components/ynex';
import { useHotkeys, useTeam } from '../lib/hooks';
import { waitLabel } from '../lib/logic';

type Assigned = 'any' | 'me' | 'unassigned';

/**
 * V11: Documents and Writing are two modes of one Review area (REPORT §77.1), so when this renders inside
 * `/review` it drops its own page title and hands only its actions to the shared header.
 */
export default function DocumentQueue({ embedded }: { embedded?: boolean } = {}) {
  const { api, session } = useAuth();
  const { t, locale } = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const team = useTeam();
  const [sp, setSp] = useSearchParams();
  const selected = sp.get('doc');
  const category = sp.get('category') ?? '';
  // V8: Today's "Review" action opens the queue narrowed to one student (?student=).
  const student = sp.get('student') ?? '';
  const assigned = (sp.get('assigned') as Assigned) || 'any';
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [upload, setUpload] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const params = { page_size: 100, assigned: assigned === 'any' ? undefined : assigned };
  const q = useQuery({ queryKey: ['documents', 'review-queue', params], queryFn: () => api.documents.reviewQueue(params), placeholderData: (p) => p });
  const items = useMemo(() => (q.data?.items ?? []).filter((d) => (!category || d.category === category) && (!student || d.owner_user_id === student)), [q.data, category, student]);
  const categories = useMemo(() => [...new Set((q.data?.items ?? []).map((d) => d.category))], [q.data]);
  const overSla = items.filter((d) => d.over_sla).length;
  const idx = items.findIndex((d) => d.id === selected);
  const setParam = (k: string, v: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const select = (id: string | null) => setParam('doc', id);
  const step = (dir: 1 | -1) => {
    if (!items.length) return;
    const next = idx < 0 ? 0 : Math.min(items.length - 1, Math.max(0, idx + dir));
    select(items[next].id);
    setTimeout(() => document.getElementById(`qi-${items[next].id}`)?.scrollIntoView({ block: 'nearest' }), 0);
  };
  useHotkeys({ j: () => step(1), k: () => step(-1) });
  // Desktop: open the oldest document straight away so the reviewer starts working, not choosing.
  useEffect(() => {
    if (!selected && items.length && window.matchMedia('(min-width: 1024px)').matches) select(items[0].id);
  }, [selected, items]); // eslint-disable-line react-hooks/exhaustive-deps
  // Filtering keeps the open document when it is still in the list; otherwise it opens the first one in the new list.
  const refiltered = useRef(false);
  useEffect(() => { setPicked(new Set()); refiltered.current = true; }, [assigned, category, student]);
  useEffect(() => {
    if (!refiltered.current || q.isFetching) return;
    refiltered.current = false;
    if (selected && items.length && !items.some((d) => d.id === selected) && window.matchMedia('(min-width: 1024px)').matches) select(items[0].id);
  }, [items, q.isFetching]); // eslint-disable-line react-hooks/exhaustive-deps

  const bulk = useMutation({
    mutationFn: (body: { action: 'VERIFY' | 'ASSIGN_REVIEWER'; reviewer_user_id?: string }) => api.documents.bulk({ ids: [...picked], ...body }),
    onSuccess: (r, body) => {
      toast.success(body.action === 'VERIFY' ? t('docs.bulkVerified', { count: r.ok }) : t('docs.bulkAssigned', { count: r.ok }));
      if (r.failed) toast.error(t('docs.bulkFailed', { count: r.failed }));
      setPicked(new Set());
      setConfirmVerify(false);
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const members = (team.data?.members ?? []).filter((m) => m.active);

  const shortcuts = (
    <Popover width={280} trigger={(p) => <Button className="ag-shortcuts-btn" size="sm" variant="ghost" icon={<Keyboard />} {...p}>{t('docs.shortcuts')}</Button>}>
      <dl className="ag-shortcuts">
        <dt><Kbd>J</Kbd> / <Kbd>K</Kbd></dt><dd>{t('docs.sc.nav')}</dd>
        <dt><Kbd>1</Kbd>–<Kbd>6</Kbd></dt><dd>{t('docs.sc.checks')}</dd>
        <dt><Kbd>V</Kbd></dt><dd>{t('docs.sc.verify')}</dd>
        <dt><Kbd>C</Kbd></dt><dd>{t('docs.sc.changes')}</dd>
        <dt><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></dt><dd>{t('docs.sc.send')}</dd>
        <dt><Kbd>Esc</Kbd></dt><dd>{t('docs.sc.cancel')}</dd>
      </dl>
    </Popover>
  );

  return (
    <div className="ag7 ag7-docs">
      {embedded
        ? <div className="ag-revhub__actions">{shortcuts}{<Button size="sm" icon={<Upload />} onClick={() => setUpload(true)}>{t('docs.uploadForStudent')}</Button>}</div>
        : <PageHeader title={t('sidebar.documents')}
            sub={overSla ? t('docs.subSla', { count: q.data?.total ?? 0, late: overSla, hours: items[0]?.sla_hours ?? 48 }) : t('docs.sub', { count: q.data?.total ?? 0 })}
            actions={<>{shortcuts}{<Button size="sm" icon={<Upload />} onClick={() => setUpload(true)}>{t('docs.uploadForStudent')}</Button>}</>} />}
      <div className="ag-split ag-split--review" data-has-selection={!!selected}>
        <section className="ag-split__list card custom-card ag7-queue-pane" aria-labelledby="dq-title">
          <div className="card-header justify-content-between">
            <h2 className="card-title" id="dq-title">{t('docs.queue')}<span className="badge bg-light text-default rounded ms-1 fs-12 align-middle yx-count">{items.length}</span></h2>
          </div>
          <div className="ag7-queue-pane__filters">
            <div className="btn-group ag7-seg" role="group" aria-label={t('docs.queue')}>
              {(['any', 'me', 'unassigned'] as const).map((v) => (
                <button key={v} type="button" className="btn btn-sm btn-light" aria-pressed={assigned === v}
                  onClick={() => setParam('assigned', v === 'any' ? null : v)}>{t(`docs.assigned.${v}`)}</button>
              ))}
            </div>
            <FilterSelect size="sm" label={t('docs.category')} value={category} onChange={(e) => setParam('category', e.target.value || null)}>
              <option value="">{t('docs.allCategories')}</option>
              {categories.map((c) => <option key={c} value={c}>{t(`docCategory.${c}`)}</option>)}
            </FilterSelect>
            {student && (
              <button type="button" className="btn btn-sm btn-light" onClick={() => setParam('student', null)}>
                {t('v8.docs.oneStudent', { name: items[0]?.owner_name ?? '' })} ×
              </button>
            )}
          </div>
          {picked.size > 0 && (
            <div className="ag-bulkbar" role="region" aria-label={t('docs.bulkLabel')}>
              <strong className="hg-small">{t('table.selected', { count: picked.size })}</strong>
              <Button size="sm" variant="primary" icon={<CheckCircle2 />} onClick={() => setConfirmVerify(true)}>{t('docs.bulkVerify')}</Button>
              <Popover width={240} trigger={(p) => <Button size="sm" icon={<UserCheck />} {...p}>{t('docs.bulkAssign')}</Button>}>
                {(close) => (
                  <div role="menu" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {members.map((m) => (
                      <button key={m.user_id} role="menuitem" type="button" className="hg-menu-item"
                        onClick={() => { bulk.mutate({ action: 'ASSIGN_REVIEWER', reviewer_user_id: m.user_id }); close(); }}>
                        <span className="hg-grow">{m.full_name}{m.user_id === session?.user.id ? ` · ${t('docs.you')}` : ''}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{t(`role.${m.role}`)}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>{t('table.clearSelection')}</Button>
            </div>
          )}
          {q.isLoading ? <div style={{ padding: 12 }} className="hg-stack">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={52} r={8} />)}</div>
            : q.isError ? <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
              : items.length === 0 ? <EmptyState compact icon={<FileCheck />} title={t('docs.empty')} text={t(`docs.emptyBy.${assigned}`)} />
                : (
                  <ul className="ag-queue" aria-label={t('docs.queue')}>
                    {items.map((d) => (
                      <li key={d.id} id={`qi-${d.id}`} className={cx('ag-queue__li', d.id === selected && 'is-active')}>
                        {(
                          <input type="checkbox" className="ag-queue__check" checked={picked.has(d.id)} onChange={() => toggle(d.id)}
                            aria-label={t('docs.selectDoc', { name: d.owner_name, doc: t(`docCategory.${d.category}`) })} />
                        )}
                        <button type="button" className="ag-queue__item ag7-qitem" aria-current={d.id === selected || undefined} onClick={() => select(d.id)}>
                          <YAvatar name={d.owner_name ?? '?'} />
                          <span className="min-w-0 flex-fill">
                            <span className="d-flex justify-content-between gap-2 min-w-0">
                              <span className="fw-semibold text-truncate"><span aria-hidden title={countryName(d.owner_nationality, locale)}>{flagEmoji(d.owner_nationality)}</span> {d.owner_name}</span>
                              <span className={cx('badge', d.over_sla ? 'bg-danger-transparent' : 'bg-light text-muted')}>{waitLabel(d.waiting_hours ?? 0, t)}</span>
                            </span>
                            <span className="d-flex justify-content-between gap-2 min-w-0 fs-12 text-muted">
                              <span className="text-truncate">{t(`docCategory.${d.category}`)}</span>
                              {d.assigned_reviewer && <span className="text-truncate">{d.assigned_reviewer.full_name}</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
        </section>
        <section className="ag-split__detail" aria-label={t('docs.reviewer')}>
          {selected ? (
            <>
              <DocumentReviewPanel id={selected} hotkeys toolbar={
                <div className="d-flex align-items-center gap-2 ag7-review__nav">
                  <Button className="ag7-back" size="sm" variant="ghost" icon={<ChevronLeft className="hg-flip-rtl" />} onClick={() => select(null)}>{t('docs.backToQueue')}</Button>
                  <span className="badge bg-light text-muted">{idx >= 0 ? t('docs.position', { n: idx + 1, total: items.length }) : t('docs.notInQueue')}</span>
                </div>
              } onDecided={() => {
                const next = items[idx + 1] ?? items[idx - 1];
                select(next && next.id !== selected ? next.id : null);
              }} />
            </>
          ) : <div className="card custom-card"><EmptyState icon={<FileCheck />} title={t('docs.pick')} text={t('docs.pickText')} /></div>}
        </section>
      </div>
      <UploadOnBehalf open={upload} onClose={() => setUpload(false)} onDone={(d) => { qc.invalidateQueries({ queryKey: ['documents'] }); select(d.id); }} />
      <Modal open={confirmVerify} onClose={() => setConfirmVerify(false)} title={t('docs.bulkVerifyTitle', { count: picked.size })} width={480}
        footer={<><Button onClick={() => setConfirmVerify(false)}>{t('actions.cancel')}</Button><Button variant="primary" loading={bulk.isPending} onClick={() => bulk.mutate({ action: 'VERIFY' })}>{t('docs.bulkVerify')}</Button></>}>
        <p className="hg-small">{t('docs.bulkVerifyText')}</p>
      </Modal>
    </div>
  );
}
