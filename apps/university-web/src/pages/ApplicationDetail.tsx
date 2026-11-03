// PRIMARY QUESTION: "Can I decide this applicant now?" — V9 U2: the requirement · evidence · status table is the first content
// after a one-line header; the decision panel sits beside it (≥1280 px) or after it (<1280 px) and offers no dominant action
// until the evidence has been on screen; the primary is then the state's natural next step given that evidence. Deciding or
// requesting documents can open the next applicant in the queue (with its position). Statements, documents, history kept.
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@hangyul/auth';
import {
  BookOpen, Building2, CalendarDays, ChevronLeft, ChevronRight, Eye, FileText, Flag, FlagOff, GraduationCap, Lock, MessageSquare, Send,
} from '@hangyul/icons';
import { useLocale, localName } from '@hangyul/i18n';
import type { ApplicationDetail as Detail, ApplicationStatus, ChecklistItem, Requirements } from '@hangyul/types';
import {
  Button, Callout, Drawer, ErrorState, Field, Input, Modal, Select, Skeleton, SkeletonCard,
  Textarea, useToast,
} from '@hangyul/ui';
import { PageHeader, SoftBadge, YCard } from '@hangyul/ynex-ui';
import { countryName, cx, documentTone, essayTone, flagEmoji, formatDate, formatDateTime, formatMoney, formatNumber, formatRelative, type Tone } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';

import { Provenance } from '../components/common';
import { StatusSoft, yxTone } from '../components/ynex';
import { SubmissionEvidence } from '../components/success/SubmissionEvidence';
import { actionVariant, buildTransitionBody, decisionSchema, type DecisionValues } from '../lib/decision';
import { intakeText, type TFn } from '../lib/format';
import { decisionActions, PENDING_DECISION } from '../lib/permissions';
import { useApplications, usePrograms, useStatements, useTeam } from '../lib/queries';
import { useUniversity } from '../lib/university';
import { useApplicationAgency, useNarrow } from '../lib/v9';

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['applications'] });
    qc.invalidateQueries({ queryKey: ['university', 'analytics'] });
  };
}

