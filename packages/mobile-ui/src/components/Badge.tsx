import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme, toneColors, type Tone } from '../theme';
import { AppText } from './AppText';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Filled status badge — for rare, strong emphasis only. Lists use StatusText (dot + words). */
export function Badge({ label, tone = 'neutral', icon: Icon, solid, style }: BadgeProps) {
  const c = toneColors(tone);
  const fg = solid ? '#FFFFFF' : c.fg;
  return (
    <View style={[styles.badge, { backgroundColor: solid ? c.solid : c.bg }, style]} accessible accessibilityLabel={label}>
      {Icon ? <Icon size={12} color={fg} strokeWidth={2.4} /> : null}
      <AppText variant="label" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Small numeric counter (unread etc.). */
export function CountDot({ count, tone = 'brand' }: { count: number; tone?: Tone }) {
  if (!count) return null;
  return (
    <View style={[styles.dot, { backgroundColor: toneColors(tone).solid }]}>
      <AppText variant="label" color="#FFFFFF" style={styles.dotText}>
        {count > 99 ? '99+' : String(count)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: theme.radius.sm,
  },
  dot: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 11, lineHeight: 14 },
});
