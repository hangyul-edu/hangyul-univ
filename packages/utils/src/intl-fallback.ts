// Locale data for languages the browser's Intl (Chromium ships reduced ICU) may not support, e.g. Burmese.
// Generated from Node full-ICU CLDR data. formatDate/formatRelative/countryName in index.ts use it only when
// Intl does not support the requested locale, so users never see English month or country names in that language.
export interface IntlFallback { monthsShort: string[]; monthsLong: string[]; weekdaysShort: string[]; weekdaysLong: string[]; ymd: boolean;
  rel: { past: string; future: string; now?: string; units: Record<string, string>; day?: Record<string, string>; tpl?: Record<string, string> }; regions: Record<string, string> }
/** Loaded on demand (V9): each locale's data is its own chunk, fetched with that locale's translations. */
export const INTL_FALLBACK: Record<string, IntlFallback> = {};
const LOADERS: Record<string, () => Promise<{ default: IntlFallback }>> = {
  'my': () => import('./intl-fallback/my'),
  'az': () => import('./intl-fallback/az'),
  'kk': () => import('./intl-fallback/kk'),
  'km': () => import('./intl-fallback/km'),
  'ky': () => import('./intl-fallback/ky'),
  'lo': () => import('./intl-fallback/lo'),
  'mn': () => import('./intl-fallback/mn'),
  'ne': () => import('./intl-fallback/ne'),
  'si': () => import('./intl-fallback/si'),
  'tg': () => import('./intl-fallback/tg'),
  'uz': () => import('./intl-fallback/uz'),
  'tk': () => import('./intl-fallback/tk'),
  'ka': () => import('./intl-fallback/ka'),
  'ps': () => import('./intl-fallback/ps'),
  'hy': () => import('./intl-fallback/hy'),
  'ha': () => import('./intl-fallback/ha'),
  'yo': () => import('./intl-fallback/yo'),
  'ig': () => import('./intl-fallback/ig'),
  'so': () => import('./intl-fallback/so'),
};
export const INTL_FALLBACK_LOCALES = Object.keys(LOADERS);
/** Loads (once) the fallback data for a locale that needs it; resolves immediately for every other locale. */
export async function loadIntlFallback(locale: string): Promise<void> {
  const base = locale.split('-')[0];
  if (INTL_FALLBACK[base] || !LOADERS[base]) return;
  INTL_FALLBACK[base] = (await LOADERS[base]()).default;
}
