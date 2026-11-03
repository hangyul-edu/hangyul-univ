import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { flipStyle, theme } from '../theme';
import { AppText } from './AppText';

/** Horizontal layout helper (respects RTL automatically via flexDirection: row). */
export function Row({ children, gap = 8, align = 'center', justify, wrap, style }: {
  children: ReactNode; gap?: number; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; wrap?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

/** Vertical layout helper. */
export function VStack({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginStart: inset }]} />;
}

export interface ListItemProps {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  leading?: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  chevron?: boolean;
  numberOfLines?: number;
  /** Rendered under the text (e.g. a StatusText) so narrow rows keep the title full-width. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Standard 56pt+ list row. Rows with onPress get a chevron, ripple and button role. */
export function ListItem({
  title, subtitle, meta, leading, icon: Icon, iconColor = theme.color.textSecondary, trailing, onPress, accessibilityLabel, accessibilityHint,
  chevron = !!onPress, numberOfLines = 2, footer, style,
}: ListItemProps) {
  const content = (
    <>
      {leading ?? (Icon ? (
        <View style={styles.iconWrap}>
          <Icon size={20} color={iconColor} />
        </View>
      ) : null)}
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={numberOfLines}>{title}</AppText>
        {subtitle ? <AppText variant="caption" numberOfLines={numberOfLines}>{subtitle}</AppText> : null}
        {meta ? <AppText variant="caption" color={theme.color.textTertiary} numberOfLines={1}>{meta}</AppText> : null}
        {footer ? <View style={{ marginTop: 4 }}>{footer}</View> : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight size={18} color={theme.color.textTertiary} style={flipStyle()} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, style]} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: 'rgba(15,23,41,0.06)' }}
      style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

/** Grouped list container (iOS inset-grouped look, Material card on Android). */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <Divider inset={16} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction, style }: { title: string; actionLabel?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <AppText variant="heading" accessibilityRole="header" style={styles.sectionTitle}>{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={12} style={styles.sectionAction}>
          <AppText variant="caption" weight="semibold" color={theme.color.textSecondary}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface CheckRowProps {
  label: string;
  detail?: string | null;
  checked: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
  trailing?: ReactNode;
}

/** Checkbox row (role=checkbox). Read-only when onToggle is omitted. */
export function CheckRow({ label, detail, checked, onToggle, disabled, trailing }: CheckRowProps) {
  const box = (
    <View style={[styles.box, checked && styles.boxOn, disabled && { opacity: 0.5 }]}>
      {checked ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
    </View>
  );
  const body = (
    <>
      {box}
      <View style={styles.body}>
        <AppText variant="body" style={checked ? styles.done : undefined}>{label}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      {trailing}
    </>
  );
  if (!onToggle) {
    return (
      <View style={styles.row} accessible accessibilityRole="checkbox" accessibilityState={{ checked, disabled: true }} accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={detail ?? undefined}
      android_ripple={{ color: 'rgba(15,23,41,0.06)' }}
      style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16 },
  body: { flex: 1, gap: 2 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.color.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: theme.color.bgMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  group: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, overflow: 'hidden' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, marginTop: 12 },
  sectionTitle: { flex: 1 },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingStart: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: theme.color.text, borderColor: theme.color.text },
  done: { color: theme.color.textSecondary },
});
