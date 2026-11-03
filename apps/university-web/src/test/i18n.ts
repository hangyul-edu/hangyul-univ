import { initI18n } from '@hangyul/i18n';

let ready: Promise<unknown> | null = null;
/** Loads the real EN `common` + `university` bundles so tests assert on production copy. */
export function setupI18n() {
  ready ??= initI18n({ namespaces: ['university', 'common'], locale: 'en' });
  return ready;
}
