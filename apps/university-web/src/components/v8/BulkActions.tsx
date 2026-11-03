// V9 U3: "Select all N matching" (across pages) for the same safe actions, run on the server from the list filters, with a
// server-side preview (count + first rows) before anything changes and per-item results after. Never admit or reject.
// V8 safe bulk actions on Applicants: assign a reviewer, request one standard document (the same request as the single
// action), export the selected rows, mark the administrative check complete. Never a decision. Every action reports a
// result per application (the API checks each id against the caller's tenant independently).
import { useAuth } from '@hangyul/auth';
import { ClipboardCheck, Download, Send, UserCheck } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { Application, BulkResult, UniversityBulkAction } from '@hangyul/types';
import { Button, Callout, Field, Input, Modal, Select, Textarea, useToast } from '@hangyul/ui';
import { downloadBlob } from '@hangyul/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { todayStamp } from '../../lib/format';
import { useTeam } from '../../lib/queries';
import { useUniversity } from '../../lib/university';
import { summarizeBulk } from '../../lib/v8';
import { canSelectAllMatching, type FilterAction, type FilterPreview } from '../../lib/v9';

/** The standard document types a bulk request may ask for (same list as the server; "Other" needs a single request). */
export const STANDARD_CATEGORIES = ['BANK_STATEMENT', 'TRANSCRIPT', 'GRADUATION_CERTIFICATE', 'TOPIK', 'IELTS', 'PASSPORT', 'RECOMMENDATION', 'SPONSOR_DOCUMENT'] as const;

type Kind = UniversityBulkAction | null;

