import { useApi, useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, ChipGroup, DateRow, EmptyState, QueryState, Screen, SectionTitle, useFormat, taskTitle, kstDayMonth } from '@hangyul/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { mapWebLink, qk } from '../src/queries';

type Who = 'all' | 'mine' | 'unassigned';
type Bucket = 'overdue' | 'week' | 'later';

/** Deadlines for the agency's students, grouped by when they bite: overdue, the next 7 days, later this month. */
export default function DeadlinesScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const api = useApi();
  const { session } = useAuth();
  const [who, setWho] = useState<Who>('all');
  const q = useQuery({ queryKey: qk.deadlines, queryFn: () => api.agency.deadlines(30) });
  const me = session?.user.id;
  const all = q.data ?? [];
  const inView = (d: (typeof all)[number], w: Who) => (w === 'all' ? true : w === 'mine' ? d.owner?.id === me : !d.owner);
  const bucket = (d: (typeof all)[number]): Bucket => (d.overdue ? 'overdue' : (f.daysUntil(d.due_at) ?? 99) <= 7 ? 'week' : 'later');
  return (
    <Screen onRefresh={() => q.refetch()}>
      <AppText variant="caption">{t('agency.deadlines.subtitle')}</AppText>
      <ChipGroup<Who>
        options={(['all', 'mine', 'unassigned'] as const).map((w) => ({ value: w, label: `${t(`v3.deadlines.who.${w}`)} · ${all.filter((d) => inView(d, w)).length}` }))}
        selected={[who]}
        onToggle={setWho}
      />
      <QueryState query={q}>
        {(items) => {
          const shown = items.filter((d) => inView(d, who)).sort((a, b) => a.due_at.localeCompare(b.due_at));
          if (!shown.length) return <EmptyState icon={CalendarCheck} title={who === 'all' ? t('agency.deadlines.empty') : t('v3.deadlines.emptyView')} />;
          return (['overdue', 'week', 'later'] as const).map((b) => {
            const rows = shown.filter((d) => bucket(d) === b);
            if (!rows.length) return null;
            return (
              <View key={b}>
                <SectionTitle title={t(`v3.deadlines.bucket.${b}`, { count: rows.length })} />
                <View>
                  {rows.map((d) => {
                    const to = mapWebLink(d.link) ?? (d.student ? `/students/${d.student.id}` : null);
                    const dm = kstDayMonth(d.due_at, f.locale);
                    const urgent = d.overdue || d.priority === 'URGENT';
                    return (
                      <DateRow
                        key={d.id}
                        day={dm.day}
                        month={dm.month}
                        title={taskTitle(t, d)}
                        meta={[
                          d.student?.full_name,
                          d.owner ? (d.owner.id === me ? t('v3.deadlines.you') : d.owner.id === d.student?.id ? t('v3.deadlines.student') : d.owner.full_name) : t('agency.tasks.unassigned'),
                          f.due(d.due_at),
                          d.priority === 'URGENT' || d.priority === 'HIGH' ? t(`common:priority.${d.priority}`, { defaultValue: d.priority }) : null,
                        ].filter(Boolean).join(' · ')}
                        urgent={urgent}
                        onPress={to ? () => router.push(to) : undefined}
                      />
                    );
                  })}
                </View>
              </View>
            );
          });
        }}
      </QueryState>
    </Screen>
  );
}
