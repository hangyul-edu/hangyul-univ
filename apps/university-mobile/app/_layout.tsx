// V6: professional blue surface — must stay the first import so every StyleSheet sees the console tokens.
import '@hangyul/design-tokens/console-surface';
import { useTranslation } from '@hangyul/i18n';
import { AuthGate, LoginScreen, MobileProviders, stackScreenOptions } from '@hangyul/mobile-ui';
import { Stack } from 'expo-router';

function Login() {
  const { t } = useTranslation();
  return <LoginScreen client="university" productName={t('app.university')} tagline={t('university.login.tagline')} />;
}

function AppStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('common:nav.dashboard') }} />
      <Stack.Screen name="applicants/[id]" options={{ title: t('university.applicants.detailTitle') }} />
      <Stack.Screen name="messages/[id]" options={{ title: t('common:nav.messages') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <MobileProviders client="university">
      <AuthGate login={<Login />}>
        <AppStack />
      </AuthGate>
    </MobileProviders>
  );
}