function ResultModal({ result, rows, onClose }: { result: BulkResult; rows: Application[]; onClose: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const s = summarizeBulk(result.results);
  const name = (id: string) => rows.find((r) => r.id === id)?.student?.full_name ?? id.slice(0, 8);
  return (
    <Modal open onClose={onClose} title={t(`university:v8.bulk.${result.action}.title`)}
      footer={<Button variant="primary" onClick={onClose}>{t('common:actions.done')}</Button>}>
      <div className="hg-stack">
        <p className="mb-0" role="status">{t('university:v8.bulk.summary', { ok: s.succeeded, total: result.total })}
          {s.unchanged > 0 ? ` ${t('university:v8.bulk.unchanged', { count: s.unchanged })}` : ''}</p>
        {s.failed > 0 && (
          <Callout tone="warning" title={t('university:v8.bulk.failedTitle', { count: s.failed })}>
            <ul className="uv8-bulkfail">
              {Object.entries(s.failures).map(([reason, ids]) => (
                <li key={reason}><b>{t(`university:v8.bulk.error.${reason}`, { defaultValue: reason })}</b>: {ids.map(name).join(', ')}</li>
              ))}
            </ul>
          </Callout>
        )}
      </div>
    </Modal>
  );
}

/** Server preview of "all N matching": the count, who is skipped and why, and the first rows — before anything changes. */
function MatchPreview({ action, filters, onReady }: { action: FilterAction; filters: Record<string, unknown>; onReady: (p: FilterPreview | null) => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const [p, setP] = useState<FilterPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.post<FilterPreview>(`/university/bulk-filter/${action}/preview`, { filters })
      .then((r) => { if (live) { setP(r); onReady(r); } })
      .catch((e) => { if (live) { setErr((e as Error).message); onReady(null); } });
    return () => { live = false; };
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Callout tone="warning">{err}</Callout>;
  if (!p) return <p className="text-muted fs-13 mb-0" role="status">{t('university:v9.bulk.previewing')}</p>;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
      <p className="mb-0" role="status"><b>{t('university:v9.bulk.matching', { count: p.total })}</b>
        {p.total !== p.eligible ? ` ${t('university:v9.bulk.skipped', { count: p.total - p.eligible })}` : ''}</p>
      <ul className="uv9-preview" aria-label={t('university:v9.bulk.firstRows')}>
        {p.first.map((r) => (
          <li key={r.id} data-skip={r.will_skip || undefined}>
            <span className="text-truncate">{r.student ?? '—'} · {r.program ?? ''}</span>
            <span className="text-muted flex-none">{r.will_skip ? t('university:v9.bulk.willSkip') : t(`common:appStatus.${r.status}`)}</span>
          </li>
        ))}
      </ul>
      {p.total > p.first.length && <p className="fs-12 text-muted mb-0">{t('university:v9.bulk.andMore', { count: p.total - p.first.length })}</p>}
    </div>
  );
}

export function BulkActions({ ids, rows, clear, total, filters }: { ids: string[]; rows: Application[]; clear: () => void; total?: number; filters?: Record<string, unknown> }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { perms, scopeId } = useUniversity();
  const team = useTeam();
  const [open, setOpen] = useState<Kind>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [category, setCategory] = useState<string>('BANK_STATEMENT');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reviewers = team.data ?? [];
  const [all, setAll] = useState(false);
  const [preview, setPreview] = useState<FilterPreview | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const offerAll = !!filters && canSelectAllMatching(ids.length, rows.length, total);
  const n = all ? preview?.total ?? total ?? ids.length : ids.length;
  const openKind = (k: Kind) => { setPreview(null); setOpen(k); };

  const m = useMutation({
    mutationFn: (kind: UniversityBulkAction): Promise<BulkResult> => {
      const extra = kind === 'assign-reviewer' ? { reviewer_id: reviewer || null }
        : kind === 'document-request' ? { category, note: note.trim(), due_date: due || undefined } : {};
      return all
        ? api.post<BulkResult>(`/university/bulk-filter/${kind}`, { filters, expected_total: preview?.total, ...extra })
        : api.university.bulk(kind, { ids, ...extra });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['university', 'attention'] });
      setOpen(null);
      setResult(r);
      setNote('');
      clear();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exportSelected = async () => {
    setExporting(true);
    try {
      const res = all
        ? await api.request<Response>('/university/bulk-filter/export', { method: 'POST', body: { filters, expected_total: preview?.total }, raw: true })
        : await api.university.exportApplications(scopeId, { ids });
      downloadBlob(await res.blob(), `applicants-selected-${todayStamp()}.csv`);
      toast.success(t('university:v8.bulk.exported', { count: n }));
      setExportOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const submitRequest = () => {
    if (note.trim().length < 3) { setErr('validation.required'); return; }
    setErr(null);
    m.mutate('document-request');
  };

  const footer = (kind: UniversityBulkAction, onConfirm: () => void) => (
    <>
      <Button onClick={() => setOpen(null)}>{t('common:actions.cancel')}</Button>
      <Button variant="primary" loading={m.isPending && m.variables === kind} disabled={all && !preview} onClick={onConfirm}>{t(`university:v8.bulk.${kind}.confirm`, { count: all ? preview?.eligible ?? 0 : n })}</Button>
    </>
  );
  const scope = (kind: FilterAction) => (all && filters ? <MatchPreview action={kind} filters={filters} onReady={setPreview} /> : null);

  return (
    <>
      {(offerAll || all) && (
        <span className="uv9-allmatch">
          {all ? <><strong>{t('university:v9.bulk.allSelected', { count: total ?? 0 })}</strong><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setAll(false)}>{t('university:v9.bulk.onlyPage', { count: ids.length })}</button></>
            : <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setAll(true)}>{t('university:v9.bulk.selectAll', { count: total ?? 0 })}</button>}
        </span>
      )}
      {perms.canEdit && <Button size="sm" variant="soft" icon={<UserCheck />} onClick={() => openKind('assign-reviewer')}>{t('university:v8.bulk.assign-reviewer.cta')}</Button>}
      {perms.canEdit && <Button size="sm" variant="soft" icon={<Send />} onClick={() => openKind('document-request')}>{t('university:v8.bulk.document-request.cta')}</Button>}
      {perms.canEdit && <Button size="sm" variant="soft" icon={<ClipboardCheck />} onClick={() => openKind('admin-check')}>{t('university:v8.bulk.admin-check.cta')}</Button>}
      {perms.canExport && <Button size="sm" variant="ghost" icon={<Download />} loading={exporting && !all} onClick={() => (all ? (setPreview(null), setExportOpen(true)) : exportSelected())}>{t('university:v8.bulk.export')}</Button>}
      {exportOpen && (
        <Modal open onClose={() => setExportOpen(false)} title={t('university:v9.bulk.exportTitle')}
          footer={<><Button onClick={() => setExportOpen(false)}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={exporting} disabled={!preview} onClick={exportSelected}>{t('university:v9.bulk.exportConfirm', { count: preview?.total ?? 0 })}</Button></>}>
          {scope('export')}
        </Modal>
      )}

      {open === 'assign-reviewer' && (
        <Modal open onClose={() => setOpen(null)} title={t('university:v8.bulk.assign-reviewer.title')} description={all ? t('university:v9.bulk.scopeAll') : t('university:v8.bulk.selectedN', { count: n })}
          footer={footer('assign-reviewer', () => m.mutate('assign-reviewer'))}>
          {scope('assign-reviewer')}
          <Field label={t('university:reviewer.label')} htmlFor="bulk-rev" hint={t('university:v8.bulk.assign-reviewer.hint')}>
            <Select id="bulk-rev" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option value="">{t('university:v8.bulk.assign-reviewer.clear')}</option>
              {reviewers.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}{r.title ? ` · ${r.title}` : ''}</option>)}
            </Select>
          </Field>
        </Modal>
      )}
      {open === 'document-request' && (
        <Modal open onClose={() => setOpen(null)} title={t('university:v8.bulk.document-request.title')} description={all ? t('university:v9.bulk.scopeAll') : t('university:v8.bulk.document-request.description', { count: n })}
          footer={footer('document-request', submitRequest)}>
          <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); submitRequest(); }} noValidate>
            {scope('document-request')}
            <div className="uc-two">
              <Field label={t('university:request.category')} htmlFor="bulk-cat">
                <Select id="bulk-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {STANDARD_CATEGORIES.map((c) => <option key={c} value={c}>{t(`common:docCategory.${c}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('university:request.due')} htmlFor="bulk-due" optional>
                <Input id="bulk-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </div>
            <Field label={t('university:request.note')} htmlFor="bulk-note" hint={t('university:v8.bulk.document-request.noteHint')} error={err ?? undefined}>
              <Textarea id="bulk-note" rows={4} maxLength={2000} value={note} placeholder={t('university:request.notePlaceholder')} onChange={(e) => setNote(e.target.value)} invalid={!!err} />
            </Field>
            <p className="uc-note">{t('university:v8.bulk.document-request.skipNote')}</p>
          </form>
        </Modal>
      )}
      {open === 'admin-check' && (
        <Modal open onClose={() => setOpen(null)} title={t('university:v8.bulk.admin-check.title')} description={all ? t('university:v9.bulk.scopeAll') : t('university:v8.bulk.selectedN', { count: n })}
          footer={footer('admin-check', () => m.mutate('admin-check'))}>
          {scope('admin-check')}
          <p className="mb-0 mt-2">{t('university:v8.bulk.admin-check.body')}</p>
        </Modal>
      )}
      {result && <ResultModal result={result} rows={rows} onClose={() => setResult(null)} />}
    </>
  );
}
