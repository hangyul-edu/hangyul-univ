/**
 * V5 visa concierge — what a counselor needs on a visa case: route, post, method, pack status (missing items),
 * appointment, submission, embassy requests, caveats. Used in the service-case drawer (VISA_SUPPORT) and the student
 * workspace Visa tab. Strings: `visaroute` namespace (staff.* keys).
 */
import { useApi } from '@hangyul/auth';
import { useLocale } from '@hangyul/i18n';
import type { VisaRoutePlan } from '@hangyul/types';
import { Button, Field, Input, QueryState, Skeleton, StatusText, Textarea, useToast } from '@hangyul/ui';
import { formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const STOP: Record<string, string> = { NO_ROUTE: 'staff.noRoute', NOT_VERIFIED: 'staff.notVerified', OTHER_RESIDENCE: 'staff.otherResidence', IN_KOREA: 'staff.inKorea' };

export function VisaRoutePanel({ studentId, compact }: { studentId: string; compact?: boolean }) {
  const { t } = useLocale(['visaroute', 'agency', 'common']);
  const api = useApi();
  const q = useQuery({ queryKey: ['agency', 'visa-route', studentId], queryFn: () => api.visaRoute.student(studentId) });
  return (
    <section className="cq-block vrp" aria-label={t('staff.title')}>
      {compact && <h3 className="cq-h">{t('staff.title')}</h3>}
      <QueryState query={q} skeleton={<Skeleton h={120} />}>{(p) => <Body plan={p} studentId={studentId} />}</QueryState>
    </section>
  );
}

function Body({ plan, studentId }: { plan: VisaRoutePlan; studentId: string }) {
  const { t, locale } = useLocale(['visaroute', 'agency', 'common']);
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [adding, setAdding] = useState(false);
  const done = (p: VisaRoutePlan) => { qc.setQueryData(['agency', 'visa-route', studentId], p); qc.invalidateQueries({ queryKey: ['agency'] }); toast.success(t('common:actions.saved')); };
  const reviewed = useMutation({ mutationFn: () => api.visaRoute.packReviewed(studentId), onSuccess: done, onError: (e) => toast.error((e as Error).message) });
  const request = useMutation({ mutationFn: () => api.visaRoute.staffRequest(studentId, { note: note.trim(), due_on: due || null }),
    onSuccess: (p) => { done(p); setAdding(false); setNote(''); setDue(''); }, onError: (e) => toast.error((e as Error).message) });
  const d = (x: string | null | undefined) => (x ? formatDate(x, locale) : t('staff.none'));
  const r = plan.route;
  const c = plan.case;
  const missing = plan.documents.filter((x) => x.applies === 'yes' && !['READY', 'NEAR_EXPIRY', 'AT_REGISTRATION', 'NOT_NEEDED'].includes(x.status));
  const post = plan.post ? t(`post.${plan.post.kind}`, { city: t(`city.${plan.post.key}`, { defaultValue: plan.post.city }) }) : null;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
      {STOP[plan.status] && <p className="hg-small"><StatusText tone="warning">{t(STOP[plan.status])}</StatusText></p>}
      {plan.status === 'NEEDS_ANSWER' && <p className="hg-small"><StatusText tone="warning">{t('staff.needsAnswer')}</StatusText></p>}
      <dl className="cq-kv">
        <div><dt>{t('staff.route')}</dt><dd>{r ? `${r.country_name} · ${r.visa_type}` : t('staff.none')}{r && <> · <a className="hg-link" href={r.primary_source ?? '#'} target="_blank" rel="noreferrer">{t(`staff.researchVal.${r.verification_status}`)}</a></>}</dd></div>
        <div><dt>{t('staff.post')}</dt><dd>{post ?? t('staff.none')}</dd></div>
        <div><dt>{t('staff.method')}</dt><dd>{plan.method?.code ? t(`method.${plan.method.code}`) : t('staff.none')}</dd></div>
        <div><dt>{t('staff.tier')}</dt><dd>{t(`staff.tierVal.${plan.inputs.university?.tier ?? 'UNKNOWN'}`)}</dd></div>
        <div><dt>{t('staff.visaStatus')}</dt><dd>{t(`status.${plan.display_status}`)}</dd></div>
        <div><dt>{t('staff.pack')}</dt><dd>{plan.pack ? t('staff.packVal', { ready: plan.pack.ready, needed: plan.pack.needed }) : t('staff.none')}{plan.pack?.reviewed_at ? ` · ${t('staff.reviewed', { date: d(plan.pack.reviewed_at) })}` : ''}</dd></div>
        <div><dt>{t('staff.appointment')}</dt><dd>{c?.appointment ? `${d(c.appointment.on)} · ${c.appointment.status ? t(`staff.apptStatus.${c.appointment.status}`, { defaultValue: '' }) : ''}${c.appointment.reference ? ` · ${c.appointment.reference}` : ''}` : t('staff.none')}</dd></div>
        <div><dt>{t('staff.submission')}</dt><dd>{c?.submission ? `${d(c.submission.on)}${c.submission.reference ? ` · ${c.submission.reference}` : ''}` : t('staff.none')}</dd></div>
        {c?.decision && <div><dt>{t('staff.decision')}</dt><dd>{t(c.decision.decision === 'APPROVED' ? 'track.decisionApproved' : 'track.decisionRefused')} · {d(c.decision.on)}</dd></div>}
      </dl>
      {missing.length > 0 && (
        <div><p className="hg-xs hg-subtle">{t('staff.missing')}</p>
          <ul className="cq-flags">{missing.map((x) => <li key={x.key}>{t(`doc.${x.key}.name`, { defaultValue: x.name_en })} — {t(`docStatus.${x.status}`)}</li>)}</ul></div>
      )}
      {plan.caveats.length > 0 && (
        <div><p className="hg-xs hg-subtle">{t('staff.caveats')}</p>
          <ul className="cq-flags">{plan.caveats.map((x) => <li key={x.code}>{t(`caveat.${x.code}`, { ...x.params })}</li>)}</ul></div>
      )}
      {c && c.requests.length > 0 && (
        <div><p className="hg-xs hg-subtle">{t('staff.requests')}</p>
          <ul className="cq-flags">{c.requests.map((x) => <li key={x.id}>{x.note} — {x.status === 'OPEN' ? t('staff.requestOpen', { date: d(x.due_on) }) : t('staff.requestSent', { date: d(x.sent_at) })}</li>)}</ul></div>
      )}
      {c && (
        <div className="hg-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {c.status === 'READY_TO_APPLY' && !plan.pack?.reviewed_at && <Button size="sm" variant="primary" loading={reviewed.isPending} onClick={() => reviewed.mutate()}>{t('staff.markReviewed')}</Button>}
          {(c.status === 'SUBMITTED' || c.status === 'ADDITIONAL_DOCUMENTS') && !adding && <Button size="sm" onClick={() => setAdding(true)}>{t('staff.recordRequest')}</Button>}
        </div>
      )}
      {adding && (
        <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); if (note.trim().length >= 3) request.mutate(); }}>
          <Field label={t('track.requestNote')} htmlFor={`vrp-n-${studentId}`}><Textarea id={`vrp-n-${studentId}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label={t('track.requestDue')} htmlFor={`vrp-d-${studentId}`}><Input id={`vrp-d-${studentId}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <div><Button size="sm" type="submit" variant="primary" loading={request.isPending} disabled={note.trim().length < 3}>{t('track.requestSave')}</Button></div>
        </form>
      )}
    </div>
  );
}
