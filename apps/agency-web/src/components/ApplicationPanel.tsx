import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import { ArrowRight, CheckCircle2, CircleAlert, Flag as FlagIcon } from '@hangyul/icons';
import type { ApplicationDetail, ApplicationStatus } from '@hangyul/types';
import { Badge, Button, Callout, Checkbox, DescriptionList, Field, Progress, QueryState, Textarea, useToast } from '@hangyul/ui';
import { daysUntil, formatDate, formatDateTime, requirementIssue } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { AgencyStrategy, AgencySubmission } from './success/SuccessPanel';
import { AppStatusBadge, DocStatusBadge, EssayStatusBadge, useT } from './bits';

/** Required checklist items that block submission (mirrors the API's 409 rule). */
export function missingRequired(app: Pick<ApplicationDetail, 'checklist'>): string[] {
  return app.checklist.filter((i) => i.required && i.status === 'MISSING').map((i) => i.label);
}

function Transition({ app }: { app: ApplicationDetail }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [to, setTo] = useState<ApplicationStatus | ''>('');
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const missing = missingRequired(app);
  const blocked = to === 'SUBMITTED' && missing.length > 0;
  const m = useMutation({
    mutationFn: () => api.applications.transition(app.id, { to: to as ApplicationStatus, note: note || undefined, external_reference: ref || undefined }),
    onSuccess: (d) => {
      qc.setQueryData(['application', app.id], d);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['agency'] });
      toast.success(t('apps.moved', { status: t(`appStatus.${d.status}`) }));
      setTo(''); setNote(''); setRef('');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!app.allowed_transitions.length) return <p className="hg-subtle hg-small">{t('apps.noTransitions')}</p>;
  return (
    <div className="hg-stack" style={{ '--hg-gap': '10px' } as React.CSSProperties}>
      <div className="ag-transition-chips" role="group" aria-label={t('apps.moveTo')}>
        {app.allowed_transitions.map((s) => (
          <button key={s} type="button" className="hg-chip" aria-pressed={to === s} onClick={() => setTo(to === s ? '' : s)}>
            <ArrowRight size={13} aria-hidden className="hg-flip-rtl" /> {t(`appStatus.${s}`)}
          </button>
        ))}
      </div>
      {to && (
        <>
          {blocked && <Callout tone="warning" title={t('apps.submitBlocked')}>{missing.join(', ')}</Callout>}
          {to === 'WITHDRAWN' && <Callout tone="danger">{t('apps.withdrawWarn')}</Callout>}
          {to === 'SUBMITTED' && (
            <Field label={t('apps.externalRef')} htmlFor={`ref-${app.id}`} optional hint={t('apps.externalRefHint')}>
              <input id={`ref-${app.id}`} className="hg-input hg-input--sm" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} />
            </Field>
          )}
          <Field label={t('apps.note')} htmlFor={`note-${app.id}`} optional hint={t('apps.noteHint')}>
            <Textarea id={`note-${app.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </Field>
          <div className="hg-row" style={{ gap: 8 }}>
            <Button variant="primary" size="sm" disabled={blocked} loading={m.isPending} onClick={() => m.mutate()}>
              {t('apps.confirmMove', { status: t(`appStatus.${to}`) })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTo('')}>{t('actions.cancel')}</Button>
          </div>
        </>
      )}
    </div>
  );
}

function FlagToggle({ app }: { app: ApplicationDetail }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState(app.flag_reason ?? '');
  const m = useMutation({
    mutationFn: (flagged: boolean) => api.applications.update(app.id, { flagged, flag_reason: flagged ? reason || null : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application', app.id] }); qc.invalidateQueries({ queryKey: ['applications'] }); toast.success(t('actions.saved')); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="hg-stack" style={{ '--hg-gap': '8px' } as React.CSSProperties}>
      <Checkbox label={t('apps.flagged')} checked={app.flagged} disabled={m.isPending} onChange={(e) => m.mutate(e.target.checked)} />
      <div className="hg-row" style={{ gap: 6 }}>
        <input className="hg-input hg-input--sm" aria-label={t('apps.flagReason')} placeholder={t('apps.flagReason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <Button size="sm" onClick={() => m.mutate(true)} disabled={!reason.trim()} icon={<FlagIcon />}>{t('apps.flag')}</Button>
      </div>
    </div>
  );
}

export function ApplicationPanel({ id, showStudent = true }: { id: string; showStudent?: boolean }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['application', id], queryFn: () => api.applications.get(id) });
  return (
    <QueryState query={q}>
      {(app) => {
        const days = daysUntil(app.intake.application_deadline);
        const ready = app.checklist.filter((c) => c.ready).length;
        return (
          <div className="hg-stack">
            <div className="ag-app-head">
              <div style={{ minWidth: 0 }}>
                <div className="hg-strong">{localName(app.university)}</div>
                <div className="hg-muted hg-small">{localName(app.program)} · {t(`degreeShort.${app.program.degree_level}`)} · {t('intakeLabel', { term: t(`term.${app.intake.term}`), year: app.intake.year })}</div>
                {showStudent && app.student && <Link to={`/students/${app.student.id}?tab=applications`} className="hg-small">{app.student.full_name}</Link>}
              </div>
              <div className="hg-stack" style={{ '--hg-gap': '6px', alignItems: 'flex-end' } as React.CSSProperties}>
                <AppStatusBadge status={app.status} />
                {app.flagged && <Badge size="sm" tone="danger" icon={<FlagIcon aria-hidden />}>{t('apps.flagged')}</Badge>}
              </div>
            </div>
            <div className="ag-readiness">
              <div className="hg-row hg-between hg-small"><span>{t('apps.readiness')}</span><strong className="hg-num">{app.readiness_percent}%</strong></div>
              <Progress value={app.readiness_percent} tone={app.readiness_percent >= 100 ? 'success' : undefined} label={t('apps.readiness')} />
              <div className="hg-subtle hg-xs">{t('apps.checklistCount', { ready, total: app.checklist.length })}</div>
            </div>
            <DescriptionList items={[
              { label: t('apps.deadline'), value: <span>{formatDate(app.intake.application_deadline, locale)} {days !== null && <Badge size="sm" tone={days < 0 ? 'danger' : days <= 14 ? 'warning' : 'neutral'}>{days < 0 ? t('time.overdue') : t('time.daysLeft', { count: days })}</Badge>}</span> },
              { label: t('apps.semester'), value: formatDate(app.intake.semester_start, locale) },
              { label: t('apps.submitted'), value: formatDateTime(app.submitted_at, locale) },
              { label: t('apps.externalRef'), value: app.external_reference },
              ...(app.interview_at ? [{ label: t('appStatus.INTERVIEW'), value: formatDateTime(app.interview_at, locale) }] : []),
              ...(app.offer_scholarship_note ? [{ label: t('apps.scholarship'), value: app.offer_scholarship_note }] : []),
              ...(app.flag_reason ? [{ label: t('apps.flagReason'), value: app.flag_reason }] : []),
            ]} />

            <AgencyStrategy app={app} />
            <AgencySubmission app={app} />

            {(
              <section className="ag-subsection" aria-label={t('apps.moveTo')}>
                <h3 className="ag-h3">{t('apps.moveTo')}</h3>
                <Transition app={app} />
              </section>
            )}

            <section className="ag-subsection">
              <h3 className="ag-h3">{t('apps.checklist')}</h3>
              {/* V27 (REPORT §357): which official guide this list comes from — or that there is none yet. */}
              {app.admission_guide?.state === 'REVIEW_REQUIRED' ? (
                <Callout tone="warning" title={t('v27.guide.missingTitle')}>{t('v27.guide.missingBody')}</Callout>
              ) : app.admission_guide?.guide && (
                <p className="ag27-guide">
                  {app.admission_guide.state === 'PREVIOUS_ROUND' ? t('v27.guide.previous') : t('v27.guide.current')}{' '}
                  {app.admission_guide.guide.source_url
                    ? <a href={app.admission_guide.guide.source_url} target="_blank" rel="noopener noreferrer">{app.admission_guide.guide.title ?? t('v27.guide.source')}</a>
                    : app.admission_guide.guide.title}
                  {app.admission_guide.guide.verified_at && ` · ${t('v27.guide.verified', { date: formatDate(app.admission_guide.guide.verified_at, locale) })}`}
                </p>
              )}
              {/* V29: staff see exactly why an intake is outside the managed-application set (brief §32). */}
              {app.managed_support && app.managed_support.state !== 'SUPPORTED' && app.admission_guide?.state !== 'REVIEW_REQUIRED' && (
                <p className="ag29-verify fs-12">{t('v29.guide.verifyRequired', {
                  fields: app.managed_support.missing.map((f) => t(`v29.guide.field.${f}`)).join(', ') })}</p>
              )}
              <ul className="hg-list ag-checklist">
                {app.checklist.map((c) => {
                  const { issue, party } = requirementIssue(c);
                  return (
                    <li key={c.requirement_id ?? c.request_id}>
                      <span className="ag-checklist__icon" data-ready={c.ready}>{c.ready ? <CheckCircle2 aria-hidden /> : <CircleAlert aria-hidden />}</span>
                      <span className="hg-grow" style={{ minWidth: 0 }}>
                        <span className="hg-small hg-strong">{locale === 'ko' && c.name_ko ? c.name_ko : c.label}</span>
                        <span className="hg-row-wrap hg-xs" style={{ '--hg-gap': '6px' } as React.CSSProperties}>
                          <span className="ag27-issue" data-party={party}>{t(`v27.issue.${issue}`)}</span>
                          {party !== 'none' && <span className="ag27-who">{t(`v27.party.${party}`)}</span>}
                          {!c.required && <span className="hg-subtle">{c.applies === null ? t('v27.ifApplies') : t('form.optional')}</span>}
                          {c.reused && <span className="hg-subtle">{t('apps.reused')}</span>}
                        </span>
                        {(c.source || c.treatment) && (
                          <details className="ag27-evidence">
                            <summary>{t('v27.evidence.open')}</summary>
                            <dl>
                              {c.treatment && <><dt>{t('v27.evidence.legal')}</dt><dd>{t(`v27.legal.${c.treatment.legalization}`)}{c.treatment.country ? ` · ${c.treatment.country}${c.treatment.country_basis === 'nationality' ? ` (${t('v27.evidence.byNationality')})` : ''}` : ''}</dd></>}
                              {c.treatment && (c.treatment.translation || c.treatment.notarization) && <><dt>{t('v27.evidence.extra')}</dt><dd>{[c.treatment.translation && t('v27.issue.TRANSLATION'), c.treatment.notarization && t('v27.issue.NOTARIZATION')].filter(Boolean).join(' · ')}</dd></>}
                              {c.original_or_copy && <><dt>{t('v27.evidence.form')}</dt><dd>{t(`v27.form.${c.original_or_copy}`)}{c.submission_method ? ` · ${t(`v27.submit.${c.submission_method}`)}` : ''}</dd></>}
                              {c.max_age_days && <><dt>{t('v27.evidence.age')}</dt><dd>{t('v27.evidence.ageDays', { count: c.max_age_days })}</dd></>}
                              {c.condition && <><dt>{t('v27.evidence.when')}</dt><dd>{c.condition}</dd></>}
                              {c.source?.evidence && <><dt>{t('v27.evidence.quote')}</dt><dd>“{c.source.evidence}”{c.source.page ? ` (${c.source.page})` : ''}</dd></>}
                              <dt>{t('v27.evidence.proof')}</dt><dd>{c.document_id ? t(`docStatus.${c.status}`, { defaultValue: c.status }) : t('v27.evidence.none')}</dd>
                            </dl>
                          </details>
                        )}
                      </span>
                      {c.document_id ? <Link to={`/documents?doc=${c.document_id}`}><DocStatusBadge status={c.status} /></Link> : <DocStatusBadge status={c.status} />}
                    </li>
                  );
                })}
              </ul>
            </section>

            {app.essays.length > 0 && (
              <section className="ag-subsection">
                <h3 className="ag-h3">{t('nav.essays')}</h3>
                <ul className="hg-list">
                  {app.essays.map((e) => (
                    <li key={e.id} className="hg-row hg-between" style={{ padding: '8px 0' }}>
                      <Link to={`/essays/${e.id}`} className="hg-small hg-truncate">{e.title}</Link>
                      <EssayStatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {<section className="ag-subsection"><h3 className="ag-h3">{t('apps.flagTitle')}</h3><FlagToggle app={app} /></section>}

            <section className="ag-subsection">
              <h3 className="ag-h3">{t('apps.history')}</h3>
              <ol className="hg-timeline">
                {[...app.history].reverse().map((h, i) => (
                  <li key={i} className={`hg-timeline__item${i === 0 ? ' hg-timeline__item--active' : ' hg-timeline__item--done'}`}>
                    <span className="hg-timeline__dot" aria-hidden />
                    <div className="hg-small"><strong>{t(`appStatus.${h.to}`)}</strong> <span className="hg-subtle">· {t(`apps.actor.${h.actor_org_type ?? 'SYSTEM'}`, { defaultValue: h.actor })}</span></div>
                    <div className="hg-subtle hg-xs">{formatDateTime(h.at, locale)}</div>
                    {h.note && <div className="hg-small ag-quote">{h.note}</div>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        );
      }}
    </QueryState>
  );
}
