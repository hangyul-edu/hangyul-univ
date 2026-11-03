import { localName } from '@hangyul/i18n';
import { useApi } from '@hangyul/auth';
import { ExternalLink } from '@hangyul/icons';
import type { ApplicationDetail, ApplicationFeeStatus, SubmissionFormField, SubmissionSnapshot, SubmissionView } from '@hangyul/types';
import { Button, Callout, Checkbox, Field, Input, Modal, Select, Textarea, useToast } from '@hangyul/ui';
import { countryName, formatDate, formatMoney } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { UploadModal } from '../UploadModal';
import { useS } from './Strategy';

const today = () => new Date().toISOString().slice(0, 10);
type TFn = (k: string, o?: Record<string, unknown>) => string;

export function useSubmission(appId: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['submission', appId], queryFn: () => api.success.submission(appId), enabled, staleTime: 15_000 });
}

/** Session expiry (401 after the refresh attempt) is said plainly: nothing was saved. */
function errText(t: TFn, e: unknown) {
  return (e as { status?: number })?.status === 401 ? t('success:submission.sessionExpired') : (e as Error).message;
}

function useAfterSave(appId: string) {
  const qc = useQueryClient();
  return (res: SubmissionView) => {
    qc.setQueryData(['submission', appId], res);
    ['application', 'applications', 'strategy', 'dashboard', 'tasks', 'portfolio'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

function Fee({ v }: { v: SubmissionView }) {
  const { t, locale } = useS();
  const f = v.record?.fee ?? (v.checklist ? { ...v.checklist.fee, paid_on: null } : null);
  const c = v.connector.fee;
  const amount = f?.amount ?? c.amount;
  const payee = f?.payee ?? c.payee ?? null;
  const status = (f?.status ?? 'UNKNOWN') as ApplicationFeeStatus;
  const money = amount !== null && amount !== undefined ? formatMoney(amount, c.currency ?? 'KRW', locale) : null;
  return (
    <li data-ok={status === 'PAID' || status === 'CONFIRMED' || status === 'NOT_REQUIRED'}>
      <span className="sx-check__mark" aria-hidden>{status === 'PAID' || status === 'CONFIRMED' || status === 'NOT_REQUIRED' ? '✓' : '○'}</span>
      <span>
        {status === 'NOT_REQUIRED' ? t('success:submission.fee.none')
          : money ? t(`success:submission.fee.${status}${payee || status === 'PAID' || status === 'CONFIRMED' ? '' : '_NP'}`, { amount: money, payee }) : t('success:submission.fee.unknownAmount')}
        <span className="sx-check__hint">{t('success:submission.fee.separate')}</span>
      </span>
    </li>
  );
}

/** Before leaving: exactly what is ready — documents, essays, fee. */
function PreLeave({ v }: { v: SubmissionView }) {
  const { t } = useS();
  if (!v.checklist) return null;
  const d = v.checklist.documents;
  const e = v.checklist.essays;
  return (
    <ul className="sx-check" aria-label={t('success:submission.readyList')}>
      <li data-ok={d.ready === d.total}><span className="sx-check__mark" aria-hidden>{d.ready === d.total ? '✓' : '!'}</span>
        <span>{t('success:submission.docs', { ready: d.ready, total: d.total })}<span className="sx-check__hint">{t('success:submission.docsHint')}</span></span></li>
      {e.total > 0 && <li data-ok={e.approved === e.total}><span className="sx-check__mark" aria-hidden>{e.approved === e.total ? '✓' : '!'}</span>
        <span>{t('success:submission.essays', { approved: e.approved, total: e.total })}</span></li>}
      <Fee v={v} />
    </ul>
  );
}

function fieldValue(locale: string, f: SubmissionFormField) {
  if (f.key === 'date_of_birth') return formatDate(f.value, locale);
  if (f.key === 'nationality') return countryName(f.value, locale);
  return f.value;
}

function FormFields({ fields }: { fields: SubmissionFormField[] }) {
  const { t, locale } = useS();
  return (
    <dl className="sx-fields">
      {fields.map((f) => (
        <div key={f.key}><dt>{t(`success:submission.field.${f.key}`, { defaultValue: f.key })}</dt><dd data-user-content>{fieldValue(locale, f)}</dd></div>
      ))}
    </dl>
  );
}

/**
 * Connector-unavailable design (no API): what Hangyul completed, then exactly what the student does on the official
 * portal — steps, files to upload, what to enter — before the hand-off button.
 */
function GuidedPlan({ v, a }: { v: SubmissionView; a: ApplicationDetail }) {
  const { t, locale } = useS();
  const g = v.guided;
  if (!g) return null;
  const portal = v.connector.portal_name ?? v.connector.provider ?? localName(a.university);
  const uni = localName(a.university);
  const files = g.files;
  const upload = g.steps.includes('upload_documents') || g.steps.includes('upload_photo');
  const essays = v.checklist?.essays;
  const review = g.counselor_review;
  return (
    <div className="sx-plan">
      <section aria-labelledby="sx-done">
        <h3 id="sx-done" className="sx-plan__title">{t('success:submission.guided.doneTitle')}</h3>
        <ul className="sx-check">
          <li data-ok="true"><span className="sx-check__mark" aria-hidden>✓</span><span>{t('success:submission.guided.files', { count: files.filter((f) => f.required).length })}</span></li>
          {essays && essays.total > 0 && <li data-ok={essays.approved === essays.total}><span className="sx-check__mark" aria-hidden>{essays.approved === essays.total ? '✓' : '!'}</span>
            <span>{t('success:submission.guided.essays', { approved: essays.approved, total: essays.total })}</span></li>}
          {review && <li data-ok="true"><span className="sx-check__mark" aria-hidden>✓</span>
            <span>{review.by ? t('success:submission.guided.reviewBy', { name: review.by, date: formatDate(review.date, locale) }) : t('success:submission.guided.review', { date: formatDate(review.date, locale) })}</span></li>}
          <Fee v={v} />
        </ul>
      </section>
      {g.steps.length > 0 && (
        <section aria-labelledby="sx-todo">
          <h3 id="sx-todo" className="sx-plan__title">{t('success:submission.guided.todoTitle', { portal })}</h3>
          <ol className="sx-steps">
            {g.steps.map((s) => <li key={s}>{t(`success:submission.step.${s}`, { portal, defaultValue: s })}</li>)}
          </ol>
          {v.connector.receipt_method && <p className="hg-xs hg-muted sx-plan__note">{t('success:submission.guided.receipt', { what: v.connector.receipt_method })}</p>}
          {v.connector.originals_by_mail && !g.steps.includes('mail_documents') && <p className="hg-xs hg-muted sx-plan__note">{t('success:submission.guided.originals', { university: uni })}</p>}
        </section>
      )}
      {files.length > 0 && (
        <section aria-labelledby="sx-files">
          <h3 id="sx-files" className="sx-plan__title">{t('success:submission.guided.filesTitle')}</h3>
          {!upload && g.steps.includes('mail_documents') && <p className="hg-xs hg-muted sx-plan__note">{t('success:submission.guided.filesMail')}</p>}
          <ul className="sx-files">
            {files.map((f) => (
              <li key={f.category}>
                {f.document_id ? <Link className="hg-link" to={`/documents?doc=${f.document_id}`}>{t(`common:docCategory.${f.category}`, { defaultValue: f.label })}</Link>
                  : t(`common:docCategory.${f.category}`, { defaultValue: f.label })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {g.form_fields.length > 0 && (
        <details className="sx-enter">
          <summary>{t('success:submission.guided.enterTitle')}</summary>
          <p className="hg-xs hg-muted">{t('success:submission.guided.enterHint')}</p>
          <FormFields fields={g.form_fields} />
        </details>
      )}
    </div>
  );
}

/** Back from the portal: confirmation number / date / fee / receipt. Evidence decides "confirmed". */
function ConfirmForm({ a, v, onDone }: { a: ApplicationDetail; v: SubmissionView; onDone?: () => void }) {
  const { t } = useS();
  const api = useApi();
  const toast = useToast();
  const after = useAfterSave(a.id);
  const ids = { ref: useId(), date: useId(), fee: useId() };
  const [ref, setRef] = useState(v.record?.external_reference ?? '');
  const [date, setDate] = useState(v.record?.submitted_on ?? today());
  const [fee, setFee] = useState<ApplicationFeeStatus | ''>(v.record?.fee?.status === 'UNKNOWN' ? '' : (v.record?.fee?.status ?? ''));
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(v.record?.receipt ? { id: v.record.receipt.id, name: v.record.receipt.title } : null);
  const [uploading, setUploading] = useState(false);
  const m = useMutation({
    mutationFn: () => api.success.confirm(a.id, { external_reference: ref.trim() || undefined, submitted_on: date || undefined,
      receipt_document_id: receipt?.id, fee_status: fee || undefined }),
    onSuccess: (res) => {
      after(res);
      toast.success(res.status === 'SUBMITTED_CONFIRMED' ? t('success:submission.savedConfirmed') : t('success:submission.savedUnconfirmed'));
      onDone?.();
    },
    onError: (e) => toast.error(errText(t, e)),
  });
  const hasEvidence = !!ref.trim() || !!receipt;
  return (
    <form className="sx-confirm" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <h3 className="sx-confirm__title">{t('success:submission.backTitle')}</h3>
      <p className="hg-small hg-muted">{t('success:submission.backText', { university: localName(a.university) })}</p>
      <Field label={t('success:submission.refLabel')} htmlFor={ids.ref} hint={v.connector.confirmation_method ?? t('success:submission.refHint')} optional>
        <Input id={ids.ref} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} autoComplete="off" />
      </Field>
      <Field label={t('success:submission.dateLabel')} htmlFor={ids.date}>
        <Input id={ids.date} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t('success:submission.feeLabel')} htmlFor={ids.fee} optional>
        <Select id={ids.fee} value={fee} onChange={(e) => setFee(e.target.value as ApplicationFeeStatus | '')}>
          <option value="">{t('success:submission.feeChoose')}</option>
          <option value="PAID">{t('success:submission.feeOpt.PAID')}</option>
          <option value="UNPAID">{t('success:submission.feeOpt.UNPAID')}</option>
          <option value="NOT_REQUIRED">{t('success:submission.feeOpt.NOT_REQUIRED')}</option>
        </Select>
      </Field>
      <div className="sx-receipt">
        {receipt ? <span className="hg-small">{t('success:submission.receiptAttached', { name: receipt.name })}</span>
          : <span className="hg-small hg-muted">{t('success:submission.receiptNone')}</span>}
        <Button type="button" size="sm" variant="secondary" onClick={() => setUploading(true)}>{receipt ? t('success:submission.receiptReplace') : t('success:submission.receiptUpload')}</Button>
      </div>
      {!hasEvidence && <p className="hg-xs sx-warn">{t('success:submission.needEvidence')}</p>}
      <Button type="submit" variant="primary" loading={m.isPending}>{hasEvidence ? t('success:submission.saveConfirmed') : t('success:submission.saveUnconfirmed')}</Button>
      {uploading && (
        <UploadModal open onClose={() => setUploading(false)} target={{ category: 'OTHER', title: t('success:submission.receiptTitle', { university: localName(a.university) }) }}
          onUploaded={(id) => { setReceipt({ id, name: t('success:submission.receiptTitle', { university: localName(a.university) }) }); setUploading(false); }} />
      )}
    </form>
  );
}

function methodText(t: TFn, v: SubmissionView, university: string, counselor: string) {
  const provider = v.connector.provider ?? '';
  return t(`success:submission.next.${v.connector.method}`, { university, provider, counselor, agency: v.agency_submission?.agency ?? counselor });
}

/** Everything the student authorises, in plain words (consent screen and "What you authorized"). */
function SnapshotView({ s }: { s: SubmissionSnapshot }) {
  const { t, locale } = useS();
  const money = s.fee.amount !== null ? formatMoney(s.fee.amount, s.fee.currency ?? 'KRW', locale) : null;
  const payer = t(`success:submission.authorize.payer.${s.fee.payer}`);
  const essays = s.essays.filter((e) => e.approved).length;
  return (
    <div className="sx-consent">
      <section>
        <h3 className="sx-plan__title">{t('success:submission.authorize.where')}</h3>
        <p className="hg-small">{localName(s.university)} · {localName(s.program)} · {t('common:intakeLabel', { term: t(`common:term.${s.intake.term}`), year: s.intake.year })}</p>
        <p className="hg-xs hg-muted">{t('success:submission.authorize.deadline', { date: formatDate(s.intake.deadline, locale) })}</p>
      </section>
      <section>
        <h3 className="sx-plan__title">{t('success:submission.authorize.form')}</h3>
        <FormFields fields={s.form_fields} />
      </section>
      <section>
        <h3 className="sx-plan__title">{t('success:submission.authorize.docs', { count: s.documents.length })}</h3>
        <ul className="sx-files">{s.documents.map((d) => <li key={`${d.category}-${d.document_id}`}>{t(`common:docCategory.${d.category}`, { defaultValue: d.label })}</li>)}</ul>
        {s.essays.length > 0 && <p className="hg-xs hg-muted">{t('success:submission.authorize.essays', { approved: essays, total: s.essays.length })}</p>}
      </section>
      <section>
        <h3 className="sx-plan__title">{t('success:submission.authorize.fee')}</h3>
        <p className="hg-small">{money ? (s.fee.payee ? t('success:submission.authorize.feeValue', { amount: money, payer, payee: s.fee.payee }) : t('success:submission.authorize.feeValueNoPayee', { amount: money, payer }))
          : t('success:submission.fee.unknownAmount')}</p>
        <p className="hg-xs hg-muted">{t('success:submission.fee.separate')}</p>
      </section>
      <section>
        <h3 className="sx-plan__title">{t('success:submission.authorize.who')}</h3>
        <p className="hg-small">{s.submitter.counselor ? t('success:submission.authorize.whoValue', { counselor: t('student:messages.team'), agency: s.submitter.agency })
          : t('success:submission.authorize.whoValueNoName', { agency: s.submitter.agency })}</p>
        <p className="hg-xs hg-muted">{t('success:submission.authorize.noPassword')}</p>
        {s.mechanism.basis && <p className="hg-xs hg-muted">{t('success:submission.authorize.basis', { basis: s.mechanism.basis })}</p>}
      </section>
    </div>
  );
}

function ConsentModal({ a, v, onClose }: { a: ApplicationDetail; v: SubmissionView; onClose: () => void }) {
  const { t } = useS();
  const api = useApi();
  const toast = useToast();
  const after = useAfterSave(a.id);
  const [checked, setChecked] = useState(false);
  const s = v.consent_preview;
  const agency = v.agency_submission?.agency ?? '';
  const m = useMutation({
    mutationFn: () => api.success.authorize(a.id, v.consent_version ?? ''),
    onSuccess: (res) => { after(res); toast.success(t('success:submission.authorize.done', { agency })); onClose(); },
    onError: (e) => toast.error(errText(t, e)),
  });
  if (!s) return null;
  return (
    <Modal open onClose={onClose} width={620} title={t('success:submission.authorize.title', { agency })} description={t('success:submission.authorize.intro')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('success:submission.authorize.cancel')}</Button>
        <Button variant="primary" disabled={!checked} loading={m.isPending} onClick={() => m.mutate()}>{t('success:submission.authorize.submit')}</Button>
      </>}>
      <SnapshotView s={s} />
      <p className="hg-small sx-consent__withdraw">{t('success:submission.authorize.withdraw', { agency })}</p>
      <Checkbox label={t('success:submission.authorize.check', { agency, university: localName(a.university) })} checked={checked} onChange={(e) => setChecked(e.target.checked)} />
    </Modal>
  );
}

function WithdrawModal({ a, v, onClose }: { a: ApplicationDetail; v: SubmissionView; onClose: () => void }) {
  const { t } = useS();
  const api = useApi();
  const toast = useToast();
  const after = useAfterSave(a.id);
  const id = useId();
  const [reason, setReason] = useState('');
  const agency = v.agency_submission?.agency ?? '';
  const m = useMutation({
    mutationFn: () => api.success.revoke(a.id, reason.trim() || undefined),
    onSuccess: (res) => { after(res); toast.success(t('success:submission.authorize.withdrawn')); onClose(); },
    onError: (e) => toast.error(errText(t, e)),
  });
  return (
    <Modal open onClose={onClose} title={t('success:submission.authorize.withdrawTitle')} description={t('success:submission.authorize.withdrawText', { agency })}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('success:submission.authorize.cancel')}</Button>
        <Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>{t('success:submission.authorize.withdrawConfirm')}</Button>
      </>}>
      <Field label={t('success:submission.authorize.withdrawReason')} htmlFor={id} optional>
        <Textarea id={id} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** AUTHORIZED_AGENCY: explicit consent → agency submits → the reference appears here. */
function AgencyHero({ a, v }: { a: ApplicationDetail; v: SubmissionView }) {
  const { t, locale } = useS();
  const [consent, setConsent] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const agency = v.agency_submission?.agency ?? '';
  // V22 (REPORT §246 A3): the submitter is the Hangyul team, never a named staff member.
  const counselor = v.agency_submission?.counselor ? t('student:messages.team') : undefined;
  const auth = v.authorization;
  const active = auth?.status === 'ACTIVE';
  const revoked = auth?.status === 'REVOKED';
  const failure = v.record?.failure;
  return (
    <section className="sa-next v4-hero sx-hero" aria-labelledby="sx-hero-title">
      <div className="sx-hero__text">
        <p className="v4-hero__eyebrow">{t('success:submission.eyebrow')}</p>
        <h2 id="sx-hero-title" className="v4-hero__title">
          {active ? t('success:submission.authorize.activeTitle', { agency }) : revoked ? t('success:submission.authorize.revokedTitle') : t('success:submission.readyTitle')}
        </h2>
        <p className="v4-hero__why">
          {active ? (counselor ? t('success:submission.authorize.activeText', { date: formatDate(auth.granted_at, locale), counselor })
            : t('success:submission.authorize.activeTextNoName', { date: formatDate(auth.granted_at, locale), agency }))
            : revoked ? t('success:submission.authorize.revokedText', { date: formatDate(auth.revoked_at, locale) })
              : methodText(t, v, localName(a.university), counselor ?? agency)}
        </p>
        {active && failure && <Callout tone="warning" title={t('success:queue.failed')}>{t('success:submission.authorize.failure', { agency, reason: failure.reason })}</Callout>}
        {active && auth.package_changed && <p className="hg-xs sx-verify">{t('success:submission.authorize.changed', { agency })}</p>}
        {!active && <PreLeave v={v} />}
        {active && (
          <details className="sx-enter">
            <summary>{t('success:submission.authorize.seeWhat')}</summary>
            <SnapshotView s={auth.snapshot} />
          </details>
        )}
        <p className="hg-xs hg-muted sx-safety">{t('success:submission.authorize.noPassword')}</p>
      </div>
      <div className="sx-hero__actions">
        {v.can_authorize && (
          <Button variant="primary" size="lg" onClick={() => setConsent(true)}>{revoked ? t('success:submission.authorize.again') : t('success:submission.authorize.cta')}</Button>
        )}
        {v.can_revoke && <Button variant="secondary" size="sm" onClick={() => setWithdraw(true)}>{t('success:submission.authorize.withdrawCta')}</Button>}
      </div>
      {consent && <ConsentModal a={a} v={v} onClose={() => setConsent(false)} />}
      {withdraw && <WithdrawModal a={a} v={v} onClose={() => setWithdraw(false)} />}
    </section>
  );
}

/**
 * Replaces the hero while the application is READY (and after a hand-off without evidence):
 * guided self-submission (what Hangyul completed → exact steps / files / what to enter → [Continue to official
 * submission] in a new tab, records HANDED_OFF → "Did you submit?"), authorised agency submission, or — for API
 * methods — "Awaiting provider integration" (never a button that cannot work).
 */
export function SubmissionHero({ a, counselorName }: { a: ApplicationDetail; counselorName: string | null }) {
  const { t, locale } = useS();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useSubmission(a.id);
  const [formOpen, setFormOpen] = useState(false);
  const handoff = useMutation({
    mutationFn: () => api.success.handoff(a.id),
    onSuccess: (res) => { qc.setQueryData(['submission', a.id], res); qc.invalidateQueries({ queryKey: ['strategy'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: (e) => toast.error(errText(t, e)),
  });
  const v = q.data;
  if (!v) return <section className="sa-next v4-hero sx-hero" aria-busy="true"><p className="hg-muted">{t('success:submission.loading')}</p></section>;
  if (v.agency_submission?.available && v.status !== 'SUBMITTED_CONFIRMED') return <AgencyHero a={a} v={v} />;
  const counselor = counselorName ?? t('success:owner.counselor');
  const uni = localName(a.university);
  const away = v.status === 'HANDED_OFF' || v.status === 'SUBMITTED_UNCONFIRMED';
  const awaiting = v.integration_state === 'AWAITING_PROVIDER';
  const g = v.guided;
  const portal = v.connector.portal_name ?? v.connector.provider ?? uni;
  const open = () => {
    // The official portal opens in a new tab; Hangyul keeps this page and asks for the confirmation on return.
    if (v.connector.portal_url) window.open(v.connector.portal_url, '_blank', 'noopener,noreferrer');
    handoff.mutate();
  };
  const lead = awaiting ? t('success:submission.awaitingProviderText', { university: uni, counselor })
    : g?.self_submit_required ? (g.minutes ? t('success:submission.selfRequired', { university: uni, portal, minutes: g.minutes }) : t('success:submission.selfRequiredNoTime', { university: uni, portal }))
      : methodText(t, v, uni, counselor);
  return (
    <section className="sa-next v4-hero sx-hero" aria-labelledby="sx-hero-title">
      <div className="sx-hero__text">
        <p className="v4-hero__eyebrow">{awaiting ? t('success:submission.awaitingProvider') : t('success:submission.eyebrow')}</p>
        <h2 id="sx-hero-title" className="v4-hero__title">
          {v.status === 'SUBMITTED_UNCONFIRMED' ? t('success:submission.unconfirmedTitle') : away ? t('success:submission.awayTitle', { university: uni }) : t('success:submission.readyTitle')}
        </h2>
        {v.status === 'SUBMITTED_UNCONFIRMED' ? <p className="v4-hero__why">{t('success:submission.unconfirmedText')}</p>
          : away ? <p className="v4-hero__why">{t('success:submission.awayText', { date: v.record?.handed_off_at ? formatDate(v.record.handed_off_at, locale, { month: 'short', day: 'numeric' }) : '' })}</p>
          : <p className="v4-hero__why">{lead}</p>}
        {g?.self_submit_required && g.minutes && !away && <p className="hg-xs hg-muted sx-safety">{t('success:submission.minutesNote')}</p>}
        {v.connector.placeholder && <p className="hg-xs sx-verify">{t('success:submission.placeholder')}</p>}
        {v.connector.partial && <p className="hg-xs sx-verify">{t('success:submission.partial')}</p>}
        {v.connector.instructions && !v.connector.placeholder && !away && !g && <p className="hg-small hg-muted">{v.connector.instructions}</p>}
        {!away && (g ? <GuidedPlan v={v} a={a} /> : <PreLeave v={v} />)}
        {!away && v.can_handoff && <p className="hg-xs hg-muted sx-safety">{t('success:submission.safety')}</p>}
      </div>
      <div className="sx-hero__actions">
        {v.can_handoff && !away && (
          <Button variant="primary" size="lg" iconEnd={<ExternalLink aria-hidden size={16} />} loading={handoff.isPending} onClick={open}>
            {v.connector.portal_url ? t('success:submission.continue') : t('success:submission.continueManual')}
          </Button>
        )}
        {away && v.connector.portal_url && (
          <a className="hg-link hg-small" href={v.connector.portal_url} target="_blank" rel="noopener noreferrer">{t('success:submission.reopen', { university: uni })}</a>
        )}
        {v.counselor_submits && !awaiting && <p className="hg-small">{t('success:submission.counselorDoes', { counselor })}</p>}
        {v.student_can_record && !away && !formOpen && (
          <Button variant="link" size="sm" onClick={() => setFormOpen(true)}>{t('success:submission.alreadySubmitted')}</Button>
        )}
      </div>
      {v.student_can_record && (away || formOpen) && <div className="sx-hero__form"><ConfirmForm a={a} v={v} onDone={() => setFormOpen(false)} /></div>}
    </section>
  );
}

/** After submission: Submitted · reference · date · who submitted · receipt; or the missing-confirmation callout. */
export function SubmissionEvidenceLine({ a }: { a: ApplicationDetail }) {
  const { t, locale } = useS();
  const q = useSubmission(a.id, a.status !== 'READY');
  const v = q.data;
  if (!v?.record) return null;
  const r = v.record;
  if (r.status === 'SUBMITTED_CONFIRMED') {
    const who = r.recorded_by_role === 'STUDENT' ? t('success:evidence.byYou')
      : r.recorded_by_org ? (r.recorded_by?.full_name ? t('success:evidence.by', { name: t('student:messages.team'), agency: r.recorded_by_org }) : t('success:evidence.byAgency', { agency: r.recorded_by_org }))
        : r.recorded_by?.full_name ? t('success:evidence.byCounselor', { name: t('student:messages.team') }) : null;
    return (
      <div className="sx-evidence" data-testid="submission-evidence">
        <p className="hg-small">
          <span aria-hidden>✓ </span>
          {t(`success:evidence.${r.evidence_kind}`, { ref: r.external_reference ?? '', date: r.submitted_on ? formatDate(r.submitted_on, locale) : '' })}
        </p>
        {(who || r.receipt) && (
          <p className="hg-xs hg-muted">
            {who}
            {who && r.receipt && ' · '}
            {r.receipt && <Link className="hg-link" to={`/documents?doc=${r.receipt.id}`}>{t('success:evidence.receipt')}</Link>}
          </p>
        )}
      </div>
    );
  }
  if ((r.status === 'SUBMITTED_UNCONFIRMED' || r.status === 'HANDED_OFF') && v.student_can_record) {
    return (
      <div className="hg-stack">
        <Callout tone="warning" title={t('success:submission.unconfirmedTitle')}>{t('success:submission.unconfirmedText')}</Callout>
        <ConfirmForm a={a} v={v} />
      </div>
    );
  }
  return null;
}
