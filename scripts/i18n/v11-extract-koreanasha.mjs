/**
 * V11 — extract the canonical Korean marketing copy from the owner-supplied Koreanasha template.
 *
 * Source of truth: `template-koreanasha/assets/js/lang.js`, the i18next resource bundle the template renders
 * through `innerHTML`. The page's own HTML carries empty elements with ids (`id="banner_title"`), so the
 * rendered Korean text exists ONLY in this file — it is the authoritative string set (brief Part 19).
 *
 * Output: `docs/qa/v11/koreanasha-copy.json` — for every string Hangyul reuses:
 *   sourceKey      the Koreanasha i18next key
 *   sourceText     the string exactly as the template ships it
 *   hangyulKey     where it lands in `packages/i18n/locales/ko/marketing.json`
 *   substitution   none | brand | count | identity   (the only edits the brief permits)
 *   expectedText   sourceText after the approved substitution — what the validator compares against
 * Strings the brief does not allow us to reuse are listed with `excluded` and a reason, so the decision is
 * auditable rather than silent.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(resolve(root, 'template-koreanasha/assets/js/lang.js'), 'utf8');

/**
 * A locale's `translation` object literal, read as source text (the file is a DOMContentLoaded handler, not
 * JSON). The template ships **two** owner-written locales, ko and ru, and both are canonical: Koreanasha's
 * audience is Russian-speaking, so its Russian is the company's own words, not a translation of its Korean.
 */
function block(locale) {
  const start = src.indexOf(`${locale}: {`);
  if (start < 0) throw new Error(`lang.js: no ${locale} resource block`);
  const next = locale === 'ko' ? src.indexOf('ru: {', start) : src.length;
  return src.slice(start, next);
}

/** `key: "value"` pairs, honouring \" escapes. Values keep their literal <br>, <span>, <h2> markup. */
function parse(block) {
  const out = new Map();
  const re = /^\s*([a-z0-9_]+)\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/gim;
  let m;
  while ((m = re.exec(block))) out.set(m[1], JSON.parse(`"${m[2]}"`));
  return out;
}

const BUNDLES = { ko: parse(block('ko')), ru: parse(block('ru')) };
for (const [loc, map] of Object.entries(BUNDLES)) {
  if (map.size < 200) throw new Error(`lang.js: expected the full ${loc} bundle, parsed only ${map.size} keys`);
}
const ko = BUNDLES.ko;

/**
 * Brand substitution — the one rewrite the owner authorises (brief: "Koreanasha company name → Hangyul Univ").
 *
 * In Korean the subject/topic particle agrees with the final sound of the noun it attaches to. "Koreanasha" ends
 * in a vowel and so takes 는 / 가 / 와; 한귤 ends in the consonant ㄹ and must take 은 / 이 / 과. Carrying the old
 * particle across would produce "한귤는", which is simply ungrammatical. Swapping it is therefore part of
 * replacing the name, not an edit to the sentence: the words around it are untouched.
 */
const BRAND_KO = '한귤';                  // the Korean brand mark (never 한결); product name is 한귤 유니브
const PARTICLE = { '는': '은', '가': '이', '와': '과' };
/** Russian writes the brand in Latin, as `locales/ru/common.json` already does; no particle question arises. */
const BRAND_RU = 'Hangyul';
const brand = (s, locale) => (locale === 'ko'
  ? s.replace(/Koreanasha([는가와])/g, (_, p) => BRAND_KO + PARTICLE[p])
     .replace(/Koreanasha/g, BRAND_KO)
     .replace(/코리아나샤([는가와])/g, (_, p) => BRAND_KO + PARTICLE[p])
     .replace(/코리아나샤/g, BRAND_KO)
  : s.replace(/Koreanasha/g, BRAND_RU).replace(/Корианаша/g, BRAND_RU));

/**
 * Reused strings. `sub` records WHY the expected text differs from source, and nothing else may differ.
 *   brand    — company name only
 *   count    — a figure that would be false for Hangyul; bound to the live catalogue instead (see §74)
 *   none     — byte-identical
 */
