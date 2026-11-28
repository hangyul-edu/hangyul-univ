/**
 * A university, as a decision (launch pass — rebuilt from the V20 editorial page).
 *
 * **What was wrong with the page this replaces.** It introduced the institution and then listed whichever
 * database blocks happened to exist, in the order they were built: three "why" points, a gallery, a paragraph of
 * language rules, a scholarship *count* behind a disclosure, a one-row "Majors disclosed — 64" table, two
 * different sections both called "International students", and the official links last. A reader could not
 * answer "what can I study, what do I need, what does it cost, where would I live, what help is there" without
 * reading all of it — and for the 376 institutions with no international research the page was a name, a
 * registry row and a photograph of a temple.
 *
 * **What this is instead.** The order a student decides in:
 *
 *   hero (identity) → decision summary → why students look at it → admissions → scholarships →
 *   campus and student life → official film → what it stands for → one closing action.
 *
 * **Rules it does not bend.**
 *   - *Only confirmed data.* Every value is read from the database (live, or its snapshot) with its source and date. Hangyul writes no new
 *     claim about an institution here.
 *   - *Unknown is not none.* What is unverified is named once per topic ("Not yet verified") with the official
 *     link. Tuition, application fee, intake dates, required documents and legalization are not in the public
 *     export for any institution, so they are always in that state — see `scripts/qa/university-coverage.mjs`.
 *   - *Only this campus.* A photograph appears only when it is a licensed picture of this institution; otherwise
 *     the campus section sets an identity composition (name, mark, region) beside a captioned regional picture.
 *   - *Few actions.* One in the hero, the official guide at the end of admissions, one closing action.
 */
import { ArrowUpRight, BadgeCheck } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { InstitutionDetail } from '@hangyul/types';
import {
  ErrorState, PhotoCredit, Skeleton, UniversityAdmissions, UniversityHero, UniversityIdentityBoard, UniversityLife,
  UniversityPhilosophy, UniversityPhoto, UniversityScholarships, UniversitySummary, UniversityVideo, universityLinks,
} from '@hangyul/ui';
import { formatDate, galleryFor, resolveUniversityVisual } from '@hangyul/utils';
import { useParams } from 'react-router';

import { useNoClosingCta } from '../components/blocks';
import { LocaleLink } from '../components/LocaleLink';
import { useInstitution, useInstitutionAdmissions } from '../lib/queries';
import { prepareAction, useStudentSession } from '../lib/session';
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
  // Launch pass: "founded in 19xx" and "N majors on the register" are gone — they are registry rows said aloud, not
  // reasons. The founding year is not shown at all; the major count is one line of the summary's study options.
  return out.slice(0, 3);
}

