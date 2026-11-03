import { useTranslation } from '@hangyul/i18n';
import { onlineManager } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

/** Subscribe to React Query's online state — the same signal the fetch layer uses, so the UI cannot disagree. */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(() => setOnline(onlineManager.isOnline())), []);
  return online;
}

/**
 * How long ago, in words.
 *
 * `Intl.RelativeTimeFormat` rather than four translated strings per locale: it already knows that Polish
 * needs "5 minut temu" but "2 minuty temu", and that Arabic has a dual. Hand-translating a relative time
 * into 33 locales is how plural bugs get shipped, and this is the one case where the platform is simply
 * right. Hermes ships Intl on both platforms; if it is ever unavailable the stamp is dropped rather than
 * rendered half-English.
 *
 * Deliberately coarse. The only question this line has to answer is "is what I am looking at from today".
 */
function useAgo(at: number | undefined): string | null {
  const { i18n } = useTranslation('mobile');
  if (!at) return null;
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    mins < 60 ? [-mins, 'minute'] : mins < 60 * 24 ? [-Math.round(mins / 60), 'hour'] : [-Math.round(mins / 1440), 'day'];
  try {
    return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(value, unit);
  } catch {
    return null;
  }
}

/**
 * The offline banner (brief §21–22).
 *
 * Shown **only when actually offline**. A permanent "data may be stale" strip trains students to ignore it,
 * and then it is not there when it matters. When the device is online this renders nothing at all.
 */
export function OfflineBanner() {
  const { t } = useTranslation('mobile');
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <CloudOff size={15} color={theme.color.textSecondary} />
      <AppText variant="caption" style={styles.bannerText}>{t('v18.offline.title')}</AppText>
    </View>
  );
}

/**
 * "Last updated …", under a screen's content.
 *
 * Only rendered when the device is offline **and** we are showing something we loaded earlier — which is
 * precisely when the student needs to know the age of what they are reading. Online, the data is live and
 * the line would be noise.
 *
 * `updatedAt` is React Query's `dataUpdatedAt`, so it is the real time of the last successful response
 * rather than the time the screen mounted.
 */
export function LastUpdated({ updatedAt }: { updatedAt?: number }) {
  const { t } = useTranslation('mobile');
  const online = useIsOnline();
  const ago = useAgo(updatedAt);
  if (online || !ago) return null;
  return (
    <AppText variant="caption" align="center" style={styles.stamp}>
      {t('v18.offline.stamp', { when: ago })}
    </AppText>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.color.surfaceWarm,
    borderBottomWidth: theme.hairline,
    borderBottomColor: theme.color.border,
  },
  bannerText: { color: theme.color.textSecondary },
  stamp: { marginTop: 12, marginBottom: 4, color: theme.color.textTertiary },
});
