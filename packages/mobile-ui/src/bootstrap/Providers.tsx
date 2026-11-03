import { ApiError } from '@hangyul/api-client';
import { i18next } from '@hangyul/i18n';
import { AuthProvider, useAuth } from '@hangyul/auth';
import type { Namespace } from '@hangyul/i18n';
import type { ClientApp } from '@hangyul/types';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Image, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontsReadyContext, fontAssets } from '../fonts';
import { theme } from '../theme';
import { createMobileApi } from './api';
import { clearOfflineCache, wireOfflineCache } from './offline';
import { applyAccountLocale, initMobileI18n, MOBILE_NAMESPACES } from './i18n';

let queryClient: QueryClient | null = null;
function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 10 * 60_000,
          retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        },
        mutations: { retry: 0 },
      },
    });
    // V31 (REPORT §424): found on the emulator — after switching the app to Korean, the home task still read
    // "Pusan National University · … high school transcripts…": the cached response had been resolved for the old
    // language. Server-resolved names follow Accept-Language, so a language change refetches cached data.
    const qc = queryClient;
    i18next.on('languageChanged', () => { void qc.invalidateQueries(); });
  }
  return queryClient;
}

// Refetch stale queries when the app returns to the foreground.
let focusWired = false;
function wireAppFocus() {
  if (focusWired) return;
  focusWired = true;
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => setFocused(s === 'active'));
    return () => sub.remove();
  });
}

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.color.primary,
    background: theme.color.bgCanvas,
    card: theme.color.surface,
    text: theme.color.text,
    border: theme.color.border,
    notification: theme.color.primary,
  },
};

export function BrandSplash() {
  return (
    <View style={styles.splash} accessible accessibilityRole="progressbar" accessibilityLabel="Hangyul Univ">
      <Image source={require('../../assets/brand/symbol-192.png')} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      <ActivityIndicator color={theme.color.primary} />
    </View>
  );
}

export interface MobileProvidersProps {
  client: ClientApp;
  namespaces?: readonly Namespace[];
  children: ReactNode;
}

/**
 * App bootstrap: fonts (Pretendard, system fallback), i18n (device locale via expo-localization),
 * React Query, API client with keychain-backed refresh token, and auth context.
 */
export function MobileProviders({ client, namespaces = MOBILE_NAMESPACES, children }: MobileProvidersProps) {
  const api = createMobileApi(client);
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    wireAppFocus();
    // V18: connectivity + the allowlisted disk cache. Keyed on the app version so a release that changes a
    // response shape cannot rehydrate the previous one (see bootstrap/offline.ts).
    wireOfflineCache(getQueryClient(), String(Constants.expoConfig?.version ?? '0'));
    initMobileI18n(namespaces, client === 'agency' || client === 'university' ? client : undefined).catch(() => undefined).finally(() => setI18nReady(true));
    const timer = setTimeout(() => setFontTimeout(true), 2500); // never block on fonts — fall back to system
    return () => clearTimeout(timer);
  }, [namespaces]);

  const fontsSettled = fontsLoaded || !!fontError || fontTimeout;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        {/*
          * V18: on Android 15+ the activity is edge-to-edge and the runtime StatusBarModule call is a
          * no-op — logcat showed `Ignored status bar change, current activity is edge-to-edge` on every
          * launch. The bar is now set on the app theme instead (`android:windowLightStatusBar`, written by
          * the expo-status-bar config plugin), so rendering this on Android only logs a warning about work
          * that has already been done declaratively. iOS still honours it at runtime, so it stays there.
          */}
        {Platform.OS === 'ios' ? <StatusBar style="dark" /> : null}
        {!i18nReady || !fontsSettled ? (
          <BrandSplash />
        ) : (
          <FontsReadyContext.Provider value={fontsLoaded && !fontError}>
            <QueryClientProvider client={getQueryClient()}>
              <AuthProvider api={api}>
                <QueryResetOnLogout>{children}</QueryResetOnLogout>
              </AuthProvider>
            </QueryClientProvider>
          </FontsReadyContext.Provider>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Drop cached data from the previous user when the session ends. */
function QueryResetOnLogout({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  useEffect(() => {
    // V18: the disk cache outlives the process, so clearing memory alone would leave the previous
    // student's applications on the device for the next person to sign in.
    if (status === 'anonymous') { getQueryClient().clear(); void clearOfflineCache(); }
  }, [status]);
  const accountLocale = session?.user.locale;
  useEffect(() => { void applyAccountLocale(accountLocale).catch(() => undefined); }, [accountLocale]);
  return <>{children}</>;
}

/** Shows the splash while restoring, the login screen when signed out, and the app when signed in. */
/** `hold` keeps the signed-out tree on screen although a session already exists — the native sign-up uses it so the
 *  "account created" step and the quick profile are shown before the app takes over (V22). */
export function AuthGate({ children, login, hold = false }: { children: ReactNode; login: ReactNode; hold?: boolean }) {
  const { status } = useAuth();
  if (status === 'loading') return <BrandSplash />;
  if (status === 'anonymous' || hold) return <>{login}</>;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: theme.color.bgCanvas },
  logo: { width: 81, height: 96 },
});
