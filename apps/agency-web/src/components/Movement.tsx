// V8 workspace top: "Why is this case not moving?" then "What happens next" (GET /agency/students/{id}/movement).
// The reasons are the same ones that rank the student on Today (services/priority.py), so the two screens never disagree.
import { useAuth } from '@hangyul/auth';
import { Skeleton } from '@hangyul/ui';
import { SoftBadge } from '@hangyul/ynex-ui';
import { caseStage, formatDate, formatRelative, MACRO_STAGES } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { localName } from '@hangyul/i18n';
import { taskTitle } from '../lib/logic';
import { reasonText, TIER_TONE, useMovement, type MovementNext } from '../lib/v8';
import { useT, useWaitingText } from './bits';
import { PlanMark } from './Plan';

export interface ExtraBlocker { key: string; title: string; detail?: string; onOpen: () => void }

function NextLabel({ n }: { n: MovementNext }) {
  const { t } = useT();
  if (n.kind === 'task') {
    return <>{taskTitle(t, { title: n.title ?? '', title_key: n.title_key, title_params: n.title_params })}{n.student_side && <span className="text-muted"> · {t('v8.move.studentSide')}</span>}</>;
  }
  if (n.kind === 'meeting') return <>{t('v8.move.meeting', { kind: t(`consult.kind.${n.meeting_kind}`, { defaultValue: t('v8.move.meetingDefault') }) })}</>;
  return <>{t('v8.move.deadline', { university: n.university ?? '' })}</>;
}

