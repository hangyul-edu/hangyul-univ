import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { tabScreenOptions, useConversations, useFontsReady } from '@hangyul/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';
import { FileCheck, MessageCircle, Settings, Sun, Users } from 'lucide-react-native';

import { qk } from '../../src/queries';

/**
 * Mobile jobs, not the desktop console: today's queue, find a student, the work (documents and applications), reply,
 * and settings — the V22 web console's 오늘 · 학생 관리 · 지원·서류 · 메시지 · 설정, without the desktop analytics (REPORT §274 N4).
 *
 * V11 drops the Tasks tab for the same reason the web console did (REPORT §77.1): Today *is* the list of what
 * needs the team, so a second tab of it was the same screen twice — and a phone has four tab slots'
 * worth of attention, not five. The route stays (`href: null` keeps it reachable from Today's rows and from
 * any existing link); only its permanent slot is gone.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const api = useApi();
  const fontsReady = useFontsReady();
  const queue = useQuery({ queryKey: qk.reviewQueue, queryFn: () => api.documents.reviewQueue({ page_size: 100 }) });
  const convs = useConversations();
  const unread = (convs.data ?? []).reduce((s, c) => s + c.unread, 0);
  const pending = queue.data?.total ?? 0;
  return (
    <Tabs screenOptions={tabScreenOptions(fontsReady)}>
      <Tabs.Screen name="index" options={{ title: t('v3.agency.today'), tabBarIcon: ({ color, size }) => <Sun color={color} size={size} /> }} />
      <Tabs.Screen name="students" options={{ title: t('common:nav.students'), tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen
        name="reviews"
        options={{
          title: t('agency.reviews.tab'),
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarAccessibilityLabel: t('agency.reviews.tabA11y', { count: pending }),
          tabBarIcon: ({ color, size }) => <FileCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="messages" options={{ title: t('common:nav.messages'), tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('settings.title'), tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      <Tabs.Screen name="tasks" options={{ href: null, title: t('common:nav.tasks') }} />
    </Tabs>
  );
}
