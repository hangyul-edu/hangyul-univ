import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import { ExternalLink } from '@hangyul/icons';
import type { SubmissionQueueRow, SubmissionSnapshot, SubmissionView } from '@hangyul/types';
import { Button, ButtonLink, Callout, Field, Input, QueryState, SkeletonCard, StatusText, Textarea, useToast } from '@hangyul/ui';
import { countryName, formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useS } from './SuccessPanel';

type TFn = (k: string, o?: Record<string, unknown>) => string;
const today = () => new Date().toISOString().slice(0, 10);

function errText(t: TFn, e: unknown) {
  return (e as { status?: number })?.status === 401 ? t('success:queue.detail.sessionExpired') : (e as Error).message;
}

/** Shared by the nav badge and the page: one request, every group's count. */
export function useSubmissionQueue(enabled = true) {
  const { api } = useAuth();
  return useQuery({ queryKey: ['submissions', 'queue'], queryFn: () => api.success.queue('all'), enabled, staleTime: 30_000 });
}

export function intakeText(t: TFn, r: Pick<SubmissionQueueRow, 'intake'>) {
  return t('common:intakeLabel', { term: t(`common:term.${r.intake.term}`), year: r.intake.year });
}

function SnapshotList({ s }: { s: SubmissionSnapshot }) {
  const { t, locale } = useS();
  const money = s.fee.amount !== null ? formatMoney(s.fee.amount, s.fee.currency ?? 'KRW', locale) : '—';
  return (
    <dl className="sxa-dl">
      {s.form_fields.map((f) => (
        <div key={f.key}><dt>{t(`success:submission.field.${f.key}`, { defaultValue: f.key })}</dt>
          <dd>{f.key === 'date_of_birth' ? formatDate(f.value, locale) : f.key === 'nationality' ? countryName(f.value, locale) : f.value}</dd></div>
      ))}
      <div><dt>{t('success:submission.authorize.docs', { count: s.documents.length })}</dt>
        <dd>{s.documents.map((d) => t(`common:docCategory.${d.category}`, { defaultValue: d.label })).join(' · ')}</dd></div>
      <div><dt>{t('success:agency.fee')}</dt><dd>{money} · {t(`success:queue.payer.${s.fee.payer}`)}<span className="sxa-note">{t('success:agency.feeSeparate')}</span></dd></div>
    </dl>
  );
}

function reviewText(t: TFn, locale: string, i: NonNullable<SubmissionView['final_review']>[number]) {
  const p = i.params as Record<string, string | number | null>;
  switch (i.code) {
    case 'CONSENT': return i.ok ? t('success:queue.review.CONSENT', { date: formatDate(String(p.at), locale) }) : t('success:queue.review.CONSENT_no');
    case 'PACKAGE_UNCHANGED': return i.ok ? t('success:queue.review.PACKAGE_UNCHANGED') : t('success:queue.review.PACKAGE_UNCHANGED_no');
    case 'DEADLINE': return i.ok ? t('success:queue.review.DEADLINE', { deadline: formatDate(String(p.deadline), locale), days: p.days })
      : t('success:queue.review.DEADLINE_no', { deadline: formatDate(String(p.deadline), locale) });
    case 'FEE': return p.amount === null || p.amount === undefined ? t('success:queue.review.FEE_unknown')
      : t('success:queue.review.FEE', { amount: formatMoney(Number(p.amount), String(p.currency ?? 'KRW'), locale), payer: t(`success:queue.payer.${p.payer ?? 'UNKNOWN'}`) });
    default: return t(`success:queue.review.${i.code}`, p as Record<string, unknown>);
  }
}

function RecordSubmission({ v, studentId, onSaved }: { v: SubmissionView; studentId: string; onSaved: () => void }) {
  const { t } = useS();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ids = { ref: useId(), date: useId(), file: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(today());
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const uni = localName(v.university);
  const upload = useMutation({
    mutationFn: (file: File) => api.documents.upload(file, { category: 'OTHER', title: t('success:queue.detail.receiptTitle', { university: uni }), student_user_id: studentId }),
    onSuccess: (doc, file) => setReceipt({ id: doc.id, name: file.name }),
    onError: (e) => toast.error(errText(t, e)),
  });
  const m = useMutation({
    mutationFn: () => api.success.confirm(v.application_id, { external_reference: ref.trim(), submitted_on: date || undefined, receipt_document_id: receipt?.id }),
    onSuccess: (res) => {
      qc.setQueryData(['submission', v.application_id], res);
      ['submissions', 'application', 'applications', 'agency', 'tasks'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(t('success:queue.detail.saved'));
      onSaved();
    },
    onError: (e) => toast.error(errText(t, e)),
  });
  return (
    <form className="sxa-form" onSubmit={(e) => { e.preventDefault(); if (ref.trim()) m.mutate(); }} aria-labelledby={`${ids.ref}-h`}>
      <h3 className="ag-h3" id={`${ids.ref}-h`}>{t('success:queue.detail.record')}</h3>
      <div className="sxa-form__row">
        <Field label={t('success:queue.detail.refLabel')} htmlFor={ids.ref} hint={v.connector.confirmation_method ?? t('success:queue.detail.refHint')}>
          <Input id={ids.ref} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} autoComplete="off" required />
        </Field>
        <Field label={t('success:queue.detail.dateLabel')} htmlFor={ids.date}>
          <Input id={ids.date} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('success:queue.detail.receipt')} htmlFor={ids.file} optional hint={receipt ? receipt.name : t('success:queue.detail.receiptNone')}>
        <input ref={fileRef} id={ids.file} type="file" accept="application/pdf,image/*" className="sxa-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} disabled={upload.isPending} />
      </Field>
      <Button type="submit" size="sm" variant="primary" loading={m.isPending} disabled={!ref.trim() || upload.isPending}>{t('success:queue.detail.complete')}</Button>
    </form>
  );
}

