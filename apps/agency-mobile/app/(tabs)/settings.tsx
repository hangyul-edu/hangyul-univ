import { useTranslation } from '@hangyul/i18n';
import { AccountCard, AppText, LanguagePicker, ListGroup, ListItem, Screen, SectionTitle, SignOutSection } from '@hangyul/mobile-ui';
import { router } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { View } from 'react-native';

/** Who I am, where my other work lives, language, sign out. Account and team settings stay on the web console. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AccountCard />
      <View style={{ gap: 8 }}>
        <SectionTitle title={t('v3.settings.work')} />
        <ListGroup>
          <ListItem icon={CalendarClock} title={t('agency.deadlines.title')} subtitle={t('agency.deadlines.subtitle')} onPress={() => router.push('/deadlines')} />
        </ListGroup>
        <AppText variant="caption">{t('v3.settings.consoleHint')}</AppText>
      </View>
      <LanguagePicker surface="agency" />
      <SignOutSection />
    </Screen>
  );
}
