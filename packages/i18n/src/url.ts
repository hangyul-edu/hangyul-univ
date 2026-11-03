/**
 * The locale lives in the URL (V14, brief Part 44).
 *
 * Before this pass the current language was a `localStorage` key and nothing else. Two consequences, both of
 * which a user feels: a link someone sends to a friend opens in the friend's language, not the one the sender
 * was reading; and moving from the public site to the student app lost the choice entirely, because they are
 * different origins with different storage.
 *
 * `?lang=<code>` is now the authority. The resolution order the brief sets out:
 *
 *   1. an explicit `lang` in the URL      — always wins, including over a signed-in account's preference
 *   2. the authenticated account's preference
 *   3. the saved local preference
 *   4. the browser's language
 *   5. the default
 *
 * The rule that keeps this honest when the language changes is that **only** the `lang` parameter changes.
 * Path, other query parameters and hash are preserved exactly, so switching language on
 * `/universities?region=seoul#list` does not drop the region or the scroll target — which is what every
 * "reload the page in the new language" implementation does, and why language switching so often feels like
 * being thrown out of what you were doing.
 */

export const LANG_PARAM = 'lang';

/** Read the locale from a query string or a full URL. Returns null when there is no explicit choice. */
export function langFromSearch(search: string | URLSearchParams): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;
  return params.get(LANG_PARAM);
}

/**
 * Add or replace `lang` on a URL while preserving everything else about it.
 *
 * Accepts an absolute URL, a root-relative path, or a path with its own query and hash. `locale` of `null`
 * removes the parameter, which is how a product returns to "whatever this visitor's preference is".
 */
export function withLang(href: string, locale: string | null): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const noHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const qAt = noHash.indexOf('?');
  const path = qAt === -1 ? noHash : noHash.slice(0, qAt);
  const params = new URLSearchParams(qAt === -1 ? '' : noHash.slice(qAt + 1));
  if (locale) params.set(LANG_PARAM, locale);
  else params.delete(LANG_PARAM);
  const q = params.toString();
  return `${path}${q ? `?${q}` : ''}${hash}`;
}

/**
 * The current location with a different language and nothing else changed — what the language selector
 * navigates to. Separate from `withLang` only so the caller does not have to reassemble `location`.
 */
export function localeHref(locale: string, loc: { pathname: string; search: string; hash: string }): string {
  return withLang(`${loc.pathname}${loc.search}${loc.hash}`, locale);
}
