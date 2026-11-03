import { AccountCard, LanguagePicker, Screen, SignOutSection } from '@hangyul/mobile-ui';

export default function SettingsScreen() {
  return (
    <Screen>
      <AccountCard />
      <LanguagePicker surface="university" />
      <SignOutSection />
    </Screen>
  );
}
