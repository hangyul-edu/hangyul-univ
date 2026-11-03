/**
 * **테스트 계정으로 로그인** — the native counterpart of `@hangyul/ui/test-access` (V23, REPORT §274 N3).
 *
 * V12–V22 hid the persona picker behind five taps on the heading, which nobody reviewing the product could find, and
 * `DevAccess.tsx` imported every persona statically, so the V22 production AAB carried the demo addresses and
 * "Demo access" (found by the V23 audit, §268 P2).
 *
 * This module is reached **only** through `LoginScreen`'s `require()` inside `if (TEST_LOGIN)`, where `TEST_LOGIN` is
 * `__DEV__ || process.env.EXPO_PUBLIC_TEST_LOGIN === 'true'`. Metro inlines both at build time and folds the branch
 * before it collects dependencies, so a production build (`EXPO_PUBLIC_TEST_LOGIN=false`, set explicitly in every
 * production profile) contains neither this file nor `@hangyul/auth/demo-personas`. `qa:v23` exports a production
 * bundle and greps it. The API refuses `/auth/demo-login` in production regardless.
 *
 * Copy is inline for the same reason as the web component: a production bundle must contain *no* test-login UI.
 */
import { useAuth, type DemoProduct } from '@hangyul/auth';
import { TEST_ACCOUNTS } from '@hangyul/auth/demo-personas';
import { useTranslation } from '@hangyul/i18n';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

const COPY: Record<string, { title: string; or: string; more: string }> = {
  ko: { title: '테스트 계정으로 로그인', or: '또는', more: '다른 테스트 계정 선택' },
  en: { title: 'Sign in with test account', or: 'or', more: 'Choose another test account' },
  vi: { title: 'Đăng nhập bằng tài khoản thử', or: 'hoặc', more: 'Chọn tài khoản thử khác' },
  ja: { title: 'テストアカウントでログイン', or: 'または', more: '別のテストアカウントを選ぶ' },
  'zh-Hans': { title: '使用测试账号登录', or: '或', more: '选择其他测试账号' },
  ne: { title: 'परीक्षण खाताबाट लग इन', or: 'वा', more: 'अर्को परीक्षण खाता छान्नुहोस्' },
  my: { title: 'စမ်းသပ်အကောင့်ဖြင့် ဝင်ရန်', or: 'သို့မဟုတ်', more: 'အခြားစမ်းသပ်အကောင့် ရွေးရန်' },
  uz: { title: 'Test hisob bilan kirish', or: 'yoki', more: 'Boshqa test hisobini tanlash' },
  mn: { title: 'Туршилтын бүртгэлээр нэвтрэх', or: 'эсвэл', more: 'Өөр туршилтын бүртгэл сонгох' },
  ru: { title: 'Войти с тестовым аккаунтом', or: 'или', more: 'Выбрать другой тестовый аккаунт' },
};

export function TestAccountSignIn({ client }: { client: DemoProduct }) {
  const { i18n } = useTranslation();
  const { demoLogin } = useAuth();
  const lang = i18n.language;
  const c = COPY[lang] ?? COPY[lang.split('-')[0]] ?? COPY.en;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const accounts = TEST_ACCOUNTS[client];
  if (!accounts?.length) return null;
  const [primary, ...rest] = accounts;

  const signIn = async (email: string) => {
    setError(null);
    setBusy(email);
    try {
      await demoLogin(email);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <View style={styles.root} testID="test-login">
      <View style={styles.or}>
        <View style={styles.rule} /><AppText variant="caption">{c.or}</AppText><View style={styles.rule} />
      </View>
      {error ? <AppText variant="caption" style={styles.error}>{error}</AppText> : null}
      <Button label={c.title} variant="secondary" onPress={() => void signIn(primary.email)} loading={busy === primary.email} disabled={!!busy} fullWidth />
      {rest.length > 0 && (
        <>
          <Pressable onPress={() => setMore((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: more }} hitSlop={8} style={styles.moreBtn}>
            <AppText variant="caption" style={styles.more}>{c.more}</AppText>
          </Pressable>
          {more && rest.map((a) => (
            <Button key={a.email} label={lang === 'ko' ? a.ko : a.en} variant="ghost" size="sm" onPress={() => void signIn(a.email)} loading={busy === a.email} disabled={!!busy} fullWidth />
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.space[3] },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  moreBtn: { alignSelf: 'center', paddingVertical: 4 },
  more: { textDecorationLine: 'underline' },
  error: { color: theme.status.danger.fg, textAlign: 'center' },
});
