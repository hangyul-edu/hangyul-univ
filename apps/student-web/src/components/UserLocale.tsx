import { useAuth } from '@hangyul/auth';
import { changeLocale, resolveLocale, STORAGE_KEY, useLocale } from '@hangyul/i18n';
import { useEffect } from 'react';

/**
 * A student who chose a language (e.g. Burmese) sees it right after signing in on any device. The account's language
 * applies only when nothing was chosen on this device (no ?lang= and no language-switcher choice saved), so an explicit
 * choice always wins.
 */
export function UserLocale() {
  const { session } = useAuth();
  const { locale } = useLocale('common');
  const wanted = session?.user.locale;
  useEffect(() => {
    if (!wanted) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    if (saved || new URLSearchParams(window.location.search).get('lang')) return;
    const code = resolveLocale(wanted);
    if (code !== locale) void changeLocale(code);
  }, [wanted, locale]);
  return null;
}
