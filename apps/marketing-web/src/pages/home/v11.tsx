/**
 * The homepage — Koreanasha's composition and Koreanasha's own Korean words, rebuilt in V14 as **one
 * continuous editorial page** rather than six stacked rectangles (REPORT §§105, 110, 111).
 *
 * Every string rendered here comes from `docs/qa/v11/koreanasha-copy.json`, generated from the owner's template
 * and checked on every run by `scripts/qa/v11-copy-fidelity.mjs`. Nothing in this file writes marketing prose.
 *
 * What V14 changed, and why, section by section:
 *
 *   hero       the copy block moved from the bottom third to the top half, so the campus is visible rather
 *              than covered (Part 15); the photography credit caption is gone (Part 2).
 *   marquee    the band is a true white canvas that bridges in and out of the page surface (Part 5); the
 *              trademark disclaimer is gone (Part 4); **all 23 crests link to their university** (Part 8).
 *   value      three pale cards on white became a typographic triptych (Part 13).
 *   services   the phone carousel became three vertical stories (Part 14).
 *   all        the decorative eyebrow above each heading is gone (Part 12), and every section uses the one
 *              shared `Reveal` rather than its own animation (Parts 17–29).
 */
import { Band, Faq, Hero, MediaRow, Marquee, Reveal, SectionHead } from '@hangyul/koreanasha-ui';
import { ArrowRightIcon } from '@hangyul/koreanasha-ui';
import { useLocale } from '@hangyul/i18n';
import { formatNumber, marketingScale } from '@hangyul/utils';

import type { MouseEvent } from 'react';
import { marqueeRows, universityPath, type UniversityMarqueeItem } from '../../lib/marqueeUniversities';
import { Photo } from '../../components/Photo';
import { LocaleLink } from '../../components/LocaleLink';
import { copyLocale, koreanasha } from '../../lib/koreanasha-copy';
import { useStudentSession, prepareAction } from '../../lib/session';
import { useDirectoryRegions } from '../../lib/queries';

/* -------------------------------------------------------------------------------------------- 1. Hero */

/**
 * Koreanasha's full-viewport photograph with three hand-made crops, one per breakpoint. The copy is
 * `banner_title` / `banner_description`, verbatim. Two actions only: start a preparation, or browse.
 *
 * `focusSm` biases the phone crop upward: the copy is now in the upper half, so the buildings and the ridge
 * need to sit in the lower half rather than being cropped off the bottom by a centred `cover`.
 */
export function KoreaHero() {
  const { t, locale } = useLocale(['marketing', 'common']);
  const { authenticated } = useStudentSession();
  return (
    <Hero
      alt={t('v10.hero.alt')}
      width={2400}
      height={1100}
      focus="50% 52%"
      focusSm="50% 64%"
      sources={[
        {
          media: '(max-width: 575px)',
          srcSet: '/media/korea-campus-autumn-portrait-600.jpg 600w, /media/korea-campus-autumn-portrait-900.jpg 900w, /media/korea-campus-autumn-portrait-1200.jpg 1200w',
          webpSrcSet: '/media/korea-campus-autumn-portrait-600.webp 600w, /media/korea-campus-autumn-portrait-900.webp 900w, /media/korea-campus-autumn-portrait-1200.webp 1200w',
        },
        {
          media: '(max-width: 1199px)',
          srcSet: '/media/korea-campus-autumn-tablet-800.jpg 800w, /media/korea-campus-autumn-tablet-1600.jpg 1600w',
          webpSrcSet: '/media/korea-campus-autumn-tablet-800.webp 800w, /media/korea-campus-autumn-tablet-1600.webp 1600w',
        },
        {
          srcSet: '/media/korea-campus-autumn-640.jpg 640w, /media/korea-campus-autumn-1200.jpg 1200w, /media/korea-campus-autumn-1600.jpg 1600w, /media/korea-campus-autumn-2400.jpg 2400w',
          webpSrcSet: '/media/korea-campus-autumn-640.webp 640w, /media/korea-campus-autumn-1200.webp 1200w, /media/korea-campus-autumn-1600.webp 1600w, /media/korea-campus-autumn-2400.webp 2400w',
        },
      ]}
      title={koreanasha(t('v11.hero.title'))}
      lede={koreanasha(t('v11.hero.lede'))}
      actions={
        <>
          {/*
            V13, brief Part 1. Starting a preparation **is** the decision a visitor came to make, so it is the
            one primary action on this screen, in every state; the directory supports that decision and is
            styled as the lesser of the two.
          */}
          <a href={prepareAction(authenticated, locale)} className="kn-btn kn-btn--primary kn-btn--lg" data-cta="primary">
            {authenticated ? t('v10.account.continue') : t('v13.cta.prepare')}
            <ArrowRightIcon />
          </a>
          <LocaleLink to="/universities" className="kn-btn kn-btn--quiet-onphoto kn-btn--lg">{t('v11.hero.explore')}<ArrowRightIcon /></LocaleLink>
        </>
      }
    />
  );
}

