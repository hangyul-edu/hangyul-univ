import { ApiError } from '@hangyul/api-client';
import { i18next } from '@hangyul/i18n';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Owner pass 261119 (req 7) — the text an error shows a person. API error details are written in English by the
 * server, so they are shown only in English; in every other locale the person sees the localized state that fits
 * (offline, no access, not found, service unavailable, or the generic "something went wrong").
 */
export function errorText(t: TFn, e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof TypeError ? t('common:states.offline') : t('mobile:v261119.error.action');
  if (e.unreachable) return t('common:states.unavailableText');
  if (e.isForbidden) return t('common:states.forbiddenDetail');
  if (e.isNotFound) return t('common:states.notFound');
  const english = (i18next.language ?? 'en').toLowerCase().startsWith('en');
  return english && e.message ? e.message : t('mobile:v261119.error.action');
}
