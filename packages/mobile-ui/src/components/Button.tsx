import { control } from '@hangyul/design-tokens';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * **Solid Hangyul tangerine always carries a white label and a white icon** (V20, brief §38). On native
 * there is no cascade to lose it to: the colour is read from this table and handed to both the `AppText`
 * and every icon as `p.fg`, so the label and the glyph cannot disagree. `loading` keeps the same pair,
 * because a spinner on a tangerine fill is still a tangerine fill.
 */
const palettes: Record<ButtonVariant, { bg: string; fg: string; border: string; ripple: string; pressed: string }> = {
  primary: { bg: theme.color.primary, fg: theme.color.textOnPrimary, border: theme.color.primary, ripple: 'rgba(255,255,255,0.25)', pressed: theme.color.primaryPressed },
  // V25 (REPORT §317): SECONDARY is the brand's warm-neutral filled surface (`control.secondaryBg`), as on the web — not an outline.
  secondary: { bg: control.secondaryBg, fg: control.secondaryText, border: control.secondaryBg, ripple: 'rgba(15,23,41,0.08)', pressed: control.secondaryBgPressed },
  ghost: { bg: 'transparent', fg: theme.color.primaryText, border: 'transparent', ripple: 'rgba(255,103,0,0.12)', pressed: theme.color.primarySubtle },
  danger: { bg: theme.status.danger.solid, fg: '#FFFFFF', border: theme.status.danger.solid, ripple: 'rgba(255,255,255,0.25)', pressed: theme.palette.red[600] },
};

/**
 * Disabled is a **neutral surface**, not a faded brand one (V20, brief §38 — the rule V19 applied to the
 * web and did not carry across). `opacity: 0.5` over tangerine-with-white gave a washed-out orange at
 * roughly 1.9 : 1: a control that reads as broken rather than as not-yet-available. The fill, the border
 * and the label change; the height, the radius and the padding do not, so nothing moves when the button
 * activates — which is what makes the moment it turns tangerine mean something.
 *
 * `loading` is deliberately **not** disabled-looking: the action was accepted and is in flight, so the
 * button keeps its brand colour and shows the spinner in its own foreground.
 */
const DISABLED = { bg: theme.color.surfaceSunken, fg: theme.color.textTertiary, border: theme.color.border } as const;

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  iconAfter?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Primary action control. Always ≥48pt tall (touch target), ripple on Android, pressed tint on iOS. */
export function Button({
  label, onPress, variant = 'primary', size = 'md', icon: Icon, iconAfter: IconAfter, loading, disabled, fullWidth, accessibilityLabel, accessibilityHint, style, testID,
}: ButtonProps) {
  const base = palettes[variant];
  const inactive = disabled || loading;
  // Only a genuinely disabled control goes neutral. A loading one keeps its colours (see DISABLED).
  const p = disabled && !loading ? { ...base, ...DISABLED, pressed: DISABLED.bg } : base;
  const height = size === 'md' ? 48 : 40;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      android_ripple={{ color: p.ripple }}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height, backgroundColor: pressed && Platform.OS === 'ios' ? p.pressed : p.bg, borderColor: p.border, paddingHorizontal: size === 'md' ? 20 : 14 },
        fullWidth && styles.full,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={size === 'md' ? 18 : 16} color={p.fg} strokeWidth={2.2} /> : null}
          <AppText variant="bodyStrong" color={p.fg} numberOfLines={1} style={size === 'sm' ? styles.smallText : undefined}>
            {label}
          </AppText>
          {IconAfter ? <IconAfter size={16} color={p.fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  badge?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Icon-only touchable with a 48pt hit area and a mandatory accessibility label. */
export function IconButton({ icon: Icon, accessibilityLabel, onPress, color = theme.color.text, size = 22, disabled, badge, style }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: 'rgba(15,23,41,0.10)', borderless: true, radius: 24 }}
      style={({ pressed }) => [styles.icon, pressed && Platform.OS === 'ios' && { opacity: 0.5 }, disabled && styles.disabled, style]}
    >
      <Icon size={size} color={color} />
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: control.radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { alignSelf: 'stretch' },
  /** No opacity: the disabled palette above already carries the whole visual change. This only removes
   *  the press affordance. `IconButton` keeps `disabled` because an icon on a transparent ground has no
   *  surface to neutralise. */
  inactive: {},
  disabled: { opacity: 0.5 },
  smallText: { fontSize: 14 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
});
