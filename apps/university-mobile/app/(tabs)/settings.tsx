import { AccountCard, LanguagePicker, Screen, SignOutSection } from '@hangyul/mobile-ui';

export default function SettingsScreen() {
  // A tab root with no native header pads the status bar itself (V32: the account card sat under the clock).
  return (
    <Screen edges={['top', 'left', 'right']}>
      <AccountCard />
      <LanguagePicker surface="university" />
      <SignOutSection />
    </Screen>
  );
}
