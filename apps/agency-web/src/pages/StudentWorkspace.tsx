// PRIMARY QUESTION: Why is this case not moving, and who has to act next?
// V9 (REPORT §59 A3/A8/A12): the header answers why it is not moving · next action · waiting on · deadline · owner before
// any tab; meetings are one record on the timeline; the agency identity responsible for the applicant is on the case.
import { localName } from '@hangyul/i18n';
import { useAuth } from '@hangyul/auth';
import { CalendarPlus, Check, NotebookPen, ChevronRight, Reply, Ellipsis, GraduationCap, Info, Languages, Mail, MessageSquarePlus, Phone, Plus, Sparkles, Upload, UserRound, Wallet } from '@hangyul/icons';
import { PIPELINE_STAGES, VISA_STATUSES, type PipelineStage, type StudentWorkspace as WS, type Task, type VisaStatus } from '@hangyul/types';
import {
  Badge, Button, Callout, Card, DescriptionList, Drawer, EmptyState, ErrorState, Field, Popover, Progress, QueryState, Select, Skeleton, StatusText, Textarea, useToast,
} from '@hangyul/ui';
import { applicationTone, formatDate, formatDateTime, formatMoney, formatRelative } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Col, Row, YCard } from '@hangyul/ynex-ui';
import { Link, useParams, useSearchParams } from 'react-router';

import { ApplicationPanel } from '../components/ApplicationPanel';
import { VisaRoutePanel } from '../components/VisaRoutePanel';
import { CaseProgress, CaseStrip, MovementPanel } from '../components/Movement';
import { AgencyIdentityCard } from '../components/AgencyIdentity';
import { MeetingRecords, RecordMeetingModal } from '../components/Meetings';
import { AppStatusBadge, DocStatusBadge, EssayStatusBadge, Flag, Intake, SlaBadge, useT, VisaStatusBadge } from '../components/bits';
import { DocumentReviewPanel } from '../components/DocumentReviewPanel';
import { DossierPanel } from '../components/DossierPanel';
import { MessageThread, NewConversationModal } from '../components/MessageThread';
import { PortfolioTab } from '../components/success/PortfolioTab';
import { CreateTaskModal, TaskRow } from '../components/TaskBits';
import { UploadOnBehalf } from '../components/UploadOnBehalf';
import { bucketTasks, TASK_BUCKETS, taskTitle } from '../lib/logic';
import { AppointmentForm } from './Consultations';
import { StudentServices } from '../components/ServiceCases';
import { PlanScope } from '../components/Plan';
import { YAvatar } from '../components/ynex';
import { parseFocus, type Focus } from '../lib/focus';

/**
 * V22 — header, then the work, then tabs only for deep data (REPORT §249 G4, brief §54).
 *
 * V11 opened four equal tabs with a profile first. The job is: what stage is this student in, why is it stuck, what is
 * the next action and when is it due — the header strip (CaseStrip) answers that before anything else. Beneath it, the
 * two things a counsellor acts on: what needs action (documents, applications, overdue tasks) and the recent
 * conversation. Everything deeper — the full application record, the whole thread and history, the profile and plan,
 * tasks and services — sits behind one row of detail tabs that is closed until asked. Every V10/V11 `?tab=` link still
 * resolves: a section name opens the tab that holds it and scrolls there.
 */
const TABS = ['application', 'communication', 'profile', 'more'] as const;
type Tab = (typeof TABS)[number];

