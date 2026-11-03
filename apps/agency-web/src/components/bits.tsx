import { useAuth } from '@hangyul/auth';
import { ChevronRight, Info, Lock, Search, SlidersHorizontal, Timer } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { AgencyNextAction, AgencyWaitingOwner, AgencyWaitingParty, AgencyWaitingReason, ApplicationStatus, DocumentStatus, EssayStatus, PipelineStage, TaskPriority, TaskType, VisaStatus } from '@hangyul/types';
import { Avatar, Badge, Button, Card, CardHeader, Drawer, Skeleton, StatusText } from '@hangyul/ui';
import {
  applicationTone, countryName, cx, documentTone, essayTone, flagEmoji, pipelineTone, priorityTone, visaTone,
} from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useDebounced } from '../lib/hooks';
import { parseIntake, slaState, taskTitle } from '../lib/logic';

export function useT() {
  return useLocale(['agency', 'common']);
}

// ----------------------------------------------------------------------------- badges
export function StageBadge({ stage }: { stage: PipelineStage }) {
  const { t } = useT();
  return <StatusText tone={pipelineTone(stage)}>{t(`pipeline.${stage}`)}</StatusText>;
}
export function AppStatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useT();
  return <StatusText tone={applicationTone[status] ?? 'neutral'}>{t(`appStatus.${status}`)}</StatusText>;
}
export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useT();
  return <StatusText tone={documentTone[status] ?? 'neutral'}>{t(`docStatus.${status}`)}</StatusText>;
}
export function EssayStatusBadge({ status }: { status: EssayStatus }) {
  const { t } = useT();
  return <StatusText tone={essayTone[status] ?? 'neutral'}>{t(`essayStatus.${status}`)}</StatusText>;
}
export function VisaStatusBadge({ status }: { status: VisaStatus }) {
  const { t } = useT();
  return <StatusText tone={visaTone[status] ?? 'neutral'}>{t(`visaStatus.${status}`)}</StatusText>;
}
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { t } = useT();
  return <Badge size="sm" dot tone={priorityTone[priority]}>{t(`priority.${priority}`)}</Badge>;
}
export function TaskTypeBadge({ type }: { type: TaskType }) {
  const { t } = useT();
  return <Badge size="sm" outline tone="neutral">{t(`taskType.${type}`)}</Badge>;
}
/** Always-visible label for staff-only content (never rendered in student-facing apps). */
export function InternalBadge() {
  const { t } = useT();
  return <span className="ag-internal-tag"><Lock aria-hidden size={12} />{t('misc.internalTag')}</span>;
}

export function Flag({ code, name = true }: { code: string | null | undefined; name?: boolean }) {
  const { locale } = useT();
  if (!code) return <span className="hg-subtle">—</span>;
  return (
    <span className="ag-flag" title={countryName(code, locale)}>
      <span aria-hidden>{flagEmoji(code)}</span>
      {name ? <span className="hg-truncate">{countryName(code, locale)}</span> : <span className="hg-sr-only">{countryName(code, locale)}</span>}
    </span>
  );
}

export function Intake({ value }: { value: string | null | undefined }) {
  const { t } = useT();
  const p = parseIntake(value);
  if (!p) return <span className="hg-subtle">—</span>;
  return <>{t('intakeLabel', { term: t(`term.${p.term}`), year: p.year })}</>;
}

export function Person({ name, sub, size = 28, to }: { name: string | null | undefined; sub?: ReactNode; size?: number; to?: string }) {
  const { t } = useT();
  if (!name) return <span className="hg-subtle hg-small">{t('misc.unassigned')}</span>;
  const inner = (
    <span className="ag-person">
      <Avatar name={name} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="hg-truncate ag-person__name">{name}</span>
        {sub && <span className="hg-subtle hg-xs hg-truncate" style={{ display: 'block' }}>{sub}</span>}
      </span>
    </span>
  );
  return to ? <Link to={to} className="ag-link-plain" onClick={(e) => e.stopPropagation()}>{inner}</Link> : inner;
}

/** Small (i) with the metric definition as native tooltip + screen-reader text. */
export function HelpTip({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <span className="ag-help" title={text} tabIndex={0} aria-label={text} role="note">
      <Info aria-hidden size={13} />
    </span>
  );
}

export function SlaBadge({ dueAt, respondedAt, compact }: { dueAt: string | null | undefined; respondedAt?: string | null; compact?: boolean }) {
  const { t } = useT();
  const s = slaState(dueAt, respondedAt);
  if (s.state === 'none') return compact ? null : <span className="hg-subtle hg-small">—</span>;
  const h = Math.abs(s.hours ?? 0);
  const dur = h >= 48 ? t('misc.days', { count: Math.round(h / 24) }) : t('misc.hours', { count: Math.round(h) });
  const map = {
    met: { tone: 'success' as const, text: t('sla.met') },
    late: { tone: 'warning' as const, text: t('sla.late', { dur }) },
    pending: { tone: (s.hours ?? 0) < 4 ? ('warning' as const) : ('info' as const), text: t('sla.dueIn', { dur }) },
    breached: { tone: 'danger' as const, text: t('sla.breachedBy', { dur }) },
  }[s.state];
  return <Badge size="sm" tone={map.tone} icon={<Timer aria-hidden />}>{map.text}</Badge>;
}

