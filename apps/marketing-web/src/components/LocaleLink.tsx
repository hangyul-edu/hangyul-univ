/**
 * A `<Link>` that keeps the reader's language (V14, brief Part 44).
 *
 * Every internal navigation on the public site has to carry `?lang=` forward, or the architecture is a lie:
 * someone reading in Vietnamese who clicks the Yonsei crest must land on `/universities/yonsei-university?lang=vi`,
 * not on an English page. React Router's own `Link` has no idea the parameter is meaningful, so this wraps it.
 *
 * The parameter is only written when the locale is not the default, which keeps a Korean reader's URLs clean
 * and keeps the homepage canonical. `useLocaleHref` is the same logic for a plain `<a>` — the one case being
 * the hand-off to the Student Platform, which is a different origin and therefore not a router navigation.
 */
import { useLocale, withLang } from '@hangyul/i18n';
import { forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router';

/** Korean is the product's default; a `?lang=ko` on every link is noise. */
const DEFAULT_LOCALE = 'ko';

export function useLocaleHref(): (to: string) => string {
  const { locale } = useLocale();
  return (to: string) => (locale && locale !== DEFAULT_LOCALE ? withLang(to, locale) : to);
}

export const LocaleLink = forwardRef<HTMLAnchorElement, LinkProps & { to: string }>(
  function LocaleLink({ to, ...rest }, ref) {
    const href = useLocaleHref();
    return <Link ref={ref} to={href(to)} {...rest} />;
  },
);
