import { useAuth } from '@hangyul/auth';
import { AlarmClock, CalendarDays, CalendarRange, Check, CheckCircle2, Hourglass, Plus, UserRound, UserRoundCheck } from '@hangyul/icons';
import type { Task, TaskPriority, TaskType } from '@hangyul/types';
import { Button, EmptyState, ErrorState, Popover, FilterSelect, Skeleton, StatusText } from '@hangyul/ui';
import { Col, PageHeader, ProgressRow, Row, StatCard, YCard, YTabs, type YxTone } from '@hangyul/ynex-ui';
import { cx, formatDateTime, formatNumber, formatRelative } from '@hangyul/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { FilterBar, SearchBox, useT, WaitingOn } from '../components/bits';
import { CreateTaskModal, PRIORITIES, TASK_TYPES, useTaskMutations } from '../components/TaskBits';
import { usePerms, useTeam, useUrlFilters } from '../lib/hooks';
import { taskTitle, taskWaitingOn } from '../lib/logic';
import { YAvatar } from '../components/ynex';
import { MeetingsView } from './Consultations';
import { DeadlinesView } from './Deadlines';

const PRIO_TONE: Record<TaskPriority, YxTone> = { URGENT: 'danger', HIGH: 'warning', MEDIUM: 'primary', LOW: 'light' };

type View = 'today' | 'overdue' | 'week' | 'waiting' | 'mine' | 'team';
const VIEWS: View[] = ['today', 'overdue', 'week', 'waiting', 'mine', 'team'];
// V8: Deadlines and Consultations are Tasks views (their old routes redirect here).
type AnyView = View | 'deadlines' | 'meetings';
const EXTRA_VIEWS = ['deadlines', 'meetings'] as const;
const PRIO_ORDER: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }

/** Which view(s) a task belongs to. "Waiting" = tasks someone else has to move first (see `taskWaitingOn`). */
export function inView(task: Task, view: View, me: string | undefined, now = Date.now()): boolean {
  const due = task.due_at ? new Date(task.due_at).getTime() : null;
  switch (view) {
    case 'overdue': return task.overdue;
    case 'today': return !task.overdue && due !== null && due <= endOfToday();
    case 'week': return !task.overdue && due !== null && due > endOfToday() && due <= now + 7 * 86_400_000;
    case 'waiting': return taskWaitingOn(task).kind !== 'us';
    case 'mine': return task.owner?.id === me || !task.owner;
    default: return true;
  }
}

function WorkRow({ task }: { task: Task }) {
  const { t, locale } = useT();
  const perms = usePerms();
  const team = useTeam();
  const m = useTaskMutations();
  const done = task.status === 'DONE';
  const members = (team.data?.members ?? []).filter((x) => x.active);
  const wait = taskWaitingOn(task, (d) => taskTitle(t, d));
  const waitingOn = wait.kind === 'blocked' ? <StatusText tone="danger" colored>{t('tasksPage.wait.blocked')}</StatusText>
    : wait.kind === 'after' ? <span className="hg-truncate ag-cell-block" title={wait.title}>{t('tasksPage.wait.after', { title: wait.title })}</span>
      : wait.kind === 'us' ? <span className="hg-subtle ag-work__ready">{t('tasksPage.wait.ready')}</span>
        : <WaitingOn on={wait.kind} bare />;
  return (
    <li className={cx('ag-work', task.overdue && 'ag-work--overdue')}>
      <button type="button" className="ag-task__check" role="checkbox" aria-checked={done} aria-label={t('tasksPage.complete', { title: taskTitle(t, task) })}
        disabled={m.isPending || done} onClick={() => m.mutate({ id: task.id, patch: { status: 'DONE' }, msg: t('tasksPage.completed') })}>
        {done && <Check aria-hidden />}
      </button>
      <span className="ag-work__student hg-truncate">
        {task.student_id ? <Link to={`/students/${task.student_id}?tab=tasks`} className="ag-link-plain hg-medium">{task.student_name ?? t('misc.student')}</Link> : <span className="hg-subtle">—</span>}
      </span>
      <span className="ag-work__main">
        <span className="ag-work__title hg-truncate">{task.link ? <Link to={task.link}>{taskTitle(t, task)}</Link> : taskTitle(t, task)}</span>
        {task.university && <span className="ag-work__meta hg-truncate">{task.university}</span>}
      </span>
      <span className="ag-work__due" title={formatDateTime(task.due_at, locale)}>
        {task.due_at ? <span className={task.overdue ? 'ag-overdue' : undefined}>{formatRelative(task.due_at, locale)}</span> : <span className="hg-subtle">{t('tasksPage.noDue')}</span>}
      </span>
      <span className="ag-work__prio"><span className={cx('badge', PRIO_TONE[task.priority] === 'light' ? 'bg-light text-muted' : `bg-${PRIO_TONE[task.priority]}-transparent`)}>{t(`priority.${task.priority}`)}</span></span>
      <span className="ag-work__wait">{waitingOn}</span>
      <span className="ag-work__owner">
        <Popover width={260} align="end" trigger={(p) => (
          <button type="button" className="ag-owner-btn" aria-label={t('tasksPage.reassign', { title: taskTitle(t, task) })} {...p}>
            {task.owner ? <YAvatar name={task.owner.full_name} size="xs" /> : <span className="ag-owner-empty"><UserRound size={13} aria-hidden /></span>}
            <span className="hg-truncate hg-xs">{task.owner?.full_name ?? t('tasksPage.unclaimed')}</span>
          </button>
        )}>
          {(close) => (
            <div role="menu" aria-label={t('actions.reassign')} style={{ maxHeight: 300, overflowY: 'auto' }}>
              {task.owner?.id !== perms.userId && (
                <button type="button" role="menuitem" className="hg-menu-item" onClick={() => { close(); m.mutate({ id: task.id, patch: { owner_user_id: perms.userId }, msg: t('tasksPage.claimed') }); }}>
                  <UserRoundCheck aria-hidden /> {t('tasksPage.assignMe')}
                </button>
              )}
              {members.filter((x) => x.user_id !== perms.userId).map((x) => (
                <button key={x.user_id} type="button" role="menuitem" className="hg-menu-item"
                  onClick={() => { close(); m.mutate({ id: task.id, patch: { owner_user_id: x.user_id }, msg: t('tasksPage.reassigned', { name: x.full_name }) }); }}>
                  <YAvatar name={x.full_name} size="xs" /><span className="hg-grow hg-truncate">{x.full_name}</span>
                </button>
              ))}
              <hr className="hg-divider" style={{ margin: '4px 0' }} />
              {PRIORITIES.filter((p) => p !== task.priority).map((p) => (
                <button key={p} type="button" role="menuitem" className="hg-menu-item hg-small" onClick={() => { close(); m.mutate({ id: task.id, patch: { priority: p } }); }}>
                  {t('tasksPage.setPriority', { p: t(`priority.${p}`) })}
                </button>
              ))}
              <button type="button" role="menuitem" className="hg-menu-item hg-small"
                onClick={() => { close(); m.mutate({ id: task.id, patch: { status: task.status === 'BLOCKED' ? 'OPEN' : 'BLOCKED' } }); }}>
                {task.status === 'BLOCKED' ? t('tasksPage.unblock') : t('tasksPage.markBlocked')}
              </button>
            </div>
          )}
        </Popover>
      </span>
    </li>
  );
}