// ----------------------------------------------------------------------------- waiting on (docs/STATE_MAP.md)
/** V9: seven parties (server services/waiting.py) + legacy `us` (counselor or agency team) for old saved views. */
export type WaitingParty = AgencyWaitingParty | 'us';
export const WAITING_PARTIES: AgencyWaitingParty[] = ['counselor', 'agency', 'hangyul', 'student', 'university', 'external'];
const WAIT_TONE: Record<WaitingParty, 'warning' | 'neutral' | 'info' | 'danger'> = {
  counselor: 'warning', agency: 'warning', hangyul: 'danger', us: 'warning', student: 'neutral', university: 'info', external: 'neutral',
};
/** Codes whose application status names the reason ("offer reply", "under review"). */
const APP_CODES = new Set(['app', 'app_university']);
/** Student-side next actions phrased from the reason when the student has no matching task. */
const STUDENT_WHAT: Record<string, string> = {
  university_request: 'v9.next.student.university_request', fix: 'v9.next.student.fix', submit_on_portal: 'v9.next.student.submit_on_portal',
  student_task: 'v9.next.student.student_task',
};

/** Words for the waiting model: the party, its one reason, the next action in that party's voice, and the owner. */
export function useWaitingText() {
  const { t } = useT();
  return {
    party: (on: WaitingParty) => t(on === 'us' ? 'waiting.us' : `v9.waiting.party.${on}`),
    reason: (r: AgencyWaitingReason | null | undefined) => {
      if (!r) return null;
      if (APP_CODES.has(r.code)) return r.status ? t(`waiting.app.${r.status}`, { defaultValue: '' }) || null : null;
      return t(`v9.waiting.reason.${r.code}`, { count: r.count ?? 1, defaultValue: t(`waiting.reason.${r.code}`, { count: r.count ?? 1, defaultValue: '' }) }) || null;
    },
    /** §55 #8: staff rows get a staff imperative; student rows read "Student: <their task>"; outside parties say what they do. */
    next: (na: AgencyNextAction | null | undefined) => {
      if (!na) return null;
      const p = na.params ?? {};
      if (na.party === 'student') {
        const what = na.task ? taskTitle(t, na.task)
          : APP_CODES.has(na.code) && p.status ? t(`v9.next.app.${p.status}`, { defaultValue: t(`waiting.app.${p.status}`, { defaultValue: '' }) })
            : t(STUDENT_WHAT[na.code] ?? 'v9.next.student.generic', { count: p.count ?? 1, university: p.university ?? '' });
        return t('v9.next.studentSays', { what });
      }
      if (na.party === 'university') return t('v9.next.universitySays', { what: p.status ? t(`waiting.app.${p.status}`, { defaultValue: '' }) : t('v9.next.uniDecision'), university: p.university ?? '' });
      if (na.party === 'external') return t(`v9.next.${na.code}`, { university: p.university ?? '' });
      if ((na.code === 'task' || na.code === 'task_unassigned') && na.task) return t('v9.next.taskTitle', { title: taskTitle(t, na.task) });
      return t(`v9.next.${na.code}`, { count: p.count ?? 1, university: p.university ?? '' });
    },
    owner: (o: AgencyWaitingOwner | null | undefined) => {
      if (!o) return null;
      if (o.kind === 'person' || o.kind === 'student' || o.kind === 'university') return o.name ?? t('misc.unassigned');
      if (o.kind === 'rail') return o.name ? t('v9.owner.railOf', { university: o.name }) : t('v9.owner.rail');
      return t(`v9.owner.${o.kind}`) + (o.kind === 'agency' && o.name ? ` · ${o.name}` : '');
    },
  };
}

/** Who has to act next, with the reason in plain words: "Counselor · student is waiting for a reply". One meaning everywhere. */
export function WaitingOn({ on, reason, bare }: { on: WaitingParty | null | undefined; reason?: AgencyWaitingReason | null; bare?: boolean }) {
  const w = useWaitingText();
  if (!on) return <span className="hg-subtle">—</span>;
  const why = w.reason(reason);
  return (
    <span className="ag-waiting" title={why ? `${w.party(on)} · ${why}` : w.party(on)}>
      <StatusText tone={WAIT_TONE[on] ?? 'neutral'} hollow={on === 'student' || on === 'external' || on === 'university'}>{w.party(on)}</StatusText>
      {why && !bare && <span className="ag-waiting__why">{why}</span>}
    </span>
  );
}