const REUSE = [
  // ---- header (anchors; Koreanasha's 상담 신청 CTA is replaced by login per brief Part 7, so it is excluded)
  ['header_menu_koreanasha_services', 'v11.nav.services', 'none'],
  ['header_menu_faq', 'v11.nav.faq', 'none'],
  // ---- 1. hero
  ['banner_title', 'v11.hero.title', 'none'],
  ['banner_description', 'v11.hero.lede', 'none'],
  // ---- 2. university crest marquee
  ['korean_universities_title', 'v11.unis.title', 'count'],
  // ---- 3. why
  ['why_koreanasha_title', 'v11.why.title', 'brand'],
  ['why_koreanasha_section1_title', 'v11.why.s1.title', 'none'],
  ['why_koreanasha_section1_description', 'v11.why.s1.text', 'brand'],
  ['why_koreanasha_section2_title', 'v11.why.s2.title', 'none'],
  ['why_koreanasha_section2_description', 'v11.why.s2.text', 'brand'],
  ['why_koreanasha_section3_title', 'v11.why.s3.title', 'none'],
  ['why_koreanasha_section3_description', 'v11.why.s3.text', 'brand'],
  // ---- 4. services  (koreanasha_services_subtitle is excluded in V14 — see EXCLUDED)
  ['koreanasha_services_title', 'v11.services.title', 'brand'],
  ['koreanasha_services_description', 'v11.services.lede', 'brand'],
  ['koreanasha_services_section1_title', 'v11.services.s1.title', 'none'],
  ['koreanasha_services_section1_description', 'v11.services.s1.text', 'none'],
  ['koreanasha_services_section2_title', 'v11.services.s2.title', 'none'],
  ['koreanasha_services_section2_description', 'v11.services.s2.text', 'none'],
  ['koreanasha_services_section3_title', 'v11.services.s3.title', 'none'],
  // 'brand', not 'none': the Korean text names no company here but the Russian one does. The class is a
  // property of the *string set*, so it has to cover whichever locale mentions the name.
  ['koreanasha_services_section3_description', 'v11.services.s3.text', 'brand'],
  // ---- 5. FAQ (Koreanasha's own ten questions and answers, verbatim; faq_subtitle excluded in V14)
  ['faq_title', 'v11.faq.title', 'none'],
  ...Array.from({ length: 10 }, (_, i) => [`faq_q${i + 1}`, `v11.faq.q${i + 1}.q`, 'none']),
  ...Array.from({ length: 10 }, (_, i) => [`faq_a${i + 1}`, `v11.faq.q${i + 1}.a`, 'none']),
];

/** Strings deliberately NOT reused. Each reason is a rule the brief itself states. */
const EXCLUDED = [
  ['about_us_section1_subtitle|about_us_section1_title|about_us_section1_description',
    'Names a real Koreanasha employee (김예찬) and his 800k-follower credential. Presenting it as Hangyul staff would be a false statement about who works here — brief Part 2 ("must NOT imply … unless Hangyul actually has them").'],
  ['about_us_section2_*|about_us_section3_*',
    'Named Koreanasha consultants (체보타레바 알리나, 사이라노바 알렉산드라) with their own degrees. Same rule.'],
  ['reviews_*',
    'Four signed student testimonials praising named Koreanasha consultants. Re-attributing them to Hangyul would be fabricated social proof.'],
  ['pricing_plans_*',
    "Koreanasha's own prices, plan tiers and service SLAs ($40 add-ons, 3-hour reply guarantee, 주 7일 멘토). These are another company's commercial commitments; Hangyul's plans are its own. No pricing section exists on the V11 home (brief Part 6)."],
  ['modal_*|prevStep|nextStep|submit|swal_*',
    'The 상담 신청 consultation form. Brief Part 7 forbids any public application form; conversion goes through login.'],
  ['footer_description',
    "Koreanasha's legal identity — 대표 김예찬, koreanasha333@gmail.com, 사업자등록번호 139-74-00672. Replaced by Hangyul's own legal identity (allowed substitution: identity)."],
  ['header_btn|banner_btn|banner_btn_only_mobile|pricing_plans_plan*_btn',
    '상담 신청 ("request a consultation") is a form CTA. Replaced by 로그인 / 내 유학 준비 (brief Part 7).'],
  ['header_menu_about_us|header_menu_pricing_plans|header_menu_reviews',
    'Nav items for the three sections above, which V11 does not ship.'],
  ['koreanasha_services_subtitle|faq_subtitle',
    'V14, brief Part 12: the decorative eyebrow above a section heading ("서비스 소개", "FAQ") is removed from every section. The owner asked for the layer to go, not for a different label, and a section that already has an <h2> does not need a smaller duplicate of it above. Hierarchy is carried by type and space instead. Dropped from the reuse set rather than left unrendered, so the dead key could be deleted from all 55 locale bundles (brief Part 47).'],
];

