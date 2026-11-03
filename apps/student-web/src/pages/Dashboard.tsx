import { docLabel, localizedTitle, localName } from '@hangyul/i18n';
import { useApi, useAuth } from '@hangyul/auth';
import { ArrowRight, Check, ChevronRight, MessageCircle, Plane } from '@hangyul/icons';
import type { Dashboard as DashboardData } from '@hangyul/types';
import {
  ButtonLink, ListRow, QueryState, Section, Skeleton, StatusText, UniMark,
} from '@hangyul/ui';
import { applicationTone, dayPart, formatDate, formatDateTime } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { DaysLeft, TierLabel } from '../components/bits';
import { isPreSubmit } from '../lib/format';
import { intakeLabel, reasonText, tr, useT, type TFn } from '../lib/i18n';
import { PHASES, TEAM_STATUSES, journeyPhases, needsStudent, phaseOfStage, showsRecommendations, type Phase } from '../lib/journey';
import { useDashboard } from '../lib/queries';
import { useFirstYearText } from '../lib/cost';
import { itemTitle, itemWhy } from '../lib/success';
import { RoutesCard } from '../components/Routes';
import { RefundCard } from '../components/RefundCard';
import { TaskList, useMyTasks } from '../components/TaskList';
import { TeamAvatar } from '../components/TeamAvatar';
import type { LanguageRoutes } from '../lib/routes';
import type { RefundSummary } from '../lib/money';

type V9Home = DashboardData & { routes?: LanguageRoutes | null; refund?: RefundSummary | null };

/**
 * PRIMARY QUESTION (home): "Where am I, and what is the one thing I should do now?"
 *
 * V22 (REPORT §248 S1–S3) fixes the order of the page once, and it never varies:
 *
 *   1. the six-stage journey strip      — where am I
 *   2. ONE next action                  — what do I do now
 *   3. what the Hangyul team is doing   — what is happening without me
 *   4. coming up                        — when
 *   5. applications that need me
 *   6. documents that need me
 *   7. messages (the team card)
 *
 * Recommendations appear only in stage 01 with no applications. Everything else that used to live here —
 * photo band, "what you can do today", a named counselor — did not help the next decision and is gone.
 */

const TASKS_PARAM = 'show';