/* --------------------------------------------------------------------------- 2. University crest marquee */

/**
 * Koreanasha's signature band: **three rows of university crests moving horizontally** — left, right, left,
 * which is what the original's own loop produces (`index % 2` decides direction). Rows run at slightly
 * different speeds and start at different phases, so the three are never aligned on one column.
 *
 * V14 (brief Parts 5–9):
 *
 *  - the band is a **white** canvas. The crests carry all the colour this section needs, and the V13 peach
 *    fill was competing with twenty-three sets of university colours. It bridges in and out of the page
 *    surface over `--kn-bridge`, so it is a clean white middle without being a rectangle (Part 5).
 *  - **every** crest is a link to that university's page. V13 linked 8 of 23 and left 15 as inert images,
 *    which is a logo wall that teaches a visitor their click does nothing. `universities.json` is generated
 *    by `scripts/media/build_marquee_manifest.py` against the national register, so the mapping is data and
 *    no destination is written in this file (Part 8).
 *  - the trademark line under the band is gone (Part 4). Removing it changes nothing legally — university
 *    mark permission is still unresolved and still tracked in `release:check` and REPORT — and a visitor
 *    does not need to read our legal position to look at a logo.
 *
 * Under `prefers-reduced-motion` the shared marquee CSS drops the animation and wraps each row into a centred
 * static grid, which is the clean multi-row logo grid the brief asks for.
 */
