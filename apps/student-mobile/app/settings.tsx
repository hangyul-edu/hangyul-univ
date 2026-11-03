import { useTranslation } from '@hangyul/i18n';
import { AppText, LanguagePicker, ListGroup, ListItem, Screen, SectionTitle, SignOutSection, theme } from '@hangyul/mobile-ui';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, CreditCard, UserRound } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * **설정** (V17, brief §36).
 *
 * Language, notifications, and signing out — the three things a student changes about the app rather than
 * about their application. It is deliberately short: the settings a student would expect to find here and
 * which only the web can change (profile fields, notification channels per event, plan) are **links to
 * where they live**, not duplicated forms. A second editor for the same field is a second answer to the
 * question of what the field is.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Screen>
      <LanguagePicker surface="student" />

      <View style={{ gap: 8 }}>
        <SectionTitle title={t('mobile:settings.elsewhere')} />
        <ListGroup>
          <ListItem icon={Bell} title={t('common:nav.notifications')} subtitle={t('mobile:settings.notificationsHint')}
            onPress={() => router.push('/notifications')} />
          <ListItem icon={UserRound} title={t('common:nav.profile')} subtitle={t('v3.profile.editOnWeb')}
            onPress={() => router.push('/profile')} />
          <ListItem icon={CreditCard} title={t('mobile:more.plan')} onPress={() => router.push('/services')} />
        </ListGroup>
      </View>

      <SignOutSection />
      <AppText variant="caption" color={theme.color.textTertiary}>{t('mobile:settings.version', { version })}</AppText>
    </Screen>
  );
}
