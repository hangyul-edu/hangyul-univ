import { useAuth } from '@hangyul/auth';
import { ExternalLink } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { ApplicationDetail, ApplicationFeeStatus, SubmissionView } from '@hangyul/types';
import { Button, Field, Input, Select, StatusText, Textarea, useToast } from '@hangyul/ui';
import { formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { agencyItemTitle } from '../../lib/success';
import './success.css';

export function useS() {
  return useLocale(['success', 'agency', 'common']);
}

const PRE = new Set(['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY', 'SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED']);

/** Dense, operational: what still affects this application, with owner. No score. */
export function AgencyStrategy({ app }: { app: ApplicationDetail }) {
  const { t, locale } = useS();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['strategy', app.id], queryFn: () => api.success.strategy(app.id), enabled: PRE.has(app.status), staleTime: 30_000 });
  const s = q.data;
  if (!s || s.scope === 'closed') return null;
  const shown = s.items.filter((i) => i.severity !== 'info');
  const info = s.items.filter((i) => i.severity === 'info');
  return (
    <section className="ag-subsection" aria-labelledby={`sx-str-${app.id}`}>
      <h3 className="ag-h3" id={`sx-str-${app.id}`}>{t('success:agency.strategyTitle')}</h3>
      {shown.length === 0 ? <p className="hg-small hg-subtle">{t('success:agency.strategyNone')}</p> : (
        <ul className="sxa-items">
          {shown.map((i, k) => (
            <li key={k} data-severity={i.severity}>
              <span className="sxa-items__sev">{i.severity === 'blocker' ? '!' : '·'}</span>
              <span className="sxa-items__title">{agencyItemTitle(t, locale, i)}</span>
              <span className="sxa-items__owner">{t(`success:agency.ownerShort.${i.owner}`)}</span>
            </li>
          ))}
        </ul>
      )}
      {info.length > 0 && <p className="hg-xs hg-subtle sxa-info">{info.map((i) => agencyItemTitle(t, locale, i)).join(' · ')}</p>}
    </section>
  );
}

