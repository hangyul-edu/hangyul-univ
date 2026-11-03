/**
 * Renders the owner-authorised Koreanasha strings, which carry the template's own markup.
 *
 * Exactly four tags occur across the 43 canonical strings (counted in REPORT §74): `<br>`,
 * `<span class="text-blue">`, `<span class="text-gradation">` and one `<h2 class="mb-4">` wrapper. They are
 * matched by a whitelist and turned into React elements — no `dangerouslySetInnerHTML`, so a string that one day
 * contains anything else renders as visible text instead of executing. Unknown tags are therefore *safe*, not
 * silently dropped, which is also how we would notice a copy change.
 *
 * `text-blue` / `text-gradation` become `<em>`, which `.kn-head__title em` paints in the Hangyul accent — the
 * same role Koreanasha's two classes play in its own headings.
 */
import { localeChain, TARGET_LOCALES } from '@hangyul/i18n';
import { Fragment, type ReactNode } from 'react';

/** Koreanasha wraps one heading string in its own `<h2>`; our `SectionHead` supplies the element, so unwrap it. */
const unwrapHeading = (s: string) => s.replace(/^\s*<h2[^>]*>/, '').replace(/<\/h2>\s*$/, '');

const TOKEN = /<br\s*\/?>|<span class="text-(blue|gradation)">([\s\S]*?)<\/span>/g;

export function koreanasha(source: string): ReactNode {
  const text = unwrapHeading(source);
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) out.push(<Fragment key={out.length}>{text.slice(last, m.index)}</Fragment>);
    if (m[0].startsWith('<br')) out.push(<br key={out.length} />);
    else out.push(<em key={out.length} className={m[1] === 'gradation' ? 'kn-accent--gradient' : undefined}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={out.length}>{text.slice(last)}</Fragment>);
  return out;
}

/** Body copy: the same renderer, used where the string is a paragraph rather than a heading. */
export const koreanashaText = koreanasha;

/**
 * The locales the homepage copy actually exists in.
 *
 * Korean and Russian are the owner's own writing (`docs/qa/v11/koreanasha-copy.json` → `source.locales`) and
 * English is an AI translation of them. **V14 translated the homepage into all 31 target markets**
 * (REPORT §107), so this is no longer a list of three.
 *
 * It is derived from `TARGET_LOCALES` rather than typed out, because the version where it was typed out is
 * exactly how this went wrong: V14 shipped Bengali homepage copy while this list still said `['ko','ru','en']`,
 * so `copyLocale('bn')` fell through to English and a Bengali sentence was rendered with a Latin numeral —
 * the mirror image of the V13 defect the function exists to prevent. Caught by
 * `e2e/v13-hierarchy.spec.ts` test 6, which asserts the figure is in the script of its own sentence.
 */
export const COPY_LOCALES = ['ko', 'ru', 'en', ...TARGET_LOCALES] as const;

/**
 * The locale a **number inside that copy** should be formatted in (V13).
 *
 * `Intl` localises digits, and it has no idea which language the surrounding sentence ended up in. A visitor
 * who asked for Bengali got the English sentence — because that string has no Bengali translation — with a
 * Bengali numeral dropped into the middle of it: *২০০+ Korean universities are waiting for your admission.*
 * Correct localisation of the number, incoherent on the page, and invisible to every gate we had: the
 * sentence is not missing, not overflowing and not untranslated, it is merely written in two scripts.
 *
 * Found by the V13 country sweep (`scripts/qa/v13-country-probe.mjs`), which is the only check that has ever
 * looked at this page as each source market's reader. Returns the locale the sentence is in, so the figure is
 * written in the same script as the words around it.
 */
export function copyLocale(locale: string): string {
  const has = (c: string) => (COPY_LOCALES as readonly string[]).includes(c);
  // The chain is the same one i18next resolves the *words* through (`localeChain`), so the figure and the
  // sentence can never end up in different languages — including for the Central Asian locales that fall
  // back through Russian rather than straight to English.
  for (const c of localeChain(locale)) {
    if (has(c) || has(c.split('-')[0])) return c;
  }
  return 'en';
}
