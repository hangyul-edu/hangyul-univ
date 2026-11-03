import { useTranslation } from '@hangyul/i18n';
import { tabScreenOptions, useFontsReady } from '@hangyul/mobile-ui';
import { Tabs } from 'expo-router/js-tabs';
import { Compass, GraduationCap, House, MessageCircle, Menu } from 'lucide-react-native';

import { useDashboard } from '../../src/queries';

/**
 * Five tabs: now · find · track · talk · **더보기** (V17, brief §36).
 *
 * The first four are jobs a student does repeatedly. The fifth used to be 프로필, which meant everything
 * occasional — documents, visa, tasks, saved, notifications, settings, the plan — was a list at the bottom
 * of a screen with an avatar on it. 프로필 is now one row inside 더보기, which is the same move the mobile
 * web made in this pass, and for the same reason: a drawer should be named a drawer.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const fontsReady = useFontsReady();
  const dash = useDashboard();
  const unread = dash.data?.unread_messages ?? 0;
  return (
    <Tabs screenOptions={tabScreenOptions(fontsReady)}>
      <Tabs.Screen name="index" options={{ title: t('common:nav.home'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: t('common:nav.universities'), tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="applications" options={{ title: t('common:nav.applications'), tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('common:nav.messages'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarAccessibilityLabel: unread > 0 ? t('student.messages.unreadA11y', { count: unread }) : t('common:nav.messages'),
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="more" options={{ title: t('common:nav.journey'), tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }} />
    </Tabs>
  );
}