// ----------------------------------------------------------------------------- layout helpers
export function Panel({ title, subtitle, actions, to, linkLabel, children, className, pad = true, id }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; to?: string; linkLabel?: string; children: ReactNode; className?: string; pad?: boolean; id?: string;
}) {
  const { t } = useT();
  return (
    <Card className={cx('ag-panel', className)} as="section" aria-labelledby={id}>
      <CardHeader id={id} title={title} subtitle={subtitle} actions={<>
        {actions}
        {to && <Link to={to} className="ag-viewall">{linkLabel ?? t('actions.viewAll')}<ChevronRight size={14} aria-hidden className="hg-flip-rtl" /></Link>}
      </>} />
      <div className={pad ? 'ag-panel__body' : undefined}>{children}</div>
    </Card>
  );
}

/** Filters inline on desktop; behind a "Filters" button (bottom-sheet drawer) on phones. */
/**
 * Inline filters for wide screens; everything (including `more`) is also available in a drawer.
 * `more` holds secondary filters that never take inline space, so the bar stays on one line.
 */
export function FilterBar({ children, more, search, active, moreActive, onClear }: {
  children: ReactNode; more?: ReactNode; search?: ReactNode; active?: number; moreActive?: number; onClear?: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ag-filterbar">
        {search && <div className="ag-filterbar__search">{search}</div>}
        <div className="ag-filterbar__inline">{children}</div>
        <Button className={more ? 'ag-filterbar__btn ag-filterbar__btn--always' : 'ag-filterbar__btn'} size="sm" variant={moreActive ? 'soft' : 'secondary'} icon={<SlidersHorizontal />} onClick={() => setOpen(true)}>
          <span className="ag-filterbar__btnlabel--wide">{more ? t('actions.moreFilters') : t('actions.filter')}{moreActive ? ` · ${moreActive}` : ''}</span>
          <span className="ag-filterbar__btnlabel--narrow">{t('actions.filter')}{active ? ` · ${active}` : ''}</span>
        </Button>
        {!!active && onClear && <Button size="sm" variant="ghost" onClick={onClear}>{t('actions.clearFilters')}</Button>}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('actions.filter')}
        footer={<Button variant="primary" block onClick={() => setOpen(false)}>{t('actions.apply')}</Button>}>
        <div className="hg-stack ag-filterbar__drawer">{children}{more}</div>
      </Drawer>
    </>
  );
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  return (
    <div className="hg-input-icon">
      <Search aria-hidden />
      <input type="search" className="hg-input hg-input--sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

// ----------------------------------------------------------------------------- student picker
export function StudentPicker({ value, onChange, label }: { value: { id: string; full_name: string } | null; onChange: (v: { id: string; full_name: string } | null) => void; label: string }) {
  const { api } = useAuth();
  const { t } = useT();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const res = useQuery({
    queryKey: ['agency', 'students', { q: dq, page_size: 8, picker: true }],
    queryFn: () => api.agency.students({ q: dq, page_size: 8 }),
    enabled: !value,
  });
  if (value) {
    return (
      <div className="ag-picked">
        <Person name={value.full_name} />
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>{t('misc.change')}</Button>
      </div>
    );
  }
  return (
    <div className="ag-picker">
      <SearchBox value={q} onChange={setQ} placeholder={t('misc.searchStudents')} label={label} />
      <div className="ag-picker__list" role="listbox" aria-label={label}>
        {res.isLoading && <div style={{ padding: 8 }}><Skeleton h={28} /></div>}
        {res.data?.items.length === 0 && <div className="hg-subtle hg-small" style={{ padding: 10 }}>{t('states.noResults')}</div>}
        {res.data?.items.map((s) => (
          <button key={s.id} type="button" role="option" aria-selected={false} className="hg-menu-item" onClick={() => onChange({ id: s.id, full_name: s.full_name })}>
            <span aria-hidden>{flagEmoji(s.nationality)}</span>
            <span className="hg-grow hg-truncate">{s.full_name}<span className="hg-subtle hg-xs" style={{ display: 'block' }}>{s.email}</span></span>
            <StageBadge stage={s.pipeline_stage} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Meter({ value, max, label, danger }: { value: number; max: number | null; label?: string; danger?: boolean }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const tone = danger || pct >= 100 ? 'var(--hg-status-danger-solid)' : pct >= 85 ? 'var(--hg-status-warning-solid)' : 'var(--hg-chart-ink)';
  return (
    <div className="ag-meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max ?? undefined} aria-label={label}>
      <div className="hg-progress hg-progress--sm"><div className="hg-progress__bar" style={{ width: `${pct}%`, background: tone } as CSSProperties} /></div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="hg-kbd">{children}</kbd>;
}

/**
 * Mobile card renderer for DataTable rows that contain links/buttons. The shared DataTable wraps default cards in a
 * <button>, which would nest interactive elements; renderCard uses a plain container instead.
 */
export function kvCard<T>(title: (r: T) => ReactNode, items: [ReactNode, (r: T) => ReactNode][]) {
  return function Card(r: T) {
    return (
      <div className="ag-kvcard">
        <div className="hg-strong">{title(r)}</div>
        {items.map(([label, value], i) => (
          <div key={i} className="hg-rowcard__kv"><span>{label}</span><span>{value(r)}</span></div>
        ))}
      </div>
    );
  };
}
