import { Check, Info, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme, toneColors, type Tone } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './Inputs';

/** Inline callout (info / warning / disclaimer). */
export function Callout({ title, body, tone = 'info', icon: Icon = Info, children }: { title?: string; body?: string; tone?: Tone; icon?: LucideIcon; children?: ReactNode }) {
  const c = toneColors(tone);
  return (
    <View style={[styles.callout, { backgroundColor: c.bg }]} accessible accessibilityLabel={[title, body].filter(Boolean).join('. ')}>
      <Icon size={18} color={c.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <AppText variant="subheading" color={c.fg}>{title}</AppText> : null}
        {body ? <AppText variant="caption" color={c.fg}>{body}</AppText> : null}
        {children}
      </View>
    </View>
  );
}

export interface PromptSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  minLength?: number;
  requiredMessage?: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). Bottom sheet style modal. */
export function PromptSheet({
  visible, title, message, label, placeholder, confirmLabel, cancelLabel, destructive, minLength = 0, requiredMessage, loading, onCancel, onSubmit,
}: PromptSheetProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => { if (visible) { setText(''); setError(null); } }, [visible]);
  const submit = () => {
    if (text.trim().length < minLength) { setError(requiredMessage ?? null); return; }
    onSubmit(text.trim());
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="title" accessibilityRole="header">{title}</AppText>
          {message ? <AppText variant="body" secondary>{message}</AppText> : null}
          <TextField label={label} placeholder={placeholder} value={text} onChangeText={setText} multiline autoFocus error={error} />
          <View style={styles.sheetActions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={submit} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  callout: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: theme.radius.lg },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.color.overlay },
  sheet: {
    backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
    padding: theme.space[5], gap: theme.space[3],
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.color.borderStrong, marginBottom: 4 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  pickerSheet: { maxHeight: '80%' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.md, overflow: 'hidden' },
  optionOn: { backgroundColor: theme.color.primarySubtle },
});

export interface PickerSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: { value: T; label: string; description?: string }[];
  selected?: T | null;
  cancelLabel: string;
  onCancel: () => void;
  onSelect: (value: T) => void;
}

/** Bottom-sheet single-choice picker (native feel on both platforms, no extra dependency). */
export function PickerSheet<T extends string>({ visible, title, options, selected, cancelLabel, onCancel, onSelect }: PickerSheetProps<T>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel} />
        <View style={[styles.sheet, styles.pickerSheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="title" accessibilityRole="header">{title}</AppText>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 2 }}>
            {options.map((o) => {
              const on = o.value === selected;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => onSelect(o.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }}
                  accessibilityLabel={o.label}
                  android_ripple={{ color: 'rgba(15,23,41,0.06)' }}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading" color={on ? theme.color.primaryText : theme.color.text}>{o.label}</AppText>
                    {o.description ? <AppText variant="caption">{o.description}</AppText> : null}
                  </View>
                  {on ? <Check size={18} color={theme.color.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
