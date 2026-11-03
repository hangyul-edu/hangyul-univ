import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, CheckRow, ChipGroup, EmptyState, ListGroup, QueryState, Screen, useFormat, taskTitle } from '@hangyul/mobile-ui';
import type { Page, Task } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { mapWebLink, qk } from '../../src/queries';

type View = 'today' | 'overdue' | 'week' | 'waiting' | 'team';
const VIEWS: View[] = ['today', 'overdue', 'week', 'waiting', 'team'];

function inView(x: Task, v: View): boolean {
  if (x.status === 'DONE' || x.status === 'CANCELLED') return false;
  const due = x.due_at ? new Date(x.due_at).getTime() : null;
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const endWeek = Date.now() + 7 * 86_400_000;
  switch (v) {
    case 'today': return due !== null && due <= endToday.getTime() && !x.overdue;
    case 'overdue': return x.overdue;
    case 'week': return due !== null && due <= endWeek;
    case 'waiting': return x.status === 'BLOCKED' || (!!x.depends_on && !x.depends_on.done);
    default: return true;
  }
}

/** My work by urgency. Ticking a task completes it; tapping the text opens what it's about. */
export default function TasksScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View>(VIEWS.includes(params.view as View) ? (params.view as View) : 'today');
  useEffect(() => { if (VIEWS.includes(params.view as View)) setView(params.view as View); }, [params.view]);
  const scope = view === 'team' ? 'team' : 'mine';
  const q = useQuery({ queryKey: qk.tasks(scope), queryFn: () => api.tasks.list({ scope, status: ['OPEN', 'IN_PROGRESS', 'BLOCKED'], page_size: 200 }) });
  const complete = useMutation({
    mutationFn: (id: string) => api.tasks.update(id, { status: 'DONE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.tasks(scope) });
      const prev = qc.getQueryData<Page<Task>>(qk.tasks(scope));
      if (prev) qc.setQueryData<Page<Task>>(qk.tasks(scope), { ...prev, items: prev.items.map((x) => (x.id === id ? { ...x, status: 'DONE' } : x)) });
      return { prev };
    },
    onError: (e: Error, _id, ctx) => { if (ctx?.prev) qc.setQueryData(qk.tasks(scope), ctx.prev); Alert.alert(t('common:states.error'), e.message); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['tasks'] }); void qc.invalidateQueries({ queryKey: ['agency', 'today'] }); },
  });
  const all = q.data?.items ?? [];
  const count = (v: View) => all.filter((x) => inView(x, v)).length;
  // V4: never open on an empty view — without an explicit view, start at the first of overdue / today / week that has work.
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (autoPicked || !q.data || VIEWS.includes(params.view as View)) return;
    setAutoPicked(true);
    const first = (['overdue', 'today', 'week'] as View[]).find((v) => q.data!.items.some((x) => inView(x, v)));
    if (first) setView(first);
  }, [q.data, autoPicked, params.view]);

  return (
    <Screen title={t('common:nav.tasks')} onRefresh={() => q.refetch()}>
      <ChipGroup<View> options={VIEWS.map((v) => ({ value: v, label: v === 'team' ? t('v3.tasks.view.team') : `${t(`v3.tasks.view.${v}`)} · ${count(v)}` }))} selected={[view]} onToggle={setView} />
      <QueryState query={q}>
        {() => {
          const items = all.filter((x) => inView(x, view)).sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));
          if (!items.length) return <EmptyState icon={ListChecks} title={t(`v3.tasks.empty.${view}`)} />;
          return (
            <ListGroup>
              {items.map((x) => (
                <CheckRow key={x.id} checked={false} disabled={complete.isPending || view === 'team'}
                  onToggle={view === 'team' ? undefined : () => complete.mutate(x.id)}
                  label={taskTitle(t, x)}
                  detail={[
                    x.student_name,
                    x.due_at ? (x.overdue ? t('v3.tasks.overdue', { when: f.due(x.due_at) }) : f.due(x.due_at)) : null,
                    x.priority === 'URGENT' || x.priority === 'HIGH' ? t(`common:priority.${x.priority}`) : null,
                    view === 'team' && x.owner ? x.owner.full_name : null,
                    x.depends_on && !x.depends_on.done ? t('v3.tasks.waitingOn', { what: taskTitle(t, { ...x.depends_on, title_params: x.depends_on.title_params }) }) : null,
                  ].filter(Boolean).join(' · ')}
                  trailing={x.link && mapWebLink(x.link) ? <AppText variant="caption" weight="semibold" onPress={() => router.push(mapWebLink(x.link)!)}>{t('v3.tasks.open')}</AppText> : null}
                />
              ))}
            </ListGroup>
          );
        }}
      </QueryState>
    </Screen>
  );
}
