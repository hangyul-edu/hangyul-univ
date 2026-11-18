import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, CheckRow, ErrorState, ListGroup, ListItem, LoadingState, Screen, SectionTitle, TextField, theme, useFormat, taskTitle } from '@hangyul/mobile-ui';
import type { AgencyToday, Task } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CircleCheck, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { qk } from '../../src/queries';
import { attentionRank, StudentRow } from '../../src/StudentRow';

/** How many students Today lists before "See all" takes over. */
const QUEUE_ROWS = 6;

/**
 * Today answers one question: who needs me right now? The student queue comes first (student · next action · due ·
 * stage · waiting on); the per-queue counts follow it, and every count opens exactly the list it counts.
 */
export default function TodayScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const { session } = useAuth();
  const today = useQuery({ queryKey: ['agency', 'today'], queryFn: () => api.agency.today(), refetchInterval: 60_000 });
  const queue = useQuery({ queryKey: qk.attention, queryFn: () => api.agency.students({ view: 'attention', page_size: 50 }), refetchInterval: 60_000 });
  const tasks = useQuery({ queryKey: qk.tasks('mine'), queryFn: () => api.tasks.list({ scope: 'mine', status: ['OPEN', 'IN_PROGRESS'], page_size: 50 }) });
  const [q, setQ] = useState('');
  const f = useFormat();
  const hour = new Date().getHours();
  // The server returns the view by last update; the phone shows the most pressing few of them first.
  const rows = [...(queue.data?.items ?? [])].sort((a, b) => attentionRank(a) - attentionRank(b)).slice(0, QUEUE_ROWS);
  return (
    <Screen onRefresh={() => Promise.all([today.refetch(), queue.refetch(), tasks.refetch()])} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">{t(`v3.agency.greeting.${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}`, { name: session?.user.preferred_name ?? session?.user.full_name.split(' ').slice(-1)[0] })}</AppText>
        <AppText variant="caption">{session?.active_org?.org_name}</AppText>
      </View>
      <TextField label={t('v3.agency.findStudent')} hideLabel placeholder={t('v3.agency.findStudent')} value={q} onChangeText={setQ} returnKeyType="search"
        onSubmitEditing={() => router.push({ pathname: '/students', params: { q } })} trailing={<Search size={18} color={theme.color.textTertiary} />} />
      <View style={styles.section}>
        <SectionTitle title={t('v3.agency.needsAttention')} action={rows.length ? t('v3.common.all') : undefined}
          onAction={() => router.push({ pathname: '/students', params: { view: 'attention' } })} />
        {queue.isPending ? <LoadingState rows={3} /> : queue.isError ? <ErrorState error={queue.error} onRetry={() => void queue.refetch()} compact /> : rows.length ? (
          <ListGroup>{rows.map((s) => <StudentRow key={s.id} s={s} due={f.due} />)}</ListGroup>
        ) : (
          <View style={styles.clear}>
            <CircleCheck size={16} color={theme.status.success.fg} />
            <AppText variant="caption" style={styles.flex}>{t('v3.agency.queueClear')}</AppText>
          </View>
        )}
      </View>
      <DueToday tasks={tasks.data?.items ?? []} />
      {today.isPending ? <LoadingState rows={3} /> : today.isError ? <ErrorState error={today.error} onRetry={() => void today.refetch()} compact /> : <Queues d={today.data!} />}
    </Screen>
  );
}

