import { useTranslation } from '@hangyul/i18n';
import { AuthGate, MobileProviders, stackScreenOptions } from '@hangyul/mobile-ui';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { usePushTaps } from '../src/push';
import { AuthEntry } from '../src/signup/AuthEntry';
import { consumePostSignup, useSignupHold } from '../src/signup/SignupFlow';

function AppStack() {
  const { t } = useTranslation();
  usePushTaps();
  // V22: a student who has just registered lands on recommendations (the free matching journey), not an empty home.
  useEffect(() => { if (consumePostSignup()) setTimeout(() => router.replace('/explore?welcome=1'), 0); }, []);
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('common:nav.home') }} />
      <Stack.Screen name="applications/[id]" options={{ title: t('student.applications.detailTitle') }} />
      <Stack.Screen name="documents/index" options={{ title: t('common:nav.documents') }} />
      <Stack.Screen name="documents/[id]" options={{ title: t('student.documents.detailTitle') }} />
      <Stack.Screen name="messages/[id]" options={{ title: t('common:nav.messages') }} />
      <Stack.Screen name="universities/[slug]" options={{ title: t('common:nav.universities') }} />
      <Stack.Screen name="matches" options={{ headerShown: false }} />
      <Stack.Screen name="saved" options={{ title: t('common:nav.saved') }} />
      <Stack.Screen name="tasks" options={{ title: t('student.tasks.title') }} />
      <Stack.Screen name="visa" options={{ title: t('common:nav.visa') }} />
      <Stack.Screen name="notifications" options={{ title: t('common:nav.notifications') }} />
      {/* V17: pushed from 더보기 rather than carried in the tab bar. */}
      <Stack.Screen name="profile" options={{ title: t('common:nav.profile') }} />
      <Stack.Screen name="services" options={{ title: t('mobile:more.plan') }} />
      <Stack.Screen name="settings" options={{ title: t('mobile:settings.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const hold = useSignupHold();
  return (
    <MobileProviders client="student">
      <AuthGate login={<AuthEntry />} hold={hold}>
        <AppStack />
      </AuthGate>
    </MobileProviders>
  );
}