export default function UniversityDetail() {
  const { slug } = useParams();
  const { t, locale } = useLocale(['marketing', 'common']);
  const { authenticated } = useStudentSession();
  // Live from the database through the public API; the build's DB snapshot answers only if the API is unreachable.
  const q = useInstitution(slug);
  const inst = q.data;
  const adm = useInstitutionAdmissions(slug);
  const korean = locale === 'ko';
  const primary = inst ? (korean || !inst.name_en ? inst.name_ko : inst.name_en) : '';
  const secondary = inst ? (korean ? inst.name_en : inst.name_ko) : null;

  useSeo({
    // `<University> | Hangyul Univ` — the same title the build prerenders into this page's static HTML.
    title: inst ? `${primary} | ${t('common:brand.name')}` : t('v12.seo.directory.title'),
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
  // 유학 준비 is one action site-wide: the Student login (`next=/match`), or `/match` for a signed-in student.
  const prepareHref = prepareAction(authenticated, locale);
  const regionLabel = t(`common:region.${inst.region}`, { defaultValue: inst.region });
  const typeLabel = t(`v12.type.${inst.institution_type}`);
  const links = universityLinks(content, inst.website_url);
  const identity = { slug: inst.slug, name: primary, altName: secondary, nameKo: inst.name_ko, region: inst.region, content };

  /*
   * The hero is **never** also the gallery's first picture: one photograph shown twice is padding. If nothing is
   * left after the hero, there is no gallery. At most five, each count with its own composition (`hg-uni-gal--nN`).
   */
  const heroAsset = content?.media?.hero?.asset;
  const gallery = galleryFor(content).filter((m) => m.asset !== heroAsset).slice(0, 5);
  const visual = resolveUniversityVisual(inst.slug, inst.region, content);
  const why = whyPoints(t, inst, adm.data?.scholarships.length ?? 0);
  const ieqas = inst.ieqas;
  const date = (d?: string | null) => (d ? formatDate(d, locale, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
  const checked = date(inst.last_verified);
  const researched = adm.data?.verified ? date(content?.intl?.researched_at) : null;

  /*
   * The regional photograph and text belong to the section about the place, labelled as the region. They are
   * never the hero and never pass as the campus: the resolver returns a regional picture only for an institution
   * with no campus photograph of its own, and it is captioned "<region>, where this university is".
   */
  const cityPhoto = visual.city;
  const cityBody = t(`v20.city.${inst.region}.body`, { defaultValue: '' });
  const cityLine = cityBody ? t(`v20.city.${inst.region}.line`, { defaultValue: '' }) : '';
  const guide = (content?.intl?.sources ?? []).find((s) => s.kind === 'OFFICIAL_GUIDE' && s.url);

  return (
    <article className="mk-uni hg-uni hg-unid">
      <UniversityHero
        id={identity}
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
          <span>{typeLabel}</span>
          <span>{establishmentLabel(t, inst, 'noun')}</span>
        </p>
        {/* Badges only where the data justifies them: the IEQAS list, NIIED's GKS guidelines, and a dated Hangyul
            verification of this institution's admissions pages. No badge is a rating. */}
        {(ieqas?.certified || content?.gks?.programmes?.length || researched) && (
          <ul className="hg-unid-badges">
            {ieqas?.certified && <li>{t(ieqas.excellent ? 'v12.ieqas.excellent' : 'v12.ieqas.certified')}</li>}
            {!!content?.gks?.programmes?.length && <li>{t('common:uniDetail.badge.gks')}</li>}
            {researched && <li className="is-verified"><BadgeCheck aria-hidden size={14} /> {t('common:uniDetail.badge.verified', { date: researched })}</li>}
          </ul>
        )}
        {/* ONE action above the fold — the site's 유학 준비 (Student login → /match). The official website is a
            text link beside it. */}
        <div className="hg-uni-hero__act">
          <a href={prepareHref} className="kn-btn kn-btn--primary kn-btn--lg" data-cta="primary">{t('common:uniDetail.cta.prepare')}</a>
          {inst.website_url && (
            <a className="hg-uni-hero__site" href={inst.website_url} target="_blank" rel="noopener noreferrer">
              {t('v12.uni.officialSite')} <ArrowUpRight aria-hidden size={14} />
            </a>
          )}
        </div>
      </UniversityHero>

      <div className="hg-uni__wrap">
        {/* 02 — the decision summary: study options, admissions, cost, student life, support. Confirmed data only. */}
        <UniversitySummary
          inst={inst} data={adm.data} typeLabel={typeLabel} regionLabel={regionLabel} level={null}
          anchors={{ admissions: '#admissions', scholarships: '#scholarships', life: '#life' }}
          foot={checked ? <p className="hg-uni-checked">{t('v12.uni.checked', { date: checked })}</p> : null}
        />

        {/* 03 — why students look at it. Two points is a list; one is an orphan, so the section waits for two. */}
        {why.length >= 2 && (
          <section className="hg-uni-sec" aria-labelledby="hg-uni-why-h">
            <Head eyebrow={t('v20.uni.whyEyebrow')} title={t('common:uniDetail.why.title')} id="hg-uni-why-h" />
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

        {/* 04 — admissions, on its own. Ends on the one action that belongs here: the official guide. */}
        <UniversityAdmissions
          content={content} data={adm.data} level={null} website={inst.website_url}
          action={guide && (
            <a className="kn-btn kn-btn--secondary" href={guide.url} target="_blank" rel="noopener noreferrer">
              {t('common:uniDetail.cta.guide')} <ArrowUpRight aria-hidden size={16} />
            </a>
          )}
        />

        {/* 05 — scholarships: grouped records with source and date; GKS designation from NIIED's guidelines. */}
        <UniversityScholarships
          data={adm.data} level={null}
          checkHref={prepareHref} content={content}
          fallbackHref={links.scholarship}
        />

        {/* 06 — campus and student life. Own-campus photographs only; otherwise the identity composition. */}
        <UniversityLife
          inst={inst} regionLabel={regionLabel} regionLine={cityLine} regionBody={cityBody}
          media={gallery.length > 0 ? (
            /* Focusable with a name: below 860 px this is a horizontal scroll region, and a scroll region a
               keyboard user cannot reach is one they cannot read (axe `scrollable-region-focusable`). */
            <ul
              className={`hg-uni-gal hg-uni-gal--n${gallery.length}${gallery.length === 1 ? ' hg-uni-gal--single' : ''}${gallery.length === 2 ? ' hg-uni-gal--pair' : ''}`}
              tabIndex={0}
              aria-label={t('v20.uni.campusTitle')}
            >
              {gallery.map((m, i) => (
                <li key={m.asset} className={i === 0 ? 'is-lead' : undefined}>
                  <UniversityPhoto media={m} sizes={i === 0 ? '(min-width: 860px) 62vw, 88vw' : '(min-width: 860px) 31vw, 88vw'} alt={t(m.alt_key, { name: primary })} />
                  {/* The licence's own condition, satisfied beside the picture it applies to. */}
                  <PhotoCredit media={m} />
                </li>
              ))}
            </ul>
          ) : !visual.campus ? (
            <UniversityIdentityBoard
              id={identity} regionLabel={regionLabel} kindLabel={typeLabel}
              cityPhoto={cityPhoto}
              cityAlt={cityPhoto ? t(cityPhoto.alt_key, { region: regionLabel }) : undefined}
              cityCaption={t('v14.uni.cityPhoto', { region: regionLabel })}
              note={t('common:uniDetail.life.noPhoto')}
            />
          ) : null}
        />

        {/* 07 — the official film, behind a facade. */}
        <UniversityVideo content={content} name={primary} />

        {/* 08 — what it stands for. Renders only for a reviewed reading or a registry-asserted motto. */}
        <UniversityPhilosophy content={content} name={primary} />

        {/* 09 — one closing action. */}
        <section className="hg-uni-sec hg-uni-cta" aria-labelledby="hg-uni-cta-h">
          <h2 className="hg-uni-sec__h" id="hg-uni-cta-h">{t('v20.uni.ctaTitle')}</h2>
          <p className="hg-uni-sec__lede">{t('v20.uni.ctaBody')}</p>
          <div className="hg-unid-cta__act">
            <a href={prepareHref} className="kn-btn kn-btn--primary kn-btn--lg">{t('common:uniDetail.cta.prepare')}</a>
          </div>
        </section>
      </div>
    </article>
  );
}
