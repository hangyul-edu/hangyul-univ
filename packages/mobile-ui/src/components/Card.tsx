import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme, toneColors, type Tone } from '../theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Tinted surface (e.g. hero card). */
  tone?: Tone | 'warm';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, accessibilityLabel, accessibilityHint, tone, padded = true, style }: CardProps) {
  const bg = tone === 'warm' ? theme.color.surfaceWarm : tone ? toneColors(tone).bg : theme.color.surface;
  const border = tone === 'warm' ? theme.color.borderSubtle : tone ? toneColors(tone).bg : theme.color.border;
  const base = [styles.card, { backgroundColor: bg, borderColor: border }, padded && styles.padded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: 'rgba(15,23,41,0.06)', foreground: true }}
      style={({ pressed }) => [...base, pressed && Platform.OS === 'ios' && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: theme.radius.lg, borderWidth: 1, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
  padded: { padding: theme.space[4], gap: theme.space[3] },
  pressed: { opacity: 0.75 },
});
