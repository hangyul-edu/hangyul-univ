/**
 * **The canonical market manifest (V17).** One list, consumed by marketing, student web, student native and
 * both consoles. Nothing else in the product may hold its own list of countries, languages or flags.
 *
 * Before V17 there were three lists and they disagreed: 31 rows here, 31 files in `apps/flags`, and 52
 * translation bundles — and the consumer language picker rendered from the *bundles*, so a student was
 * offered markets the business does not serve alongside bundles that were 0 % translated. The picker now
 * renders from this file; `LOCALES` stays what it always was, a registry of which bundles exist and how far
 * each has been reviewed.
 *
 * **33 markets.** V14 shipped 31 and recorded the missing 32nd as an open question
 * (`docs/qa/v14/LOCALE_MATRIX.md`); the owner answered it in V17 with **Nepal**. V18 adds the 33rd,
 * **Myanmar**, on the same evidence and for the same reason: the `my` bundle was one of the best-covered
 * student translations in the product — including every V17 string — and simply had no market row or flag
 * to be selected by. Both were wiring gaps, not translation gaps.
 *
 * Myanmar is in `RESEARCH_MARKETS` as well, because the research was already there too: a visa playbook
 * entry sourced to the Korean embassy in Yangon (verified 2026-10-10) and a country simulation at
 * `docs/qa/v13/country-simulations/mm-myanmar.md`.
 *
 * **Filename is not country.** `apps/flags` is the owner's drop and is never edited: the French tricolour
 * ships as `GP.svg`, the Polish flag as `ID2.svg`, and Korea's as `KO.svg` (a language tag). `asset` is the
 * owner's filename, `code` is the real ISO 3166-1 alpha-2 country, and `scripts/media/sync-flags.mjs`
 * publishes each asset under its real code. The one asset V17 added, `NP.svg`, is named correctly and
 * carries its provenance beside it.
 *
 * **One locale is still deliberately NOT a market, and that is the owner's call to change.** `zh-Hant`
 * sits at 87 % and has never had a market row. V18 did not add one: the owner's V18 decision names
 * **Myanmar** and sets the canonical list at **33**, and promoting Traditional Chinese as well is a
 * commercial decision about Taiwan and Hong Kong, not a wiring fix. It remains reachable as a locale —
 * see `localeOptions` — and §189 carries it as an open owner question.
 *
 * **Country is not language.** `locale` is the language a market is *served* in, which is why India is `hi`,
 * the Philippines `fil` and Saudi Arabia `ar`. Each of the 32 markets maps to a distinct locale.
 *
 * **`flagRatio` exists because of Nepal.** Every other national flag here is a rectangle at roughly 3:2.
 * Nepal's is the only non-quadrilateral national flag in the world — two stacked pennons, and portrait at
 * ~0.82:1. Rendering flags at a fixed 20 × 14 with `object-fit: cover` would crop it into a rectangle,
 * which the brief forbids by name. So every row declares its own aspect ratio, `<Flag>` sizes by height and
 * lets width follow, and Nepal is a narrow flag rather than a special case.
 */

export interface Market {
  /** ISO 3166-1 alpha-2 of the country. The market's own code; `marketCode` is an alias for the brief's wording. */
  code: string;
  /** The filename in `apps/flags`, without `.svg`. Not always equal to `code` — see the module note. */
  asset: string;
  /** The locale this market is served in. */
  locale: string;
  /** Country name in English, in the market's own language, and in Korean — all three are searchable. */
  nameEn: string;
  nameNative: string;
  nameKo: string;
  /** The *language* name, in itself, in English and in Korean. The picker shows the first two. */
  languageNative: string;
  languageEn: string;
  languageKo: string;
  /** Writing direction of the served locale. */
  dir: 'ltr' | 'rtl';
  /** Intrinsic width ÷ height of the flag asset. 1.5 is a 3:2 rectangle; Nepal is 0.82. */
  flagRatio: number;
  /** Which Hangyul products this market is offered in. Every market gets the public and student surfaces. */
  products: readonly ('marketing' | 'student')[];
}

const WEB = ['marketing', 'student'] as const;

/**
 * The 33 markets, in **recruitment priority** rather than alphabetical order: a Vietnamese, Nepali or Uzbek
 * student must not have to scroll past Sweden to find their own language. Korea leads because the product is
 * Korean; the rest descend by how much of Hangyul's intake each market represents.
 */
