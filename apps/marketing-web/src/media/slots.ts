/**
 * Which photograph fills which slot on the marketing site.
 *
 * **Every slug here is attribution-free** (V14, brief Parts 2 and 35): Hangyul-owned, or CC0 / public domain
 * with the licence read back from the source's own API rather than from a page's prose. That is the whole
 * mechanism behind "no customer-visible photo credits" — the captions were not hidden, the thirteen CC BY
 * photographs that required them were taken out of the product. `docs/MEDIA_LICENSE_AUDIT.md` lists all
 * twenty-four assets, what each is licensed as, and where each one went.
 *
 * If you add a slot, add an attribution-free asset: `scripts/media/fetch_cc0.py` refuses anything else, and
 * `scripts/qa/v14-media-licence.mjs` fails the build if a slot ever points at an attribution-required slug.
 *
 * Swap a slug here (or drop Hangyul-commissioned files with the same slug into public/media) and the layout
 * follows automatically.
 */
export const SLOTS = {
  hero: 'korea-campus-autumn',
  heroPortrait: 'korea-campus-autumn-portrait',
  journey: {
    discover: 'snu-law-library',
    apply: 'snu-main-gate',
    admission: 'seoul-songpa-sunset',
    visa: 'seoul-subway-line9-platform',
    arrive: 'seoul-cheonggyecheon-walk',
  },
  life: 'seoul-cheonggyecheon-walk',
  check: 'snu-law-library',
  pageHeader: 'seoul-namsan-tower',
  lifeInset: 'seoul-cheonggyecheon-walk',
  lifeEnd: 'seoul-yeouido-river-dusk',
  /**
   * A city photograph stands in only where it is labelled as the city, never as a campus (brief Part 36).
   * Busan has no attribution-free photograph in the set, so there is no Busan entry: a region with no licensed
   * image falls through to the brand visual rather than borrowing Seoul's, which would tell a student they
   * were looking at a city they are not.
   */
  cityFallback: { Seoul: 'seoul-han-river-golden-hour' } as Record<string, string>,
  /**
   * A campus photograph appears only on that university's own page, never as generic imagery implying a
   * relationship. Yonsei's and Kyung Hee's were CC BY and are gone; both universities now fall through to the
   * region/brand visual until a licensed campus photograph of them exists.
   */
  university: { 'seoul-national-university': 'snu-main-gate' } as Record<string, string>,
  cta: 'seoul-jamsil-lotte-tower-night',
};
