/** Signed-out entry (brief §15): sign-in and sign-up are equals; sign-up is a full native flow, never a browser hand-off. */
import { useTranslation } from '@hangyul/i18n';
import { Button, LoginScreen } from '@hangyul/mobile-ui';
import { useState } from 'react';
import { View } from 'react-native';

import { QuickCheck } from '../QuickCheck';
import { SignupFlow } from './SignupFlow';

export function AuthEntry() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  if (mode === 'signup') return <SignupFlow onCancel={() => setMode('login')} />;
  return (
    <LoginScreen
      client="student" productName={t('app.student')} tagline={t('student.login.tagline')}
      secondary={<View style={{ gap: 8 }}><Button label={t('mobile:signup.signup')} variant="secondary" onPress={() => setMode('signup')} fullWidth /></View>}
      extra={<QuickCheck onSignup={() => setMode('signup')} />}
    />
  );
}
