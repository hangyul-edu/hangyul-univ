import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { tabScreenOptions, useConversations, useFontsReady } from '@hangyul/mobile-ui';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';
import { Inbox, ListTodo, MessageCircle, Settings } from 'lucide-react-native';

/**
 * V23 (REPORT §274 N5): the V22 web console's 지원자 · 메시지 · 통계 · 설정 on a phone. 지원자 opens on the applicants that need a
 * decision (the full list and saved views are one tap away); 현황 is a small pipeline overview with the cohort view behind it.
 * No desktop analytics on the phone.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const api = useApi();
  const fontsReady = useFontsReady();
  const attention = useQuery({ queryKey: ['university', 'attention'], queryFn: () => api.university.attention(), refetchInterval: 60_000 });
  const convs = useConversations();
  const unread = (convs.data ?? []).reduce((s, c) => s + c.unread, 0);
  const waiting = (attention.data?.awaiting_review ?? 0) + (attention.data?.documents_returned ?? 0);
  return (
    <Tabs screenOptions={tabScreenOptions(fontsReady)}>
      <Tabs.Screen name="index" options={{ title: t('v3.uni.tab.applicants'), tabBarBadge: waiting > 0 ? waiting : undefined, tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }} />
      <Tabs.Screen name="applicants" options={{ href: null, title: t('v3.uni.tab.applicants') }} />
      <Tabs.Screen name="inbox" options={{ title: t('common:nav.messages'), tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="pipeline" options={{ title: t('v3.uni.tab.pipeline'), tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('settings.title'), tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      <Tabs.Screen name="cohorts" options={{ href: null, title: t('v3.uni.tab.students') }} />
    </Tabs>
  );
}
