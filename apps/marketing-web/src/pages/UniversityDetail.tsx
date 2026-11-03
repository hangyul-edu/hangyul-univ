/**
 * A university, introduced (V20 — rebuilt; brief §10–§15, §23–§28, §50–§53).
 *
 * **What was wrong with the page this replaces.** For 424 of 425 institutions it was a breadcrumb, a
 * name, three grey words, a four-row registry table and a list of source links, occupying the left 56 %
 * of the viewport with nothing in the other 44 %. The brief's test — *remove the Hangyul logo, would
 * this page still obviously belong to THIS university?* — failed everywhere, and the most prominent
 * fact about 경성대학교 was `공시 학과 수 — 80개` (REPORT §211.2).
 *
 * **What this is instead.** One editorial composition that opens with the institution and closes with an
 * action, in the order a person actually decides in: what is this place → why here → what does it look
 * like → what does it stand for → what is in place for me → what is the city → the film → the record →
 * where to check → start. The registry table is still on the page; it is now ninth rather than first,
 * which is where a reader who has decided they are interested will use it (§11).
 *
 * **Three rules it does not bend.**
 *
 *   *Nothing renders without a source.* Every block returns `null` when the content record has nothing
 *   verified for it, so two universities' pages are different lengths. That is honest, and it is why
 *   there is no grid of half-empty cards.
 *
 *   *Nothing is a card.* §13 is explicit that the content sequence must not become eleven rounded boxes.
 *   The page is built from full-bleed media, two-column stories, hairlines and whitespace; the only
 *   `border-radius` on it is on photographs and the video poster.
 *
 *   *Nothing is invented.* The identity sentence and the "why here" points are **composed from registry
 *   facts**, not written about the institution: a national university is described as state-run because
 *   the register says `NATIONAL`, and a university with 80 disclosed majors is described as having 80.
 *   There is no 명문, no 최고, no 세계적인 (§24), and the only prose Hangyul writes about a specific
 *   institution is the education-philosophy reading, which exists for the eight whose own statement a
 *   person has read (§25).
 */
import { ArrowUpRight, Sparkles } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import { FIT_TIERS, fitGpa, normaliseGpa, readFitAnswers, type InstitutionDetail, type StudyLevel } from '@hangyul/types';
import { useQuery } from '@tanstack/react-query';
import {
  ErrorState, PhotoCredit, Skeleton, UniversityHero, UniversityOfficialLinks, UniversityPhilosophy,
  UniversityHousing, UniversityInternational, UniversityPhoto, UniversityScholarships, UniversityVideo,
} from '@hangyul/ui';
import { formatDate, galleryFor, resolveUniversityVisual } from '@hangyul/utils';
import { useParams, useSearchParams } from 'react-router';

import { useNoClosingCta } from '../components/blocks';
import { LocaleLink } from '../components/LocaleLink';
import { publicData } from '../lib/publicData';
import { useInstitution } from '../lib/queries';
import { studentAction, useStudentSession } from '../lib/session';
import { useSeo } from '../lib/useSeo';
import '../styles/directory.css';
import '../styles/university.css';

/** A section heading with its eyebrow. Used by the blocks this page composes itself. */
function Head({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <>
      <p className="hg-uni-sec__eyebrow">{eyebrow}</p>
      <h2 className="hg-uni-sec__h" id={id}>{title}</h2>
    </>
  );
}

/**
 * How the register says this institution was established — and it has **four** answers, not three.
 *
 * `establishment` collapses to NATIONAL / PUBLIC / PRIVATE, which is right for 375 of 425 rows and
 * actively wrong for twelve: 특별법법인 (KAIST, UNIST, KENTECH and four others) and 특별법국립 /
 * 국립대법인 are institutions created by their own statute, publicly funded, and neither 국립 nor
 * 사립. Printing "a private university in Daejeon" over a photograph of KAIST is a factual error the
 * page makes in its own voice, so the finer value from `establishment_source` wins wherever the
 * register carries one.
 */