export function UniversityCrests() {
  const { t, locale } = useLocale('marketing');
  /**
   * The count describes the **directory**, not the application catalogue: how many Korean universities there
   * are to go to, which is what Koreanasha's own sentence says. `UNIVERSITY` only, because the sentence says
   * 대학교 and junior colleges are not what that word means. Rounded down to one significant figure by
   * `marketingScale` (218 → 200), so the "+" stays honest whichever way the register moves.
   */
  const q = useDirectoryRegions();
  const exact = q.data?.regions.reduce((n, r) => n + (r.by_type.UNIVERSITY ?? 0), 0) ?? 0;
  const total = marketingScale(exact);
  const rows = marqueeRows();

  /**
   * One university → one link, at every rendered copy (V30). The anchor *is* the slot: the row gap is its
   * inline padding (home.css), so the whole slot — not just the opaque crest pixels — opens the page.
   * A `repeat` copy is the same link for a pointer, taken out of the tab order and the accessibility tree
   * so a keyboard or screen-reader user meets each university once (see `Marquee`).
   */
  const logo = (u: UniversityMarqueeItem, { repeat }: { repeat: boolean }) => {
    const name = locale === 'ko' ? u.nameKo : u.nameEn;
    // `--c-scale` is the optical correction from the manifest: the drawn box is identical for every crest and
    // the artwork inside it is nudged toward the set's median ink mass, so a wide wordmark does not out-weigh
    // a compact seal at the same height. Clamped to 0.88–1.10 — no official proportion is altered.
    //
    // Not `loading="lazy"`: the track is wider than the viewport and moves, so a lazy crest only starts
    // loading as it slides into view and pops in mid-loop, leaving a hole in the row.
    return (
      <LocaleLink
        to={universityPath(u)}
        className={`kn-crest${u.crest.tile ? ' kn-crest--tile' : ''}`}
        aria-label={t('v30.unis.open', { name })}
        data-university={u.slug}
        {...(repeat ? {
          tabIndex: -1, 'aria-hidden': true,
          // A mouse press would otherwise focus a link inside an aria-hidden copy for the instant before the
          // route changes. The click itself still fires and navigates; middle-click still opens a tab.
          onMouseDown: (e: MouseEvent) => e.preventDefault(),
        } : {})}
      >
        <img
          className="kn-crest__img" src={`/media/universities/${u.crest.file}`} alt=""
          width={u.crest.width} height={u.crest.height} style={{ ['--c-scale' as string]: u.crest.scale }}
          fetchPriority="low" decoding="async" draggable={false}
        />
      </LocaleLink>
    );
  };
  const rowProps = { render: logo, itemKey: (u: UniversityMarqueeItem) => u.slug, minItems: 18 };

  return (
    <Band afterHero canvas labelledBy={total !== null ? 'unis-title' : undefined}>
      {/* Held back until the directory answers, rather than shown as "0 Korean universities" — a sentence that
          is both wrong and discouraging. The crests below do not depend on it. */}
      {total !== null && (
        <SectionHead
          reveal id="unis-title" title={koreanasha(t('v11.unis.title', { count: formatNumber(total, copyLocale(locale)) }))}
          // V25 (REPORT §311 M2): the directory link belongs to this section, so it sits under the section's own heading —
          // visible the moment the section is, and the logos below it are what it opens. It is the SECONDARY role (a filled
          // warm-neutral surface), so 유학 준비 stays the one tangerine action on the page.
          action={(
            <LocaleLink to="/universities" className="kn-btn kn-btn--secondary kn-btn--browse" data-cta="secondary">
              {t('v11.unis.all')}
              <ArrowRightIcon />
            </LocaleLink>
          )}
        />
      )}
      {/* The three rows fade in as **one group**, and nothing happens to a crest individually: the belt is
          already this section's movement, and an entrance on each logo on top of a slide is two effects
          fighting. `fade` and not `rise` for the same reason — the rows are mid-travel, so lifting them as
          well would read as a wobble. */}
      <Reveal variant="fade" className="kn-crests">
        {/* V17: each loop is ~15 % longer than V14's (46/54/50 → 53/62/58 s), which is the brief's 10–20 %
            band. The three durations stay *different* — that is what stops the rows locking into a single
            scrolling wall — and the ratios between them are unchanged, so the composition is the same belt
            moving more calmly rather than a new one. Slower than this and the row stops reading as motion
            at all, which is the failure the brief names on the other side. */}
        <Marquee label={t('v11.unis.rowLabel', { n: 1 })} items={rows[0]} {...rowProps} seconds={53} offset={0} />
        <Marquee label={t('v11.unis.rowLabel', { n: 2 })} items={rows[1]} {...rowProps} seconds={62} offset={0.33} reverse />
        <Marquee label={t('v11.unis.rowLabel', { n: 3 })} items={rows[2]} {...rowProps} seconds={58} offset={0.66} />
      </Reveal>
    </Band>
  );
}

/* ---------------------------------------------------------------------------------------------- 3. Why */

/**
 * Koreanasha's three `why_*` propositions as an **editorial triptych** (V14, brief Part 13).
 *
 * V13 rendered them through the shared `.kn-card` grid: three white rounded boxes with a hairline, on white.
 * On a white background a white card has no edge, so the section had almost no visual presence — the owner's
 * words were on the page and nothing about the page said they mattered.
 *
 * Two compositions were built and compared at 390 / 768 / 1440 (docs/qa/v14/VALUE_SECTION.md): (A) three
 * tonal panels, (B) three columns divided by fine vertical rules. B ships. A is three filled rectangles inside
 * a section, which is the thing Part 16 spends a page removing from this page, and on the new warm page
 * surface the panels had to be either too faint to see or dark enough to become boxes again. B has no fill at
 * all: a hairline, an oversized ordinal, a 28 px title and a 17 px measure do the work, which is what the
 * brief means by letting typography and space establish hierarchy.
 *
 * On phones the columns stack with horizontal rules between them — no swipe, no peeking next card, no clipped
 * text, which is the same rule the service section now follows.
 */