// ------------------------------------------------------------------ Decision modal
function DecisionModal({ app, to, onClose, onDecided }: { app: Detail; to: ApplicationStatus; onClose: () => void; onDecided?: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { register, handleSubmit, formState: { errors } } = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema), defaultValues: { to } });
  const m = useMutation({
    mutationFn: (v: DecisionValues) => api.applications.transition(app.id, buildTransitionBody(v)),
    onSuccess: (d) => {
      qc.setQueryData(['application', app.id], d);
      invalidate();
      toast.success(t('university:decision.done', { status: t(`common:appStatus.${to}`) }));
      onClose();
      onDecided?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const title = t(`university:decision.action.${to}`, { defaultValue: t(`common:appStatus.${to}`) });
  return (
    <Modal open onClose={onClose} title={title}
      description={t('university:decision.confirm', { from: t(`common:appStatus.${app.status}`), to: t(`common:appStatus.${to}`), student: app.student?.full_name ?? '' })}
      footer={<>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant={actionVariant(to) === 'danger' ? 'danger' : 'primary'} loading={m.isPending} onClick={handleSubmit((v) => m.mutate(v))}>{t('common:actions.confirm')}</Button>
      </>}>
      <form className="hg-stack" onSubmit={handleSubmit((v) => m.mutate(v))} noValidate>
        {to === 'INTERVIEW' && (
          <Field label={t('university:decision.interviewAt')} htmlFor="d-int" error={errors.interview_at?.message}>
            <Input id="d-int" type="datetime-local" {...register('interview_at')} invalid={!!errors.interview_at} />
          </Field>
        )}
        {to === 'OFFERED' && (
          <Field label={t('university:decision.scholarshipNote')} htmlFor="d-sch" optional hint={t('university:decision.scholarshipNoteHint')} error={errors.offer_scholarship_note?.message}>
            <Input id="d-sch" maxLength={300} {...register('offer_scholarship_note')} />
          </Field>
        )}
        {to === 'TUITION_PENDING' && (
          <div className="uc-form-2">
            <Field label={t('university:decision.tuitionAmount')} htmlFor="d-amt" error={errors.tuition_amount_krw?.message}>
              <Input id="d-amt" type="number" inputMode="numeric" min={1} step={1000} {...register('tuition_amount_krw')} invalid={!!errors.tuition_amount_krw} />
            </Field>
            <Field label={t('university:decision.tuitionDue')} htmlFor="d-due" error={errors.tuition_due?.message}>
              <Input id="d-due" type="date" {...register('tuition_due')} invalid={!!errors.tuition_due} />
            </Field>
          </div>
        )}
        {(to === 'ADMISSION_CERTIFICATE_ISSUED' || to === 'OFFERED') && (
          <Field label={t('university:detail.externalRef')} htmlFor="d-ref" optional hint={t('university:detail.externalRefHint')}>
            <Input id="d-ref" maxLength={80} defaultValue={app.external_reference ?? ''} {...register('external_reference')} />
          </Field>
        )}
        <Field label={to === 'REJECTED' || to === 'WAITLISTED' ? t('university:decision.reason') : t('university:decision.note')} htmlFor="d-note"
          optional={!['REJECTED', 'WAITLISTED'].includes(to)}
          hint={to === 'REJECTED' || to === 'WAITLISTED' ? t('university:decision.reasonHint') : t('university:decision.noteHint')} error={errors.note?.message}>
          <Textarea id="d-note" rows={3} maxLength={2000} {...register('note')} invalid={!!errors.note} />
        </Field>
        {to === 'REJECTED' && <Callout tone="warning">{t('university:decision.rejectWarning')}</Callout>}
        {to === 'ADMISSION_CERTIFICATE_ISSUED' && <Callout tone="info">{t('university:decision.certificateInfo')}</Callout>}
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ Flag
// ------------------------------------------------------------------ Document requests
const REQUEST_CATEGORIES = ['BANK_STATEMENT', 'TRANSCRIPT', 'GRADUATION_CERTIFICATE', 'TOPIK', 'IELTS', 'PASSPORT', 'RECOMMENDATION', 'SPONSOR_DOCUMENT', 'OTHER'] as const;

function RequestDocumentsModal({ app, onClose, onSent }: { app: Detail; onClose: () => void; onSent?: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [category, setCategory] = useState<string>('BANK_STATEMENT');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState<{ label?: string; note?: string }>({});
  const effectiveLabel = label.trim() || (category !== 'OTHER' ? t(`common:docCategory.${category}`) : '');
  const m = useMutation({
    mutationFn: () => api.applications.requestDocument(app.id, { label: effectiveLabel, note: note.trim(), category: category as never, due_date: due || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application', app.id] });
      qc.invalidateQueries({ queryKey: ['university', 'attention'] });
      invalidate();
      toast.success(t('university:request.sent', { student: app.student?.full_name ?? '' }));
      onClose();
      onSent?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = () => {
    const e: typeof err = {};
    if (effectiveLabel.length < 2) e.label = 'validation.required';
    if (note.trim().length < 3) e.note = 'validation.required';
    setErr(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <Modal open onClose={onClose} title={t('university:request.title')} description={t('university:request.description', { student: app.student?.full_name ?? '' })}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={submit}>{t('university:request.submit')}</Button></>}>
      <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <div className="uc-two">
          <Field label={t('university:request.category')} htmlFor="rq-cat">
            <Select id="rq-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {REQUEST_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'OTHER' ? t('university:request.other') : t(`common:docCategory.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('university:request.due')} htmlFor="rq-due" optional>
            <Input id="rq-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label={t('university:request.label')} htmlFor="rq-label" optional={category !== 'OTHER'} hint={t('university:request.labelHint')} error={err.label}>
          <Input id="rq-label" maxLength={200} value={label} placeholder={category !== 'OTHER' ? t(`common:docCategory.${category}`) : ''} onChange={(e) => setLabel(e.target.value)} invalid={!!err.label} />
        </Field>
        <Field label={t('university:request.note')} htmlFor="rq-note" hint={t('university:request.noteHint')} error={err.note}>
          <Textarea id="rq-note" rows={4} maxLength={2000} value={note} placeholder={t('university:request.notePlaceholder')} onChange={(e) => setNote(e.target.value)} invalid={!!err.note} />
        </Field>
        <p className="uc-note">{t('university:request.whatHappens')}</p>
      </form>
    </Modal>
  );
}

const REQ_TONE: Record<string, Tone> = { OPEN: 'warning', FULFILLED: 'success', CANCELLED: 'neutral' };

function DocumentRequests({ app }: { app: Detail }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { perms } = useUniversity();
  const [showClosed, setShowClosed] = useState(false);
  const all = app.document_requests ?? [];
  // V9: open requests always; answered ones newest first, two shown — older history behind one toggle (keeps evidence first).
  const live = all.filter((r) => r.status !== 'CANCELLED');
  const answered = live.filter((r) => r.status !== 'OPEN').sort((x, y) => (y.requested_at ?? '').localeCompare(x.requested_at ?? ''));
  const reqs = showClosed ? all : [...live.filter((r) => r.status === 'OPEN'), ...answered.slice(0, 2)];
  const cancelled = all.length - reqs.length;
  const cancel = useMutation({
    mutationFn: (id: string) => api.applications.cancelRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', app.id] }); qc.invalidateQueries({ queryKey: ['university', 'attention'] }); toast.success(t('university:request.cancelled')); },
    onError: (e) => toast.error((e as Error).message),
  });
  const open = async (docId: string) => {
    try {
      const { url } = await api.documents.downloadUrl(docId, 'inline');
      window.open(url, '_blank', 'noopener');
    } catch (e) { toast.error((e as Error).message); }
  };
  if (!all.length) return null;
  return (
    <div className="uc-reqs-wrap">
      <h3 className="uc-h3">{t('university:request.sectionTitle')}</h3>
      <ul className="uc-requests uc-requests--compact">
        {reqs.map((r) => (
          <li key={r.id} data-status={r.status}>
            <div className="uc-requests__main">
              <div className="hg-row-wrap" style={{ gap: 10 }}>
                <span className="hg-medium">{r.label}</span>
                <SoftBadge tone={yxTone(REQ_TONE[r.status])}>{t(`university:request.status.${r.status}`)}</SoftBadge>
              </div>
              <p className="uc-requests__note" title={r.note}>{r.note}</p>
              <div className="uc-sub">
                {t('university:request.byOn', { name: r.requested_by_user?.full_name ?? '—', date: formatDate(r.requested_at, locale) })}
                {r.due_date ? ` · ${t('common:time.due', { date: formatDate(r.due_date, locale) })}` : ''}
                {r.fulfilled_at ? ` · ${t('university:request.sentOn', { date: formatDate(r.fulfilled_at, locale) })}` : ''}
              </div>
            </div>
            <div className="uc-requests__act">
              {r.status === 'FULFILLED' && r.document_id && <Button size="sm" variant="soft" icon={<Eye />} onClick={() => open(r.document_id as string)}>{t('university:request.view')}</Button>}
              {r.status === 'OPEN' && perms.canEdit && <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id)}>{t('university:request.cancel')}</Button>}
            </div>
          </li>
        ))}
      </ul>
      {(cancelled > 0 || showClosed) && <button type="button" className="hg-btn hg-btn--link hg-btn--sm" onClick={() => setShowClosed(!showClosed)}>{showClosed ? t('common:actions.showLess') : t('university:v9.rv.showEarlier', { count: cancelled })}</button>}
    </div>
  );
}

function FlagModal({ app, onClose }: { app: Detail; onClose: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.applications.update(app.id, { flagged: true, flag_reason: reason.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', app.id] }); invalidate(); toast.success(t('university:flag.flagged')); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={t('university:flag.title')} description={t('university:flag.description')}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="danger" icon={<Flag />} loading={m.isPending} onClick={() => (reason.trim() ? m.mutate() : setErr('validation.required'))}>{t('university:flag.submit')}</Button></>}>
      <Field label={t('university:flag.reason')} htmlFor="flag-reason" error={err ?? undefined}>
        <Textarea id="flag-reason" rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} invalid={!!err} />
      </Field>
    </Modal>
  );
}

// ------------------------------------------------------------------ Message
function MessageModal({ app, onClose }: { app: Detail; onClose: () => void }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(t('university:message.defaultSubject', { student: app.student?.full_name ?? '', program: localName(app.program) }));
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.messages.start({ kind: 'APPLICATION', application_id: app.id, subject: subject.trim(), body: body.trim() }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success(t('university:message.sent')); nav(`/messages/${r.id}`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open onClose={onClose} title={t('university:message.title')} description={t('university:message.description', { agency: app.agency?.name ?? t('university:agencies.direct') })}
      footer={<><Button onClick={onClose}>{t('common:actions.cancel')}</Button><Button variant="primary" loading={m.isPending} onClick={() => (subject.trim() && body.trim() ? m.mutate() : setErr('validation.required'))}>{t('common:actions.send')}</Button></>}>
      <div className="hg-stack">
        <Field label={t('university:message.subject')} htmlFor="msg-subj"><Input id="msg-subj" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={t('university:message.body')} htmlFor="msg-body" error={err ?? undefined}>
          <Textarea id="msg-body" rows={5} maxLength={8000} value={body} onChange={(e) => { setBody(e.target.value); setErr(null); }} invalid={!!err} />
        </Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Documents
function DocumentRow({ item }: { item: ChecklistItem }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!item.document_id) return;
    setBusy(true);
    const w = window.open('', '_blank');
    try {
      const r = await api.documents.downloadUrl(item.document_id, 'inline');
      if (w) w.location.href = r.url;
      else window.location.assign(r.url);
    } catch (e) {
      w?.close();
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="uc-doc uv7-doc">
      <span className={`avatar avatar-sm avatar-rounded bg-${item.status === 'VERIFIED' ? 'success' : item.status === 'MISSING' ? 'light' : 'primary'}-transparent`} aria-hidden><FileText /></span>
      <div className="hg-grow" style={{ minWidth: 0 }}>
        <div className="hg-medium hg-truncate">{item.label || t(`common:docCategory.${item.category}`)}</div>
        <div className="uc-sub">
          {[!item.required ? t('university:detail.optionalDoc') : null, item.legalization_required ? t('university:detail.legalization') : null, item.translation_required ? t('university:detail.translation') : null].filter(Boolean).join(' · ') || t('university:ev.required')}
        </div>
      </div>
      <div style={{ flex: 'none' }}>
        <SoftBadge tone={yxTone(documentTone[item.status] ?? 'neutral')}>{t(`common:docStatus.${item.status}`)}</SoftBadge>
      </div>
      {item.document_id ? (
        <Button size="sm" variant="ghost" icon={<Eye />} loading={busy} onClick={open} aria-label={`${t('common:actions.view')} — ${item.label}`}>{t('common:actions.view')}</Button>
      ) : item.status !== 'MISSING' ? (
        <span className="uc-notshared" title={t('university:detail.notSharedHint')}><Lock aria-hidden size={13} /> {t('university:detail.notShared')}</span>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------------ Eligibility
type Verdict = 'meets' | 'below' | 'missing' | 'info' | 'none';

export interface EligibilityRow { key: string; required: string; applicant: string; verdict: Verdict }

const EDU_RANK: Record<string, number> = { HIGH_SCHOOL: 1, ASSOCIATE: 2, BACHELOR: 3, MASTER: 4, DOCTORATE: 5 };
const FINANCIAL = ['BANK_STATEMENT', 'SPONSOR_DOCUMENT'];

/**
 * Published requirement vs. what the applicant has on file — one table, in the order an officer checks:
 * prior education, GPA, language (the applicant's score is shown even when no minimum is published), interview,
 * financial proof. Informational — the decision stays human.
 */
export function eligibilityRows(req: Requirements | null | undefined, prof: Detail['student_profile'], t: TFn,
  extra: { checklist?: ChecklistItem[]; interview_at?: string | null; locale?: string } = {}): EligibilityRow[] {
  if (!req) return [];
  const rows: EligibilityRow[] = [];
  const edu = prof?.education ?? [];
  if (req.min_prior_education) {
    const need = EDU_RANK[req.min_prior_education] ?? 1;
    const best = [...edu].sort((x, y) => (EDU_RANK[y.level] ?? 0) - (EDU_RANK[x.level] ?? 0))[0];
    const done = edu.some((e) => (EDU_RANK[e.level] ?? 0) >= need && e.graduation_status === 'GRADUATED');
    const pending = edu.some((e) => (EDU_RANK[e.level] ?? 0) >= need);
    rows.push({
      key: 'education', required: t('university:v4.ev.educationReq', { level: t(`university:eduLevel.${req.min_prior_education}`, { defaultValue: req.min_prior_education }) }),
      applicant: best ? `${t(`university:eduLevel.${best.level}`, { defaultValue: best.level })} · ${t(`university:gradStatus.${best.graduation_status}`, { defaultValue: best.graduation_status })}` : t('university:ev.notProvided'),
      verdict: done ? 'meets' : pending ? 'info' : best ? 'below' : 'missing',
    });
  }
  const gpa = Math.max(-1, ...edu.map((e) => e.gpa_percent ?? -1));
  if (req.min_gpa_percent !== null) {
    rows.push({ key: 'gpa', required: t('university:ev.gpaMin', { value: req.min_gpa_percent }), applicant: gpa >= 0 ? t('university:ev.gpaValue', { value: Math.round(gpa * 10) / 10 }) : t('university:ev.notProvided'),
      verdict: gpa < 0 ? 'missing' : gpa >= req.min_gpa_percent ? 'meets' : 'below' });
  }
  const scores = (prof?.languages ?? []).filter((l) => !l.is_planned);
  const scoreText = (test: string) => {
    const best = scores.filter((l) => l.test === test).sort((x, y) => y.score - x.score)[0];
    if (!best) return null;
    return { v: best.score, text: `${test.replace('_IBT', ' iBT')} ${best.score} · ${best.verified ? t('university:detail.verified') : t('university:detail.selfReported')}` };
  };
  const lang: { key: string; min: number | null; test: string; label: string }[] = [
    { key: 'topik', min: req.min_topik_level, test: 'TOPIK', label: 'TOPIK' },
    { key: 'ielts', min: req.min_ielts, test: 'IELTS', label: 'IELTS' },
    { key: 'toefl', min: req.min_toefl_ibt, test: 'TOEFL_IBT', label: 'TOEFL iBT' },
  ];
  const langRows: EligibilityRow[] = lang.filter((l) => l.min !== null).map((l) => {
    const sc = scoreText(l.test);
    return { key: l.key, required: `${l.label} ≥ ${l.min}`, applicant: sc ? sc.text : t('university:ev.notProvided'), verdict: (!sc ? 'missing' : sc.v >= (l.min as number) ? 'meets' : 'below') as Verdict };
  });
  if (req.language_alternative && langRows.length > 1 && langRows.some((r) => r.verdict === 'meets')) {
    // Any one accepted language test satisfies the requirement.
    langRows.forEach((r) => { if (r.verdict !== 'meets') r.verdict = 'info'; });
  }
  rows.push(...langRows);
  if (langRows.length === 0) {
    // No published language minimum: still show what the applicant brings (e.g. TOPIK 5 for a language program).
    const any = scores.map((l) => scoreText(l.test)?.text).filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i);
    rows.push({ key: 'language', required: t('university:v4.ev.languageNoMin'), applicant: any.length ? any.join(' · ') : t('university:ev.notProvided'), verdict: 'none' });
  }
  if (req.requires_interview) {
    rows.push({ key: 'interview', required: t('university:ev.interviewRequired'),
      applicant: extra.interview_at ? t('university:v4.ev.interviewOn', { date: formatDateTime(extra.interview_at, extra.locale ?? 'en') }) : t('university:v4.ev.interviewNotYet'), verdict: 'info' });
  }
  if (req.requires_portfolio) rows.push({ key: 'portfolio', required: t('university:ev.portfolioRequired'), applicant: '—', verdict: 'info' });
  const fin = (extra.checklist ?? []).find((c) => !c.request_id && FINANCIAL.includes(c.category));
  if (fin) {
    rows.push({ key: 'financial', required: t('university:v4.ev.financialReq', { label: fin.label }),
      applicant: fin.status === 'MISSING' ? t('university:ev.notProvided') : t(`university:v4.ev.docStatus.${fin.status}`, { defaultValue: fin.status }),
      verdict: fin.status === 'VERIFIED' ? 'meets' : fin.status === 'MISSING' ? 'missing' : 'info' });
  }
  return rows;
}

type EvidenceRow = { key: string; requirement: ReactNode; evidence: ReactNode; verdict: Verdict | 'doc'; docStatus?: string; doc?: ChecklistItem };

/** Overall answer to "can I make a decision now?" from the evidence rows and open requests. */
export function readiness(rows: { verdict: string; docStatus?: string }[], openRequests: number): { ready: boolean; open: number; below: number } {
  const below = rows.filter((r) => r.verdict === 'below').length;
  const open = rows.filter((r) => r.verdict === 'missing' || r.verdict === 'info' || (r.verdict === 'doc' && r.docStatus !== 'VERIFIED')).length + openRequests;
  return { ready: open === 0 && below === 0, open, below };
}

/** Evidence rows and the "can I decide now?" answer, computed once and shared by the table and the decision panel. */
function useEvidence(app: Detail | undefined) {
  const { t, locale } = useLocale(['university', 'common']);
  const programs = usePrograms();
  if (!app) return { rows: [] as EvidenceRow[], optional: [] as ChecklistItem[], r: { ready: false, open: 0, below: 0 }, loading: true, program: undefined };
  const program = programs.data?.find((p) => p.id === app.program.id);
  const elig = eligibilityRows(program?.requirements, app.student_profile, t, { checklist: app.checklist, interview_at: app.interview_at, locale });
  const docs = app.checklist.filter((d) => !d.request_id);
  const required = docs.filter((d) => d.required && !(FINANCIAL.includes(d.category) && elig.some((r) => r.key === 'financial')));
  const optional = docs.filter((d) => !d.required);
  const rows: EvidenceRow[] = [
    ...elig.map((r) => ({ key: r.key, requirement: r.required, evidence: r.applicant, verdict: r.verdict })),
    ...required.map((d) => ({ key: `doc-${d.requirement_id}`, requirement: d.label || t(`common:docCategory.${d.category}`), evidence: <DocEvidence item={d} />, verdict: 'doc' as const, docStatus: d.status, doc: d })),
  ];
  const openReq = (app.document_requests ?? []).filter((x) => x.status === 'OPEN').length;
  return { rows, optional, r: readiness(rows, openReq), loading: programs.isLoading, program };
}

/** Fires once when the element has been on screen — "the evidence was shown". */
function useSeen<T extends Element>(): [(el: T | null) => void, boolean] {
  const [seen, setSeen] = useState(false);
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true); });
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);
  return [setEl, seen];
}

/**
 * V8 "Can I make a decision now?" — one table: published requirement | the applicant's evidence | status. Required
 * documents are rows of the same table (the document is the evidence, opened in place); requests sit under it.
 * V9: first content of the page; on phones each row stacks (requirement, then evidence + status) instead of scrolling.
 */
function DecisionEvidence({ app, ev, canRequest, onRequest, sentinel }: { app: Detail; ev: ReturnType<typeof useEvidence>; canRequest: boolean; onRequest: () => void; sentinel: (el: HTMLDivElement | null) => void }) {
  const { t } = useLocale(['university', 'common']);
  const { rows, optional, r, loading, program } = ev;
  const [showOptional, setShowOptional] = useState(false);
  const tone: Record<Verdict, Tone> = { meets: 'success', below: 'danger', missing: 'warning', info: 'neutral', none: 'neutral' };
  const summary = !awaitingDecisionStatus(app.status) ? t('university:v8.rv.decided')
    : r.ready ? t('university:v8.rv.ready') : r.below ? t('university:v8.rv.below', { count: r.below, open: r.open }) : t('university:v8.rv.open', { count: r.open });
  return (
    <YCard id="ev" as="section" className="uv7-sec uv8-evidence" title={t('university:v8.rv.question')}
      tools={canRequest ? <button type="button" className="btn btn-sm btn-light uv7-btn" onClick={onRequest}><Send aria-hidden />{t('university:request.cta')}</button> : undefined}>
      <p className={cx('uv8-verdict', r.ready && awaitingDecisionStatus(app.status) && 'is-ready', r.below > 0 && 'is-below')} role="status">{summary}</p>
      {loading ? <Skeleton h={160} /> : rows.length === 0 ? <p className="hg-subtle hg-small">{t('university:ev.none')}</p> : (
        <div className="uv8-fit">
          <table className="table mb-0 uv7-table uv8-evtable uv9-evtable">
            <caption className="hg-sr-only">{t('university:v8.rv.question')}</caption>
            <thead><tr><th scope="col">{t('university:v8.rv.requirement')}</th><th scope="col">{t('university:v8.rv.evidence')}</th><th scope="col">{t('university:ev.result')}</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.key} data-verdict={x.verdict === 'doc' ? (x.docStatus === 'VERIFIED' ? 'meets' : 'open') : x.verdict}>
                  <th scope="row" className="fw-normal">{x.requirement}</th>
                  <td>{x.evidence}</td>
                  <td>{x.verdict === 'doc'
                    ? <SoftBadge tone={yxTone((documentTone as Record<string, Tone>)[x.docStatus ?? ''] ?? 'neutral')}>{t(`common:docStatus.${x.docStatus}`)}</SoftBadge>
                    : x.verdict === 'none' ? <span className="text-muted fs-12">{t('university:v4.ev.verdictNone')}</span>
                      : <SoftBadge tone={yxTone(tone[x.verdict])}>{t(`university:v4.ev.verdict.${x.verdict}`)}</SoftBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div ref={sentinel} className="uv9-evsentinel" aria-hidden />
      <DocumentRequests app={app} />
      {optional.length > 0 && (
        <div className="mt-2">
          <button type="button" className="hg-btn hg-btn--link hg-btn--sm" aria-expanded={showOptional} onClick={() => setShowOptional(!showOptional)}>
            {showOptional ? t('common:actions.showLess') : t('university:v8.rv.optional', { count: optional.length })}
          </button>
          {showOptional && <ul className="uc-docs uv7-docs">{optional.map((d) => <DocumentRow key={d.requirement_id} item={d} />)}</ul>}
        </div>
      )}
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2 fs-12 text-muted">
        {program?.requirements && <Provenance data={program.requirements} />}
        <span>{t('university:detail.sharingNote')}</span>
      </div>
    </YCard>
  );
}

const AWAIT: ApplicationStatus[] = ['SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'WAITLISTED'];
const awaitingDecisionStatus = (s: ApplicationStatus) => AWAIT.includes(s);

/** The document itself is the evidence: open it in place, or say why it cannot be opened. */
function DocEvidence({ item }: { item: ChecklistItem }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const extra = [item.legalization_required ? t('university:detail.legalization') : null, item.translation_required ? t('university:detail.translation') : null].filter(Boolean).join(' · ');
  if (!item.document_id) {
    return <span className="text-muted">{item.status === 'MISSING' ? t('university:ev.notProvided') : <><Lock aria-hidden size={12} /> {t('university:detail.notShared')}</>}{extra ? <span className="d-block fs-11">{extra}</span> : null}</span>;
  }
  const open = async () => {
    setBusy(true);
    const w = window.open('', '_blank');
    try {
      const r = await api.documents.downloadUrl(item.document_id as string, 'inline');
      if (w) w.location.href = r.url; else window.location.assign(r.url);
    } catch (e) { w?.close(); toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <span>
      <button type="button" className="btn btn-link btn-sm p-0 uv8-evlink" disabled={busy} onClick={open}>
        <Eye aria-hidden size={14} /> {t('university:v8.rv.openDoc')}<span className="hg-sr-only"> — {item.label}</span>
      </button>
      {extra ? <span className="d-block fs-11 text-muted">{extra}</span> : null}
    </span>
  );
}

// ------------------------------------------------------------------ Side panels
function ReviewerName({ id }: { id: string | null | undefined }) {
  const { t } = useLocale(['university', 'common']);
  const team = useTeam();
  if (!id) return <span className="hg-subtle">{t('university:reviewer.none')}</span>;
  return <>{team.data?.find((m) => m.user_id === id)?.full_name ?? '…'}</>;
}

function ReviewerPanel({ app }: { app: Detail }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const team = useTeam();
  const [assigned, setAssigned] = useState<string>(app.university_reviewer_id ?? '');
  const reviewers = team.data ?? [];
  const m = useMutation({
    mutationFn: (id: string | null) => api.applications.update(app.id, { university_reviewer_id: id }),
    onSuccess: (_, id) => { setAssigned(id ?? ''); qc.invalidateQueries({ queryKey: ['application', app.id] }); qc.invalidateQueries({ queryKey: ['applications'] }); toast.success(id ? t('university:reviewer.assigned', { name: reviewers.find((r) => r.user_id === id)?.full_name ?? '' }) : t('university:reviewer.cleared')); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Field label={t('university:reviewer.label')} htmlFor="rev">
      <Select id="rev" compact value={assigned} disabled={m.isPending || team.isLoading} onChange={(e) => m.mutate(e.target.value || null)}>
        <option value="">{t('university:reviewer.none')}</option>
        {reviewers.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}{r.title ? ` · ${r.title}` : ''}</option>)}
      </Select>
    </Field>
  );
}

function ExternalRefPanel({ app }: { app: Detail }) {
  const { t } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(app.external_reference ?? '');
  const m = useMutation({
    mutationFn: () => api.applications.update(app.id, { external_reference: value.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', app.id] }); toast.success(t('university:detail.refSaved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <form className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <Field label={t('university:detail.externalRef')} htmlFor="ext-ref" hint={t('university:detail.externalRefHint')}>
        <div className="hg-row" style={{ gap: 8 }}>
          <Input id="ext-ref" compact maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" size="sm" disabled={value.trim() === (app.external_reference ?? '')} loading={m.isPending}>{t('common:actions.save')}</Button>
        </div>
      </Field>
    </form>
  );
}

// ------------------------------------------------------------------ Decision plan
/**
 * One primary action per state (V4): the step that moves the application forward for the university; everything else is
 * a quiet secondary link. While requested documents are outstanding there is no primary — the applicant acts next.
 */
export function decisionPlan(status: ApplicationStatus, actions: ApplicationStatus[], o: { openRequests: number; canRequest: boolean }):
  { primary: ApplicationStatus | 'REQUEST' | null; secondary: (ApplicationStatus | 'REQUEST')[] } {
  const has = (s: ApplicationStatus) => actions.includes(s);
  let primary: ApplicationStatus | null = null;
  if (status === 'SUBMITTED' && has('UNIVERSITY_REVIEW')) primary = 'UNIVERSITY_REVIEW';
  else if (status === 'ADDITIONAL_DOCUMENTS') primary = o.openRequests === 0 && has('UNIVERSITY_REVIEW') ? 'UNIVERSITY_REVIEW' : null;
  else {
    const order: ApplicationStatus[] = ['OFFERED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_ISSUED', 'ENROLLED', 'UNIVERSITY_REVIEW'];
    primary = order.find(has) ?? null;
  }
  const rest: (ApplicationStatus | 'REQUEST')[] = actions.filter((s) => s !== primary && s !== 'ADDITIONAL_DOCUMENTS' && s !== 'ADMISSION_CERTIFICATE_PENDING');
  if (o.canRequest) rest.unshift('REQUEST');
  // Reject always last.
  rest.sort((x, y) => (x === 'REJECTED' ? 1 : 0) - (y === 'REJECTED' ? 1 : 0));
  return { primary, secondary: rest };
}

/**
 * V9 U2: the primary action is the state's natural next step *given the evidence*: start the review; once in review, make
 * an offer only when every requirement is met and every document verified; request documents when items are open; when a
 * minimum is not met there is no dominant action (the committee decides). Never a primary before the evidence was shown.
 */
export function decisionPlanV9(status: ApplicationStatus, actions: ApplicationStatus[],
  o: { openRequests: number; canRequest: boolean; evidence: { ready: boolean; open: number; below: number }; seen: boolean }):
  { primary: ApplicationStatus | 'REQUEST' | null; secondary: (ApplicationStatus | 'REQUEST')[] } {
  const base = decisionPlan(status, actions, o);
  if (['UNIVERSITY_REVIEW', 'INTERVIEW', 'WAITLISTED'].includes(status)) {
    let primary: ApplicationStatus | 'REQUEST' | null = null;
    if (o.evidence.ready && actions.includes('OFFERED')) primary = 'OFFERED';
    else if (o.evidence.below === 0 && o.evidence.open > 0 && o.canRequest) primary = 'REQUEST';
    const all: (ApplicationStatus | 'REQUEST')[] = [...(base.primary ? [base.primary] : []), ...base.secondary];
    const secondary = all.filter((x) => x !== primary);
    secondary.sort((x, y) => (x === 'REJECTED' ? 1 : 0) - (y === 'REJECTED' ? 1 : 0));
    return { primary: o.seen ? primary : null, secondary: o.seen || !primary ? secondary : [primary, ...secondary] };
  }
  if (!o.seen && base.primary) return { primary: null, secondary: [base.primary, ...base.secondary] };
  return base;
}

// ------------------------------------------------------------------ V6: review loop + reader view
/** Previous / next applicant among those awaiting a decision (same order as the review queue). */
function useQueue(id: string) {
  const q = useApplications({ status: PENDING_DECISION, sort: 'submitted', page: 1, page_size: 100 });
  const ids = (q.data?.items ?? []).map((x) => x.id);
  const i = ids.indexOf(id);
  const others = ids.filter((x) => x !== id);
  // "Next" after a decision: the following applicant, or the first one still waiting when this was the last.
  const after = i >= 0 ? ids[i + 1] ?? others[0] ?? null : others[0] ?? null;
  return { i, total: ids.length, prev: i > 0 ? ids[i - 1] : null, next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null, after };
}

/** Work the queue without going back to the list. */
function ReviewQueueNav({ queue }: { queue: ReturnType<typeof useQueue> }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { i, total, prev, next } = queue;
  if (i < 0 || total < 2) return null;
  return (
    <nav className="uv7-qnav" aria-label={t('university:v6.detail.queue')}>
      <span className="fs-12 text-muted uv7-num">{t('university:v6.detail.position', { n: formatNumber(i + 1, locale), total: formatNumber(total, locale) })}</span>
      <div className="btn-group">
        {prev ? <Link to={`/applications/${prev}`} className="btn btn-sm btn-light uv7-btn" aria-label={t('university:v6.detail.prev')}><ChevronLeft className="hg-flip-rtl" aria-hidden /></Link>
          : <span className="btn btn-sm btn-light uv7-btn disabled" aria-disabled="true"><ChevronLeft className="hg-flip-rtl" aria-hidden /></span>}
        {next ? <Link to={`/applications/${next}`} className="btn btn-sm btn-light uv7-btn">{t('university:v6.detail.next')}<ChevronRight className="hg-flip-rtl" aria-hidden /></Link>
          : <span className="btn btn-sm btn-light uv7-btn disabled" aria-disabled="true">{t('university:v6.detail.next')}<ChevronRight className="hg-flip-rtl" aria-hidden /></span>}
      </div>
    </nav>
  );
}

const OPEN_NEXT_KEY = 'hg.uni.openNext';
function readOpenNext(): boolean {
  try { return localStorage.getItem(OPEN_NEXT_KEY) !== '0'; } catch { return true; }
}
function writeOpenNext(v: boolean) {
  try { localStorage.setItem(OPEN_NEXT_KEY, v ? '1' : '0'); } catch { /* private mode: keep the default */ }
}

/** Administrative check (V8): the file is administratively in order. Audited; never a decision. */
function AdminCheckPanel({ app }: { app: Detail }) {
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const c = app.admin_check;
  const m = useMutation({
    mutationFn: () => (c ? api.university.undoAdminCheck(app.id) : api.university.bulk('admin-check', { ids: [app.id] })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', app.id] }); qc.invalidateQueries({ queryKey: ['applications'] }); toast.success(c ? t('university:v8.rv.adminUndone') : t('university:v8.rv.adminDone')); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="uv8-admincheck">
      <span className="fs-12 text-muted d-block">{t('university:v8.chip.adminCheck')}</span>
      <span className="fs-13">{c ? t('university:v8.rv.adminBy', { name: c.by ?? '—', date: formatDate(c.checked_at, locale) }) : t('university:v8.chip.admin_check.pending')}</span>
      <button type="button" className="btn btn-link btn-sm p-0 ms-2" disabled={m.isPending} onClick={() => m.mutate()}>{c ? t('university:v8.rv.adminUndo') : t('university:v8.rv.adminMark')}</button>
    </div>
  );
}

/**
 * Statements (personal statement, study plan) in a calm reading column: the approved text the student submitted, with its
 * word count against the limit. Drafts and counselor comments never reach the university.
 */
function Statements({ app }: { app: Detail }) {
  return <StatementsReader app={app} />;
}

function StatementsReader({ app }: { app: Detail }) {
  const { t, locale } = useLocale(['university', 'common']);
  const q = useStatements(app.id, app.essays.length > 0);
  const [pick, setPick] = useState<string | null>(null);
  const list = q.data ?? [];
  const cur = list.find((s) => s.id === pick) ?? list[0];
  const pending = app.essays.filter((e) => !list.some((s) => s.id === e.id));
  return (
    <div id="statements" className="hg-stack">
      <p className="fs-12 text-muted mb-0">{t('university:v6.reader.sub')}</p>
      {q.isLoading ? <Skeleton h={160} /> : app.essays.length === 0 ? <p className="hg-subtle hg-small">{t('university:v4.material.noEssays')}</p> : (
        <div className="uc-reader">
          {list.length > 1 && (
            <div className="uc-reader__tabs" role="tablist" aria-label={t('university:v6.reader.title')}>
              {list.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={s.id === cur?.id} className="uc-reader__tab" onClick={() => setPick(s.id)}>
                  {t(`university:v6.reader.type.${s.essay_type}`, { defaultValue: s.title })}
                </button>
              ))}
            </div>
          )}
          {cur ? (
            <article className="uc-reader__doc" role={list.length > 1 ? 'tabpanel' : undefined} aria-label={cur.title}>
              <header className="uc-reader__head">
                <h3>{t(`university:v6.reader.type.${cur.essay_type}`, { defaultValue: cur.title })}</h3>
                <p className="uc-sub">
                  {cur.word_limit ? t('university:v6.reader.wordsOf', { n: formatNumber(cur.words, locale), limit: formatNumber(cur.word_limit, locale) }) : t('university:v6.reader.words', { n: formatNumber(cur.words, locale) })}
                  {' · '}{t('university:v6.reader.version', { n: cur.version })}
                  {cur.approved_at ? ` · ${t('university:v6.reader.approvedOn', { date: formatDate(cur.approved_at, locale) })}` : ''}
                </p>
                {cur.prompt && <p className="uc-reader__prompt">{cur.prompt}</p>}
              </header>
              <div className="uc-reader__body">{cur.body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
            </article>
          ) : null}
          {pending.length > 0 && (
            <ul className="uc-reader__pending">
              {pending.map((e) => (
                <li key={e.id}>
                  <span className="hg-truncate">{e.title}</span>
                  <SoftBadge tone={yxTone(essayTone[e.status] ?? 'neutral')}>{t(`common:essayStatus.${e.status}`)}</SoftBadge>
                </li>
              ))}
            </ul>
          )}
          <p className="fs-12 text-muted mb-0">{t('university:v6.reader.note')}</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Agency identity (V9)
/** Who sent the applicant: agency, legal name and registration as recorded ("Not recorded" until a real one exists). */
function AgencyFacts({ app }: { app: Detail }) {
  const { t } = useLocale(['university', 'common']);
  const q = useApplicationAgency(app.id, !!app.agency);
  if (!app.agency) return <><dt>{t('university:v9.rv.agency')}</dt><dd>{t('university:agencies.direct')}</dd></>;
  const a = q.data?.agency;
  return (
    <>
      <dt>{t('university:v9.rv.agency')}</dt><dd>{app.agency.name}</dd>
      <dt>{t('university:v9.rv.legalName')}</dt><dd>{a?.legal_name ?? <span className="text-muted">{t('university:v9.rv.notRecorded')}</span>}</dd>
      <dt>{t('university:v9.rv.registration')}</dt>
      <dd>{!a || a.registration_status === 'NOT_RECORDED' ? <span className="text-muted">{t('university:v9.rv.notRecorded')}</span> : t(`university:v9.rv.reg.${a.registration_status}`, { defaultValue: a.registration_status })}</dd>
      <dt>{t('university:v9.rv.counselor')}</dt><dd>{a?.responsible_counselor ?? <span className="text-muted">{t('university:v9.rv.notRecorded')}</span>}</dd>
    </>
  );
}

// ------------------------------------------------------------------ Page
export default function ApplicationDetail() {
  const { id = '' } = useParams();
  const { t, locale } = useLocale(['university', 'common']);
  const { api } = useAuth();
  const { perms } = useUniversity();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const invalidate = useInvalidate();
  const [decision, setDecision] = useState<ApplicationStatus | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [openNext, setOpenNext] = useState(readOpenNext);
  const queue = useQueue(id);
  const q = useQuery({ queryKey: ['application', id], queryFn: () => api.applications.get(id), enabled: !!id });
  const ev = useEvidence(q.data);
  const [sentinel, seen] = useSeen<HTMLDivElement>();
  const wide = useNarrow('(min-width: 1280px)');
  const unflag = useMutation({
    mutationFn: () => api.applications.update(id, { flagged: false, flag_reason: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', id] }); invalidate(); toast.success(t('university:flag.unflagged')); },
    onError: (e) => toast.error((e as Error).message),
  });

  const crumbs = [{ label: t('common:nav.applicants'), to: '/applicants' }, { label: q.data?.student?.full_name ?? t('university:detail.applicant') }];
  const head = <PageHeader title={t('university:v7.rv.title')} crumbs={crumbs} />;

  if (q.isLoading) return <div className="uv7 hg-stack">{head}<SkeletonCard lines={4} /><SkeletonCard lines={6} /></div>;
  if (q.isError || !q.data) return <div className="uv7 hg-stack">{head}<ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const a = q.data;
  const actions = decisionActions(a.allowed_transitions, perms);
  const prof = a.student_profile;
  const intake = `${a.intake.year}-${a.intake.term}`;
  const requests = a.document_requests ?? [];
  const openRequests = requests.filter((r) => r.status === 'OPEN').length;
  const canRequest = perms.canEdit && AWAIT.includes(a.status);
  const nationality = prof?.nationality ?? a.student?.nationality;
  const { primary, secondary } = decisionPlanV9(a.status, actions, { openRequests, canRequest, evidence: ev.r, seen: seen || !AWAIT.includes(a.status) });
  const statusLabel = (st: string) => t(`university:v4.status.${st}`, { defaultValue: t(`common:appStatus.${st}`, { defaultValue: st }) });
  const actionLabel = (st: ApplicationStatus) => (st === 'UNIVERSITY_REVIEW' && a.status === 'ADDITIONAL_DOCUMENTS'
    ? t('university:v4.decision.resume') : t(`university:decision.action.${st}`, { defaultValue: statusLabel(st) }));
  const run = (st: ApplicationStatus | 'REQUEST') => (st === 'REQUEST' || st === 'ADDITIONAL_DOCUMENTS' ? setRequestOpen(true) : setDecision(st));
  // Review-and-advance: a real decision — or a document request (the applicant acts next) — opens the next applicant.
  const FINAL: ApplicationStatus[] = ['OFFERED', 'REJECTED', 'WAITLISTED', 'INTERVIEW'];
  const advance = () => { if (openNext && queue.after) nav(`/applications/${queue.after}`); };
  const afterDecision = (st: ApplicationStatus) => () => { if (FINAL.includes(st)) advance(); };
  const name = a.student?.full_name ?? t('university:detail.applicant');
  const awaiting = AWAIT.includes(a.status);

  const decisionCard = (
    <section className="card custom-card uv7-decision uv8-decision uv9-decision" aria-labelledby="dec-h">
      <div className="card-body">
        <h2 id="dec-h" className="uv8-decision__title">{t('university:decision.title')}</h2>
        <p className="fs-13 mb-2">
          {perms.readOnly ? t('university:decision.readOnly') : t(`university:v4.decision.state.${a.status}`, { defaultValue: t('university:decision.none'), count: openRequests })}
        </p>
        {!perms.readOnly && awaiting && !seen && <p className="uv9-decision__hint">{t('university:v9.rv.evidenceFirst')}</p>}
        {!perms.readOnly && awaiting && seen && !primary && ev.r.below > 0 && <p className="uv9-decision__hint">{t('university:v9.rv.belowHint')}</p>}
        {!perms.readOnly && (primary || secondary.length > 0) && (
          <div className="uv9-decision__grid">
            {primary && (
              <button type="button" className={cx('btn uv7-btn uv7-decision__primary', primary === 'REJECTED' ? 'btn-danger' : 'btn-primary')} onClick={() => run(primary)}>
                {primary === 'REQUEST' ? <><Send aria-hidden />{t('university:request.cta')}</> : actionLabel(primary)}
              </button>
            )}
            {secondary.map((st) => (
              <button key={st} type="button" className={cx('btn btn-sm uv7-btn', st === 'REJECTED' ? 'btn-outline-danger' : 'btn-outline-light uv7-btn-quiet')} onClick={() => run(st)}>
                {st === 'REQUEST' ? <><Send aria-hidden />{t('university:request.cta')}</> : actionLabel(st)}
              </button>
            ))}
          </div>
        )}
        {!perms.readOnly && awaiting && queue.total > 1 && (
          <label className="uv8-opennext">
            <input type="checkbox" checked={openNext} onChange={(e) => { setOpenNext(e.target.checked); writeOpenNext(e.target.checked); }} />
            <span>{t('university:v9.rv.openNext', { count: Math.max(0, queue.total - (queue.i >= 0 ? 1 : 0)) })}</span>
          </label>
        )}
      </div>
    </section>
  );
  const detailsCard = (
    <YCard className="uv7-details" title={t('university:v7.rv.details')}>
      <dl className="uv7-kv">
        <dt>{t('university:applicants.col.deadline')}</dt><dd>{formatDate(a.intake.application_deadline, locale)}</dd>
        {a.submitted_at && <><dt>{t('university:v9.rv.submitted')}</dt><dd>{formatDate(a.submitted_at, locale)}<span className="d-block fs-11 text-muted"><SubmissionEvidence appId={a.id} /></span></dd></>}
        <AgencyFacts app={a} />
        {a.decided_at && <><dt>{t('university:detail.decided')}</dt><dd>{formatDate(a.decided_at, locale)}</dd></>}
        {a.interview_at && <><dt>{t('university:detail.interview')}</dt><dd>{formatDateTime(a.interview_at, locale)}</dd></>}
        {a.tuition_amount_krw ? <><dt>{t('university:detail.tuition')}</dt><dd>{formatMoney(a.tuition_amount_krw, 'KRW', locale)}{a.tuition_due ? ` · ${t('common:time.due', { date: formatDate(a.tuition_due, locale) })}` : ''}</dd></> : null}
        {a.offer_scholarship_note && <><dt>{t('university:detail.scholarshipNote')}</dt><dd>{a.offer_scholarship_note}</dd></>}
        {!perms.canEdit && <><dt>{t('university:detail.externalRef')}</dt><dd>{a.external_reference ?? '—'}</dd></>}
        {!perms.canEdit && <><dt>{t('university:reviewer.title')}</dt><dd><ReviewerName id={a.university_reviewer_id} /></dd></>}
      </dl>
      {perms.canEdit && (
        <div className="uv7-details__edit hg-stack" style={{ '--hg-gap': '14px' } as React.CSSProperties}>
          {/* Keys reset the panels' local state when the value changes; prefixed so two "none" states are never siblings with one key. */}
          <ReviewerPanel key={`reviewer:${a.university_reviewer_id ?? ''}`} app={a} />
          <ExternalRefPanel key={`ref:${a.external_reference ?? ''}`} app={a} />
          <AdminCheckPanel app={a} />
        </div>
      )}
      <Link to={`/messages?application=${a.id}`} className="btn btn-sm btn-light uv7-btn mt-3"><MessageSquare aria-hidden />{t('university:message.threads')}</Link>
    </YCard>
  );
  const background = (
    <>
      <details className="card custom-card uv8-more" id="bg">
        <summary>{t('university:v6.detail.record')}<span className="fs-12 text-muted ms-2">{t('university:v8.rv.recordCount', { count: prof?.education.length ?? 0 })}</span></summary>
        <div className="card-body pt-0">
          {prof?.education.length ? (
            <ul className="list-unstyled mb-0 uv7-record">
              {prof.education.map((e, i) => (
                <li key={i}>
                  <span className="avatar avatar-sm avatar-rounded bg-primary-transparent" aria-hidden><GraduationCap /></span>
                  <div className="min-w-0">
                    <div className="fw-semibold">{e.institution}</div>
                    <div className="fs-12 text-muted">{t(`university:eduLevel.${e.level}`, { defaultValue: e.level })} · {countryName(e.country, locale)} · {t(`university:gradStatus.${e.graduation_status}`, { defaultValue: e.graduation_status })} · {e.gpa_percent !== null ? t('university:detail.gpaNormalized', { value: Math.round(e.gpa_percent * 10) / 10 }) : t('university:detail.gpaUnknown')}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted fs-13 mb-0">{t('university:detail.noEducation')}</p>}
          {prof?.residence_country && <p className="fs-12 text-muted mb-0 mt-2">{t('university:detail.residence')}: {countryName(prof.residence_country, locale)}</p>}
        </div>
      </details>

      <details className="card custom-card uv8-more" id="history">
        <summary>{t('university:detail.history')}<span className="fs-12 text-muted ms-2">{t('university:v8.rv.historyLast', { status: statusLabel(a.history[a.history.length - 1]?.to ?? a.status), when: a.history.length ? formatRelative(a.history[a.history.length - 1].at, locale) : '' })}</span></summary>
        <div className="card-body pt-0">
          <ol className="list-unstyled mb-0 uv7-tl">
            {[...a.history].reverse().map((h, i) => (
              <li key={i} className="uv7-tl__item">
                <span className={cx('uv7-tl__dot', i === 0 && 'is-current')} aria-hidden />
                <div className="min-w-0">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-semibold">{statusLabel(h.to)}</span>
                    <span className="fs-12 text-muted" title={formatDateTime(h.at, locale)}>{formatRelative(h.at, locale)}</span>
                  </div>
                  <div className="fs-12 text-muted">{[h.actor && h.actor.toUpperCase() !== h.actor_org_type ? h.actor : null, h.actor_org_type ? t(`university:actor.${h.actor_org_type}`, { defaultValue: h.actor_org_type }) : null].filter(Boolean).join(' · ')}</div>
                  {h.note && <p className="fs-13 mb-0 mt-1">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </>
  );

  return (
    <div className="uv7 uv7-review uv8-review uv9-review">
      <div className="uv7-rvtop">
        <nav aria-label="breadcrumb"><ol className="breadcrumb mb-0">
          <li className="breadcrumb-item"><Link to="/applicants">{t('common:nav.applicants')}</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{t('university:v7.rv.title')}</li>
        </ol></nav>
        <ReviewQueueNav queue={queue} />
      </div>

      <header className="card custom-card uv9-rvhead">
        <h1 className="uv9-rvhead__name" title={name}>{name}</h1>
        <StatusSoft status={a.status} />
        {a.flagged && <span className="badge bg-danger-transparent d-inline-flex align-items-center gap-1" title={a.flag_reason ?? undefined}><Flag aria-hidden size={12} />{t('university:applicants.flagged')}</span>}
        <div className="uv9-rvhead__meta">
          <span>{nationality ? <><span aria-hidden>{flagEmoji(nationality)} </span>{countryName(nationality, locale)}</> : '—'}</span>
          <span><BookOpen aria-hidden /><b>{localName(a.program)}</b>&nbsp;· {t(`common:degreeShort.${a.program.degree_level}`)}</span>
          <span><CalendarDays aria-hidden />{intakeText(intake, t)}</span>
          <span><Building2 aria-hidden />{t('university:ev.via', { agency: a.agency?.name ?? t('university:agencies.direct') })}</span>
        </div>
        <div className="uv9-rvhead__actions">
          <button type="button" className="btn btn-sm btn-light uv7-btn" onClick={() => setReaderOpen(true)} disabled={a.essays.length === 0}
            title={a.essays.length ? t('university:v8.rv.readStatements', { count: a.essays.length }) : t('university:v4.material.noEssays')}>
            <FileText aria-hidden /><span className="hg-sr-only">{a.essays.length ? t('university:v8.rv.readStatements', { count: a.essays.length }) : t('university:v4.material.noEssays')}</span>{a.essays.length ? <span aria-hidden>{a.essays.length}</span> : null}
          </button>
          <button type="button" className="btn btn-sm btn-light uv7-btn" onClick={() => setMsgOpen(true)} title={t('university:message.cta')}><MessageSquare aria-hidden /><span className="hg-sr-only">{t('university:message.cta')}</span></button>
          {perms.canEdit && (a.flagged
            ? <button type="button" className="btn btn-sm btn-light uv7-btn" disabled={unflag.isPending} onClick={() => unflag.mutate()} title={t('university:flag.unflag')}><FlagOff aria-hidden /><span className="hg-sr-only">{t('university:flag.unflag')}</span></button>
            : <button type="button" className="btn btn-sm btn-light uv7-btn" onClick={() => setFlagOpen(true)} title={t('university:flag.cta')}><Flag aria-hidden /><span className="hg-sr-only">{t('university:flag.cta')}</span></button>)}
        </div>
        {a.flagged && a.flag_reason && <p className="uv9-rvhead__flag text-danger">{t('university:flag.reasonTitle')}: {a.flag_reason}</p>}
      </header>

      <div className="uv9-rvgrid">
        <div className="uv9-rvgrid__main">
          <DecisionEvidence app={a} ev={ev} canRequest={canRequest} onRequest={() => setRequestOpen(true)} sentinel={sentinel} />
          {!wide && decisionCard}
          {background}
        </div>
        <aside className="uv9-rvgrid__side" aria-label={t('university:detail.side')}>
          {wide && decisionCard}
          {detailsCard}
        </aside>
      </div>

      {decision && <DecisionModal app={a} to={decision} onClose={() => setDecision(null)} onDecided={afterDecision(decision)} />}
      {flagOpen && <FlagModal app={a} onClose={() => setFlagOpen(false)} />}
      {msgOpen && <MessageModal app={a} onClose={() => setMsgOpen(false)} />}
      {requestOpen && <RequestDocumentsModal app={a} onClose={() => setRequestOpen(false)} onSent={advance} />}
      {readerOpen && (
        <Drawer open onClose={() => setReaderOpen(false)} title={t('university:v6.reader.title')} width={640}>
          <Statements app={a} />
        </Drawer>
      )}
    </div>
  );
}