export function MovementPanel({ studentId, name, extra }: { studentId: string; name: string; extra: ExtraBlocker[] }) {
  const { t, locale } = useT();
  const q = useMovement(studentId);
  const m = q.data;
  return (
    <div className="ag8-move">
      <section className="ag8-move__card" aria-labelledby="ag8-why">
        <h2 className="ag8-move__h" id="ag8-why">{t('v8.move.why')}</h2>
        {q.isLoading || !m ? <Skeleton h={80} /> : (
          <>
            {/* V9: who / why / since-when is the header strip (CaseStrip); this card lists every reason behind it. */}
            {m.reasons.length === 0 && extra.length === 0 ? (
              <p className="text-muted fs-12 mb-0">{t('v8.move.noReasons', { name })}</p>
            ) : (
              <ul className="ag8-move__list">
                {m.reasons.map((r) => (
                  <li key={r.code}>
                    <SoftBadge tone={TIER_TONE[r.tier]}>{t(`v8.tier.${r.tier}`)}</SoftBadge>
                    <span className="ag8-move__item">{reasonText(t, r)}</span>
                  </li>
                ))}
                {extra.map((b) => (
                  <li key={b.key}>
                    <SoftBadge tone="warning">{t('v8.move.blocker')}</SoftBadge>
                    <span className="ag8-move__item">
                      <button type="button" className="btn btn-link p-0 text-start fs-13" onClick={b.onOpen}>{b.title}</button>
                      {b.detail && <span className="text-muted">{b.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="ag8-move__def">{t('v8.move.definition')}</p>
          </>
        )}
      </section>
      <section className="ag8-move__card" aria-labelledby="ag8-next">
        <h2 className="ag8-move__h" id="ag8-next">{t('v8.move.next')}</h2>
        {q.isLoading || !m ? <Skeleton h={80} /> : m.next.length === 0 ? <p className="text-muted fs-12 mb-0">{t('v8.move.nothingNext')}</p> : (
          <ul className="ag8-move__list">
            {m.next.map((n, i) => (
              <li key={`${n.kind}-${i}`}>
                <SoftBadge tone={n.kind === 'meeting' ? 'info' : n.kind === 'deadline' ? 'orange' : 'secondary'}>{t(`v8.move.kind.${n.kind}`)}</SoftBadge>
                <span className="ag8-move__item">
                <Link to={n.link}><NextLabel n={n} /></Link>
                {n.due_at && (
                  <span className="ag8-move__when" data-overdue={n.overdue || undefined} title={formatDate(n.due_at, locale)}>
                    {n.overdue ? t('v8.move.overdue', { when: formatRelative(n.due_at, locale) }) : n.kind === 'deadline' ? formatDate(n.due_at, locale, { month: 'short', day: 'numeric' }) : formatRelative(n.due_at, locale)}
                  </span>
                )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * V9 workspace header (REPORT §59 A3): five answers before any tab — why it is not moving · next action · waiting on ·
 * deadline · owner. Same waiting model as the Students list and Today (server services/waiting.py).
 */
export function CaseStrip({ studentId }: { studentId: string }) {
  const { t, locale } = useT();
  const w = useWaitingText();
  const q = useMovement(studentId);
  const { api } = useAuth();
  // Its own query rather than a prop: the strip renders on screens that do not load the whole workspace,
  // and this is cached per student by react-query so opening a case does not fetch it twice.
  const plan = useQuery({ queryKey: ['agency', 'plan', studentId], queryFn: () => api.agency.studentPlan(studentId), staleTime: 60_000 });
  const m = q.data;
  if (q.isLoading || !m) return <div className="ag9-strip"><Skeleton h={44} /></div>;
  const why = m.waiting_on ? w.reason(m.waiting_reason) : null;
  const dl = m.deadline;
  const days = dl ? Math.ceil((new Date(`${dl.date}T23:59:59`).getTime() - Date.now()) / 86_400_000) : null;
  const cells: { k: string; label: string; value: React.ReactNode; tone?: string }[] = [
    // V15: PLAN first, so the counselor's required first viewport — student · plan · stage · why blocked ·
    // next action · deadline · owner — is complete in the one strip they already read (REPORT §119).
    { k: 'plan', label: t('v15.scope.strip'), value: plan.data ? <PlanMark code={plan.data.code} /> : <span className="text-muted">—</span> },
    { k: 'why', label: t('v9.strip.why'), value: m.waiting_on
      ? <>{why ?? w.party(m.waiting_on)}{m.days_since_moved !== null && <span className="text-muted"> · {t('v8.move.lastMoved', { count: m.days_since_moved })}</span>}</>
      : t('v8.move.nobody') },
    { k: 'next', label: t('v9.strip.next'), value: w.next(m.next_action) ?? '—' },
    { k: 'waiting', label: t('v9.waiting.title'), value: m.waiting_on ? w.party(m.waiting_on) : t('v9.waiting.party.none'), tone: m.waiting_on && ['counselor', 'agency', 'hangyul'].includes(m.waiting_on) ? 'staff' : undefined },
    { k: 'deadline', label: t('v9.strip.deadline'), value: dl ? <span title={localName({ name_en: dl.university, name_ko: dl.university_ko })}>{formatDate(dl.date, locale, { month: 'short', day: 'numeric' })} · {localName({ name_en: dl.university, name_ko: dl.university_ko })}</span> : '—',
      tone: days !== null && days <= 7 ? 'soon' : undefined },
    // V26: "담당" names who in the team holds it. When the student or the university holds it, "대기 주체" above already
    // says so — a second cell reading "담당 · <student name>" read as if the student were the assignee.
    ...(m.owner && ['person', 'agency', 'hangyul'].includes(m.owner.kind) ? [{ k: 'owner', label: t('v9.owner.label'), value: w.owner(m.owner) ?? '—' }] : []),
  ];
  return (
    <dl className="ag9-strip" aria-label={t('v8.move.why')}>
      {cells.map((c) => (
        <div key={c.k} className="ag9-strip__cell" data-k={c.k} data-tone={c.tone}>
          <dt>{c.label}</dt>
          <dd>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * V27 (REPORT §361, brief §24–§25): the case's stage in under two seconds — seven stages over the existing statuses
 * (`caseStage`, no new state), done / current / next, with the current stage marked when it has stopped moving or a
 * deadline has passed, and when the case last changed. Colour is used once: on the current stage.
 */
export function CaseProgress({ studentId, statuses }: { studentId: string; statuses: string[] }) {
  const { t } = useT();
  const q = useMovement(studentId);
  const m = q.data;
  const { index } = caseStage(statuses);
  const stalled = !!m?.waiting_on && (m.days_since_moved ?? 0) >= 7;
  const dl = m?.deadline;
  const overdue = !!dl && new Date(`${dl.date}T23:59:59`).getTime() < Date.now();
  const next = MACRO_STAGES[index + 1];
  // V28 (UX_AUDIT AG-2): one quiet line — the stage is stated once, here; the strip below says why / next / who / when.
  return (
    <div className={`ag27-progress${stalled || overdue ? ' is-blocked' : ''}`}>
      <ol className="ag27-progress__bar" aria-label={t('v27.stage.label')}>
        {MACRO_STAGES.map((s, i) => (
          <li key={s} className={i < index ? 'is-done' : i === index ? 'is-current' : undefined} aria-current={i === index ? 'step' : undefined}>
            <span className="hg-sr-only">{t(`v27.stage.${s}`)}</span>
          </li>
        ))}
      </ol>
      <p className="ag27-progress__line">
        <strong>{t(`v27.stage.${MACRO_STAGES[index]}`)}</strong>
        <span className="ag27-progress__step">{t('v28.stage.of', { n: index + 1, total: MACRO_STAGES.length })}</span>
        {next && <span>{t('v28.stage.next', { stage: t(`v27.stage.${next}`) })}</span>}
        {(stalled || overdue) && <span className="ag27-progress__flag">{overdue ? t('v27.stage.overdue') : t('v27.stage.stalled', { count: m?.days_since_moved ?? 0 })}</span>}
        {m && m.days_since_moved != null && !stalled && <span className="ag27-progress__recent">{t('v27.stage.recent', { count: m.days_since_moved })}</span>}
      </p>
    </div>
  );
}