/** The V10 tab names, kept as the addressable sections inside the detail tabs. */
const SECTIONS = ['applications', 'documents', 'essays', 'visa', 'messages', 'history', 'portfolio', 'services', 'tasks', 'profile'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_TAB: Record<Section, Tab> = {
  applications: 'application', documents: 'application', essays: 'application', visa: 'application',
  messages: 'communication', history: 'communication',
  profile: 'profile',
  portfolio: 'more', services: 'more', tasks: 'more',
};

const sectionId = (s: Section) => `ws-${s}`;

/**
 * One addressable block inside a tab. A heading and an anchor, nothing more — the point of merging ten tabs
 * into four is that the content is *visible together*, so this must not become a second set of tabs or an
 * accordion that hides it again.
 */
function WsSection({ id, title, count, children }: { id: Section; title: string; count?: number; children: ReactNode }) {
  return (
    <section id={sectionId(id)} className="ag-wssection" aria-labelledby={`${sectionId(id)}-h`}>
      <h2 className="ag-wssection__title" id={`${sectionId(id)}-h`}>
        {title}
        {count ? <span className="ag-wssection__count">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function StageSelect({ ws }: { ws: WS }) {
  const { api } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: (stage: PipelineStage) => api.agency.setStage(ws.student.id, stage),
    onSuccess: (_r, stage) => {
      qc.invalidateQueries({ queryKey: ['agency'] });
      toast.success(t('kanban.moved', { name: ws.student.full_name, stage: t(`pipeline.${stage}`) }));
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Select compact aria-label={t('ws.stage')} value={ws.profile.pipeline_stage} disabled={m.isPending} onChange={(e) => m.mutate(e.target.value as PipelineStage)} style={{ minWidth: 180 }}>
      {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{t(`pipeline.${s}`)}</option>)}
    </Select>
  );
}

function AssignmentWhy({ a }: { a: NonNullable<WS['assignment']> }) {
  const { t } = useT();
  const total = (a.score_breakdown ?? []).reduce((s, f) => s + f.weight, 0) || 1;
  return (
    <Popover width={340} trigger={(p) => <Button size="sm" variant="ghost" icon={<Sparkles />} {...p}>{t('ws.whyAssigned')}</Button>}>
      <div style={{ padding: 12 }} className="hg-stack">
        <div>
          <div className="hg-strong hg-small">{t('ws.assignedBy', { by: t(`ws.by.${a.assigned_by}`, { defaultValue: a.assigned_by }) })}</div>
          {a.score !== null && <div className="hg-subtle hg-xs">{t('ws.score', { score: Math.round(a.score) })}</div>}
        </div>
        {(a.score_breakdown ?? []).length === 0 ? <p className="hg-subtle hg-small">{t('ws.noBreakdown')}</p> : (
          <ul className="ag-factors">
            {a.score_breakdown!.map((f) => (
              <li key={f.factor}>
                <div className="hg-row hg-between hg-xs"><span className="hg-strong">{t(`ws.factor.${f.factor}`, { defaultValue: f.factor })}</span><span className="hg-num">{f.points} / {f.weight}</span></div>
                <div className="hg-progress hg-progress--sm"><div className="hg-progress__bar" style={{ width: `${(f.points / Math.max(1, f.weight)) * 100}%` }} /></div>
                <div className="hg-subtle hg-xs">{f.note}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="hg-subtle hg-xs">{t('ws.weightsNote', { total })}</p>
      </div>
    </Popover>
  );
}

/** job-candidate-details.html header card: avatar, name, meta rows with icons, soft badges, primary + light actions, tabs strip. */
function Header({ ws, onAction, onReply }: { ws: WS; onAction: (a: 'message' | 'task' | 'call' | 'meeting') => void; /** V26: the case waits for our reply */ onReply?: () => void }) {
  const { t, locale } = useT();
  const a = ws.assignment;
  const intake = ws.profile.target_intake_year && ws.profile.target_intake_term ? `${ws.profile.target_intake_year}-${ws.profile.target_intake_term}` : null;
  const sla = a && !a.first_response_at && a.first_response_due_at;
  return (
    <header className="card custom-card ag7-wshead">
      <div className="card-body">
        <div className="d-sm-flex align-items-start gap-4 ag7-wshead__top">
          <YAvatar name={ws.student.full_name} size="xl" className="ag7-wshead__av" />
          <div className="flex-fill min-w-0">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h1 className="fs-20 fw-semibold mb-0">{ws.student.full_name}</h1>
              {sla && <SlaBadge dueAt={a.first_response_due_at} respondedAt={a.first_response_at} compact />}
            </div>
            <div className="ag7-wshead__meta">
              <span><Flag code={ws.profile.nationality} /></span>
              <span><GraduationCap aria-hidden />{ws.profile.target_degree ? t(`degreeShort.${ws.profile.target_degree}`) : '—'} · <Intake value={intake} /></span>
              <span><Mail aria-hidden /><a href={`mailto:${ws.student.email}`}>{ws.student.email}</a></span>
              {ws.student.phone && <span><Phone aria-hidden />{ws.student.phone}</span>}
            </div>
            <div className="ag7-wshead__facts">
              <span className="ag7-fact">
                <span className="text-muted">{t('v22.work.owner')}</span>
                {a?.counselor ? <span className="d-inline-flex align-items-center gap-1 fw-semibold"><YAvatar name={a.counselor.full_name} size="xs" />{a.counselor.full_name}</span>
                  : <span className="fw-semibold">{t('ws.notAssigned')}</span>}
              </span>
              {/*
                V15: the purchased-plan badge that used to sit here is gone. The case strip below now carries
                the plan as its first cell, translated, beside the four facts it belongs with — so this was
                the same fact twice, eight pixels apart, and the badge version printed the English product
                name on a Korean screen.
              */}
              <span className="ag7-fact ag7-fact--progress">
                <span className="text-muted">{t('ws.profileComplete', { pct: ws.profile_percent })}</span>
                <div className="progress progress-xs" role="presentation"><div className="progress-bar bg-primary" style={{ width: `${ws.profile_percent}%` }} /></div>
              </span>
            </div>
          </div>
          <div className="btn-list ag7-wshead__actions">
            {/* V26 (REPORT §335 A3): one primary, and it is the next action — answering the student when a reply is owed
                (the thread opens with the cursor in the reply box); otherwise a new message. "할 일" is the neutral secondary. */}
            {onReply
              ? <button type="button" className="btn btn-primary" onClick={onReply}><Reply aria-hidden className="ag7-btnicon" />{t('v26.ws.reply')}</button>
              : <button type="button" className="btn btn-primary" onClick={() => onAction('message')}><MessageSquarePlus aria-hidden className="ag7-btnicon" />{t('ws.act.message')}</button>}
            {onReply && <button type="button" className="btn btn-light" onClick={() => onAction('message')}><MessageSquarePlus aria-hidden className="ag7-btnicon" />{t('ws.act.message')}</button>}
            <button type="button" className="btn btn-light" onClick={() => onAction('task')}><Plus aria-hidden className="ag7-btnicon" />{t('ws.act.task')}</button>
            <Popover width={280} align="end" trigger={(p) => <button type="button" className="btn btn-icon btn-light ag7-iconbtn" aria-label={t('ws.more')} {...p}><Ellipsis aria-hidden /></button>}>
              {(close) => (
                <div className="hg-stack" style={{ padding: 10, '--hg-gap': '10px' } as React.CSSProperties}>
                  <button type="button" className="hg-menu-item" onClick={() => { close(); onAction('call'); }}><CalendarPlus aria-hidden /> {t('ws.act.call')}</button>
                  <button type="button" className="hg-menu-item" onClick={() => { close(); onAction('meeting'); }}><NotebookPen aria-hidden /> {t('v9.meet.recordTitle')}</button>
                  {<Field label={t('ws.stage')}><StageSelect ws={ws} /></Field>}
                  {a && <div className="hg-subtle hg-xs">{t('ws.sinceDate', { date: formatDate(a.since, locale) })}</div>}
                  {a && <AssignmentWhy a={a} />}
                </div>
              )}
            </Popover>
          </div>
        </div>
      </div>
      {/* V27: the stage first (brief §25 — 현재 단계), then why it is stopped, who acts, what next, the deadline. */}
      <div className="ag27-wshead__progress"><CaseProgress studentId={ws.student.id} statuses={ws.applications.map((x) => x.status)} /></div>
      <div className="ag9-wshead__strip"><CaseStrip studentId={ws.student.id} /></div>
    </header>
  );
}

/** A blocker points at the *section* that fixes it; the shell works out which tab that section lives in. */
interface Blocker { key: string; tone: 'danger' | 'warning' | 'info'; title: string; detail?: string; tab: Section; /** V26: the record it opens */ focus?: string }

function useBlockers(ws: WS, tasks: Task[] | undefined): Blocker[] {
  const { t, locale } = useT();
  const out: Blocker[] = [];
  const a = ws.assignment;
  const tg = ws.targets ?? {};
  if (a && !a.first_response_at && a.first_response_due_at && new Date(a.first_response_due_at) < new Date()) {
    out.push({ key: 'sla', tone: 'danger', title: t('ws.block.sla'), detail: t('ws.block.slaDetail', { when: formatRelative(a.first_response_due_at, locale) }), tab: 'messages',
      focus: tg.thread ? `thread:${tg.thread}` : undefined });
  } else if (ws.waiting_reason?.code === 'reply_owed' && tg.reply_thread) {
    // V26 (REPORT §335 A2): the case strip says "학생에게 답장하기" — this panel must not say "nothing is waiting".
    out.push({ key: 'reply', tone: 'warning', title: t('v26.ws.replyOwed'), tab: 'messages', focus: `reply:${tg.reply_thread}` });
  }
  ws.documents.filter((d) => d.status === 'NEEDS_CORRECTION' || d.status === 'EXPIRED').forEach((d) => out.push({
    key: `fix-${d.id}`, tone: 'danger', title: t(d.status === 'EXPIRED' ? 'ws.block.expired' : 'ws.block.fix', { doc: t(`docCategory.${d.category}`) }), detail: d.rejection_reason ?? undefined, tab: 'documents',
    focus: `doc:${d.id}`,
  }));
  const review = ws.documents.filter((d) => d.status === 'UPLOADED' || d.status === 'NEEDS_REVIEW');
  if (review.length) out.push({ key: 'review', tone: 'warning', title: t('ws.block.review', { count: review.length }), detail: review.map((d) => t(`docCategory.${d.category}`)).join(', '), tab: 'documents',
    focus: `doc:${review[0].id}` });
  ws.applications.filter((x) => x.status === 'ADDITIONAL_DOCUMENTS' || (x.requests?.length ?? 0) > 0).forEach((x) => out.push({
    key: `add-${x.id}`, tone: 'danger', title: t('ws.block.uniRequest', { uni: localName(x.university) }), detail: x.requests?.[0]?.label, tab: 'applications',
    focus: x.requests?.[0] ? `request:${x.requests[0].id}` : `app:${x.id}` }));
  ws.applications.filter((x) => ['DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY'].includes(x.status)).forEach((x) => {
    const days = Math.ceil((new Date(x.intake.application_deadline).getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 21) out.push({ key: `dl-${x.id}`, tone: days <= 7 ? 'danger' : 'warning', title: t('ws.block.deadline', { uni: localName(x.university), count: days }),
      detail: (x as { guide_review?: boolean }).guide_review ? t('v27.guide.missingTitle') : x.items_remaining != null ? t('ws.itemsRemain', { count: x.items_remaining }) : undefined, tab: 'applications', focus: `app:${x.id}` });
  });
  (tasks ?? []).filter((x) => x.overdue).forEach((x) => out.push({ key: `task-${x.id}`, tone: 'danger', title: t('ws.block.overdue', { title: taskTitle(t, x) }), detail: formatRelative(x.due_at, locale), tab: 'tasks', focus: `task:${x.id}` }));
  return out;
}

/**
 * The one sentence a counselor needs before promising anything about an application (V15, brief Part 10).
 *
 * **Never a score.** Not 92점, not 87% 합격확률, not an "AI Admission Score". A number over this is both
 * unactionable and a prediction the business plan refuses to make (§8 합격 비보장). A state plus its named
 * blockers is a task list: "성적증명서 번역본 필요" is something a person can go and do.
 *
 * It replaces the item *count* this row used to carry. "3 items remain" said how much was left but not
 * whether the application could go, which is the question.
 */
function ReadinessText({ a }: { a: WS['applications'][number] }) {
  const { t, locale } = useT();
  const r = a.readiness;
  if (!r) {
    if ((a as { guide_review?: boolean }).guide_review) return <span className="ag-remain">{t('v27.guide.missingTitle')}</span>;
    if (a.items_remaining == null) return a.waiting_on ? <span className="ag-remain">{t(`v9.waiting.on.${a.waiting_on}`)}</span> : null;
    return <span className="ag-remain">{t('ws.itemsRemain', { count: a.items_remaining })}</span>;
  }
  const blocking = r.blockers.filter((b) => b.severity === 'BLOCKING');
  const label = r.state === 'CHECKS_REQUIRED' || (r.state === 'WAITING_STUDENT' && blocking.length)
    ? t(`v15.readiness.${r.state === 'CHECKS_REQUIRED' ? 'CHECKS_REQUIRED' : 'WAITING_STUDENT'}`, { count: blocking.length })
    : t(`v15.readiness.${r.state}`);
  return (
    <span className="ag15-ready" data-state={r.state}>
      <span className="ag15-ready__state">{label}</span>
      {/* The blockers themselves, named, up to two inline — the rest are in the application section. A
          counselor scanning the overview should see *what* is wrong, not just that something is. */}
      {blocking.slice(0, 2).map((b, i) => (
        <span key={`${b.key}-${i}`} className="ag15-ready__b">{t(`v15.readiness.blocker.${b.key}`, { detail: (locale === 'ko' && (b as { detail_ko?: string | null }).detail_ko) || b.detail || '', defaultValue: b.detail ?? '' })}</span>
      ))}
      {blocking.length > 2 && <span className="ag15-ready__more">+{blocking.length - 2}</span>}
    </span>
  );
}


/** What is waiting on us for this student — documents, applications, overdue tasks — each opening the section that fixes it. */
function NeedsAction({ ws, tasks, go, open }: { ws: WS; tasks: Task[] | undefined; go: (section: Section) => void; open: (focus: string) => void }) {
  const { t, locale } = useT();
  const blockers = useBlockers(ws, tasks);
  const review = ws.documents.filter((d) => d.status === 'UPLOADED' || d.status === 'NEEDS_REVIEW').length;
  const fix = ws.documents.filter((d) => d.status === 'NEEDS_CORRECTION' || d.status === 'EXPIRED').length;
  return (
    <YCard as="section" title={t('v22.ws.needsAction')} count={blockers.length || undefined} flush className="ag22-needs"
      tools={<span className="hg-subtle hg-xs">{[review ? t('v22.ws.docReview', { count: review }) : null, fix ? t('v22.ws.docFix', { count: fix }) : null].filter(Boolean).join(' · ')}</span>}>
      {blockers.length === 0 ? <p className="text-muted p-3 mb-0">{t('v22.ws.needsActionEmpty')}</p> : (
        <ul className="list-unstyled mb-0 ag7-list">
          {blockers.map((b) => (
            <li key={b.key}>
              <button type="button" className="ag7-listrow ag22-needs__row" data-tone={b.tone} onClick={() => (b.focus ? open(b.focus) : go(b.tab))}>
                <span className="ag22-needs__dot" aria-hidden />
                <span className="flex-fill min-w-0">
                  <span className="d-block fw-semibold">{b.title}</span>
                  {b.detail && <span data-user-content className="d-block fs-12 text-muted text-truncate">{b.detail}</span>}
                </span>
                <ChevronRight size={16} aria-hidden className="hg-flip-rtl hg-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {ws.applications.length > 0 && (
        <div className="ag22-needs__apps">
          <div className="ag22-needs__h">{t('v22.ws.appsTitle')} <span className="hg-subtle">{ws.applications.length}</span><button type="button" className="btn btn-sm btn-link p-0 ms-auto" onClick={() => go('applications')}>{t('v22.ws.seeAll')}</button></div>
          <ul className="list-unstyled mb-0 ag7-list">
            {ws.applications.slice(0, 3).map((x) => (
              <li key={x.id}>
                <button type="button" className="ag7-listrow" onClick={() => open(`app:${x.id}`)}>
                  <span className="flex-fill min-w-0">
                    <span className="d-block fw-semibold text-truncate">{localName(x.university)}</span>
                    <span className="d-block fs-12 text-muted text-truncate">{localName(x.program)} · {t('apps.deadline')} {formatDate(x.intake.application_deadline, locale)}</span>
                    <ReadinessText a={x} />
                  </span>
                  <StatusText tone={applicationTone[x.status] ?? 'neutral'}>{t(`appStatus.${x.status}`)}</StatusText>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </YCard>
  );
}

/** The latest thread with this student, reply-able in place; the whole history is one tab away. */
function RecentConversation({ ws, go, onNew }: { ws: WS; go: (section: Section) => void; onNew: () => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const q = useQuery({ queryKey: ['conversations', { student_id: ws.student.id }], queryFn: () => api.messages.conversations(ws.student.id) });
  const latest = q.data?.[0];
  return (
    <YCard as="section" title={t('v22.ws.conversation')} className="ag22-conv" flush
      tools={latest ? <button type="button" className="btn btn-sm btn-link p-0" onClick={() => go('messages')}>{t('v22.ws.openThread')}</button> : null}>
      {q.isLoading ? <div className="p-3"><Skeleton h={160} /></div> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : !latest ? <div className="p-3"><EmptyState compact title={t('v22.ws.noConversation')} action={<Button size="sm" onClick={onNew}>{t('inbox.new')}</Button>} /></div>
          : <div className="ag22-conv__thread"><MessageThread key={latest.id} id={latest.id} /></div>}
    </YCard>
  );
}

/** Deep data: the profile, the plan, the agency identity, and the reasons/next steps list. */
function ProfilePanel({ ws }: { ws: WS }) {
  const { t, locale } = useT();
  const p = ws.profile;
  const yesNo = (v: boolean | null) => (v === null ? '—' : v ? t('misc.yes') : t('misc.no'));
  return (
    <Row>
      <Col xl={7}>
        <MovementPanel studentId={ws.student.id} name={ws.student.preferred_name || ws.student.full_name} extra={[]} />
        <YCard title={t('ws.profileTitle')} className="ag7-profile">
          <section className="ag7-psec">
            <h3 className="ag7-psec__title"><span className="avatar avatar-sm avatar-rounded bg-primary-transparent" aria-hidden><GraduationCap /></span>{t('ws.education')}</h3>
            {p.educations.length === 0 ? <p className="text-muted fs-12 mb-0">{t('ws.noEducation')}</p> : p.educations.map((e) => (
              <div key={e.id} className="ag7-psec__item">
                <div className="fw-semibold">{e.institution}</div>
                <div className="text-muted fs-12">{t(`ws.level.${e.level}`, { defaultValue: e.level })} · {e.major ?? '—'} · {e.graduation_year ?? '—'}</div>
                <div className="fs-12">{t('ws.gpa')}: <span className="hg-num fw-semibold">{e.gpa_value ?? '—'}{e.gpa_scale_max ? ` / ${e.gpa_scale_max}` : ''}</span>{e.gpa_percent !== null && <span className="text-muted"> · {t('ws.gpaNorm', { pct: Math.round(e.gpa_percent) })}</span>}</div>
              </div>
            ))}
          </section>
          <section className="ag7-psec">
            <h3 className="ag7-psec__title"><span className="avatar avatar-sm avatar-rounded bg-secondary-transparent" aria-hidden><Languages /></span>{t('ws.languages')}</h3>
            {p.languages.length === 0 ? <p className="text-muted fs-12 mb-0">{t('ws.noLanguages')}</p> : (
              <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                {p.languages.map((l) => (
                  <li key={l.id}>
                    <span className="fw-semibold">{l.test.replace('_', ' ')} {l.score}</span>
                    <span className="text-muted fs-12"> · {l.verified ? t('docStatus.VERIFIED') : l.is_planned ? t('ws.planned') : t('ws.selfReported')}{l.expires_on ? ` · ${t('ws.expires', { date: formatDate(l.expires_on, locale) })}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ag7-psec">
            <h3 className="ag7-psec__title"><span className="avatar avatar-sm avatar-rounded bg-success-transparent" aria-hidden><Wallet /></span>{t('ws.preferences')}</h3>
            <DescriptionList items={[
              { label: t('ws.fields'), value: p.desired_fields.length ? p.desired_fields.map((f) => t(`field.${f}`, { defaultValue: f })).join(', ') : '—' },
              { label: t('ws.regions'), value: p.preferred_regions.length ? p.preferred_regions.map((r) => t(`region.${r}`, { defaultValue: r })).join(', ') : '—' },
              { label: t('ws.budget'), value: p.annual_budget_krw ? formatMoney(p.annual_budget_krw, 'KRW', locale) : '—' },
              { label: t('ws.scholarship'), value: yesNo(p.needs_scholarship) },
              { label: t('ws.sponsor'), value: p.financial_sponsor ? t(`ws.sponsorKind.${p.financial_sponsor}`, { defaultValue: p.financial_sponsor }) : '—' },
            ]} />
          </section>
          <section className="ag7-psec">
            <h3 className="ag7-psec__title"><span className="avatar avatar-sm avatar-rounded bg-warning-transparent" aria-hidden><UserRound /></span>{t('ws.identity')}</h3>
            <DescriptionList items={[
              { label: t('ws.residence'), value: <Flag code={p.residence_country} /> },
              { label: t('ws.dob'), value: formatDate(p.date_of_birth, locale) },
              { label: t('ws.passport'), value: p.passport_number_masked ? <span className="hg-num" title={t('ws.maskedHint')}>{p.passport_number_masked}</span> : yesNo(p.has_passport) },
              { label: t('ws.passportExpiry'), value: formatDate(p.passport_expiry, locale) },
              { label: t('ws.visaHistory'), value: p.current_korean_visa ?? p.previous_korean_visa },
            ]} />
          </section>
        </YCard>
      </Col>
      <Col xl={5}>
        <AgencyIdentityCard studentId={ws.student.id} identity={ws.agency_identity} />
        <YCard title={t('v9.meet.title')}><MeetingRecords studentId={ws.student.id} limit={2} /></YCard>
      </Col>
    </Row>
  );
}

/** timeline.html / profile.html activity: actor avatar on a dashed rail, action in bold, detail and time. */
function ActivityTimeline({ studentId, limit }: { studentId: string; limit?: number }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['audit', { subject_id: studentId }], queryFn: () => api.admin.audit({ subject_id: studentId, page_size: 50 }) });
  return (
    <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<p className="text-muted mb-0">{t('ws.noActivity')}</p>}>
      {(d) => (
        <ol className="list-unstyled mb-0 ag7-tl">
          {d.items.slice(0, limit ?? d.items.length).map((a) => {
            const detail = a.detail && Object.keys(a.detail).length ? Object.entries(a.detail).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ') : '';
            return (
              <li key={a.id} className="ag7-tl__item">
                <YAvatar name={a.actor || '?'} size="sm" className="ag7-tl__av" />
                <div className="min-w-0 flex-fill">
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <span><span className="fw-semibold">{t(`audit.action.${a.action}`, { defaultValue: a.action })}</span> <span className="text-muted">· {a.actor}</span></span>
                    <time className="fs-12 text-muted text-nowrap" dateTime={a.at}>{formatDateTime(a.at, locale)}</time>
                  </div>
                  {detail && <div className="fs-12 text-muted ag7-tl__detail">{detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </QueryState>
  );
}

function ApplicationsTab({ ws, focus }: { ws: WS; focus: Focus | null }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (!ws.applications.length) return <EmptyState title={t('ws.noApps')} text={t('ws.noAppsText')} />;
  const focusedApp = focus?.kind === 'app' ? focus.id : focus?.kind === 'request' ? ws.applications.find((a) => a.requests?.some((r) => r.id === focus.id))?.id : null;
  return (
    <>
      <ul className="ag-cards">
        {ws.applications.map((a) => (
          <li key={a.id} className="ag26-focusable" data-focus={focusedApp === a.id && focus?.kind === 'app' ? 'true' : undefined}>
            <button type="button" className="ag-rowbtn" onClick={() => setOpen(a.id)}>
              <span className="hg-grow" style={{ minWidth: 0 }}>
                <span className="hg-strong hg-small hg-truncate" style={{ display: 'block' }}>{localName(a.university)}</span>
                <span className="hg-subtle hg-xs hg-truncate" style={{ display: 'block' }}>{localName(a.program)} · {t('intakeLabel', { term: t(`term.${a.intake.term}`), year: a.intake.year })} · {t('apps.deadline')} {formatDate(a.intake.application_deadline, locale)}</span>
              </span>
              <ReadinessText a={a} />
              <AppStatusBadge status={a.status} />
              <ChevronRight size={16} aria-hidden className="hg-flip-rtl hg-subtle" />
            </button>
            {/* V26 (REPORT §335): the university's request, in its own words, on the application it belongs to. Before V26
                the console never showed it — "대학 요청" led to a page where the request could not be found. */}
            {(a.requests?.length ?? 0) > 0 && (
              <ul className="ag26-reqs" aria-label={t('v26.ws.requests')}>
                {a.requests!.map((r) => (
                  <li key={r.id} className="ag26-req ag26-focusable" data-focus={focus?.kind === 'request' && focus.id === r.id ? 'true' : undefined}>
                    <span className="ag26-req__label">{t('v26.ws.requestFrom', { university: localName(a.university), label: r.category ? t(`docCategory.${r.category}`) : r.label })}</span>
                    {r.note && <q className="ag26-req__note" data-user-content>{r.note}</q>}
                    <span className="ag26-req__meta hg-subtle">{t('v26.ws.requestedOn', { date: formatDate(r.requested_at, locale) })}{r.due_date ? ` · ${t('time.due', { date: formatDate(r.due_date, locale) })}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={t('apps.detail')} width={620}>{open && <ApplicationPanel id={open} showStudent={false} />}</Drawer>
    </>
  );
}

function DocumentsTab({ ws, focus }: { ws: WS; focus: Focus | null }) {
  const { t, locale } = useT();
  // V26: arriving on a document (`focus=doc:`) opens it in the reviewer straight away.
  const [open, setOpen] = useState<string | null>(focus?.kind === 'doc' && ws.documents.some((d) => d.id === focus.id) ? focus.id : null);
  const qc = useQueryClient();
  const [upload, setUpload] = useState(false);
  const uploadBtn = <Button size="sm" icon={<Upload />} onClick={() => setUpload(true)}>{t('docs.uploadForName', { name: ws.student.full_name })}</Button>;
  const uploadModal = <UploadOnBehalf open={upload} onClose={() => setUpload(false)} student={{ id: ws.student.id, full_name: ws.student.full_name }}
    onDone={(d) => { qc.invalidateQueries({ queryKey: ['agency', 'student'] }); setOpen(d.id); }} />;
  if (!ws.documents.length) return <><EmptyState title={t('ws.noDocs')} action={uploadBtn} />{uploadModal}</>;
  const order = { NEEDS_REVIEW: 0, UPLOADED: 1, NEEDS_CORRECTION: 2, EXPIRED: 3, PROCESSING: 4, MISSING: 5, VERIFIED: 6 } as Record<string, number>;
  const docs = [...ws.documents].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  return (
    <>
      <div className="ag-tabhead"><span className="hg-small hg-muted">{t('ws.docsHint')}</span>{uploadBtn}</div>
      <DossierPanel studentId={ws.student.id} />
      {uploadModal}
      <ul className="ag-cards">
        {docs.map((d) => (
          <li key={d.id} className="ag26-focusable" data-focus={focus?.kind === 'doc' && focus.id === d.id ? 'true' : undefined}>
            <button type="button" className="ag-rowbtn" onClick={() => setOpen(d.id)}>
              <span className="hg-grow" style={{ minWidth: 0 }}>
                <span className="hg-strong hg-small">{t(`docCategory.${d.category}`)}</span>
                <span className="hg-subtle hg-xs" style={{ display: 'block' }}>
                  {d.title} · v{d.current_version} · {formatRelative(d.updated_at, locale)}
                  {d.legalization_path !== 'NONE' && ` · ${t(`legalization.${d.legalization_path}`)} (${t(`legalization.status.${d.legalization_status}`)})`}
                </span>
                {d.rejection_reason && <span data-user-content className="hg-xs" style={{ display: 'block', color: 'var(--hg-status-danger-fg)' }}>{d.rejection_reason}</span>}
              </span>
              <DocStatusBadge status={d.status} />
              <ChevronRight size={16} aria-hidden className="hg-flip-rtl hg-subtle" />
            </button>
          </li>
        ))}
      </ul>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={t('docs.reviewer')} width={960}>{open && <DocumentReviewPanel id={open} />}</Drawer>
    </>
  );
}

function EssaysTab({ ws }: { ws: WS }) {
  const { t, locale } = useT();
  if (!ws.essays.length) return <EmptyState title={t('ws.noEssays')} />;
  return (
    <ul className="ag-cards">
      {ws.essays.map((e) => (
        <li key={e.id}>
          <Link to={`/essays/${e.id}`} className="ag-rowbtn">
            <span className="hg-grow" style={{ minWidth: 0 }}>
              <span className="hg-strong hg-small hg-truncate" style={{ display: 'block' }}>{e.title}</span>
              <span className="hg-subtle hg-xs">{t(`essayType.${e.essay_type}`)}{e.due_date ? ` · ${t('time.due', { date: formatDate(e.due_date, locale) })}` : ''}</span>
            </span>
            <EssayStatusBadge status={e.status} />
            <ChevronRight size={16} aria-hidden className="hg-flip-rtl hg-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TasksTab({ ws, focus }: { ws: WS; focus: Focus | null }) {
  const { api } = useAuth();
  const { t } = useT();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['tasks', { scope: 'team', student_id: ws.student.id }], queryFn: () => api.tasks.list({ scope: 'team', student_id: ws.student.id, page_size: 100 }) });
  const groups = bucketTasks(q.data?.items ?? []);
  return (
    <div className="hg-stack">
      <div className="hg-row hg-between">
        <p className="hg-subtle hg-small">{t('ws.tasksHint')}</p>
        <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>{t('tasksPage.new')}</Button>
      </div>
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState compact title={t('tasksPage.empty')} />}>
        {() => (
          <Card>
            {TASK_BUCKETS.filter((b) => groups[b].length).map((b) => (
              <section key={b} className="ag-task-group" data-bucket={b}>
                <h3 className="ag-task-group__head"><span>{t(`tasksPage.bucket.${b}`)}</span><Badge size="sm">{groups[b].length}</Badge></h3>
                <ul className="ag-tasklist">{groups[b].map((x) => (
                  focus?.kind === 'task' && focus.id === x.id
                    ? <div key={x.id} className="ag26-focusable" data-focus="true"><TaskRow task={x} showStudent={false} /></div>
                    : <TaskRow key={x.id} task={x} showStudent={false} />
                ))}</ul>
              </section>
            ))}
          </Card>
        )}
      </QueryState>
      <CreateTaskModal open={creating} onClose={() => setCreating(false)} student={{ id: ws.student.id, full_name: ws.student.full_name }} />
    </div>
  );
}

function MessagesTab({ ws, focus }: { ws: WS; focus: Focus | null }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const q = useQuery({ queryKey: ['conversations', { student_id: ws.student.id }], queryFn: () => api.messages.conversations(ws.student.id) });
  // V26: `focus=thread:` / `focus=reply:` opens that conversation (a reply also puts the cursor in the reply box).
  const wantedThread = focus && (focus.kind === 'thread' || focus.kind === 'reply') ? focus.id : null;
  const [sel, setSel] = useState<string | null>(wantedThread);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (!sel && q.data?.length) setSel(q.data[0].id); }, [q.data, sel]);
  return (
    <div className="hg-stack">
      <div className="hg-row hg-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="hg-row-wrap">
          {(q.data ?? []).map((c) => (
            <button key={c.id} type="button" className="hg-chip" aria-pressed={sel === c.id} onClick={() => setSel(c.id)}>
              {c.subject}{c.unread ? ` · ${c.unread}` : ''}<span className="hg-subtle hg-xs"> {formatRelative(c.last_message_at, locale)}</span>
            </button>
          ))}
        </div>
        <Button size="sm" icon={<MessageSquarePlus />} onClick={() => setCreating(true)}>{t('inbox.new')}</Button>
      </div>
      {q.isLoading ? <Skeleton h={240} r={12} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : !q.data?.length ? <EmptyState title={t('ws.noConversations')} action={<Button size="sm" onClick={() => setCreating(true)}>{t('inbox.new')}</Button>} />
          : sel && <Card className="ag-thread-card ag26-focusable" data-focus={wantedThread === sel ? 'true' : undefined}><MessageThread key={sel} id={sel} focusComposer={focus?.kind === 'reply' && wantedThread === sel} /></Card>}
      <NewConversationModal open={creating} onClose={() => setCreating(false)} student={{ id: ws.student.id, full_name: ws.student.full_name }} />
    </div>
  );
}

function VisaCaseCard({ id }: { id: string }) {
  const { api } = useAuth();
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['visa', id], queryFn: () => api.visa.get(id) });
  const [notes, setNotes] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.visa.update(id, body),
    onSuccess: (v) => { qc.setQueryData(['visa', id], v); qc.invalidateQueries({ queryKey: ['agency', 'student'] }); toast.success(t('actions.saved')); setNotes(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <QueryState query={q}>
      {(v) => {
        const done = v.checklist.filter((c) => c.done).map((c) => c.key);
        return (
          <Card pad className="hg-stack">
            <div className="hg-row hg-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 className="hg-title-sm">{t('ws.visaType', { type: v.visa_type })} {v.university && <span className="hg-subtle hg-small">· {v.university}</span>}</h3>
                {v.visa_type_reason && <p className="hg-subtle hg-xs">{v.visa_type_reason}</p>}
              </div>
              <div className="hg-row" style={{ gap: 8 }}>
                <VisaStatusBadge status={v.status} />
                {(
                  <Select compact aria-label={t('ws.visaStatus')} value={v.status} disabled={m.isPending} onChange={(e) => m.mutate({ status: e.target.value as VisaStatus })}>
                    {VISA_STATUSES.map((s) => <option key={s} value={s}>{t(`visaStatus.${s}`)}</option>)}
                  </Select>
                )}
              </div>
            </div>
            <div className="ag-mini-progress"><Progress value={v.progress} tone="success" label={t('ws.visaProgress')} /><span className="hg-num hg-xs">{v.progress}%</span></div>
            {v.blockers.length > 0 && <Callout tone="warning" title={t('ws.blockers')}>{v.blockers.join(' · ')}</Callout>}
            <ul className="hg-list">
              {v.checklist.map((c) => (
                <li key={c.key} className="hg-check-item" data-done={c.done} data-blocked={c.blocked}>
                  <button type="button" className="hg-check-item__box" role="checkbox" aria-checked={c.done} aria-label={c.title} disabled={m.isPending || (c.blocked && !c.done)}
                    onClick={() => m.mutate({ completed_steps: c.done ? done.filter((k) => k !== c.key) : [...done, c.key] })}>
                    {c.done && <Check aria-hidden />}
                  </button>
                  <span className="hg-grow">
                    <span className="hg-small hg-strong">{c.title}</span>{!c.required && <span className="hg-subtle hg-xs"> ({t('form.optional')})</span>}
                    {c.detail && <span className="hg-subtle hg-xs" style={{ display: 'block' }}>{c.detail}</span>}
                    {c.blocked && <span className="hg-xs" style={{ display: 'block', color: 'var(--hg-status-warning-fg)' }}>{t('ws.blockedBy', { deps: c.depends_on.join(', ') })}</span>}
                  </span>
                  {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer noopener" className="hg-xs">{t('freshness.source')}</a>}
                </li>
              ))}
            </ul>
            <DescriptionList items={[
              { label: t('ws.consulate'), value: v.consulate },
              { label: t('ws.targetEntry'), value: formatDate(v.target_entry_date, locale) },
              { label: t('ws.visaSubmitted'), value: formatDate(v.submitted_on, locale) },
              { label: t('ws.visaIssued'), value: formatDate(v.issued_on, locale) },
            ]} />
            {(
              <Field label={t('ws.visaNotes')} htmlFor={`vn-${id}`}>
                <Textarea id={`vn-${id}`} rows={2} value={notes ?? v.notes ?? ''} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
              </Field>
            )}
            {notes !== null && <div><Button size="sm" variant="primary" loading={m.isPending} onClick={() => m.mutate({ notes })}>{t('actions.save')}</Button></div>}
            <p className="hg-subtle hg-xs"><Info size={12} aria-hidden style={{ display: 'inline' }} /> {v.disclaimer}</p>
          </Card>
        );
      }}
    </QueryState>
  );
}

function AppointmentsTab({ ws }: { ws: WS }) {
  const { t, locale } = useT();
  const [creating, setCreating] = useState(false);
  const now = Date.now();
  return (
    <div className="hg-stack">
      <div className="hg-row hg-between">
        <p className="hg-subtle hg-small">{t('ws.apptHint')}</p>
        <Button size="sm" variant="primary" icon={<CalendarPlus />} onClick={() => setCreating(true)}>{t('consult.new')}</Button>
      </div>
      {ws.appointments.length === 0 ? <EmptyState compact title={t('consult.empty')} /> : (
        <ul className="ag-cards">
          {ws.appointments.map((a) => (
            <li key={a.id} className="ag-rowbtn" data-past={new Date(a.starts_at).getTime() < now}>
              <span className="hg-grow"><span className="hg-strong hg-small">{formatDateTime(a.starts_at, locale)}</span><span className="hg-subtle hg-xs" style={{ display: 'block' }}>{t(`consult.kind.${a.kind}`, { defaultValue: a.kind })} · {t(`consult.channel.${a.channel}`, { defaultValue: a.channel })}</span></span>
              <Badge size="sm" tone={a.status === 'SCHEDULED' ? 'info' : 'neutral'}>{t(`consult.status.${a.status}`, { defaultValue: a.status })}</Badge>
            </li>
          ))}
        </ul>
      )}
      <AppointmentForm open={creating} onClose={() => setCreating(false)} student={{ id: ws.student.id, full_name: ws.student.full_name }} />
    </div>
  );
}

function HistoryTab({ ws, onCloseMeeting }: { ws: WS; onCloseMeeting: (id: string) => void }) {
  const { t } = useT();
  return (
    <div className="hg-stack" style={{ '--hg-gap': '28px' } as React.CSSProperties}>
      <YCard title={t('v9.meet.title')}><MeetingRecords studentId={ws.student.id} onClose={onCloseMeeting} /></YCard>
      <AppointmentsTab ws={ws} /><ActivityTab ws={ws} />
    </div>
  );
}

function ActivityTab({ ws }: { ws: WS }) {
  const { t } = useT();
  return (
    <YCard title={t('v7.ws.recent')} footer={<p className="text-muted fs-12 mb-0">{t('ws.activityNote')}</p>}>
      <ActivityTimeline studentId={ws.student.id} />
    </YCard>
  );
}

export default function StudentWorkspace() {
  const { id = '' } = useParams();
  const { api } = useAuth();
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  // `?tab=` may name one of the detail tabs or — from an older link — one of the sections inside them. No tab = the work view.
  const asked = sp.get('tab') ?? '';
  // V26 (REPORT §341): `?focus=<kind>:<id>` names the exact record a queue row or "처리 필요" item is about. It opens the
  // tab that holds it; the record itself is scrolled to, highlighted, and — for a reply — the cursor is put in the reply box.
  const focus = parseFocus(sp.get('focus'));
  const FOCUS_TAB: Record<Focus['kind'], Tab> = { request: 'application', app: 'application', doc: 'application', essay: 'application', reply: 'communication', thread: 'communication', task: 'more', compose: 'communication' };
  const tab: Tab | null = TABS.includes(asked as Tab) ? (asked as Tab)
    : SECTIONS.includes(asked as Section) ? SECTION_TAB[asked as Section]
      : focus ? FOCUS_TAB[focus.kind]
        : null;
  const wanted = SECTIONS.includes(asked as Section) ? (asked as Section) : null;
  const q = useQuery({ queryKey: ['agency', 'student', id], queryFn: () => api.agency.student(id) });
  const tasks = useQuery({ queryKey: ['tasks', { scope: 'team', student_id: id }], queryFn: () => api.tasks.list({ scope: 'team', student_id: id, page_size: 100 }) });
  // `focus=compose:` (a silent student with no thread yet) opens the new-conversation dialog straight away.
  const [action, setAction] = useState<null | 'message' | 'task' | 'call' | 'meeting'>(focus?.kind === 'compose' ? 'message' : null);
  const [closing, setClosing] = useState<string | null>(null);
  const setTab = (v: Tab | null) => setSp((p) => { const n = new URLSearchParams(p); if (!v) n.delete('tab'); else n.set('tab', v); return n; }, { replace: true });
  /** "Needs action" rows and "see all" name a section; open its tab and land on it. */
  const goSection = (v: Section) => setSp((p) => { const n = new URLSearchParams(p); n.set('tab', v); n.delete('focus'); return n; }, { replace: true });
  /** A record (V26): open the tab that holds it and land on the record itself. */
  const openFocus = (f: string) => setSp((p) => { const n = new URLSearchParams(p); n.delete('tab'); n.set('focus', f); return n; }, { replace: true });

  // A section asked for by name is scrolled to once its tab has rendered (instant, not smooth: arriving on a URL
  // should put you where you asked to be).
  useEffect(() => {
    if (!wanted) return;
    const el = document.getElementById(sectionId(wanted));
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [wanted, tab]);
  // The focused record is marked `data-focus` by whichever tab renders it. Cards above it (the conversation, readiness)
  // load after it and push it down, so land on it and keep it centred until the layout has been still for a moment —
  // and stop the moment the reader scrolls or types, so the page never fights them.
  const focusKey = focus ? `${focus.kind}:${focus.id}` : null;
  useEffect(() => {
    if (!focusKey) return;
    let tries = 0; let still = 0; let lastTop: number | null = null; let stopped = false;
    const stop = () => { stopped = true; };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    window.addEventListener('keydown', stop, { once: true });
    const h = window.setInterval(() => {
      tries += 1;
      const el = document.querySelector<HTMLElement>('[data-focus="true"]');
      if (stopped || tries > 60) { window.clearInterval(h); return; }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.top <= window.innerHeight * 0.6;
      if (!inView) { el.scrollIntoView({ behavior: 'auto', block: r.height > window.innerHeight * 0.8 ? 'start' : 'center' }); still = 0; }
      else if (lastTop !== null && Math.abs(lastTop - r.top) < 1) still += 1;
      lastTop = el.getBoundingClientRect().top;
      if (still >= 4) window.clearInterval(h);
    }, 100);
    return () => { window.clearInterval(h); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop); };
  }, [focusKey, q.data]);

  return (
    <div className="ag7 ag-ws ag7-ws ag22-ws">
      <nav className="ag7-crumbs" aria-label={t('misc.breadcrumb')}>
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item"><Link to="/students">{t('v22.nav.students')}</Link></li>
          {q.data && <li className="breadcrumb-item active" aria-current="page">{q.data.student.full_name}</li>}
        </ol>
      </nav>
      <QueryState query={q} skeleton={<><Skeleton h={160} /><Skeleton h={300} /></>}>
        {(ws) => {
          const openTasks = (tasks.data?.items ?? []).filter((x) => x.status !== 'DONE' && x.status !== 'CANCELLED');
          const needsDocs = ws.documents.filter((d) => ['NEEDS_REVIEW', 'UPLOADED', 'NEEDS_CORRECTION', 'EXPIRED'].includes(d.status)).length;
          const showVisa = wanted === 'visa'
            || ws.visa_cases.length > 0
            || ws.applications.some((a) => ['OFFERED', 'OFFER_ACCEPTED', 'TUITION_PAID', 'ENROLLED'].includes(a.status));
          const student = { id: ws.student.id, full_name: ws.student.full_name };
          const tabDefs: { id: Tab; label: string; count?: number }[] = [
            { id: 'application', label: t('v22.ws.tab.application'), count: needsDocs || undefined },
            { id: 'communication', label: t('v22.ws.tab.communication') },
            { id: 'profile', label: t('v22.ws.tab.profile') },
            { id: 'more', label: t('v22.ws.tab.more'), count: openTasks.length || undefined },
          ];
          return (
            <>
              <Header ws={ws} onAction={setAction} onReply={ws.targets?.reply_thread && ws.waiting_reason?.code === 'reply_owed' ? () => openFocus(`reply:${ws.targets!.reply_thread}`) : undefined} />
              {/* The work: what waits on us, and what we last said to each other. Always visible, no tab. */}
              <div className="ag22-ws__work">
                <div className="ag29-ws__left">
                  <NeedsAction ws={ws} tasks={tasks.data ? openTasks : undefined} go={goSection} open={openFocus} />
                  {/* V29 (brief §20): plan · service term · used/included · add-ons, and "추가 서비스 제안" — on the first view, so
                      nobody has to remember the plan rules or open a tab to find them. */}
                  <YCard title={t('v15.scope.title')} className="ag15-scopecard"><PlanScope plan={ws.plan} studentId={ws.student.id} /></YCard>
                </div>
                <RecentConversation ws={ws} go={goSection} onNew={() => setAction('message')} />
              </div>
              {/* Deep data, behind one row of tabs that is closed until asked. */}
              <section className="ag22-details" aria-labelledby="ag22-details-h">
                <div className="ag22-details__bar">
                  <h2 className="ag22-details__h" id="ag22-details-h">{t('v22.ws.details')} <span className="hg-subtle fw-normal fs-12">{t('v22.ws.detailsHint')}</span></h2>
                  <div className="ag22-details__tabs" role="tablist" aria-label={t('v22.ws.details')}>
                    {tabDefs.map((x) => (
                      <button key={x.id} type="button" role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} className="ag22-details__tab" onClick={() => setTab(tab === x.id ? null : x.id)}>
                        {x.label}{x.count ? <span className="ag22-details__n">{x.count}</span> : null}
                      </button>
                    ))}
                    {tab && <button type="button" className="btn btn-sm btn-link ag22-details__hide" onClick={() => setTab(null)}>{t('v22.ws.hideDetails')}</button>}
                  </div>
                </div>
                {tab && (
                  <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="ag7-tabpanel ag22-details__panel">
                    {tab === 'application' && (
                      <div className="hg-stack ag-wsgroup">
                        <WsSection id="applications" title={t('ws.tab.applications')}><ApplicationsTab ws={ws} focus={focus} /></WsSection>
                        <WsSection id="documents" title={t('ws.tab.documents')} count={needsDocs}><DocumentsTab ws={ws} focus={focus} /></WsSection>
                        <WsSection id="essays" title={t('ws.tab.essays')} count={ws.essays.length}><EssaysTab ws={ws} /></WsSection>
                        {showVisa && (
                          <WsSection id="visa" title={t('ws.tab.visa')}>
                            {ws.visa_cases.length === 0
                              ? <><VisaRoutePanel studentId={ws.student.id} /><EmptyState title={t('ws.noVisa')} text={t('ws.noVisaText')} /></>
                              : <div className="hg-stack"><VisaRoutePanel studentId={ws.student.id} />{ws.visa_cases.map((v) => <VisaCaseCard key={v.id} id={v.id} />)}</div>}
                          </WsSection>
                        )}
                      </div>
                    )}
                    {tab === 'communication' && (
                      <div className="hg-stack ag-wsgroup">
                        <WsSection id="messages" title={t('ws.tab.messages')}><MessagesTab ws={ws} focus={focus} /></WsSection>
                        <WsSection id="history" title={t('ws.tab.history')}><HistoryTab ws={ws} onCloseMeeting={setClosing} /></WsSection>
                      </div>
                    )}
                    {tab === 'profile' && <WsSection id="profile" title={t('v22.ws.tab.profile')}><ProfilePanel ws={ws} /></WsSection>}
                    {tab === 'more' && (
                      <div className="hg-stack ag-wsgroup">
                        <WsSection id="tasks" title={t('ws.tab.tasks')} count={openTasks.length}><TasksTab ws={ws} focus={focus} /></WsSection>
                        <WsSection id="portfolio" title={t('ws.tab.portfolio')}><PortfolioTab studentId={ws.student.id} /></WsSection>
                        <WsSection id="services" title={t('concierge:ws.services')}><StudentServices studentId={ws.student.id} /></WsSection>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <NewConversationModal open={action === 'message'} onClose={() => setAction(null)} student={student} />
              <CreateTaskModal open={action === 'task'} onClose={() => setAction(null)} student={student} />
              <AppointmentForm open={action === 'call'} onClose={() => setAction(null)} student={student} />
              <RecordMeetingModal open={action === 'meeting' || !!closing} onClose={() => { setAction(null); setClosing(null); }} studentId={ws.student.id} appointmentId={closing} />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
