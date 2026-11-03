// V6: professional blue surface — must stay the first import so every StyleSheet sees the console tokens.
import '@hangyul/design-tokens/console-surface';
import { useTranslation } from '@hangyul/i18n';
import { AuthGate, LoginScreen, MobileProviders, stackScreenOptions } from '@hangyul/mobile-ui';
import { Stack } from 'expo-router';

function Login() {
  const { t } = useTranslation();
  return <LoginScreen client="agency" productName={t('app.agency')} tagline={t('agency.login.tagline')} />;
}

function AppStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('common:nav.dashboard') }} />
      <Stack.Screen name="students/[id]" options={{ title: t('agency.students.detailTitle') }} />
      <Stack.Screen name="reviews/[id]" options={{ title: t('agency.reviews.detailTitle') }} />
      <Stack.Screen name="messages/[id]" options={{ title: t('common:nav.messages') }} />
      <Stack.Screen name="deadlines" options={{ title: t('agency.deadlines.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <MobileProviders client="agency">
      <AuthGate login={<Login />}>
        <AppStack />
      </AuthGate>
    </MobileProviders>
  );
}