function establishmentLabel(
  t: (k: string, o?: Record<string, unknown>) => string,
  inst: InstitutionDetail,
  style: 'noun' | 'adjective',
): string {
  const source = inst.establishment_source;
  const key = source && ['특별법법인', '특별법국립', '국립대법인'].includes(source) ? 'STATUTORY' : inst.establishment;
  // In the *sentence* a statutory institution takes no adjective at all — "a statutory university in
  // Daejeon" is not English anyone writes. The fact is still on the page, in the line above it, where
  // it can be a noun phrase ("Established by statute") rather than a modifier.
  const base = style === 'adjective' ? `v20.uni.say.estab.${key}` : `v20.uni.estab.${key}`;
  if (style === 'adjective' && key === 'STATUTORY') return '';
  return t(base, { defaultValue: t(`v12.establishment.${inst.establishment}`) });
}

/*
 * **The composed identity sentence is deleted** (V21, brief §11).
 *
 * V20 printed "A private university in Cheongju, opened in 1998 and now teaching across 3 majors."
 * under every name. Every clause was a sourced registry field and the whole thing still read as a
 * database row said aloud, in the same order, on all 425 pages — and "3개 학과를 두고 있습니다" is not
 * a reason to study anywhere. The facts have not gone anywhere: they are in 공식 기록 further down,
 * in a table, where a reader who wants them will look. What the hero says now is the name, the place
 * and the kind of institution, which is all that is both true and worth the first line.
 */

/**
 * 왜 이 대학인가 — three points, or none.
 *
 * §12 asks for "three or four genuine identity points, not cards for everything", and §2 of the hostile
 * audit asks whether the page says anything that is true of *this* institution and not of the other 424.
 * So each candidate is a fact the register or the institution's own site actually carries, they are
 * offered in order of how much they change a decision, and the list stops at three. An institution with
 * fewer than two gets no section at all rather than a thin one.
 */
function whyPoints(
  t: (k: string, o?: Record<string, unknown>) => string,
  inst: InstitutionDetail,
  verifiedScholarships = 0,
): { id: string; k: string; v: string }[] {
  const e = inst.enrichment;
  const out: { id: string; k: string; v: string }[] = [];
  const add = (key: string, vars?: Record<string, unknown>, ns = 'v20') =>
    out.push({ id: key, k: t(`${ns}.uni.why.${key}`, vars), v: t(`${ns}.uni.why.${key}Body`, vars) });

  // V28 (UX_AUDIT MK-3): distinctive, verified reasons first; generic registry facts ("a national university", "a link to an
  // international office exists") are no longer reasons. Visa consequence still leads.
  if (inst.ieqas?.excellent) add('ieqasExcellent');
  else if (inst.ieqas?.certified) add('ieqas');
  if (e?.gks?.programmes?.length) add('gks', undefined, 'v28');
  if (e?.intl?.english_taught_degrees?.value === true) add('english', undefined, 'v28');
  if (verifiedScholarships > 0) add('scholarships', { count: verifiedScholarships }, 'v28');
  if (inst.ieqas?.language_programme || e?.intl?.korean_language_program?.value === true) add('language');
  if (inst.other_campuses?.length) add('campuses', { list: inst.other_campuses.map((c) => c.name_ko).join(' · ') });
  if (e?.founded_year && e.founded_year <= 1960) add('founded', { year: e.founded_year });
  if (inst.major_count && inst.major_count >= 40) add('breadth', { count: inst.major_count, year: inst.sources?.registry?.survey_year ?? '' });
  return out.slice(0, 3);
}

const CAMPUS_ROLE: Record<string, string> = { 분교: 'branch', 제2캠퍼스: 'second', 제3캠퍼스: 'third', 제4캠퍼스: 'fourth' };

