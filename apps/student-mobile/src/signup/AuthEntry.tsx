/**
 * Signed-out entry (brief §15): sign-in and sign-up are equals; sign-up is a full native flow, never a browser hand-off.
 *
 * Owner pass 261119 (req 2): the first frame is the mode that was asked for. The route (`/register`, `/signup`,
 * `?mode=signup`) is read synchronously in the `useState` initialiser — there is no effect that renders sign-in first
 * and then switches. The session restore before this screen is the neutral brand splash (`AuthGate`).
 * The anonymous quick check that used to sit under the form is retired (req 1): matching comes after sign-in and a plan.
 */
import { useTranslation } from '@hangyul/i18n';
import { Button, LoginScreen } from '@hangyul/mobile-ui';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { authModeFor, type AuthMode } from '../access';
import { SignupFlow } from './SignupFlow';

export function AuthEntry() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => authModeFor(pathname, params));
  if (mode === 'signup') return <SignupFlow onCancel={() => setMode('login')} />;
  return (
    <LoginScreen
      client="student" productName={t('app.student')} tagline={t('student.login.tagline')}
      secondary={<View style={{ gap: 8 }}><Button label={t('mobile:signup.signup')} variant="secondary" onPress={() => setMode('signup')} fullWidth /></View>}
    />
  );
}
