import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import {
  AppText, CheckRow, ErrorState, ListGroup, LoadingState, Screen, SectionTitle, TextField, theme, useFormat, taskTitle } from '@hangyul/mobile-ui';
import type { AgencyToday, Task } from '@hangyul/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, CircleCheck, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { qk } from '../../src/queries';

/** Today answers one question: who needs me right now? Every row opens the exact queue behind it. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const api = useApi();
  const { session } = useAuth();
  const today = useQuery({ queryKey: ['agency', 'today'], queryFn: () => api.agency.today(), refetchInterval: 60_000 });
  const tasks = useQuery({ queryKey: qk.tasks('mine'), queryFn: () => api.tasks.list({ scope: 'mine', status: ['OPEN', 'IN_PROGRESS'], page_size: 50 }) });
  const [q, setQ] = useState('');
  const hour = new Date().getHours();
  return (
    <Screen onRefresh={() => Promise.all([today.refetch(), tasks.refetch()])} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" accessibilityRole="header">{t(`v3.agency.greeting.${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}`, { name: session?.user.preferred_name ?? session?.user.full_name.split(' ').slice(-1)[0] })}</AppText>
          <AppText variant="caption">{session?.active_org?.org_name}</AppText>
        </View>
      </View>
      <TextField label={t('v3.agency.findStudent')} hideLabel placeholder={t('v3.agency.findStudent')} value={q} onChangeText={setQ} returnKeyType="search"
        onSubmitEditing={() => router.push({ pathname: '/students', params: { q } })} trailing={<Search size={18} color={theme.color.textTertiary} />} />
      {today.isPending ? <LoadingState rows={4} /> : today.isError ? <ErrorState error={today.error} onRetry={() => void today.refetch()} /> : <Attention d={today.data!} />}
      <DueToday tasks={tasks.data?.items ?? []} />
    </Screen>
  );
}

function Attention({ d }: { d: AgencyToday }) {
  const { t } = useTranslation();
  const f = useFormat();
  const rows = [
    { key: 'overdue', count: d.overdue_tasks.count, title: t('v3.agency.att.overdue', { count: d.overdue_tasks.count }), detail: d.overdue_tasks.oldest ? oldestLine(t, taskTitle(t, d.overdue_tasks.oldest), d.overdue_tasks.oldest.student) : null, go: () => router.push({ pathname: '/tasks', params: { view: 'overdue' } }), urgent: true },
    { key: 'docs', count: d.documents_waiting.count, title: t('v3.agency.att.docs', { count: d.documents_waiting.count }), detail: d.documents_waiting.over_sla ? t('v3.agency.att.overSla', { count: d.documents_waiting.over_sla, hours: d.documents_waiting.sla_hours }) : d.documents_waiting.oldest ? t('v3.agency.att.since', { who: d.documents_waiting.oldest.student ?? '', when: f.relative(d.documents_waiting.oldest.since) }) : null, go: () => router.push('/reviews'), urgent: d.documents_waiting.over_sla > 0 },
    { key: 'replies', count: d.student_replies.count, title: t('v3.agency.att.replies', { count: d.student_replies.count }), detail: null, go: () => router.push({ pathname: '/students', params: { view: 'waiting_us' } }), urgent: false },
    { key: 'closing', count: d.closing_soon.count, title: t('v3.agency.att.closing', { count: d.closing_soon.count }), detail: d.closing_soon.next ? t('v3.agency.att.next', { uni: d.closing_soon.next.university, who: d.closing_soon.next.student ?? '', date: f.deadlineShort(d.closing_soon.next.deadline) }) : null, go: () => router.push({ pathname: '/students', params: { view: 'deadline' } }), urgent: false },
    { key: 'sla', count: d.sla_risk.count, title: t('v3.agency.att.sla', { count: d.sla_risk.count }), detail: d.sla_risk.breached ? t('v3.agency.att.breached', { count: d.sla_risk.breached }) : null, go: () => router.push({ pathname: '/students', params: { view: 'sla' } }), urgent: d.sla_risk.breached > 0 },
  ];
  const active = rows.filter((r) => r.count > 0);
  const clear = rows.filter((r) => r.count === 0);
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={t('v3.agency.needsAttention')} />
      {active.length ? (
        <ListGroup>
          {active.map((r) => (
            <Pressable key={r.key} onPress={r.go} accessibilityRole="button" accessibilityLabel={[r.title, r.detail].filter(Boolean).join('. ')}
              android_ripple={{ color: 'rgba(24,26,31,0.06)' }} style={({ pressed }) => [styles.att, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}>
              <AppText variant="metric" color={r.urgent ? theme.status.danger.fg : theme.color.text} style={styles.count}>{r.count}</AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subheading">{r.title}</AppText>
                {r.detail ? <AppText variant="caption" numberOfLines={2}>{r.detail}</AppText> : null}
              </View>
              <ChevronRight size={18} color={theme.color.textTertiary} />
            </Pressable>
          ))}
        </ListGroup>
      ) : null}
      {clear.length ? (
        <View style={styles.clear}>
          <CircleCheck size={16} color={theme.status.success.fg} />
          <AppText variant="caption" style={{ flex: 1 }}>{t('v3.agency.allClear', { list: clear.map((r) => t(`v3.agency.clear.${r.key}`)).join(' · ') })}</AppText>
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
  const done = useMutation({ mutationFn: (id: string) => api.tasks.update(id, { status: 'DONE' }), onSettled: () => { void qc.invalidateQueries({ queryKey: ['tasks'] }); void qc.invalidateQueries({ queryKey: ['agency', 'today'] }); } });
  const end = new Date(); end.setHours(23, 59, 59);
  const due = tasks.filter((x) => x.due_at && new Date(x.due_at) <= end).slice(0, 6);
  if (!due.length) return null;
  return (
    <View style={{ gap: 8 }}>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  att: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  count: { minWidth: 36, textAlign: 'center' },
  clear: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
});

/** V31: a task title that already names the student is not followed by the name again ("… for Vy (Vy)"). */
function oldestLine(t: (k: string, o?: Record<string, unknown>) => string, what: string, who?: string | null): string {
  return who && !what.includes(who) ? t('v3.agency.att.oldest', { what, who }) : t('v3.agency.att.oldestSelf', { what });
}
