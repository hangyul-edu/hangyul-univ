import { createApiClient, type ApiClient, type TokenStore } from '@hangyul/api-client';
import { i18next } from '@hangyul/i18n';
import type { ClientApp } from '@hangyul/types';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * API base URL resolution (first match wins):
 *   1. EXPO_PUBLIC_API_URL (inlined at build time)
 *   2. app.json → expo.extra.apiUrl
 *   3. http://localhost:8001 (iOS simulator / web)
 * Android emulator: use http://10.0.2.2:8001. Physical device: http://<your-LAN-IP>:8001.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
  return (fromEnv || extra.apiUrl || 'http://localhost:8001').replace(/\/$/, '');
}

/** Turns a server-relative URL (e.g. signed file URL "/api/v1/files/…") into an absolute one. */
export function absoluteApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getApiBaseUrl()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

const secureOpts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** Refresh token lives in the OS keychain / keystore — never in plain storage. Access token stays in memory. */
export function createSecureTokenStore(client: ClientApp): TokenStore {
  const key = `hg.${client}.refresh`;
  // Expo web preview (dev/QA only): the keychain doesn't exist, so keep the session for the tab in sessionStorage.
  if (Platform.OS === 'web') {
    return {
      async getRefreshToken() { try { return globalThis.sessionStorage?.getItem(key) ?? null; } catch { return null; } },
      async setRefreshToken(token) { try { if (token) globalThis.sessionStorage?.setItem(key, token); else globalThis.sessionStorage?.removeItem(key); } catch { /* ignore */ } },
    };
  }
  return {
    async getRefreshToken() {
      try { return await SecureStore.getItemAsync(key, secureOpts); } catch { return null; }
    },
    async setRefreshToken(token) {
      try {
        if (token) await SecureStore.setItemAsync(key, token, secureOpts);
        else await SecureStore.deleteItemAsync(key, secureOpts);
      } catch {
        /* keychain unavailable (e.g. web preview) — session simply won't persist */
      }
    },
  };
}

const clients = new Map<ClientApp, ApiClient>();

/** One API client per app (memoised so Fast Refresh keeps the session). */
export function createMobileApi(client: ClientApp): ApiClient {
  let api = clients.get(client);
  if (!api) {
    api = createApiClient({ baseUrl: getApiBaseUrl(), client, tokenStore: createSecureTokenStore(client), getLocale: () => i18next.language });
    clients.set(client, api);
  }
  return api;
}

/** Small non-secret preferences (locale) — stored with SecureStore since AsyncStorage isn't a dependency. */
export const prefs = {
  async get(key: string) { try { return await SecureStore.getItemAsync(`hg.pref.${key}`); } catch { return null; } },
  async set(key: string, value: string | null) {
    try {
      if (value === null) await SecureStore.deleteItemAsync(`hg.pref.${key}`);
      else await SecureStore.setItemAsync(`hg.pref.${key}`, value);
    } catch { /* ignore */ }
  },
};
