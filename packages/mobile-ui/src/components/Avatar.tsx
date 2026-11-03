import { initials } from '@hangyul/utils';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Quiet, neutral tints (same as web): people are identified by name, not by a random colour. */
const TINTS: [string, string][] = [['#EFEEEB', '#4A4640'], ['#E8EDF3', '#3C4A5C'], ['#EAF1EC', '#35503E'], ['#F1ECF3', '#51405A'], ['#F3EEE6', '#5A4A33']];

/** Initials avatar with a stable tint per name. Decorative (hidden from screen readers) unless labelled. */
export function Avatar({ name, size = 40, accessibilityLabel }: { name: string | null | undefined; size?: number; accessibilityLabel?: string }) {
  const [bg, fg] = TINTS[hash(name ?? '?') % TINTS.length];
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      <AppText variant="bodyStrong" color={fg} maxFontSizeMultiplier={1} style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ avatar: { alignItems: 'center', justifyContent: 'center' } });