/**
 * V29 (REPORT §378.10): s1 promised "시작부터 성공까지 … 모든 과정을 책임집니다" and s3 "최고의 결과 … 성공적인 유학생활을
 * 보장합니다" — outcomes Hangyul does not control and, for s1, more than a Basic plan includes. Both were rewritten under
 * new keys (so no locale can keep showing the old promise); s2 is a preference claim and keeps its V11 text.
 */
const whyKey = (k: 's1' | 's2' | 's3') => (k === 's2' ? `v11.why.${k}` : `v29.why.${k}`);

export function WhyKorea() {
  const { t, locale } = useLocale('marketing');
  const cards = ['s1', 's2', 's3'] as const;
  /**
   * The ordinal is written in the digits of the sentence it sits above — the same rule `copyLocale` applies
   * to the university count. An Arabic page whose copy reads ١٠٠٪ and whose markers read 01 · 02 · 03 is
   * mixing two numbering systems in one section for no reason.
   */
  const ordinal = (n: number) => formatNumber(n, copyLocale(locale), { minimumIntegerDigits: 2 });
  return (
    <Band id="why" labelledBy="why-title">
      <SectionHead reveal id="why-title" title={koreanasha(t('v11.why.title'))} />
      {/* A restrained stagger: 80 ms apart, the whole group settled inside ~400 ms, so all three are readable
          almost at once and the eye still reads an order (brief Part 23). */}
      <Reveal variant="stagger" className="kn-tri">
        {cards.map((k, i) => (
          <article key={k} className="kn-tri__col">
            {/* Decorative: the ordinal is a visual marker for the eye, and a screen reader announcing
                "zero one" before every heading would be noise. */}
            <span className="kn-tri__n" aria-hidden>{ordinal(i + 1)}</span>
            <h3 className="kn-tri__title">{koreanasha(t(`${whyKey(k)}.title`))}</h3>
            <p className="kn-tri__text">{koreanasha(t(`${whyKey(k)}.text`))}</p>
          </article>
        ))}
      </Reveal>
    </Band>
  );
}

/* ----------------------------------------------------------------------------------------- 4. Services */

/**
 * Koreanasha's alternating photo/text rows with its own three service descriptions, verbatim.
 *
 * Desktop keeps the editorial alternation. Phones get three vertical stories — image, title, body, next — and
 * no horizontal track at all (brief Part 14); the CSS for that is `.kn-rows` in the shared stylesheet, and the
 * focusable scroller wrapper that the old carousel needed for `scrollable-region-focusable` is gone with it.
 *
 * Motion is image-first (Part 22): each row's photograph wipes up under a `media` reveal and the words follow
 * one stagger step behind, in the same direction for every row, so an alternating layout does not become
 * elements flying in from opposite sides.
 */
