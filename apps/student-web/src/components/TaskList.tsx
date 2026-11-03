import { localizedTitle } from '@hangyul/i18n';
import { useApi, useAuth } from '@hangyul/auth';
import { Check, ChevronRight } from '@hangyul/icons';
import type { Page, Task } from '@hangyul/types';
import { EmptyState, QueryState, Section, SkeletonCard, StatusText, useToast } from '@hangyul/ui';
import { daysUntil, formatDate } from '@hangyul/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useT } from '../lib/i18n';
import { DaysLeft } from './bits';

type When = 'now' | 'week' | 'later';
const WHEN: When[] = ['now', 'week', 'later'];

/** Now = overdue or due within two days; This week = within seven days; Later = the rest (or no date). */
export function whenOf(dueAt: string | null, now = new Date()): When {
  const d = daysUntil(dueAt, now);
  if (d === null) return 'later';
  if (d <= 2) return 'now';
  return d <= 7 ? 'week' : 'later';
}

export const TASKS_KEY = ['tasks', { scope: 'mine' }];

/** The student's open tasks — one query, shared by the home's "what Hangyul is doing" block and the full list. */
export function useMyTasks() {
  const api = useApi();
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => api.tasks.list({ page_size: 100 }) });
}

function TaskRow({ task, mine, onDone, busy }: { task: Task; mine: boolean; onDone: () => void; busy: boolean }) {
  const { t, locale } = useT();
  const title = localizedTitle(t, task);
  return (
    <li className="stk-row">
      {mine ? (
        <button type="button" className="stk-check" role="checkbox" aria-checked={false} aria-label={t('tasks.markDone', { title })} onClick={onDone} disabled={busy}>
          <Check aria-hidden />
        </button>
      ) : <span className="stk-check stk-check--theirs" aria-hidden />}
      <div className="stk-main">
        {task.link ? <Link to={task.link} className="stk-title">{title}</Link> : <span className="stk-title">{title}</span>}
        <div className="stk-meta">
          {/* V22 (REPORT §246 A4): a task that is not the student's is the Hangyul team's — never a staff name. */}
          <span>{mine ? t('tasksV3.owner.you') : t('tasksV3.owner.team')}</span>
          {task.university && <span>{task.university}</span>}
          {task.depends_on && !task.depends_on.done && <span>{t('tasksV3.after', { title: localizedTitle(t, task.depends_on) })}</span>}
        </div>
        {task.description && <p className="stk-desc">{task.description}</p>}
      </div>
      <div className="stk-end">
        {task.due_at ? (
          <>
            <span className="hg-small hg-num">{formatDate(task.due_at, locale, { month: 'short', day: 'numeric' })}</span>
            <DaysLeft date={task.due_at} />
          </>
        ) : <span className="hg-xs hg-subtle">{t('tasksV3.noDate')}</span>}
      </div>
      {task.link && <ChevronRight className="stk-chev hg-flip-rtl" aria-hidden />}
    </li>
  );
}

/**
 * The full task list. V22 (REPORT §248 S4): `/tasks` is no longer a destination — the home *is* the task list,
 * and this renders inline there when the student asks for everything (`/?show=tasks`).
 */
export function TaskList() {
  const { t } = useT();
  const api = useApi();
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useMyTasks();
  const done = useMutation({
    mutationFn: (id: string) => api.tasks.update(id, { status: 'DONE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<Page<Task>>(TASKS_KEY);
      qc.setQueryData<Page<Task>>(TASKS_KEY, (p) => (p ? { ...p, items: p.items.filter((x) => x.id !== id), total: p.total - 1 } : p));
      return { prev };
    },
    onError: (e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev); toast.error((e as Error).message); },
    onSuccess: () => toast.success(t('tasks.doneToast')),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
  const me = session?.user.id;
  return (
    <QueryState query={q} skeleton={<SkeletonCard lines={6} />} isEmpty={(d) => d.items.length === 0}
      empty={<EmptyState compact title={t('tasks.empty')} text={t('tasks.emptyText')} />}>
      {(d) => {
        const groups: Record<When, Task[]> = { now: [], week: [], later: [] };
        d.items.forEach((x) => groups[whenOf(x.due_at)].push(x));
        const theirs = d.items.filter((x) => x.owner && x.owner.id !== me).length;
        return (
          <div className="hg-stack" style={{ gap: 24 }}>
            <p className="hg-muted hg-small">
              {theirs > 0 ? t('tasksV3.summary', { mine: d.items.length - theirs, theirs }) : t('tasksV3.summaryMine', { count: d.items.length })}
            </p>
            {WHEN.map((w) => groups[w].length > 0 && (
              <Section key={w} title={t(`tasksV3.when.${w}`)} headingLevel={3} action={w === 'now' ? <StatusText tone="danger">{t('tasksV3.count', { count: groups[w].length })}</StatusText> : <span className="hg-small hg-subtle">{t('tasksV3.count', { count: groups[w].length })}</span>}>
                <ul className="hg-panel stk-list">
                  {groups[w].map((x) => (
                    <TaskRow key={x.id} task={x} mine={!x.owner || x.owner.id === me} onDone={() => done.mutate(x.id)} busy={done.isPending && done.variables === x.id} />
                  ))}
                </ul>
              </Section>
            ))}
          </div>
        );
      }}
    </QueryState>
  );
}