/** The work behind the queue, by kind. A row's number is the size of the list the row opens — same predicate on the server. */
function Queues({ d }: { d: AgencyToday }) {
  const { t } = useTranslation();
  const f = useFormat();
  const replies = d.student_replies.conversations ?? d.student_replies.count;
  const closing = d.closing_soon.students ?? d.closing_soon.count;
  const rows = [
    // Team-wide count → the team's overdue tasks (not only mine).
    { key: 'overdue', count: d.overdue_tasks.count, title: t('v3.agency.att.overdue', { count: d.overdue_tasks.count }), detail: d.overdue_tasks.oldest ? oldestLine(t, taskTitle(t, d.overdue_tasks.oldest), d.overdue_tasks.oldest.student) : null, go: () => router.push({ pathname: '/tasks', params: { view: 'overdue', scope: 'team' } }), urgent: true },
    { key: 'docs', count: d.documents_waiting.count, title: t('v3.agency.att.docs', { count: d.documents_waiting.count }), detail: d.documents_waiting.over_sla ? t('v3.agency.att.overSla', { count: d.documents_waiting.over_sla, hours: d.documents_waiting.sla_hours }) : d.documents_waiting.oldest ? t('v3.agency.att.since', { who: d.documents_waiting.oldest.student ?? '', when: f.relative(d.documents_waiting.oldest.since) }) : null, go: () => router.push('/reviews'), urgent: d.documents_waiting.over_sla > 0 },
    // Conversations (not students): the Messages list filtered to the ones waiting for our reply.
    { key: 'replies', count: replies, title: t('v3.agency.att.replyThreads', { count: replies }), detail: null, go: () => router.push({ pathname: '/messages', params: { filter: 'reply' } }), urgent: false },
    // Students (not applications): the list is a student list, so the number is the student count.
    { key: 'closing', count: closing, title: t('v3.agency.att.closingStudents', { count: closing }), detail: d.closing_soon.next ? t('v3.agency.att.next', { uni: d.closing_soon.next.university, who: d.closing_soon.next.student ?? '', date: f.deadlineShort(d.closing_soon.next.deadline) }) : null, go: () => router.push({ pathname: '/students', params: { view: 'deadline7' } }), urgent: false },
    { key: 'sla', count: d.sla_risk.count, title: t('v3.agency.att.sla', { count: d.sla_risk.count }), detail: d.sla_risk.breached ? t('v3.agency.att.breached', { count: d.sla_risk.breached }) : null, go: () => router.push({ pathname: '/students', params: { view: 'sla' } }), urgent: d.sla_risk.breached > 0 },
  ];
  const active = rows.filter((r) => r.count > 0);
  const clear = rows.filter((r) => r.count === 0);
  return (
    <View style={styles.section}>
      <SectionTitle title={t('v3.agency.queues')} />
      {active.length ? (
        <ListGroup>
          {active.map((r) => (
            <ListItem key={r.key} title={r.title} subtitle={r.detail} onPress={r.go}
              accessibilityLabel={[`${r.title}: ${r.count}`, r.detail].filter(Boolean).join('. ')}
              trailing={<AppText variant="subheading" tone={r.urgent ? 'danger' : undefined}>{r.count}</AppText>} />
          ))}
        </ListGroup>
      ) : null}
      {clear.length ? (
        <View style={styles.clear}>
          <CircleCheck size={16} color={theme.status.success.fg} />
          <AppText variant="caption" style={styles.flex}>{t('v3.agency.allClear', { list: clear.map((r) => t(`v3.agency.clear.${r.key}`)).join(' · ') })}</AppText>
        </View>
      ) : null}
    </View>
  );
}

function DueToday({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const qc = useQueryClient();
  const done = useMutation({ mutationFn: (id: string) => api.tasks.update(id, { status: 'DONE' }), onSettled: () => { void qc.invalidateQueries({ queryKey: ['tasks'] }); void qc.invalidateQueries({ queryKey: ['agency'] }); } });
  const end = new Date(); end.setHours(23, 59, 59);
  const due = tasks.filter((x) => x.due_at && new Date(x.due_at) <= end).slice(0, 6);
  if (!due.length) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title={t('v3.agency.dueToday', { count: due.length })} action={t('v3.common.all')} onAction={() => router.push('/tasks')} />
      <ListGroup>
        {due.map((x) => (
          <CheckRow key={x.id} label={taskTitle(t, x)} detail={[x.student_name, x.due_at ? f.due(x.due_at) : null].filter(Boolean).join(' · ')}
            checked={false} onToggle={() => done.mutate(x.id)} disabled={done.isPending} />
        ))}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: theme.space[1] / 2, paddingTop: theme.space[1] },
  section: { gap: theme.space[2] },
  clear: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2], paddingHorizontal: theme.space[1] },
});

/** V31: a task title that already names the student is not followed by the name again ("… for Vy (Vy)"). */
function oldestLine(t: (k: string, o?: Record<string, unknown>) => string, what: string, who?: string | null): string {
  return who && !what.includes(who) ? t('v3.agency.att.oldest', { what, who }) : t('v3.agency.att.oldestSelf', { what });
}