function ReportProblem({ v }: { v: SubmissionView }) {
  const { t } = useS();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.success.failure(v.application_id, reason.trim()),
    onSuccess: (res) => { qc.setQueryData(['submission', v.application_id], res); qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success(t('success:queue.detail.problemSaved')); setOpen(false); setReason(''); },
    onError: (e) => toast.error(errText(t, e)),
  });
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{t('success:queue.detail.problem')}</Button>;
  return (
    <form className="sxa-form" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 3) m.mutate(); }}>
      <Field label={t('success:queue.detail.problemLabel')} htmlFor={id}>
        <Textarea id={id} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button type="submit" size="sm" variant="secondary" loading={m.isPending} disabled={reason.trim().length < 3}>{t('success:queue.detail.problemSave')}</Button>
    </form>
  );
}

/** Detail for one queue row: final review → official mechanism (staff open the portal themselves) → record. */
export function SubmissionDetail({ appId, row, canRecord }: { appId: string; row?: SubmissionQueueRow; canRecord: boolean }) {
  const { t, locale } = useS();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['submission', appId], queryFn: () => api.success.submission(appId), staleTime: 10_000 });
  const [done, setDone] = useState(false);
  return (
    <QueryState query={q} skeleton={<SkeletonCard lines={6} />}>
      {(v) => {
        const auth = v.authorization;
        const confirmed = v.status === 'SUBMITTED_CONFIRMED';
        const active = auth?.status === 'ACTIVE';
        const c = v.connector;
        const portal = c.portal_name ?? c.provider ?? localName(v.university);
        return (
          <div className="hg-stack sxa-detail">
            {row && (
              <p className="hg-small hg-muted">{localName(row.university)} · {localName(row.program)} · {intakeText(t, row)} · {t('success:queue.col.deadline')} {formatDate(row.deadline, locale)}</p>
            )}
            {confirmed && v.record ? (
              <Callout tone="success" title={t('success:queue.detail.submitted', { date: v.record.submitted_on ? formatDate(v.record.submitted_on, locale) : '—', ref: v.record.external_reference ?? '' })}>
                {v.record.recorded_by?.full_name}{v.record.receipt && <> · {v.record.receipt.title}</>}
              </Callout>
            ) : auth?.status === 'REVOKED' ? (
              <Callout tone="warning" title={t('success:queue.detail.revoked', { date: formatDate(auth.revoked_at, locale) })} />
            ) : !active ? (
              <Callout tone="info" title={t('success:queue.detail.waiting')} />
            ) : null}
            {active && auth.package_changed && <Callout tone="warning" title={t('success:queue.detail.changed')} />}
            {v.record?.failure && !confirmed && <p className="hg-small sxa-warn">{t('success:queue.detail.lastProblem', { reason: v.record.failure.reason })}</p>}

            {v.final_review && (
              <section aria-labelledby={`fr-${appId}`}>
                <h3 className="ag-h3" id={`fr-${appId}`}>{t('success:queue.detail.review')}</h3>
                <ul className="sxa-review">
                  {v.final_review.map((i) => (
                    <li key={i.code} data-ok={i.ok}><span aria-hidden className="sxa-review__mark">{i.ok ? '✓' : '!'}</span><span>{reviewText(t, locale, i)}</span></li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby={`mech-${appId}`}>
              <h3 className="ag-h3" id={`mech-${appId}`}>{t('success:queue.detail.mechanism')}</h3>
              <p className="hg-small">{t(`success:method.${c.method}`)}{c.provider ? ` · ${c.provider}` : ''}</p>
              <p className="hg-xs hg-subtle">{t('success:queue.detail.mechanismText')}</p>
              {c.agency_submission?.basis && <p className="hg-xs hg-subtle">{t('success:queue.detail.basis', { basis: c.agency_submission.basis })}</p>}
              {c.portal_url && !confirmed && (
                <ButtonLink as="a" size="sm" href={c.portal_url} target="_blank" rel="noopener noreferrer" iconEnd={<ExternalLink size={14} aria-hidden />}>
                  {t('success:queue.detail.openPortal', { portal })}
                </ButtonLink>
              )}
            </section>

            {auth && (
              <details className="sxa-snapshot">
                <summary>{t('success:queue.detail.snapshot')}</summary>
                <SnapshotList s={auth.snapshot} />
              </details>
            )}

            {canRecord && active && !confirmed && !done && (
              <>
                <RecordSubmission v={v} studentId={row?.student.id ?? ''} onSaved={() => setDone(true)} />
                <ReportProblem v={v} />
              </>
            )}
            {!canRecord && <p className="hg-xs hg-subtle">{t('success:queue.readOnly')}</p>}
            <p className="hg-small"><Link className="hg-link" to={`/applications/${appId}`}>{t('success:queue.detail.openApp')}</Link></p>
          </div>
        );
      }}
    </QueryState>
  );
}

export function PackageCell({ r }: { r: SubmissionQueueRow }) {
  const { t } = useS();
  return r.package.complete ? <StatusText tone="success">{t('success:queue.package.complete')}</StatusText>
    : <StatusText tone="warning">{t('success:queue.package.partial', { ready: r.package.ready, total: r.package.total })}</StatusText>;
}