export default function UniversityDetail() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  // `?from=recommendation` is set by the free quick check's result rows (brief §29), so the page keeps
  // the thread rather than starting cold.
  const from = sp.get('from');
  const { t, locale } = useLocale(['marketing', 'common']);
  const { authenticated } = useStudentSession();
  const q = useInstitution(slug);
  const inst = q.data;
  // V27: the visitor's quick-fit answers (if they came from /start) shape the scholarship summary — server-side,
  // by the same rule as the quick fit. Without answers the page shows the strongest scheme and a link to check.
  const fit = readFitAnswers(sp);
  const fitLevel = (fit.level || null) as StudyLevel | null;
  const gpa = fitGpa(fit);
  const adm = useQuery({
    queryKey: ['inst-admissions', slug, fitLevel, sp.get('langs'), gpa?.value, gpa?.scale_max],
    queryFn: () => publicData.admissions(slug!, {
      ...(fitLevel ? { level: fitLevel } : {}),
      ...(fit.languages.length ? { langs: fit.languages.map((l) => `${l.test}:${l.score}`).join(',') } : {}),
      ...(gpa ? { gpa_pct: normaliseGpa(gpa.value, gpa.scale_max) ?? undefined } : {}),
    }),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  const korean = locale === 'ko';
  const primary = inst ? (korean || !inst.name_en ? inst.name_ko : inst.name_en) : '';
  const secondary = inst ? (korean ? inst.name_en : inst.name_ko) : null;

  useSeo({
    title: inst ? t('v12.seo.university.title', { name: primary }) : t('v12.seo.directory.title'),
    description: inst
      ? t('v12.seo.university.description', {
          name: primary,
          region: t(`common:region.${inst.region}`, { defaultValue: inst.region }),
        })
      : t('v12.seo.directory.description'),
  });

  // V24 (§292): the page ends on its own "이 대학 유학 준비하기"; the site's closing band right under it was a
  // second call-to-action band in a row.
  useNoClosingCta();

  if (q.isLoading) {
    return (
      <div className="kn-container mk-uni mk-uni--loading" aria-busy="true">
        <Skeleton w="40%" h={18} />
        <Skeleton w="70%" h={44} />
        <Skeleton w="100%" h={180} />
      </div>
    );
  }
  if (q.isError || !inst) {
    return (
      <div className="kn-container mk-uni">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
        <p><LocaleLink to="/universities">{t('v12.uni.back')}</LocaleLink></p>
      </div>
    );
  }

  const content = inst.enrichment ?? null;
  const prepareHref = studentAction(`/universities/${inst.slug}`, authenticated, locale);
  const regionLabel = t(`common:region.${inst.region}`, { defaultValue: inst.region });

  // A "gallery" of one photograph that the hero is already showing is the same picture twice on one
  // page, which reads as a bug. The section waits until there is something the hero did not show.
  const allShots = galleryFor(content);
  const heroAsset = content?.media?.hero?.asset;
  /*
   * The hero is **never** also the gallery's first picture.
   *
   * This used to keep the hero in whenever there were two or more shots, on the reasoning that two
   * pictures make a gallery worth having. What it actually produced was the same photograph twice on
   * one page — Seoul National's main gate full-bleed at the top and again under "Around the campus" —
   * for all 44 institutions that have a hero. One photograph shown twice is padding, and padding is
   * what this pass is removing. If nothing is left after the hero, there is no gallery.
   */
  // V24 (§292): at most five, each count with its own composition (`hg-uni-gal--nN`) so none leaves an orphan.
  const gallery = allShots.filter((m) => m.asset !== heroAsset).slice(0, 5);
  const visual = resolveUniversityVisual(inst.slug, inst.region, content);
  const why = whyPoints(t, inst, adm.data?.scholarships.length ?? 0);
  const ieqas = inst.ieqas;
  // V24 (§292): a fact is said once. What "why here" already states, the later sections leave out.
  const said = new Set(why.length >= 2 ? why.map((p) => p.id) : []);
  const showMajors = !!inst.major_count && !said.has('breadth');
  const showCampuses = inst.other_campuses.length > 0 && !said.has('campuses');
  const showIeqas = !!ieqas?.certified && !said.has('ieqas') && !said.has('ieqasExcellent');
  const showLanguage = !!ieqas?.language_programme && !said.has('language');
  const checked = inst.last_verified
    ? formatDate(inst.last_verified, locale, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  /**
   * Why this university came back from the quick check (§29). Three at most, all of them facts the
   * reader or the register already supplied — never a fabricated score.
   */
  const matchReasons: string[] = [];
  if (from === 'recommendation') {
    const fitTier = sp.get('fit');
    const degree = sp.get('level') ?? sp.get('degree');
    if (fitTier && ['STRONG', 'POSSIBLE', 'NOT_YET'].includes(fitTier)) matchReasons.push(t(`v20.uni.match.${fitTier}`));
    // V27 tiers name themselves in the quick fit's own words.
    if (fitTier && (FIT_TIERS as readonly string[]).includes(fitTier)) matchReasons.push(t(`common:fit.tier.${fitTier}.title`));
    if (degree) {
      const label = t(`common:fit.level.${degree}`, { defaultValue: '' });
      if (label) matchReasons.push(t('v20.uni.match.degree', { degree: label }));
    }
    if (ieqas?.language_programme) matchReasons.push(t('v20.uni.match.language'));
    else if (ieqas?.certified) matchReasons.push(t('v20.uni.match.ieqas'));
  }

  /*
   * The regional photograph, in the section that is about the region.
   *
   * This used to be withheld unless the institution was tier A, because the hero took the city
   * picture for every other tier and the same photograph twice on one page looks like a bug. V21
   * stopped the hero doing that — a province's temple is not an institution's identity — so the
   * picture is free to appear where it has always belonged: under a heading that says it is the
   * region, beside text written about the region.
   */
  const cityPhoto = visual.city;
  const cityBody = t(`v20.city.${inst.region}.body`, { defaultValue: '' });

  return (
    <article className="mk-uni hg-uni">
      <UniversityHero
        id={{ slug: inst.slug, name: primary, altName: secondary, nameKo: inst.name_ko, region: inst.region, content }}
        kicker={
          <nav className="hg-uni-hero__crumbs" aria-label={t('common:a11y.breadcrumb', { defaultValue: 'Breadcrumb' })}>
            <LocaleLink to="/universities">{t('v12.directory.navShort')}</LocaleLink>
            <span aria-hidden>/</span>
            <span>{regionLabel}</span>
          </nav>
        }
      >
        <p className="hg-uni-hero__where">
          <span>{regionLabel}</span>
          <span>{t(`v12.type.${inst.institution_type}`)}</span>
          <span>{establishmentLabel(t, inst, 'noun')}</span>
          {content?.founded_year ? <span>{content.founded_year}</span> : null}
        </p>
        {from === 'recommendation' && (
          /*
            §29 — the thread back to the free quick check, with **reasons rather than a score**.
            Each line is either the API's own fit verdict for this institution, the degree level the
            reader typed, or a certification the register lists. There is no percentage, because a
            percentage would be a number we made up about a decision we do not make.
          */
          <div className="hg-uni-hero__from">
            <p className="hg-uni-hero__from-h"><Sparkles aria-hidden /> {t('v17.uni.fromRecommendation')}</p>
            {matchReasons.length > 0 && (
              <ul className="hg-uni-hero__from-why">
                {matchReasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>
        )}
        {/* ONE call to action above the fold (§10). The official website sits beside it as a text link,
            not as a second button, because it leads away from the thing we are asking for. */}
        <div className="hg-uni-hero__act">
          <a href={prepareHref} className="kn-btn kn-btn--primary kn-btn--lg">{t('v12.uni.prepare')}</a>
          {inst.website_url && (
            <a className="hg-uni-hero__site" href={inst.website_url} target="_blank" rel="noopener noreferrer">
              {t('v12.uni.officialSite')} <ArrowUpRight aria-hidden size={14} />
            </a>
          )}
        </div>
      </UniversityHero>

      <div className="hg-uni__wrap">
        {/* 02 — why here. Two points is a list; one is an orphan, so the section waits for two. */}
        {why.length >= 2 && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-why-h">
            <Head eyebrow={t('v20.uni.whyEyebrow')} title={t('v20.uni.whyTitle')} id="hg-uni-why-h" />
            <ul className="hg-uni-why">
              {why.map((p) => (
                <li key={p.id}>
                  <p className="hg-uni-why__k">{p.k}</p>
                  <p className="hg-uni-why__v">{p.v}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 03 — campus. One dominant image and the rest beside it; a swipe gallery on a phone (§14). */}
        {gallery.length > 0 && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-campus-h">
            <Head eyebrow={t('v20.uni.campusEyebrow')} title={t('v20.uni.campusTitle')} id="hg-uni-campus-h" />
            {/* Focusable with a name: below 860 px this is a horizontal scroll region, and a scroll region
                a keyboard user cannot reach is one they cannot read (axe `scrollable-region-focusable`).
                No `role="group"` — it would replace the implicit `list` role and orphan every `<li>`. */}
            <ul
              className={`hg-uni-gal hg-uni-gal--n${gallery.length}${gallery.length === 1 ? ' hg-uni-gal--single' : ''}${gallery.length === 2 ? ' hg-uni-gal--pair' : ''}`}
              tabIndex={0}
              aria-label={t('v20.uni.campusTitle')}
            >
              {gallery.map((m, i) => (
                <li key={m.asset} className={i === 0 ? 'is-lead' : undefined}>
                  <UniversityPhoto
                    media={m}
                    sizes="(min-width: 860px) 62vw, 88vw"
                    alt={t(m.alt_key, { name: primary })}
                  />
                  {/* The licence's own condition, satisfied beside the picture it applies to. */}
                  <PhotoCredit media={m} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* V27 (brief §4): international students → scholarships → housing, before academic identity. Verified facts
            only; each section renders only what the official pages state. */}
        <UniversityInternational content={content} data={adm.data} level={fitLevel} />
        <UniversityScholarships
          data={adm.data} level={fitLevel} levelLabel={fitLevel ? t(`common:fit.level.${fitLevel}`) : undefined}
          checkHref={`/start?lang=${locale}`}
          fallbackHref={content?.intl?.links?.scholarship?.url ?? content?.international_admissions_url ?? inst.website_url}
        />
        <UniversityHousing content={content} />

        {/* 04 — academic identity (V24 §292). The record used to come ninth and repeat the hero's line (region ·
            type · establishment · founding year) as a table; it now keeps only what the hero does not say,
            and comes straight after the campus, where a reader is still forming a picture of the place. */}
        {(showMajors || showCampuses || showIeqas) && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-facts-h">
            <Head eyebrow={t('v20.uni.factsEyebrow')} title={t('v24.uni.academicTitle')} id="hg-uni-facts-h" />
            <dl className="hg-uni-facts">
              {showMajors ? <div><dt>{t('v12.uni.majors')}</dt><dd>{t('v12.uni.majorsValue', { count: inst.major_count })}</dd></div> : null}
              {showCampuses && (
                <div><dt>{t('v12.uni.campuses')}</dt><dd>{inst.other_campuses.map((c) => `${c.name_ko} (${CAMPUS_ROLE[c.role] ? t(`v23.uni.campusRole.${CAMPUS_ROLE[c.role]}`) : c.role})`).join(' · ')}</dd></div>
              )}
              {showIeqas && ieqas && (
                <div><dt>{t('v12.uni.intlTitle')}</dt><dd>{t(ieqas.excellent ? 'v12.ieqas.excellent' : 'v12.ieqas.certified')}</dd></div>
              )}
            </dl>
            {checked && <p className="hg-uni-checked">{t('v12.uni.checked', { date: checked })}</p>}
          </section>
        )}

        {/* 05 — education philosophy. Renders only for a reviewed reading or a registry-asserted motto. */}
        <UniversityPhilosophy content={content} name={primary} />

        {/* 06 — international student life. Lines, not a checklist: each one is a thing the institution's
            own site actually publishes, and the section does not appear when none of them does. */}
        {!content?.intl && ((content?.international_office_url && !said.has('office')) || content?.international_admissions_url
          || (content?.dormitory_url && !said.has('dormitory')) || showIeqas || showLanguage) && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-intl-h">
            <div className="hg-uni-split">
              <div className="hg-uni-split__aside">
                <Head eyebrow={t('v20.uni.intlEyebrow')} title={t('v20.uni.intlTitle')} id="hg-uni-intl-h" />
              </div>
              <div className="hg-uni-split__body">
                {content?.international_office_url && !said.has('office') && <p>{t('v20.uni.intl.officeLine')}</p>}
                {content?.international_admissions_url && <p>{t('v20.uni.intl.admissionsLine')}</p>}
                {content?.dormitory_url && !said.has('dormitory') && <p>{t('v20.uni.intl.dormLine')}</p>}
                {showIeqas && <p>{t('v12.ieqas.certifiedWhat')}</p>}
                {showLanguage && <p>{t('v12.ieqas.languageWhat')}</p>}
              </div>
            </div>
          </section>
        )}

        {/* 07 — the city. Written once per region, factual, attached to the place and never to the
            institution (§28). A city photograph here is labelled as the city, as everywhere else. */}
        {cityBody && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-city-h">
            <div className="hg-uni-split">
              <div className="hg-uni-split__aside">
                {/* V21 — "Living in Cheongju" was a heading over text about North Chungcheong province,
                    written once and shown on every institution in it. The text is good and the heading
                    was a claim it does not make, so the heading names what the text is about: the
                    campus's region. The city, where the register knows it, is a fact in the line under
                    it rather than a promise of local colour the copy does not deliver. */}
                <Head eyebrow={t('v21.uni.placeEyebrow')} title={t('v21.uni.placeTitle')} id="hg-uni-city-h" />
                {content?.city_ko && locale === 'ko'
                  ? <p className="hg-uni-sec__lede">{t('v21.uni.placeWhere', { city: content.city_ko, region: regionLabel })}</p>
                  : <p className="hg-uni-sec__lede">{t(`v20.city.${inst.region}.line`)}</p>}
              </div>
              <div className="hg-uni-split__body">
                {cityBody.split('\n').map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
              </div>
            </div>
            {cityPhoto && (
              <figure className="hg-uni-cityshot">
                <UniversityPhoto media={cityPhoto} sizes="(min-width: 1200px) 1160px, 94vw" alt={t(cityPhoto.alt_key, { region: regionLabel })} />
                <figcaption>{t('v14.uni.cityPhoto', { region: regionLabel })}</figcaption>
              </figure>
            )}
          </section>
        )}

        {/* 09 — the official film, behind a facade. */}
        <UniversityVideo content={content} name={primary} />

        {/* 10 — where to check for yourself. */}
        <UniversityOfficialLinks content={content} website={inst.website_url} websiteInHero />

        {/* 11 — one action, in the reader's own words rather than the product's. */}
        <section className="hg-uni-sec hg-uni-cta" aria-labelledby="hg-uni-cta-h">
          <h2 className="hg-uni-sec__h" id="hg-uni-cta-h">{t('v20.uni.ctaTitle')}</h2>
          <p className="hg-uni-sec__lede">{t('v20.uni.ctaBody')}</p>
          <a href={prepareHref} className="kn-btn kn-btn--primary kn-btn--lg">{t('v12.uni.prepare')}</a>
        </section>
      </div>
    </article>
  );
}
