import { changeLocale, consoleLocale, initI18n, type ConsoleApp, isRTL, registerLocalePreloader, resolveLocale, type Namespace } from '@hangyul/i18n';
import { loadIntlFallback } from '@hangyul/utils';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import { prefs } from './api';

export const MOBILE_NAMESPACES: readonly Namespace[] = ['mobile', 'common', 'success', 'dossier', 'writing', 'visaroute', 'concierge'];
const LOCALE_PREF = 'locale';

let initPromise: Promise<unknown> | null = null;
/** V29: set for the staff apps — every locale they switch to must be a complete console locale. */
let consoleAppForLocale: ConsoleApp | undefined;

/** Device locale → supported locale (persisted override wins). */
export async function detectLocale(): Promise<string> {
  const stored = await prefs.get(LOCALE_PREF);
  if (stored) return resolveLocale(stored);
  const device = getLocales()[0];
  return resolveLocale(device?.languageTag ?? device?.languageCode ?? 'en');
}

/**
 * Initialise i18next once. Resources load through @hangyul/i18n's `import()` loaders, which Metro bundles
 * (async imports are inlined into the native bundle), so no static JSON imports are needed here.
 */
export function initMobileI18n(namespaces: readonly Namespace[] = MOBILE_NAMESPACES, consoleApp?: ConsoleApp) {
  if (!initPromise) {
    initPromise = (async () => {
      // V29: a staff app never boots into a locale whose console namespace is incomplete (brief §30).
      consoleAppForLocale = consoleApp;
      const detected = await detectLocale();
      const locale = consoleApp ? consoleLocale(consoleApp, detected) : detected;
      registerLocalePreloader(loadIntlFallback);
      await initI18n({ namespaces, locale });
      // Allow RTL layouts when the OS is RTL; we never force a restart. Styles use start/end so they mirror correctly.
      I18nManager.allowRTL(true);
    })();
  }
  return initPromise;
}

/** Change the UI language at runtime and remember the choice. */
export async function setAppLocale(code: string) {
  const resolved = resolveLocale(code);
  await changeLocale(resolved);
  await prefs.set(LOCALE_PREF, resolved);
  return { locale: resolved, rtl: isRTL(resolved), layoutRTL: I18nManager.isRTL };
}

/**
 * The account's saved language (e.g. Burmese) applies after sign-in on any device — unless a language was chosen on this
 * device (persisted override), which always wins. Not persisted: it follows the account.
 */
export async function applyAccountLocale(code: string | null | undefined) {
  if (!code) return;
  if (await prefs.get(LOCALE_PREF)) return;
  const resolved = resolveLocale(code);
  // V29: the account's saved language applies only if this app offers it — a Vietnamese counsellor's staff app opens
  // in English, never in a console that is mostly untranslated (found by the V29 emulator smoke).
  await changeLocale(consoleAppForLocale ? consoleLocale(consoleAppForLocale, resolved) : resolved);
}
