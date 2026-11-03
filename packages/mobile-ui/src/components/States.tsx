import { ApiError } from '@hangyul/api-client';
import { useTranslation } from '@hangyul/i18n';
import type { UseQueryResult } from '@tanstack/react-query';
import { CircleAlert, Inbox, Lock, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ title, body, icon: Icon = Inbox, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <View style={[styles.empty, compact && styles.compact]} accessible accessibilityLabel={[title, body].filter(Boolean).join('. ')}>
      <View style={styles.emptyIcon}>
        <Icon size={22} color={theme.color.textTertiary} />
      </View>
      <AppText variant="heading" align="center">{title}</AppText>
      {body ? <AppText variant="caption" align="center" style={styles.emptyBody}>{body}</AppText> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, compact }: { error?: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useTranslation('common');
  const api = error instanceof ApiError ? error : null;
  const forbidden = api?.isForbidden;
  const offline = !api && error instanceof TypeError; // fetch network failure
  const unreachable = !!api?.unreachable; // V32: the service itself answered nothing usable
  const title = forbidden ? t('states.forbidden') : offline ? t('states.offline') : unreachable ? t('states.unavailableTitle') : api?.isNotFound ? t('states.notFound') : t('states.error');
  const body = forbidden ? t('states.forbiddenDetail') : unreachable ? t('states.unavailableText') : t('states.errorDetail');
  return (
    <EmptyState
      compact={compact}
      icon={forbidden ? Lock : offline ? WifiOff : CircleAlert}
      title={title}
      body={body}
      actionLabel={!forbidden && onRetry ? t('actions.retry') : undefined}
      onAction={onRetry}
    />
  );
}

/** Pulsing placeholder block; respects Reduce Motion. */
export function Skeleton({ height = 16, width = '100%', radius = 6, style }: { height?: number; width?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
    }).catch(() => undefined);
    return () => { cancelled = true; loop?.stop(); };
  }, [opacity]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: theme.color.surfaceSunken, opacity }, style]} />;
}

/** Skeleton list shown while a screen's first page loads. */
export function LoadingState({ rows = 4, hero = false }: { rows?: number; hero?: boolean }) {
  const { t } = useTranslation('common');
  return (
    <View style={styles.loading} accessible accessibilityRole="progressbar" accessibilityLabel={t('states.loading')}>
      {hero ? <Skeleton height={140} radius={theme.radius.lg} /> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={40} height={40} radius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Renders loading / error / data states for a React Query result. */
export function QueryState<T>({ query, children, loading, isEmpty, empty }: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingState />}</>;
  if (query.isError && query.data === undefined) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data as T;
  if (isEmpty?.(data) && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  compact: { paddingVertical: 20 },
  emptyIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: theme.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyBody: { maxWidth: 320 },
  loading: { gap: 16, paddingVertical: 8 },
  skelRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
