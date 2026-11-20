/**
 * Owner pass 261119 (req 5) — one keyboard rule for every native screen, sheet and composer.
 *
 * Expo SDK 57 / RN 0.86 run Android **edge-to-edge**: the window is no longer resized by `adjustResize`, so the old
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` left Android inputs (OTP, composer, sheets) under the
 * keyboard. Both platforms now use `padding`, offset by the native stack header above the view (measured, not the
 * hard-coded 96/100 px that was wrong on every screen without a header and on large-title iPhones).
 */
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/** Props for a KeyboardAvoidingView. `inModal`: a Modal starts at the top of the screen, so no header offset. */
export function useKeyboardAvoiding(inModal = false): { behavior: 'padding' | undefined; keyboardVerticalOffset: number } {
  const header = useContext(HeaderHeightContext) ?? 0;
  // Web has no on-screen keyboard to avoid (the browser scrolls the focused field itself).
  if (Platform.OS === 'web') return { behavior: undefined, keyboardVerticalOffset: 0 };
  return { behavior: 'padding', keyboardVerticalOffset: inModal ? 0 : header };
}

/** True while the software keyboard is up — a bottom bar then drops its safe-area padding (the keyboard covers that edge). */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}

/** A flex:1 KeyboardAvoidingView with the shared rule. */
export function KeyboardSafe({ children, inModal, style }: { children: ReactNode; inModal?: boolean; style?: StyleProp<ViewStyle> }) {
  const kb = useKeyboardAvoiding(inModal);
  return <KeyboardAvoidingView style={[styles.flex, style]} behavior={kb.behavior} keyboardVerticalOffset={kb.keyboardVerticalOffset}>{children}</KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
