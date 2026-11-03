import { useApi } from '@hangyul/auth';
import { useTranslation } from '@hangyul/i18n';
import { AppText, Button, isUnavailable, theme } from '@hangyul/mobile-ui';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { mapWebLink } from './links';

/**
 * Push, honestly: the OS permission and Expo push token are real and the token is registered with POST /me/push-tokens (204).
 * "On" is only shown once the server has the token; without a token (dev builds without an EAS project id) or when the
 * endpoint is unavailable we say alerts are allowed but in-app notifications remain the source of truth.
 */
/**
 * Loaded lazily: since SDK 53 Expo Go throws when expo-notifications is imported on Android, which took the whole root
 * layout down. In Expo Go (and on web) push is simply unavailable — in-app notifications stay the source of truth.
 */
function loadNotifications(): typeof NotificationsModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof NotificationsModule;
  } catch {
    return null;
  }
}
const Notifications = loadNotifications();
const SUPPORTED = Notifications !== null;
Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }) });

/** Tapping a push opens the matching screen (the payload carries the same web link as in-app notifications). */
export function usePushTaps() {
  useEffect(() => {
    if (!Notifications) return;
    const open = (r: NotificationsModule.NotificationResponse | null) => {
      const to = mapWebLink(r?.notification.request.content.data?.link as string | undefined);
      if (to) router.push(to);
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

type State = 'idle' | 'on' | 'pending-server' | 'denied' | 'error';

export function PushOptIn() {
  const { t } = useTranslation();
  const api = useApi();
  const [state, setState] = useState<State>('idle');
  const [busy, setBusy] = useState(false);
  /** Registers this phone's Expo push token. The endpoint answers 204 No Content on success. */
  const register = async (): Promise<State> => {
    let token: string;
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      token = (await Notifications!.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    } catch {
      // No EAS project id in development builds: permission is granted, token unavailable.
      return 'pending-server';
    }
    try {
      await api.post('/me/push-tokens', { token, platform: Platform.OS, app: 'student' });
      return 'on';
    } catch (e) {
      return isUnavailable(e) ? 'pending-server' : 'error';
    }
  };

  useEffect(() => {
    if (!Notifications) return;
    let alive = true;
    // Already allowed: refresh the registration quietly so the server keeps an up-to-date token for this user.
    void Notifications.getPermissionsAsync()
      .then(async (p) => { if (p.granted) { const next = await register(); if (alive) setState(next === 'error' ? 'idle' : next); } })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!SUPPORTED) return null;

  const enable = async () => {
    if (!Notifications) return;
    setBusy(true);
    try {
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Hangyul', importance: Notifications.AndroidImportance.DEFAULT });
      const perm = await Notifications.requestPermissionsAsync();
      setState(perm.granted ? await register() : 'denied');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8, padding: 16, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface }}>
      <AppText variant="subheading">{t('v3.push.title')}</AppText>
      <AppText variant="caption">{t(`v3.push.${state}`)}</AppText>
      {state === 'idle' || state === 'error' ? <Button label={t('v3.push.enable')} size="sm" onPress={() => void enable()} loading={busy} /> : null}
    </View>
  );
}