export function Services() {
  const { t } = useLocale('marketing');
  /**
   * One **owner-supplied** photograph per Koreanasha service row — the three Koreanasha uses for this exact
   * section on its own site (`template-koreanasha/assets/img/p1_c`, `s2_c`, `s3_c`). All three are
   * `HANGYUL_OWNED`, so nothing here carries a visible credit; see docs/MEDIA_LICENSE_AUDIT.md.
   *
   * Why a licensed set was not good enough for rows 2 and 3. The CC0 set they replace — the Songpa skyline
   * and the Namsan roofline — was accurate and completely impersonal: pictures of empty places. These are
   * pictures of the *journey*: the aircraft that takes a student to Korea, and the life they arrive into.
   *
   * Row 1 is the exception and is CC0 again, because the academic image is the one that has to carry
   * institutional weight rather than warmth. The owner asset that held this slot put a single named student
   * at the centre of the frame, which read as a testimonial, not as a university. Kyung Hee's colonnaded main
   * building is the opposite: no people, a symmetric classical facade, and the one picture in the set that
   * looks like a decision about where to study. Ewha was the alternative the brief named and is not
   * available — Commons holds no attribution-free photograph of that campus, and
   * `scripts/qa/v14-media-licence.mjs` will not let a CC BY one ship without the credit the brief forbids.
   *
   * Still three deliberately different scales, so the column reads as a sequence and not as a stock set:
   * architecture head-on, a graphic close-up, then people at human range — cold stone, airline teal, warm
   * courtyard and silk.
   *
   * Each row carries a **hand-made 3:2 master crop** (recorded per slug in credits.json) *and* its own
   * `pos`; one `object-position` cannot serve three compositions, and the two display ratios crop on
   * different axes — 16:10 desktop takes the top and bottom, 4:3 phone takes the sides — so the vertical
   * number is the desktop decision and the horizontal number is the phone decision:
   *
   *   s1  `50% 50%`  centred on both axes, because the decision was made in the master crop rather than here:
   *                  120 px of empty sky comes off the top of the original so the colonnade, not the weather,
   *                  is the subject. The facade is symmetric and already fills the width, so there is nothing
   *                  left to favour — 50 % keeps it centred when the phone crop takes the sides, and the
   *                  pediments stay clear of the top edge when the desktop row takes the height.
   *   s2  `50% 50%`  centred on both axes. The apron scene is already framed on the forward fuselage, and the
   *                  3:2 master gives the 4:3 phone crop enough slack to keep the nose, the titles and the
   *                  engine together — the aircraft's identity survives the narrowest crop we serve.
   *   s3  `42% 50%`  the three walkers sit left of centre, so the phone crop is pulled left to hold all three
   *                  rather than clipping the one in blue; 50 % vertical keeps the painted eaves above them
   *                  and their hems below.
   */
  const rows = [
    { k: 's1', slug: 'kyunghee-main-building', pos: '50% 50%' },
    { k: 's2', slug: 'korean-air-apron', pos: '50% 50%' },
    { k: 's3', slug: 'korea-palace-hanbok', pos: '42% 50%' },
  ] as const;
  return (
    <Band id="services" labelledBy="services-title">
      <SectionHead
        reveal
        id="services-title"
        title={koreanasha(t('v11.services.title'))}
        lede={koreanasha(t('v11.services.lede'))}
      />
      <div className="kn-rows">
        {rows.map((r, i) => (
          <MediaRow
            key={r.k}
            flip={i % 2 === 1}
            media={
              <Reveal variant="media">
                <Photo slug={r.slug} alt={t(`v11.services.${r.k}.alt`)} position={r.pos} sizes="(min-width: 992px) 46vw, 100vw" />
              </Reveal>
            }
            title={koreanasha(t(`v11.services.${r.k}.title`))}
            textReveal
          >
            {koreanasha(t(`v11.services.${r.k}.text`))}
          </MediaRow>
        ))}
      </div>
    </Band>
  );
}

/* ---------------------------------------------------------------------------------------------- 5. FAQ */

/** Koreanasha's own ten questions and ten answers, verbatim, as native `<details>` (no JS, keyboard-correct). */
export function Questions() {
  const { t } = useLocale('marketing');
  const items = Array.from({ length: 10 }, (_, i) => ({
    q: t(`v11.faq.q${i + 1}.q`),
    a: koreanasha(t(`v11.faq.q${i + 1}.a`)),
  }));
  return (
    <Band id="faq" labelledBy="faq-title">
      <SectionHead reveal id="faq-title" title={t('v11.faq.title')} />
      <div className="kn-container--narrow" style={{ marginInline: 'auto', paddingInline: 0 }}>
        <Reveal variant="rise"><Faq items={items} /></Reveal>
      </div>
    </Band>
  );
}