for (const [loc, map] of Object.entries(BUNDLES)) {
  const missing = REUSE.filter(([k]) => !map.has(k)).map(([k]) => k);
  if (missing.length) throw new Error(`lang.js: reused keys absent from the ${loc} bundle: ${missing.join(', ')}`);
}

/**
 * The count phrasing differs per locale; **only the figure itself is replaced**, which is what the `count`
 * substitution promises ("surrounding sentence unchanged").
 *
 * V14 fix: these two pairs still encoded V12's wording, which rewrote the sentence around the number as well
 * ("50+개 이상의" → "{{count}}곳의", "Более 50" → "{{count}}"). V13 corrected the shipped strings back to the
 * Koreanasha shape and did not update this table, so the manifest on disk disagreed with the bundles it was
 * supposed to be protecting — and because the manifest is generated, the disagreement only became visible the
 * next time someone regenerated it. The shipped strings were right; this table was wrong.
 */
const COUNT_PHRASE = { ko: ['50+', '{{count}}+'], ru: ['Более 50', 'Более {{count}}'] };

function expected(locale, sourceKey, substitution) {
  const sourceText = BUNDLES[locale].get(sourceKey);
  if (substitution === 'none') return sourceText;
  const branded = brand(sourceText, locale);
  if (substitution !== 'count') return branded;
  // Koreanasha claims "50+" / "Более 50" universities. Hangyul's catalogue is smaller, so the figure becomes a
  // binding to the live count; the sentence around it is untouched. See §74 for why this is not a rewrite.
  const [from, to] = COUNT_PHRASE[locale];
  if (!branded.includes(from)) throw new Error(`${locale}/${sourceKey}: count phrase ${JSON.stringify(from)} not found`);
  return branded.replace(from, to);
}

const strings = REUSE.map(([sourceKey, hangyulKey, substitution]) => ({
  sourceKey,
  hangyulKey,
  substitution,
  source: Object.fromEntries(Object.keys(BUNDLES).map((loc) => [loc, BUNDLES[loc].get(sourceKey)])),
  expected: Object.fromEntries(Object.keys(BUNDLES).map((loc) => [loc, expected(loc, sourceKey, substitution)])),
}));

const manifest = {
  $comment: 'Canonical Korean marketing copy. Generated by scripts/i18n/v11-extract-koreanasha.mjs — do not hand-edit.',
  generatedAt: new Date().toISOString().slice(0, 10),
  source: {
    file: 'template-koreanasha/assets/js/lang.js',
    locales: Object.keys(BUNDLES),
    keysInBundle: Object.fromEntries(Object.entries(BUNDLES).map(([l, m]) => [l, m.size])),
    note: 'Owner-supplied template. Verified in REPORT §65.1 to be the same build as the deployed reference https://univ.talkhangyul.com/, so there is no local-vs-live divergence to reconcile.',
  },
  substitutions: {
    none: 'byte-identical to the Koreanasha source',
    brand: 'company name only: Koreanasha → 한귤, with the Korean particle corrected to agree with it (는→은, 가→이, 와→과)',
    count: 'a figure that would be untrue for Hangyul, bound to live catalogue data; surrounding sentence unchanged',
    identity: 'legal identity block replaced by Hangyul Univ’s own',
  },
  strings,
  excluded: EXCLUDED.map(([keys, reason]) => ({ keys, reason })),
};

mkdirSync(resolve(root, 'docs/qa/v11'), { recursive: true });
writeFileSync(resolve(root, 'docs/qa/v11/koreanasha-copy.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`koreanasha-copy.json — ${strings.length} canonical strings x ${Object.keys(BUNDLES).length} owner locales (${Object.entries(BUNDLES).map(([l, m]) => `${l}:${m.size}`).join(', ')}), ${EXCLUDED.length} excluded groups`);
