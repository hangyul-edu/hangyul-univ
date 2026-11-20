import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppText } from './AppText';
import { useKeyboardAvoiding, useKeyboardShown } from './Keyboard';

export interface ScreenProps {
  children: ReactNode;
  /** Large title rendered in-content (tab roots). Detail screens use the native stack header instead. */
  title?: string;
  subtitle?: string;
  /** Element placed at the end of the large title row (e.g. avatar / icon button). */
  headerRight?: ReactNode;
  /** Pull-to-refresh. Awaited so the spinner stays until data arrives. */
  onRefresh?: () => Promise<unknown> | void;
  scroll?: boolean;
  padded?: boolean;
  /** Sticky footer (composer / action bar) — kept above the keyboard. */
  footer?: ReactNode;
  /** Safe-area edges to pad. Tab roots (no native header) need 'top'. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}

/** Screen scaffold: SafeArea + ScrollView + pull-to-refresh + optional large title and sticky footer. */
export function Screen({
  children, title, subtitle, headerRight, onRefresh, scroll = true, padded = true, footer, edges, contentStyle, keyboard,
}: ScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoiding();
  const keyboardShown = useKeyboardShown();
  const resolvedEdges = edges ?? (title ? ['top', 'left', 'right'] : ['left', 'right']);
  // 261119 req 5: a stack screen (no tab bar under it) pads its own bottom inset — Android's edge-to-edge navigation
  // bar and the iPhone home indicator otherwise sit on the last row. A footer already carries the inset.
  const bottomInset = !title && !footer && !resolvedEdges.includes('bottom') ? insets.bottom : 0;
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);

  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="display" accessibilityRole="header" numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, styles.gap, bottomInset ? { paddingBottom: (padded ? theme.space[10] : 0) + bottomInset } : null, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.color.primary} colors={[theme.color.primary]} /> : undefined}
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, styles.gap, bottomInset ? { paddingBottom: (padded ? theme.space[4] : 0) + bottomInset } : null, contentStyle]}>
      {header}
      {children}
    </View>
  );

  const inner = (
    <>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: keyboardShown ? theme.space[3] : Math.max(theme.space[3], insets.bottom) }]}>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={resolvedEdges}>
      {/* 261119 req 5: every scrolling screen avoids the keyboard (a field anywhere in it scrolls into view on both
          platforms); `keyboard` keeps the opt-in for non-scrolling screens. */}
      {keyboard || footer || scroll ? (
        <KeyboardAvoidingView style={styles.flex} behavior={kb.behavior} keyboardVerticalOffset={kb.keyboardVerticalOffset}>
          {inner}
        </KeyboardAvoidingView>
      ) : inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Design foundation (2026-11): the working canvas is WHITE in every product, as on the web; warm paper is for asides.
  root: { flex: 1, backgroundColor: theme.color.bg },
  flex: { flex: 1 },
  padded: { padding: theme.space[4], paddingBottom: theme.space[10] },
  gap: { gap: theme.space[5] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: theme.space[2], paddingBottom: theme.space[1] },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border, backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space[4], paddingVertical: theme.space[3],
  },
});