export default function Tasks() {
  const { api } = useAuth();
  const { t, locale } = useT();
  const perms = usePerms();
  const f = useUrlFilters(['view', 'type', 'priority', 'q'] as const);
  const anyView = ([...VIEWS, ...EXTRA_VIEWS] as string[]).includes(f.values.view) ? (f.values.view as AnyView) : 'mine';
  const extra = anyView === 'deadlines' || anyView === 'meetings' ? anyView : null;
  const view = (extra ? 'mine' : anyView) as View;
  const dl = useQuery({ queryKey: ['agency', 'deadlines', 30], queryFn: () => api.agency.deadlines(30) });
  const appts = useQuery({ queryKey: ['agency', 'appointments'], queryFn: () => api.agency.appointments() });
  const extraCount = { deadlines: dl.data?.length, meetings: appts.data?.filter((a) => a.bucket === 'upcoming' || a.bucket === 'follow_up').length };
  const [creating, setCreating] = useState(false);
  const query = { scope: 'team' as const, page_size: 200, task_type: f.values.type || undefined };
  const q = useQuery({ queryKey: ['tasks', query], queryFn: () => api.tasks.list(query) });

  const filtered = useMemo(() => {
    const needle = f.values.q.trim().toLowerCase();
    return (q.data?.items ?? []).filter((x) => (!f.values.priority || x.priority === f.values.priority)
      && (!needle || x.title.toLowerCase().includes(needle) || (x.student_name ?? '').toLowerCase().includes(needle)));
  }, [q.data, f.values.priority, f.values.q]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v, filtered.filter((x) => inView(x, v, perms.userId)).length])) as Record<View, number>, [filtered, perms.userId]);
  const rows = filtered.filter((x) => inView(x, view, perms.userId))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]);

  // task-list-view.html side cards: the same view counts as the tabs (one predicate, `inView`), each switching to that view;
  // open work by priority filters the list. Nothing here is counted any other way.
  const openFiltered = (q.data?.items ?? []).filter((x) => x.status !== 'DONE' && x.status !== 'CANCELLED' && inView(x, view, perms.userId));
  const byPrio = (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({ p, n: openFiltered.filter((x) => x.priority === p).length }));
  const prioMax = Math.max(1, ...byPrio.map((x) => x.n));
  const setView = (v: AnyView) => f.set({ view: v === 'mine' ? null : v });
  const stat = (v: View, tone: YxTone, icon: React.ReactNode) => (
    <StatCard tone={tone} icon={icon} label={t(`tasksPage.view.${v}`)} value={q.data ? formatNumber(counts[v], locale) : <Skeleton w={32} h={24} />}
      onClick={() => setView(v)} selected={!extra && view === v} />
  );
  return (
    <div className="ag7 ag7-tasks">
      <PageHeader title={t('tasksPage.title')} sub={t('v7.tasks.sub')}
        actions={<Button variant="primary" size="sm" icon={<Plus />} onClick={() => setCreating(true)}>{t('tasksPage.new')}</Button>} />
      <Row>
        <Col xxl={9} xl={8}>
      <YCard className="ag-table-panel ag7-taskcard" flush title={extra ? t(`v8.tasks.view.${extra}`) : t(`tasksPage.view.${view}`)} count={extra ? extraCount[extra] : q.data ? rows.length : undefined}>
        <div className="ag7-viewtabs">
          <YTabs label={t('tasksPage.title')} value={extra ?? view} onChange={setView}
            tabs={[...VIEWS.map((v) => ({ id: v as AnyView, label: t(`tasksPage.view.${v}`), count: q.data ? counts[v] : undefined, alert: v === 'overdue' })),
              ...EXTRA_VIEWS.map((v) => ({ id: v as AnyView, label: t(`v8.tasks.view.${v}`), count: extraCount[v] }))]} />
        </div>
        {extra === 'deadlines' ? <div className="ag8-embed__pad"><DeadlinesView /></div> : extra === 'meetings' ? <div className="ag8-embed__pad"><MeetingsView /></div> : <>
        <div className="ag-card-toolbar">
          <FilterBar active={[f.values.type, f.values.priority].filter(Boolean).length} onClear={() => f.set({ type: null, priority: null, q: null })}
            search={<SearchBox value={f.values.q} onChange={(v) => f.set({ q: v })} placeholder={t('tasksPage.searchPh')} label={t('actions.search')} />}>
            <FilterSelect size="sm" label={t('tasksPage.type')} value={f.values.type} onChange={(e) => f.set({ type: e.target.value })}>
              <option value="">{t('tasksPage.allTypes')}</option>
              {TASK_TYPES.map((x: TaskType) => <option key={x} value={x}>{t(`taskType.${x}`)}</option>)}
            </FilterSelect>
            <FilterSelect size="sm" label={t('tasksPage.priority')} value={f.values.priority} onChange={(e) => f.set({ priority: e.target.value })}>
              <option value="">{t('tasksPage.allPriorities')}</option>
              {PRIORITIES.map((x: TaskPriority) => <option key={x} value={x}>{t(`priority.${x}`)}</option>)}
            </FilterSelect>
          </FilterBar>
        </div>
        {q.isLoading ? <div style={{ padding: 16 }} className="hg-stack">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} r={6} />)}</div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
            : rows.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title={t(`tasksPage.emptyView.${view}`)} text={t('tasksPage.emptyText')}
                action={<Button size="sm" icon={<Plus />} onClick={() => setCreating(true)}>{t('tasksPage.new')}</Button>} />
            ) : (
              <div className="ag-worklist-wrap">
                <div className="ag-work ag-work--head" aria-hidden>
                  <span /><span>{t('tasksPage.col.student')}</span><span>{t('tasksPage.col.task')}</span>
                  <span>{t('tasksPage.col.due')}</span><span>{t('tasksPage.col.priority')}</span><span>{t('tasksPage.col.waiting')}</span><span>{t('tasksPage.col.owner')}</span>
                </div>
                <ul className="ag-worklist" aria-label={t(`tasksPage.view.${view}`)}>{rows.map((task) => <WorkRow key={task.id} task={task} />)}</ul>
              </div>
            )}
        {q.data && q.data.total > q.data.items.length && <p className="hg-subtle hg-xs" style={{ padding: '8px 16px' }}>{t('tasksPage.truncated', { shown: q.data.items.length, total: q.data.total })}</p>}
        </>}
      </YCard>
        </Col>
        <Col xxl={3} xl={4}>
          <div className="ag7-sidestats">
            {stat('overdue', 'danger', <AlarmClock />)}
            {stat('today', 'primary', <CalendarDays />)}
            {stat('week', 'info', <CalendarRange />)}
            {stat('waiting', 'warning', <Hourglass />)}
          </div>
          <YCard title={t('v7.tasks.byPriority')}>
            <p className="text-muted fs-12 mb-2">{t('v7.tasks.byPrioritySub', { view: t(`tasksPage.view.${view}`) })}</p>
            {byPrio.map(({ p, n }) => (
              <button key={p} type="button" className="ag7-prio" aria-pressed={f.values.priority === p} onClick={() => f.set({ priority: f.values.priority === p ? null : p })}>
                <ProgressRow label={t(`priority.${p}`)} value={n} max={prioMax} tone={PRIO_TONE[p] === 'light' ? 'secondary' : PRIO_TONE[p]} display={formatNumber(n, locale)} />
              </button>
            ))}
          </YCard>
        </Col>
      </Row>
      <CreateTaskModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
