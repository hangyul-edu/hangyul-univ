import { ApiError } from '@hangyul/api-client';
import { useAuth } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { loginSchema, type LoginInput } from '@hangyul/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react-native';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Callout } from '../components/Feedback';
import { TextField } from '../components/Inputs';
import { theme } from '../theme';
import { getApiBaseUrl } from './api';

export interface LoginScreenProps {
  client: 'student' | 'agency' | 'university';
  /** Product name shown in the heading (e.g. "Hangyul Agency"). */
  productName: string;
  tagline?: string;
  /** Rendered under the form — e.g. the student app's no-account quick eligibility check. */
  extra?: ReactNode;
  /** V22: the sign-up action, rendered as an equal next to sign-in (brief §15). When present the web-signup caption is not shown. */
  secondary?: ReactNode;
}

/**
 * V23 (REPORT §274 N3): **테스트 계정으로 로그인**, visible on the login screen of every non-production build.
 * `TEST_LOGIN` is a build-time expression Metro inlines and folds, so in a production build (`EXPO_PUBLIC_TEST_LOGIN=false`)
 * the `require` below is dead code removed before dependency collection — the component and the persona module never
 * enter the bundle. Do not turn this into a runtime check or a static import (see components/TestAccountSignIn.tsx).
 */
const TEST_LOGIN = __DEV__ || process.env.EXPO_PUBLIC_TEST_LOGIN === 'true';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestAccountSignIn: ComponentType<{ client: 'student' | 'agency' | 'university' }> | null = TEST_LOGIN ? require('../components/TestAccountSignIn').TestAccountSignIn : null;

/** Email/password sign-in (zod loginSchema); non-production builds add the test-account sign-in under it (no passwords). */
export function LoginScreen({ client, productName, tagline, extra, secondary }: LoginScreenProps) {
  const { t } = useTranslation();
  const { login, api } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  // V29: staff sign-in is two-step when the account has MFA (production requires it for staff — app/services/mfa.py).
  const staff = client === 'agency' || client === 'university';
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const verify = async () => {
    if (!mfaToken) return;
    setVerifying(true);
    setServerError(null);
    try {
      const c = code.replace(/\s/g, '');
      await api.mfa.verify(mfaToken, /^\d{6}$/.test(c) ? { code: c } : { recovery_code: c });
    } catch (e) {
      setServerError(e instanceof ApiError && e.status === 401 ? t('mobile:v29.mfa.wrongCode') : t('common:states.error'));
    } finally {
      setVerifying(false);
    }
  };
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      if (staff) {
        const r = await api.mfa.loginStaff(email.trim(), password);
        if (r.kind === 'mfa') { setMfaToken(r.mfa_token); return; }
        // Enrolment needs the authenticator QR/secret screen, which lives in the web console.
        if (r.kind === 'enroll') { setServerError(t('mobile:v29.mfa.enrollOnWeb')); return; }
        return;
      }
      await login(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 400)) setServerError(t('common:auth.invalid'));
      else if (e instanceof ApiError) setServerError(e.message || t('common:states.error'));
      else setServerError(t('mobile:login.networkError', { url: getApiBaseUrl() }));
    }
  });

  const fieldError = (msg?: string) => (msg ? t(`common:${msg}`, { defaultValue: msg }) : null);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={require('../../assets/brand/symbol-192.png')} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors accessibilityLabel={t('common:a11y.logoAlt')} />
            <AppText variant="title" align="center" accessibilityRole="header">{t('common:auth.signInTo', { product: productName })}</AppText>
            <AppText variant="body" secondary align="center">{tagline ?? t('common:brand.tagline')}</AppText>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label={t('common:auth.email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={fieldError(errors.email?.message)}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  ref={passwordRef}
                  label={t('common:auth.password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  error={fieldError(errors.password?.message)}
                />
              )}
            />
            {mfaToken ? (
              <>
                <TextField label={t('mobile:v29.mfa.codeLabel')} value={code} onChangeText={setCode} keyboardType="number-pad"
                  autoComplete="one-time-code" textContentType="oneTimeCode" returnKeyType="go" onSubmitEditing={() => void verify()} />
                <AppText variant="caption">{t('mobile:v29.mfa.codeHint')}</AppText>
              </>
            ) : null}
            {serverError ? <Callout tone="danger" body={serverError} /> : null}
            {mfaToken
              ? <Button label={t('mobile:v29.mfa.verify')} icon={LogIn} onPress={() => void verify()} loading={verifying} disabled={code.trim().length < 6} fullWidth />
              : <Button label={t('common:actions.signIn')} icon={LogIn} onPress={() => void submit()} loading={isSubmitting} fullWidth />}
            {secondary ?? <AppText variant="caption" align="center">{t('mobile:login.webSignup')}</AppText>}
            {TestAccountSignIn ? <TestAccountSignIn client={client} /> : null}
          </View>
          {extra}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bgCanvas },
  content: { padding: theme.space[5], gap: theme.space[6], flexGrow: 1, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: 8 },
  logo: { width: 52, height: 60, marginBottom: 8 },
  form: { gap: theme.space[4] },
});
