import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Badge, CheckRow, EmptyState, ListGroup, QueryState, Screen, SectionHeader, StatusBadge, useFormat, taskTitle } from '@hangyul/mobile-ui';
import type { Task } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react-native';
import { Alert } from 'react-native';

import { qk } from '../src/queries';

export default function TasksScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.tasks, queryFn: () => api.tasks.list({ page_size: 100 }) });
  const done = useMutation({
    mutationFn: (id: string) => api.tasks.update(id, { status: 'DONE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.tasks });
      const prev = qc.getQueryData<{ items: Task[] }>(qk.tasks);
      if (prev) qc.setQueryData(qk.tasks, { ...prev, items: prev.items.map((x) => (x.id === id ? { ...x, status: 'DONE' } : x)) });
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.tasks, ctx.prev);
      Alert.alert(t('common:states.error'), e.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.tasks });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });

  const confirmDone = (task: Task) =>
    Alert.alert(t('student.tasks.confirmTitle'), task.title, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      { text: t('common:actions.markDone'), onPress: () => done.mutate(task.id) },
    ]);

  return (
    <Screen onRefresh={() => q.refetch()}>
      <AppText variant="caption">{t('student.tasks.subtitle')}</AppText>
      <QueryState query={q}>
        {(page) => {
          if (page.items.length === 0) return <EmptyState icon={ListChecks} title={t('student.tasks.empty')} body={t('student.tasks.emptyBody')} />;
          const overdue = page.items.filter((x) => x.overdue && x.status !== 'DONE');
          const rest = page.items.filter((x) => !overdue.includes(x));
          return (
            <>
              {overdue.length > 0 ? (
                <>
                  <SectionHeader title={t('student.tasks.overdue', { count: overdue.length })} />
                  <TaskGroup tasks={overdue} onDone={confirmDone} />
                </>
              ) : null}
              <SectionHeader title={t('student.tasks.upcoming')} />
              <TaskGroup tasks={rest} onDone={confirmDone} />
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function TaskGroup({ tasks, onDone }: { tasks: Task[]; onDone: (t: Task) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <ListGroup>
      {tasks.map((task) => (
        <CheckRow
          key={task.id}
          label={taskTitle(t, task)}
          detail={[t(`common:taskType.${task.task_type}`, { defaultValue: task.task_type }), task.due_at ? `${f.deadline(task.due_at)} · ${f.due(task.due_at)}` : null].filter(Boolean).join(' · ')}
          checked={task.status === 'DONE'}
          onToggle={task.status === 'DONE' ? undefined : () => onDone(task)}
          trailing={task.status === 'DONE' ? <StatusBadge kind="task" value="DONE" /> : task.priority === 'HIGH' || task.priority === 'URGENT' ? <StatusBadge kind="priority" value={task.priority} /> : task.overdue ? <Badge label={t('common:time.overdue')} tone="danger" /> : null}
        />
      ))}
    </ListGroup>
  );
}