function RecordForm({ app, v }: { app: ApplicationDetail; v: SubmissionView }) {
  const { t } = useS();
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ids = { ref: useId(), date: useId(), fee: useId(), note: useId() };
  const [ref, setRef] = useState(v.record?.external_reference ?? '');
  const [date, setDate] = useState(v.record?.submitted_on ?? new Date().toISOString().slice(0, 10));
  const [fee, setFee] = useState<ApplicationFeeStatus | ''>('');
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.success.confirm(app.id, { external_reference: ref.trim() || undefined, submitted_on: date || undefined, fee_status: fee || undefined, note: note.trim() || undefined }),
    onSuccess: (res) => {
      qc.setQueryData(['submission', app.id], res);
      ['application', 'applications', 'agency', 'strategy'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(res.status === 'SUBMITTED_CONFIRMED' ? t('success:agency.saved') : t('success:agency.savedUnconfirmed'));
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <form className="sxa-form" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="sxa-form__row">
        <Field label={t('success:agency.refLabel')} htmlFor={ids.ref} optional>
          <Input id={ids.ref} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} autoComplete="off" />
        </Field>
        <Field label={t('success:agency.dateLabel')} htmlFor={ids.date}>
          <Input id={ids.date} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('success:agency.feeLabel')} htmlFor={ids.fee} optional>
          <Select id={ids.fee} value={fee} onChange={(e) => setFee(e.target.value as ApplicationFeeStatus | '')}>
            <option value="">—</option>
            {(['CONFIRMED', 'PAID', 'UNPAID', 'NOT_REQUIRED', 'UNKNOWN'] as const).map((f) => <option key={f} value={f}>{t(`success:feeStatus.${f}`)}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t('success:agency.noteLabel')} htmlFor={ids.note} optional>
        <Textarea id={ids.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
      <p className="hg-xs hg-subtle">{t('success:agency.evidenceRule')}</p>
      <Button type="submit" size="sm" variant="primary" loading={m.isPending}>{t('success:agency.save')}</Button>
    </form>
  );
}

/**
 * Submission method (research-backed or NEEDS_REVIEW), evidence, fee. Authorised agency submissions are recorded from
 * the "Ready to submit" queue (student consent required); API methods say "awaiting provider integration"; for guided
 * self-submission the counselor records the evidence the student shares.
 */
export function AgencySubmission({ app }: { app: ApplicationDetail }) {
  const { t, locale } = useS();
  const { api } = useAuth();
  const q = useQuery({ queryKey: ['submission', app.id], queryFn: () => api.success.submission(app.id), staleTime: 15_000 });
  const [open, setOpen] = useState(false);
  const v = q.data;
  if (!v) return null;
  const c = v.connector;
  const r = v.record;
  const fee = r?.fee ?? v.checklist?.fee;
  const amount = fee?.amount ?? c.fee.amount;
  const agencyMode = !!v.agency_submission?.available;
  const auth = v.authorization;
  const canRecord = !agencyMode && r?.status !== 'SUBMITTED_CONFIRMED' && ['READY', 'SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW'].includes(app.status);
  const tone = r?.status === 'SUBMITTED_CONFIRMED' ? 'success' : r?.status === 'SUBMITTED_UNCONFIRMED' || r?.status === 'HANDED_OFF' ? 'warning' : 'neutral';
  return (
    <section className="ag-subsection" aria-labelledby={`sx-sub-${app.id}`}>
      <h3 className="ag-h3" id={`sx-sub-${app.id}`}>{t('success:agency.submissionTitle')}</h3>
      <dl className="sxa-dl">
        <div><dt>{t('success:agency.method')}</dt><dd>{t(`success:method.${c.method}`)}{c.provider ? ` · ${c.provider}` : ''}
          {c.placeholder ? <span className="sxa-warn"> · {t('success:agency.needsReview')}</span> : c.partial ? <span className="sxa-warn"> · {t('success:agency.partial')}</span> : c.last_verified ? <span className="hg-subtle"> · {t('success:agency.verified', { date: formatDate(c.last_verified, locale) })}</span> : null}</dd></div>
        {c.portal_url && <div><dt>{t('success:agency.portal')}</dt><dd><a href={c.portal_url} target="_blank" rel="noopener noreferrer" className="hg-link">{new URL(c.portal_url).host} <ExternalLink size={12} aria-hidden /></a></dd></div>}
        <div><dt>{t('success:agency.fee')}</dt><dd>{amount !== null && amount !== undefined ? formatMoney(amount, c.fee.currency ?? 'KRW', locale) : '—'} · {t(`success:feeStatus.${fee?.status ?? 'UNKNOWN'}`)}
          {(c.fee.payee || fee?.payee) && <span className="hg-subtle"> → {fee?.payee ?? c.fee.payee}</span>}<span className="sxa-note">{t('success:agency.feeSeparate')}</span></dd></div>
        <div><dt>{t('success:agency.evidence')}</dt><dd>
          <StatusText tone={tone}>{t(`success:status.${v.status}`)}</StatusText>
          {r?.external_reference && <span className="hg-num"> · {r.external_reference}</span>}
          {r?.submitted_on && <span className="hg-subtle"> · {formatDate(r.submitted_on, locale)}</span>}
          {r?.receipt && <> · <Link to={`/documents?doc=${r.receipt.id}`} className="hg-link">{r.receipt.title}</Link></>}
          {r?.recorded_by_role && <span className="hg-subtle"> · {t(`success:agency.ownerShort.${r.recorded_by_role === 'STUDENT' ? 'student' : 'counselor'}`)}</span>}
        </dd></div>
        {agencyMode && r?.status !== 'SUBMITTED_CONFIRMED' && (
          <div><dt>{t('success:queue.col.authorized')}</dt><dd>
            {auth?.status === 'ACTIVE' ? t('success:agency.authorized', { date: formatDate(auth.granted_at, locale) })
              : auth?.status === 'REVOKED' ? <span className="sxa-warn">{t('success:agency.revokedAuth')}</span> : t('success:agency.awaitingAuth')}
            {' · '}<Link to={`/submissions?app=${app.id}`} className="hg-link">{t('success:agency.openQueue')}</Link>
          </dd></div>
        )}
      </dl>
      {v.integration_state === 'AWAITING_PROVIDER' && <p className="hg-xs hg-subtle">{t('success:agency.awaitingProvider')}</p>}
      {!agencyMode && v.integration_state !== 'AWAITING_PROVIDER' && canRecord && <p className="hg-xs hg-subtle">{t('success:agency.selfSubmit')}</p>}
      {canRecord && (open ? <RecordForm app={app} v={v} /> : <Button size="sm" onClick={() => setOpen(true)}>{t('success:agency.recordTitle')}</Button>)}
    </section>
  );
}