function NextStep({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const a = d.next_action;
  const arrivalMode = (d.journey.stage === 'ARRIVAL' || d.visa?.status === 'ISSUED') && d.journey.stage !== 'STUDENT_LIFE';
  if (arrivalMode) {
    const done = d.arrival?.completed ?? 0;
    return (
      <section className="sh-next v22-main" aria-labelledby="next-title">
        <div className="sh-next__eyebrow">{t('home.next')}</div>
        <h2 className="sh-next__title" id="next-title">{t('dashboard.arrival.title')}</h2>
        <p className="sh-next__text">
          {d.arrival?.arrival_at ? t('dashboard.arrival.landing', { date: formatDateTime(d.arrival.arrival_at, locale) }) : t('dashboard.arrival.noFlight')}
        </p>
        <div className="sh-next__cta">
          <ButtonLink as={Link} to="/arrival" variant="primary" size="lg" icon={<Plane />}>{t('dashboard.arrival.cta')}</ButtonLink>
          <span className="hg-small hg-muted">{t('home.arrivalProgress', { done })}</span>
        </div>
      </section>
    );
  }
  if (a.code === 'CONCIERGE' || a.code === 'SUBMISSION_AUTHORIZE' || a.code === 'SUBMISSION_HANDOFF' || a.code === 'SUBMISSION_CONFIRM' || a.code === 'VISA_STEP') return <V5Next d={d} />;
  const nested = a.code === 'PROFILE_UNLOCK' ? `dashboard.nextAction.PROFILE_UNLOCK.${String(a.params.section)}`
    : a.code === 'APPLICATION_ITEM' ? `dashboard.nextAction.APPLICATION_ITEM.${String(a.params.item)}` : `dashboard.nextAction.${a.code}`;
  const title = a.code === 'TASK'
    ? localizedTitle(t, { title: a.title, title_key: a.params.title_key as string | undefined, title_params: a.params.title_params as Record<string, unknown> | undefined })
    : tr(t, `${nested}.title`, a.title, a.params);
  const text = typeof a.params.detail === 'string' && a.params.detail ? a.params.detail : tr(t, a.code === 'TASK' ? `dashboard.nextAction.TASK.text.${String(a.params.type ?? '')}` : `${nested}.text`, '', a.params);
  const cta = a.code === 'TASK'
    ? tr(t, `dashboard.nextAction.TASK.cta.${String(a.params.type ?? '')}`, t('dashboard.nextAction.TASK.ctaDefault'))
    : tr(t, `${nested}.cta`, t('common:actions.continue'));
  const due = typeof a.params.due_at === 'string' ? a.params.due_at : null;
  return (
    <section className="sh-next v22-main" aria-labelledby="next-title">
      <div className="sh-next__eyebrow">
        <span>{t('home.next')}</span>
        {due && <><span aria-hidden>·</span><span>{t('common:time.due', { date: formatDate(due, locale) })}</span><DaysLeft date={due} /></>}
      </div>
      <h2 className="sh-next__title" id="next-title">{title}</h2>
      {text && <p className="sh-next__text">{text}</p>}
      <div className="sh-next__cta">
        <ButtonLink as={Link} to={a.link} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{cta}</ButtonLink>
        {d.open_tasks > 1 && <Link to={`/?${TASKS_PARAM}=tasks`} className="hg-link-arrow">{t('home.otherTasks', { count: d.open_tasks - 1 })}<ChevronRight className="hg-flip-rtl" /></Link>}
      </div>
    </section>
  );
}

/**
 * V25 (REPORT §313 S1): the next action is the page's hero — a warm panel with the campus of the application it is about
 * (or the student's first application), so "what do I do now" is also "where am I going". No photo, no picture: the panel
 * stands on its own and never borrows another university's campus.
 */
function NextPanel({ d, children }: { d: DashboardData; children: React.ReactNode }) {
  const id = /\/applications\/([0-9a-f-]{36})/.exec(d.next_action.link ?? '')?.[1];
  const app = d.applications.find((a) => a.id === id) ?? (id ? undefined : d.applications[0]);
  const photo = app?.university.photo ?? null;
  return (
    <div className={`v25-next v22-main${photo ? ' v25-next--photo' : ''}`}>
      {children}
      {photo && (
        <figure className="v25-next__photo" aria-hidden>
          <picture>
            {photo.formats?.includes('webp') && <source type="image/webp" srcSet={`/${photo.local_path}-640.webp 640w, /${photo.local_path}-1200.webp 1200w`} sizes="(min-width: 1024px) 380px, 100vw" />}
            <img src={`/${photo.local_path}-1200.jpg`} srcSet={`/${photo.local_path}-640.jpg 640w, /${photo.local_path}-1200.jpg 1200w`} sizes="(min-width: 1024px) 380px, 100vw"
              alt="" style={{ objectPosition: `${photo.focal_x}% ${photo.focal_y}%` }} />
          </picture>
          <figcaption>{localName(app!.university)}{photo.attribution ? <span> · {photo.attribution.author} · {photo.attribution.license}</span> : null}</figcaption>
        </figure>
      )}
    </div>
  );
}

/** V5 hero for the arrival track (after the visa) and for a READY application's guided submission. */
function V5Next({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const a = d.next_action;
  const concierge = a.code === 'CONCIERGE';
  const visa = a.code === 'VISA_STEP';
  const key = String(a.title);
  const pseudo = { code: a.code, title: a.title, why: null, params: a.params };
  const p = a.params as Record<string, string | undefined>;
  const visaDate = p.date ? formatDate(p.date, locale, { month: 'long', day: 'numeric' }) : '';
  // Visa: name the document itself ("TB certificate") and put the step sentence underneath.
  const visaDoc = visa && key === 'document' && p.doc ? t(`visaroute:doc.${p.doc}.name`, { defaultValue: '' }) : '';
  const title = concierge ? t(`concierge:step.${key}.title`, { defaultValue: key })
    : visa ? (visaDoc || t(String(p.title_key), { ...p, date: visaDate }))
      : itemTitle(t, locale, pseudo);
  const text = concierge ? t(`concierge:step.${key}.text`, { defaultValue: '' })
    : visa ? (visaDoc ? t(`visaroute:doc.${p.doc}.why`, { defaultValue: t(String(p.title_key), { ...p, date: visaDate }) }) : null)
      : itemWhy(t, locale, pseudo);
  const cta = concierge ? t(`concierge:step.${key}.cta`, { defaultValue: t('common:actions.continue') })
    : visa ? t('v5.home.openVisa') : t(`success:item.${a.code}.cta`, { defaultValue: t('common:actions.continue') });
  const eyebrow = concierge && d.concierge ? t(d.concierge.title_key) : visa && p.status_key ? t(p.status_key) : t('home.next');
  return (
    <section className="sh-next v22-main" aria-labelledby="next-title">
      <div className="sh-next__eyebrow">
        <span>{eyebrow}</span>
        {concierge && d.concierge && d.concierge.total > 0 && <><span aria-hidden>·</span><span>{t('v5.home.stepsDone', { done: d.concierge.done, total: d.concierge.total })}</span></>}
      </div>
      <h2 className="sh-next__title" id="next-title">{title}</h2>
      {text && <p className="sh-next__text">{text}</p>}
      <div className="sh-next__cta">
        <ButtonLink as={Link} to={a.link} variant="primary" size="lg" iconEnd={<ArrowRight className="hg-flip-rtl" />}>{cta}</ButtonLink>
      </div>
    </section>
  );
}

/** `/tasks` → `/?show=tasks` (REPORT §248 S4): the full task list, revealed on the home under the next action. */
function AllTasks() {
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  if (sp.get(TASKS_PARAM) !== 'tasks') return null;
  const hide = () => { const n = new URLSearchParams(sp); n.delete(TASKS_PARAM); setSp(n, { replace: true }); };
  return (
    <Section title={t('tasks.title')} id="tasks" className="v22-main" action={<button type="button" className="hg-link hg-small v22-linkbtn" onClick={hide}>{t('v22.home.hideTasks')}</button>}>
      <TaskList />
    </Section>
  );
}

/**
 * A home nudge's sentence. Two params need words rather than codes before i18next sees them: a document
 * category, and — V13, brief Part 9 — the **field names** behind a "details to check" count.
 */
function nudgeTitle(t: TFn, locale: string, n: { code: string; title_key: string; link: string; params?: Record<string, unknown> }): string {
  const p: Record<string, unknown> = { ...n.params, defaultValue: n.code };
  if (typeof n.params?.category === 'string') p.category = t(`common:docCategory.${n.params.category}`).toLowerCase();
  const fields = n.params?.fields;
  if (Array.isArray(fields) && fields.length) {
    const words = fields.map((f) => t(`dossier:field.${String(f)}`, { defaultValue: String(f) }).toLowerCase());
    const more = Number(n.params?.more ?? 0);
    p.fields = listFormat(words, locale, more > 0 ? 'unit' : 'conjunction');
    if (more > 0) return t(`${n.title_key}_more`, { ...p, count: more, more });
  }
  return t(n.title_key, p);
}

/** Intl.ListFormat where the runtime has it; a comma join is a correct-enough fallback and never throws. */
function listFormat(items: string[], locale: string, type: 'conjunction' | 'unit'): string {
  try {
    return new Intl.ListFormat(locale, { style: type === 'unit' ? 'short' : 'long', type }).format(items);
  } catch {
    return items.join(', ');
  }
}

/**
 * V31: under a group header that already names the application, each line names only its item — the document or
 * essay — in the reader's language. Cutting the university out of a translated sentence left fragments
 * ("지원용 가족관계증명서 업로드하기", "cho …") in most languages.
 */
function itemName(t: (k: string, o?: Record<string, unknown>) => string, x: { title_params?: Record<string, unknown> | null }): string | null {
  const p = x.title_params ?? {};
  if (typeof p.category === 'string' && p.category !== 'OTHER') return t(`common:docCategory.${p.category}`, { defaultValue: '' }) || null;
  if (typeof p.essayType === 'string') return t(`common:essayType.${p.essayType}`, { defaultValue: '' }) || null;
  return null;
}

function shortTitle(title: string, ...names: (string | null | undefined)[]): string {
  let out = title;
  names.filter(Boolean).forEach((n) => { out = out.replace(` — ${n}`, '').replace(` for ${n}`, '').replace(n!, '').trim(); });
  return out.replace(/[.\s—·]+$/, '');
}

/**
 * What the Hangyul team is doing now — from data the home already has, never invented: the team's open tasks,
 * documents in review, and applications in a team-owned status. When there is nothing, it says so quietly.
 */
function TeamNow({ d }: { d: DashboardData }) {
  const { t } = useT();
  const tasks = useMyTasks();
  const me = useAuth().session?.user.id;
  const theirs = (tasks.data?.items ?? []).filter((x) => x.owner && x.owner.id !== me);
  const checking = (d.document_counts.NEEDS_REVIEW ?? 0) + (d.document_counts.PROCESSING ?? 0);
  const apps = d.applications.filter((a) => TEAM_STATUSES[a.status]);
  const rows: { key: string; title: string; meta?: string; link: string }[] = [
    ...apps.map((a) => ({ key: `app-${a.id}`, title: t(`v22.home.appTeam.${TEAM_STATUSES[a.status]}`, { university: localName(a.university) }), meta: `${localName(a.program)}`, link: `/applications/${a.id}` })),
    ...(checking > 0 ? [{ key: 'docs', title: t('v22.home.docsChecking', { count: checking }), link: '/documents' }] : []),
    ...theirs.slice(0, 3).map((x) => ({ key: x.id, title: localizedTitle(t, x), meta: x.university, link: x.link ?? `/?${TASKS_PARAM}=tasks` })),
  ];
  return (
    <Section title={t('v22.home.teamNow')} id="team-now" className="v22-main">
      {rows.length === 0 ? (
        <p className="hg-small hg-muted">{d.counselor ? t('v22.home.teamNowEmpty') : t('dashboard.counselor.noneText')}</p>
      ) : (
        <ul className="v22-rows">
          {rows.map((r) => (
            <li key={r.key}><ListRow as={Link} to={r.link} chevron lead={<TeamAvatar size={28} />} title={r.title} meta={r.meta} /></li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Coming up: one row per application and date — a deadline and its own tasks are grouped, never listed twice. */
function ComingUp({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const nextLink = d.next_action.link;
  const nextDue = typeof d.next_action.params.due_at === 'string' ? d.next_action.params.due_at.slice(0, 10) : null;
  const list = d.deadlines.filter((x) => !(x.link === nextLink && (!nextDue || x.date === nextDue)));
  const groups: { key: string; date: string; items: typeof list }[] = [];
  list.forEach((x) => {
    const key = `${x.date}|${x.application_id ?? x.title}`;
    const g = groups.find((y) => y.key === key);
    if (g) g.items.push(x); else groups.push({ key, date: x.date, items: [x] });
  });
  const shown = groups.slice(0, 4);
  if (shown.length === 0 && d.applications.length > 0) return null; // zeros collapse: nothing dated is coming up
  return (
    <Section title={t('home.comingUp')} id="coming-up" className="v22-side" action={d.open_tasks > 0 ? <Link to={`/?${TASKS_PARAM}=tasks`} className="hg-link-arrow">{t('common:actions.viewAll')}</Link> : undefined}>
      {shown.length === 0 ? <p className="hg-muted hg-small">{t('dashboard.deadlines.empty')}</p> : (
        <ol className="sh-dates">
          {shown.map((g) => {
            const main = g.items.find((x) => x.kind === 'APPLICATION' || x.kind === 'TUITION') ?? (g.items.length === 1 ? g.items[0] : null);
            const rest = g.items.filter((x) => x !== main);
            const title = main ? localizedTitle(t, main) : t('v4.home.thingsDue', { count: g.items.length, label: g.items[0].application_label ?? '' });
            const link = main?.link ?? (g.items[0].application_id ? `/applications/${g.items[0].application_id}` : g.items[0].link);
            return (
              <li key={g.key}>
                <time className="sh-dates__day" dateTime={g.date}>
                  <span className="hg-num">{formatDate(g.date, locale, { day: 'numeric' })}</span>
                  <span>{formatDate(g.date, locale, { month: 'short' })}</span>
                </time>
                <div className="hg-grow" style={{ minWidth: 0 }}>
                  {link ? <Link to={link} className="hg-link hg-clamp-2">{title}</Link> : <span className="hg-medium hg-clamp-2">{title}</span>}
                  {rest.length > 0 && <div className="hg-small hg-muted v4-dates__also">{rest.map((x) => itemName(t, x) ?? shortTitle(localizedTitle(t, x), x.application_label, x.title_params?.university as string | undefined)).join(' · ')}</div>}
                  <div className="hg-xs hg-subtle"><DaysLeft date={g.date} /></div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <AfterAdmission d={d} />
    </Section>
  );
}

/** After the admission letter, housing and arrival come into view; after the visa, arrival leads. Before admission they stay quiet. */
function AfterAdmission({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const api = useApi();
  const active = !!d.concierge || d.journey.stage === 'VISA' || d.journey.stage === 'ARRIVAL';
  const housing = useQuery({ queryKey: ['housing'], queryFn: () => api.me.housing(), enabled: active });
  if (!active) return null;
  const hc = housing.data?.case;
  const hDeadline = hc?.application_deadline ?? null;
  const housingMeta = !hc ? t('v4.home.housingStart') : hDeadline && !hc.status.endsWith('CONFIRMED')
    ? t('v4.home.housingDeadline', { date: formatDate(hDeadline, locale, { month: 'short', day: 'numeric' }) }) : t(`v4.home.housingStatus`, { status: t(`common:housingStatus.${hc.status}`, { defaultValue: hc.status }) });
  return (
    <div className="v22-after">
      <div className="hg-menu-label">{d.concierge ? t(d.concierge.title_key) : d.journey.stage === 'ARRIVAL' ? t('v4.home.beforeFly') : t('v4.home.afterVisa')}</div>
      <ul className="v22-rows">
        <li><ListRow as={Link} to="/housing" chevron title={t('v4.home.housing')} meta={<>{housingMeta}{hDeadline && !hc?.status.endsWith('CONFIRMED') ? <> · <DaysLeft date={hDeadline} /></> : null}</>} /></li>
        <li><ListRow as={Link} to="/arrival" chevron title={t('v4.home.arrival')}
          meta={d.concierge && d.concierge.total > 0 ? t('v5.home.stepsDone', { done: d.concierge.done, total: d.concierge.total })
            : d.arrival?.arrival_at ? t('dashboard.arrival.landing', { date: formatDateTime(d.arrival.arrival_at, locale) }) : t('v4.home.arrivalStart')} /></li>
      </ul>
    </div>
  );
}

/** Applications that need the student — the rest are one quiet line and a link. */
function Applications({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  if (d.applications.length === 0) return null;
  const need = d.applications.filter((a) => needsStudent(d, a));
  const nextFor = (a: DashboardData['applications'][number]) => d.missing_documents.find((m) => (m.application_id ? m.application_id === a.id : m.university === localName(a.university)));
  const improve = d.improve ?? [];
  return (
    <Section title={need.length > 0 ? t('v22.home.appsNeedYou') : t('home.applications')} id="applications" className="v22-main"
      action={<Link to="/applications" className="hg-link-arrow">{t('common:actions.viewAll')}</Link>}>
      {need.length === 0 ? <p className="hg-small hg-muted">{t('v22.home.appsQuiet', { count: d.applications.length })}</p> : (
        <ul className="v22-rows">
          {need.map((a) => {
            const m = nextFor(a);
            const it = improve.find((i) => i.application_id === a.id);
            return (
              <li key={a.id}>
                <ListRow
                  as={Link} to={it?.action?.link ?? `/applications/${a.id}`} chevron
                  lead={<UniMark name={localName(a.university)} color={a.university.brand_color} photo={a.university.photo} />}
                  title={localName(a.university)}
                  meta={`${localName(a.program)} · ${intakeLabel(t, a.intake.term, a.intake.year)}`}
                  end={
                    <span className="sh-app-end">
                      <span className="sh-app-next">
                        <StatusText tone={applicationTone[a.status]}>{t(`stage.${a.status}`, { defaultValue: t(`common:appStatus.${a.status}`) })}</StatusText>
                        {(it || m) && <span className="hg-xs hg-subtle hg-truncate">{it ? itemTitle(t, locale, it) : t('home.nextItem', { item: docLabel(t, m!) })}</span>}
                      </span>
                      {isPreSubmit(a.status) && <span className="hg-xs sh-hide-sm sa-when">{t('home.closes', { date: formatDate(a.intake.application_deadline, locale) })} · <DaysLeft date={a.intake.application_deadline} /></span>}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** Documents that need the student: the missing/fix items the API already lists, plus dossier nudges. */
function Documents({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const docs = d.missing_documents.filter((m) => !m.ready);
  const nudges = d.dossier ?? [];
  if (docs.length === 0 && nudges.length === 0) return null;
  return (
    <Section title={t('home.documents')} id="documents" className="v22-main" sub={docs.length > 0 ? t('home.documentsSub', { count: docs.length }) : undefined}
      action={<Link to="/documents" className="hg-link-arrow">{t('common:actions.viewAll')}</Link>}>
      <ul className="v22-rows">
        {docs.slice(0, 5).map((m) => (
          <li key={`${m.requirement_id}-${m.application_id ?? ''}`}>
            <ListRow as={Link} to={m.document_id ? `/documents?doc=${m.document_id}` : '/documents'} chevron title={docLabel(t, m, locale)}
              meta={[m.university, m.action_code ? t(`home.docAction.${m.action_code}`, { defaultValue: m.action ?? '' }) : m.action].filter(Boolean).join(' · ')}
              end={m.due_date ? <DaysLeft date={m.due_date} /> : undefined} />
          </li>
        ))}
        {nudges.map((n) => (
          <li key={n.code}><ListRow as={Link} to={n.link} chevron title={nudgeTitle(t, locale, n)} /></li>
        ))}
      </ul>
    </Section>
  );
}

function Recommended({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const firstYear = useFirstYearText();
  if (d.recommendations.length === 0) return null;
  const close = d.recommendations_kind === 'POSSIBLE';
  return (
    <Section title={close ? t('home.closest') : t('home.recommended')} sub={close ? t('home.closestSub') : t('home.recommendedSub')} id="recommended" className="v22-main"
      action={<Link to="/explore?tab=foryou" className="hg-link-arrow">{t('home.allMatches')}</Link>}>
      <ul className="v22-rows">
        {d.recommendations.map((m) => {
          const u = m.program.university;
          const gap = m.reasons.find((r) => r.kind === 'missing');
          const cost = m.first_year_range_krw?.low ? t('v4.program.firstYearMeta', { range: firstYear(m.first_year_range_krw) }) : null;
          return (
            <li key={m.program_id}>
              <ListRow as={Link} to={`/universities/${u?.slug}?program=${m.program_id}`} chevron
                lead={<UniMark name={u?.name_en ?? '?'} color={u?.brand_color} photo={u?.photo} />}
                title={<>{u?.name_en} <span className="hg-subtle" style={{ fontWeight: 400 }}>· {localName(m.program)}</span></>}
                meta={gap ? reasonText(t, gap) : [cost, t(`common:instruction.${m.program.instruction_language}`)].filter(Boolean).join(' · ')}
                end={
                  <span className="sh-app-end">
                    <TierLabel tier={m.tier} />
                    {m.intake && <span className="hg-xs hg-subtle sh-hide-sm">{t('home.closes', { date: formatDate(m.intake.application_deadline, locale) })}</span>}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** The team card (REPORT §248 S3): the Hangyul team identity, the agency it works with, the next call, unread messages. Never a staff name. */
function Team({ d }: { d: DashboardData }) {
  const { t, locale } = useT();
  const api = useApi();
  const appts = useQuery({ queryKey: ['appointments'], queryFn: () => api.me.appointments(), enabled: !!d.counselor });
  const next = (appts.data ?? []).find((a) => a.status === 'SCHEDULED' && new Date(a.starts_at).getTime() > Date.now());
  return (
    <Section title={t('home.team')} id="team" className="v22-side">
      <div className="sh-person">
        <TeamAvatar size={40} />
        <div className="hg-grow" style={{ minWidth: 0 }}>
          <div className="hg-medium">{t('messages.team')}</div>
          {d.counselor
            ? <div className="hg-small hg-subtle hg-truncate">{t('v22.home.withAgency', { org: d.counselor.organization })}</div>
            : <div className="hg-small hg-subtle">{t('dashboard.counselor.noneText')}</div>}
        </div>
      </div>
      {next && <p className="hg-small">{t('dashboard.counselor.nextCall', { when: formatDateTime(next.starts_at, locale) })}</p>}
      <div className="hg-row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <ButtonLink as={Link} to="/messages" size="sm" icon={<MessageCircle />} variant={d.unread_messages > 0 ? 'primary' : undefined}>
          {d.unread_messages > 0 ? t('dashboard.counselor.unread', { count: d.unread_messages }) : t('dashboard.counselor.message')}
        </ButtonLink>
        {!d.counselor && <ButtonLink as={Link} to="/services" size="sm" variant="ghost">{t('dashboard.counselor.noneCta')}</ButtonLink>}
      </div>
    </Section>
  );
}

function HomeSkeleton() {
  return (
    <div className="st-page" aria-busy="true">
      <Skeleton w={240} h={28} />
      <Skeleton h={48} />
      <div className="sh-grid">
        <div className="hg-stack"><Skeleton h={180} r={10} /><Skeleton h={220} r={10} /></div>
        <div className="hg-stack"><Skeleton h={200} r={10} /></div>
      </div>
    </div>
  );
}

/**
 * The six-stage journey (REPORT §248 S1): `StageStrip` in journey mode — done = quiet check, current = tangerine,
 * upcoming = neutral. Tapping a done or current stage opens its short summary beneath the strip; upcoming stages
 * are not clickable. Exactly one stage carries `aria-current`.
 */
function Journey({ d }: { d: DashboardData }) {
  const { t } = useT();
  const phases = journeyPhases(d.journey.stage);
  const current = phaseOfStage(d.journey.stage);
  const [open, setOpen] = useState<Phase | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // Phones: the strip scrolls sideways — start with the current stage in view, not three ticked ones.
  useLayoutEffect(() => {
    const strip = wrap.current?.querySelector<HTMLElement>('.v25-line');
    const el = strip?.querySelector<HTMLElement>('.is-current');
    if (strip && el && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft += el.getBoundingClientRect().left - strip.getBoundingClientRect().left - 16;
    }
  }, [current]);
  const idx = PHASES.indexOf(open ?? current);
  const state = open ? phases[idx].state : 'current';
  const summary = state === 'current' && (d.concierge?.stage === 'ARRIVED' || d.concierge?.stage === 'SETTLED')
    ? t(`v5.home.phaseText.${d.concierge.stage}`) : t(`phase.${open ?? current}.text`);
  return (
    <section className="v22-journey v25-journey" aria-labelledby="journey-title" ref={wrap}>
      <h2 id="journey-title" className="hg-sr-only">{t('dashboard.journey.title')}</h2>
      {/* V25 (REPORT §313 S2): progression, not navigation chrome — one line, six nodes. Done = a quiet ink check,
          current = the tangerine node and the only bold label, future = a grey ring. Done and current stages open their
          one-line summary below; future stages are not interactive. */}
      <ol className="v25-line" aria-label={t('dashboard.journey.title')}>
        {phases.map((p, i) => {
          const label = t(`phase.${p.key}.label`);
          const inner = (
            <>
              <span className="v25-line__node" aria-hidden>{p.state === 'done' ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span className="v25-line__label">{label}</span>
            </>
          );
          return (
            <li key={p.key} className={`v25-line__step is-${p.state}${open === p.key ? ' is-open' : ''}`} style={{ ['--i' as string]: i }}>
              {p.state === 'todo' ? <span className="v25-line__btn">{inner}</span> : (
                <button type="button" className="v25-line__btn" aria-current={p.state === 'current' ? 'step' : undefined} aria-pressed={open === p.key}
                  onClick={() => setOpen(open === p.key ? null : p.key)}>{inner}</button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="v22-journey__summary" data-state={state} aria-live="polite">
        <div className="v22-journey__eyebrow">
          <span className="hg-num">{t('v22.journey.stageOf', { n: idx + 1, total: PHASES.length })}</span>
          <span aria-hidden>·</span>
          <span>{t(`phase.${open ?? current}.label`)}</span>
          <span aria-hidden>·</span>
          <span className="v22-journey__state">{state === 'current' ? t('phase.youAreHere') : t(`phase.state.${state}`)}</span>
        </div>
        <p className="v22-journey__text">{summary}</p>
      </div>
    </section>
  );
}

function seasonLine(t: ReturnType<typeof useT>['t'], d: DashboardData): string {
  const a = d.applications[0];
  if (a) return t('home.season', { intake: intakeLabel(t, a.intake.term, a.intake.year) });
  return t(`dashboard.stageText.${d.journey.stage}`);
}

function greeting(t: ReturnType<typeof useT>['t'], name: string): string {
  return t(`home.greet.${dayPart()}`, { name });
}

export default function Dashboard() {
  const { t } = useT();
  const q = useDashboard();
  return (
    <QueryState query={q} skeleton={<HomeSkeleton />}>
      {(d) => (
        <div className="st-page sh-home v22-home">
          <header className="v22-head">
            <h1 className="v22-head__title">{greeting(t, d.greeting_name)}</h1>
            <p className="hg-muted">{seasonLine(t, d)}</p>
          </header>
          <Journey d={d} />
          <div className="v22-grid">
            <NextPanel d={d}><NextStep d={d} /></NextPanel>
            {(d as V9Home).refund && <div className="v22-main"><RefundCard r={(d as V9Home).refund!} /></div>}
            <AllTasks />
            {(d as V9Home).routes && showsRecommendations(d) && <div className="v22-main"><RoutesCard routes={(d as V9Home).routes!} compact={d.recommendations.length > 0} /></div>}
            <TeamNow d={d} />
            <ComingUp d={d} />
            <Applications d={d} />
            <Documents d={d} />
            <Team d={d} />
            {showsRecommendations(d) && <Recommended d={d} />}
          </div>
        </div>
      )}
    </QueryState>
  );
}
