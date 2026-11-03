import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useFontsReady } from '../fonts';
import { fontFamily, theme } from '../theme';
import { AppText } from './AppText';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string | null;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  hideLabel?: boolean;
}

/** Labelled text input with error + hint; 48pt min height; error announced to screen readers. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, trailing, containerStyle, hideLabel, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const fontsReady = useFontsReady();
  const border = error ? theme.status.danger.solid : focused ? theme.color.focus : theme.color.borderStrong;
  return (
    <View style={[styles.field, containerStyle]}>
      {hideLabel ? null : <AppText variant="label" color={theme.color.text}>{label}</AppText>}
      <View style={[styles.inputWrap, { borderColor: border, borderWidth: focused || error ? 2 : 1 }, multiline && styles.multilineWrap]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? undefined}
          placeholderTextColor={theme.color.textTertiary}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          maxFontSizeMultiplier={1.6}
          style={[styles.input, fontsReady && { fontFamily: fontFamily.regular }, multiline && styles.multiline]}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});

export interface SegmentOption<T extends string> { value: T; label: string; count?: number }

/** iOS-style segmented control (tabs role). */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: {
  options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.count !== undefined ? `${o.label} (${o.count})` : o.label}
            android_ripple={{ color: 'rgba(15,23,41,0.06)', borderless: false }}
            style={[styles.segmentItem, selected && styles.segmentSelected]}
          >
            <AppText variant="subheading" numberOfLines={1} color={selected ? theme.color.text : theme.color.textSecondary}>
              {o.label}{o.count !== undefined ? ` ${o.count}` : ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontally scrolling filter chips. Multi-select when `multiple`. */
export function ChipGroup<T extends string>({ options, selected, onToggle, style }: {
  options: SegmentOption<T>[]; selected: T[]; onToggle: (v: T) => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={style}>
      {options.map((o) => (
        <Chip key={o.value} label={o.count !== undefined ? `${o.label} ${o.count}` : o.label} selected={selected.includes(o.value)} onPress={() => onToggle(o.value)} />
      ))}
    </ScrollView>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(255,103,0,0.14)' }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]}
    >
      <AppText variant="subheading" color={selected ? theme.color.primaryText : theme.color.textSecondary} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: theme.radius.md, backgroundColor: theme.color.surface, paddingHorizontal: 12,
  },
  multilineWrap: { alignItems: 'flex-start', paddingVertical: 8 },
  input: { flex: 1, fontSize: 16, color: theme.color.text, paddingVertical: Platform.OS === 'ios' ? 12 : 8, textAlign: 'auto' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', backgroundColor: theme.color.surfaceSunken, borderRadius: theme.radius.md, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, overflow: 'hidden' },
  segmentSelected: { backgroundColor: theme.color.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  chipOn: { backgroundColor: theme.color.primarySubtle, borderColor: theme.color.primary },
});