export const MARKETS: Market[] = [
  { code: 'KR',   asset: 'KO',    locale: 'ko',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'South Korea',      nameNative: '대한민국',             nameKo: '대한민국',         languageNative: '한국어',                  languageEn: 'Korean',                   languageKo: '한국어',              products: WEB },
  { code: 'VN',   asset: 'VN',    locale: 'vi',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Vietnam',          nameNative: 'Việt Nam',         nameKo: '베트남',          languageNative: 'Tiếng Việt',           languageEn: 'Vietnamese',               languageKo: '베트남어',             products: WEB },
  { code: 'NP',   asset: 'NP',    locale: 'ne',        dir: 'ltr',   flagRatio: 0.82, nameEn: 'Nepal',            nameNative: 'नेपाल',            nameKo: '네팔',           languageNative: 'नेपाली',               languageEn: 'Nepali',                   languageKo: '네팔어',              products: WEB },
  { code: 'UZ',   asset: 'UZ',    locale: 'uz',        dir: 'ltr',   flagRatio: 2.0, nameEn: 'Uzbekistan',       nameNative: 'Oʻzbekiston',      nameKo: '우즈베키스탄',       languageNative: 'Oʻzbekcha',            languageEn: 'Uzbek',                    languageKo: '우즈베크어',            products: WEB },
  { code: 'MN',   asset: 'MN',    locale: 'mn',        dir: 'ltr',   flagRatio: 2.0, nameEn: 'Mongolia',         nameNative: 'Монгол',           nameKo: '몽골',           languageNative: 'Монгол',               languageEn: 'Mongolian',                languageKo: '몽골어',              products: WEB },
  { code: 'CN',   asset: 'CN',    locale: 'zh-Hans',   dir: 'ltr',   flagRatio: 1.5, nameEn: 'China',            nameNative: '中国',               nameKo: '중국',           languageNative: '简体中文',                 languageEn: 'Chinese (Simplified)',     languageKo: '중국어(간체)',          products: WEB },
  { code: 'JP',   asset: 'JP',    locale: 'ja',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Japan',            nameNative: '日本',               nameKo: '일본',           languageNative: '日本語',                  languageEn: 'Japanese',                 languageKo: '일본어',              products: WEB },
  { code: 'US',   asset: 'US',    locale: 'en',        dir: 'ltr',   flagRatio: 1.9, nameEn: 'United States',    nameNative: 'United States',    nameKo: '미국',           languageNative: 'English',              languageEn: 'English',                  languageKo: '영어',               products: WEB },
  { code: 'TH',   asset: 'TH',    locale: 'th',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Thailand',         nameNative: 'ประเทศไทย',        nameKo: '태국',           languageNative: 'ไทย',                  languageEn: 'Thai',                     languageKo: '태국어',              products: WEB },
  { code: 'ID',   asset: 'ID',    locale: 'id',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Indonesia',        nameNative: 'Indonesia',        nameKo: '인도네시아',        languageNative: 'Bahasa Indonesia',     languageEn: 'Indonesian',               languageKo: '인도네시아어',           products: WEB },
  { code: 'PH',   asset: 'PH',    locale: 'fil',       dir: 'ltr',   flagRatio: 2.0, nameEn: 'Philippines',      nameNative: 'Pilipinas',        nameKo: '필리핀',          languageNative: 'Filipino',             languageEn: 'Filipino',                 languageKo: '필리핀어',             products: WEB },
  { code: 'MM',   asset: 'MM',    locale: 'my',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Myanmar',          nameNative: 'မြန်မာ',            nameKo: '미얀마',          languageNative: 'မြန်မာဘာသာ',            languageEn: 'Burmese',                  languageKo: '미얀마어',             products: WEB },
  { code: 'IN',   asset: 'IN',    locale: 'hi',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'India',            nameNative: 'भारत',             nameKo: '인도',           languageNative: 'हिन्दी',               languageEn: 'Hindi',                    languageKo: '힌디어',              products: WEB },
  { code: 'BD',   asset: 'BD',    locale: 'bn',        dir: 'ltr',   flagRatio: 1.67, nameEn: 'Bangladesh',       nameNative: 'বাংলাদেশ',         nameKo: '방글라데시',        languageNative: 'বাংলা',                languageEn: 'Bengali',                  languageKo: '벵골어',              products: WEB },
  { code: 'KZ',   asset: 'KZ',    locale: 'kk',        dir: 'ltr',   flagRatio: 2.0, nameEn: 'Kazakhstan',       nameNative: 'Қазақстан',        nameKo: '카자흐스탄',        languageNative: 'Қазақша',              languageEn: 'Kazakh',                   languageKo: '카자흐어',             products: WEB },
  { code: 'KG',   asset: 'KG',    locale: 'ky',        dir: 'ltr',   flagRatio: 1.67, nameEn: 'Kyrgyzstan',       nameNative: 'Кыргызстан',       nameKo: '키르기스스탄',       languageNative: 'Кыргызча',             languageEn: 'Kyrgyz',                   languageKo: '키르기스어',            products: WEB },
  { code: 'SA',   asset: 'SA',    locale: 'ar',        dir: 'rtl',   flagRatio: 1.5, nameEn: 'Saudi Arabia',     nameNative: 'السعودية',         nameKo: '사우디아라비아',      languageNative: 'العربية',              languageEn: 'Arabic',                   languageKo: '아랍어',              products: WEB },
  { code: 'TR',   asset: 'TR',    locale: 'tr',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Türkiye',          nameNative: 'Türkiye',          nameKo: '튀르키예',         languageNative: 'Türkçe',               languageEn: 'Turkish',                  languageKo: '튀르키예어',            products: WEB },
  { code: 'RU',   asset: 'RU',    locale: 'ru',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Russia',           nameNative: 'Россия',           nameKo: '러시아',          languageNative: 'Русский',              languageEn: 'Russian',                  languageKo: '러시아어',             products: WEB },
  { code: 'UA',   asset: 'UA',    locale: 'uk',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Ukraine',          nameNative: 'Україна',          nameKo: '우크라이나',        languageNative: 'Українська',           languageEn: 'Ukrainian',                languageKo: '우크라이나어',           products: WEB },
  { code: 'PL',   asset: 'ID2',   locale: 'pl',        dir: 'ltr',   flagRatio: 1.6, nameEn: 'Poland',           nameNative: 'Polska',           nameKo: '폴란드',          languageNative: 'Polski',               languageEn: 'Polish',                   languageKo: '폴란드어',             products: WEB },
  { code: 'CZ',   asset: 'CZ',    locale: 'cs',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Czechia',          nameNative: 'Česko',            nameKo: '체코',           languageNative: 'Čeština',              languageEn: 'Czech',                    languageKo: '체코어',              products: WEB },
  { code: 'HU',   asset: 'HU',    locale: 'hu',        dir: 'ltr',   flagRatio: 2.0, nameEn: 'Hungary',          nameNative: 'Magyarország',     nameKo: '헝가리',          languageNative: 'Magyar',               languageEn: 'Hungarian',                languageKo: '헝가리어',             products: WEB },
  { code: 'RO',   asset: 'RO',    locale: 'ro',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Romania',          nameNative: 'România',          nameKo: '루마니아',         languageNative: 'Română',               languageEn: 'Romanian',                 languageKo: '루마니아어',            products: WEB },
  { code: 'RS',   asset: 'RS',    locale: 'sr',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Serbia',           nameNative: 'Србија',           nameKo: '세르비아',         languageNative: 'Српски',               languageEn: 'Serbian',                  languageKo: '세르비아어',            products: WEB },
  { code: 'GR',   asset: 'GR',    locale: 'el',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Greece',           nameNative: 'Ελλάδα',           nameKo: '그리스',          languageNative: 'Ελληνικά',             languageEn: 'Greek',                    languageKo: '그리스어',             products: WEB },
  { code: 'IT',   asset: 'IT',    locale: 'it',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Italy',            nameNative: 'Italia',           nameKo: '이탈리아',         languageNative: 'Italiano',             languageEn: 'Italian',                  languageKo: '이탈리아어',            products: WEB },
  { code: 'ES',   asset: 'ES',    locale: 'es',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Spain',            nameNative: 'España',           nameKo: '스페인',          languageNative: 'Español',              languageEn: 'Spanish',                  languageKo: '스페인어',             products: WEB },
  { code: 'PT',   asset: 'PT',    locale: 'pt',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Portugal',         nameNative: 'Portugal',         nameKo: '포르투갈',         languageNative: 'Português',            languageEn: 'Portuguese',               languageKo: '포르투갈어',            products: WEB },
  { code: 'FR',   asset: 'GP',    locale: 'fr',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'France',           nameNative: 'France',           nameKo: '프랑스',          languageNative: 'Français',             languageEn: 'French',                   languageKo: '프랑스어',             products: WEB },
  { code: 'DE',   asset: 'DE',    locale: 'de',        dir: 'ltr',   flagRatio: 1.67, nameEn: 'Germany',          nameNative: 'Deutschland',      nameKo: '독일',           languageNative: 'Deutsch',              languageEn: 'German',                   languageKo: '독일어',              products: WEB },
  { code: 'NL',   asset: 'NL',    locale: 'nl',        dir: 'ltr',   flagRatio: 1.5, nameEn: 'Netherlands',      nameNative: 'Nederland',        nameKo: '네덜란드',         languageNative: 'Nederlands',           languageEn: 'Dutch',                    languageKo: '네덜란드어',            products: WEB },
  { code: 'SE',   asset: 'SE',    locale: 'sv',        dir: 'ltr',   flagRatio: 1.6, nameEn: 'Sweden',           nameNative: 'Sverige',          nameKo: '스웨덴',          languageNative: 'Svenska',              languageEn: 'Swedish',                  languageKo: '스웨덴어',             products: WEB },
];

/** The locales the 33 target markets are served in, in market order. */
export const TARGET_LOCALES: string[] = MARKETS.map((m) => m.locale);

const byLocale = new Map(MARKETS.map((m) => [m.locale, m]));
export function marketForLocale(locale: string): Market | undefined { return byLocale.get(locale); }

/** Where a market's flag is served from. Apps publish these under `public/flags` (scripts/media/sync-flags.mjs). */
export function flagUrl(code: string): string { return `/flags/${code}.svg`; }

/**
 * Does this market's text match what someone typed? Brief Part 42: "Vietnam", "베트남", "Tiếng Việt" and "VN"
 * must all find the same option, so every name the product knows for a market is searched, in every script, plus
 * the country code and the locale tag.
 *
 * `languageNames` is passed in rather than imported so this module stays free of the locale table (which imports
 * generated coverage data) and can be used by a build script.
 */
export function marketMatches(m: Market, query: string, languageNames: string[] = []): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [m.code, m.locale, m.nameEn, m.nameNative, m.nameKo, ...languageNames];
  return hay.some((s) => s.toLowerCase().includes(q));
}

/* -------------------------------------------------------------------- Two lists, deliberately different */

/**
 * The countries Hangyul has done **recruitment research** for: a visa playbook in
 * `docs/research/visa-playbooks.json`, a country simulation in `docs/qa/v13/country-simulations/`, and in
 * most cases a student persona in the seed data.
 *
 * This is **not** the same list as `MARKETS`, and it is not supposed to be. They answer different questions:
 *
 *   MARKETS            — which markets the product *presents itself to*. Defined by `apps/flags`, because
 *                        the owner supplies those assets and that is the decision they have made.
 *   RESEARCH_MARKETS   — which markets the product *knows how to serve*. Defined by what has actually been
 *                        researched and verified, which is engineering and operations work.
 *
 * A country can legitimately be in one and not the other. Presenting to a market you have not researched is
 * a go-to-market decision; researching a market you do not yet present to is groundwork. What is *not*
 * legitimate is for the difference to be invisible, which is what it was before V14 — so both lists are here,
 * `marketGap()` reports the difference, and `docs/qa/v14/LOCALE_MATRIX.md` carries the current answer.
 *
 * Neither list is edited to make the other look complete. A flag is never invented, and a locale is never
 * dropped because its recruitment research has not been done.
 */
export const RESEARCH_MARKETS: { code: string; locale: string; nameEn: string }[] = [
  { code: 'VN', locale: 'vi', nameEn: 'Vietnam' },
  { code: 'NP', locale: 'ne', nameEn: 'Nepal' },
  { code: 'UZ', locale: 'uz', nameEn: 'Uzbekistan' },
  { code: 'MN', locale: 'mn', nameEn: 'Mongolia' },
  { code: 'CN', locale: 'zh-Hans', nameEn: 'China' },
  { code: 'IN', locale: 'hi', nameEn: 'India' },
  { code: 'BD', locale: 'bn', nameEn: 'Bangladesh' },
  { code: 'PK', locale: 'ur', nameEn: 'Pakistan' },
  { code: 'ID', locale: 'id', nameEn: 'Indonesia' },
  { code: 'TH', locale: 'th', nameEn: 'Thailand' },
  { code: 'PH', locale: 'fil', nameEn: 'Philippines' },
  { code: 'MM', locale: 'my', nameEn: 'Myanmar' },
  { code: 'KZ', locale: 'kk', nameEn: 'Kazakhstan' },
  { code: 'KG', locale: 'ky', nameEn: 'Kyrgyzstan' },
];

export interface MarketGap {
  /** Researched, but no flag asset — so not presented as a market. The locale still ships. */
  researchedNotPresented: { code: string; locale: string; nameEn: string }[];
  /** Presented (a flag exists), but no recruitment research behind it yet. */
  presentedNotResearched: Market[];
  /** In both. */
  both: Market[];
}

/**
 * The difference between the two lists, as data rather than as a paragraph somebody has to remember to
 * update. `scripts/qa/v14-locales.mjs` prints it; REPORT §107 explains what the owner can do about it.
 */
export function marketGap(): MarketGap {
  const presented = new Set(MARKETS.map((m) => m.code));
  const researched = new Set(RESEARCH_MARKETS.map((m) => m.code));
  return {
    researchedNotPresented: RESEARCH_MARKETS.filter((m) => !presented.has(m.code)),
    presentedNotResearched: MARKETS.filter((m) => !researched.has(m.code)),
    both: MARKETS.filter((m) => researched.has(m.code)),
  };
}
