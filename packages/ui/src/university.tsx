/**
 * **The shared university presentation** (V20, brief §10, §13, §17, §19, §30, §54).
 *
 * One set of components, so the public page and the student app show the same institution the same way.
 * Before V20 the marketing detail page, the marketing directory and the student app each drew a
 * university from a different shape with different media rules; §54 asks for one, and this is the half of
 * it that renders. The other half is the content model in `@hangyul/utils`.
 *
 * Three ideas run through everything here:
 *
 *   **The visual is resolved, never chosen.** `resolveUniversityVisual` returns one of four tiers and the
 *   component draws that tier. A caller cannot pass a photograph, so a caller cannot pass the *wrong*
 *   photograph — which is how §8 ("never another university's campus") becomes a property of the system
 *   rather than a rule people remember.
 *
 *   **No tier is a placeholder, and no tier is generated from the name.** V20's fourth tier chopped
 *   two syllables out of the institution's title and set them at 90 px — 꽃동 for 가톨릭꽃동네대학교.
 *   The owner rejected it and was right: it reads as machine output and it was 368 of 425 pages. Tier
 *   D is now the institution's **full name**, in both scripts, properly typeset on a quiet surface,
 *   with its mark where there is one. A studio with no photograph sets the name; it does not invent
 *   a graphic.
 *
 *   **Absence composes.** Every block returns `null` when it has nothing sourced to say. Two universities'
 *   pages are therefore different lengths, which is honest and is why there is no grid of empty cards.
 */
import { ArrowUpRight, Play } from '@hangyul/icons';
import { useLocale } from '@hangyul/i18n';
import type { UniversityContent, UniversityMedia } from '@hangyul/types';
import { cx, resolveUniversityVisual } from '@hangyul/utils';
import { useState } from 'react';

export interface UniversityIdentity {
  slug: string;
  /** The name in the reader's script, already chosen by the caller. */
  name: string;
  /** The other script's name, or null when the institution has only one. */
  altName?: string | null;
  /** The Korean name, whatever script the page is in — tier D sets both, one above the other. */
  nameKo?: string;
  region: string;
  content?: UniversityContent | null;
}

/* ------------------------------------------------------------------------------------------- media */

const srcFor = (m: UniversityMedia, w: number, ext: 'jpg' | 'webp' = 'jpg') => `/${m.local_path}-${w}.${ext}`;
const srcSetFor = (m: UniversityMedia, ext: 'jpg' | 'webp') =>
  (m.renditions?.length ? m.renditions : [640, 1200, 2400]).map((w) => `${srcFor(m, w, ext)} ${w}w`).join(', ');

/**
 * The focal point as CSS variables, so a stylesheet can choose the **portrait** point where the crop is portrait (the phone
 * hero) and the landscape point everywhere else — one asset, two crops, no second file (V25, brief §12).
 */
export function focalStyle(m: Pick<UniversityMedia, 'focal_x' | 'focal_y' | 'focal_mobile_x' | 'focal_mobile_y'>): React.CSSProperties {
  return {
    ['--fp-d' as string]: `${m.focal_x}% ${m.focal_y}%`,
    ['--fp-m' as string]: `${m.focal_mobile_x ?? m.focal_x}% ${m.focal_mobile_y ?? m.focal_y}%`,
  };
}

/**
 * One photograph, at the sizes it is actually served at, cropped on **its own** focal point (§15).
 *
 * `object-position` is per asset for a reason the SNU gate makes concrete: its apex sits high in the
 * frame and the road fills the bottom third, so `center` turns a 16:10 tile into a picture of tarmac.
 *
 * V25: a `<picture>` with a WebP source first (40–60 % lighter than the JPEG at the same width) and the JPEG as the
 * fallback; the browser picks the width from `sizes`, so a directory card never fetches the 2400 px file.
 */
export function UniversityPhoto({ media, sizes, priority, className, alt }: {
  media: UniversityMedia; sizes: string; priority?: boolean; className?: string; alt: string;
}) {
  const webp = media.formats?.includes('webp');
  return (
    <picture className="hg-uni__pic">
      {webp && <source type="image/webp" srcSet={srcSetFor(media, 'webp')} sizes={sizes} />}
      <img
        className={cx('hg-uni__img', className)}
        src={srcFor(media, 1200)}
        srcSet={srcSetFor(media, 'jpg')}
        sizes={sizes}
        alt={alt}
        width={media.width}
        height={media.height}
        style={focalStyle(media)}
        // §48's hard rule: only the above-the-fold hero may load eagerly. Everything else waits.
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding={priority ? 'sync' : 'async'}
      />
    </picture>
  );
}

/**
 * The credit a licence requires, rendered as part of the picture (V21, brief §15).
 *
 * This is the thing that makes an attribution-bearing photograph usable at all. It is deliberately
 * *small and present* rather than hidden: the licence's condition is that the author is named where
 * the work is used, and a credit tucked behind a disclosure or on a separate page is not that. It
 * carries the author, the licence by name, and a link to the source — the three things CC asks for.
 *
 * It renders nothing for an asset that needs no credit, so a CC0 photograph is uncluttered.
 */
export function PhotoCredit({ media, className }: { media: UniversityMedia; className?: string }) {
  const a = media.attribution_requirement;
  if (!a) return null;
  return (
    <p className={cx('hg-uni-credit', className)}>
      <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow">{a.author}</a>
      {' · '}
      <a href={a.license_url} target="_blank" rel="noopener noreferrer nofollow license">{a.license}</a>
    </p>
  );
}

/**
 * The institution's mark, at its **own** geometry (§9).
 *
 * No circular crop, no forced square, no stretch: the stored width and height are the file's own
 * proportions and the box is computed from them, so a wide wordmark stays wide and a seal stays round.
 * A university whose logo may not be served with no credit simply has no logo here.
 */
export function UniversityLogo({ content, name, size = 56, className }: {
  content?: UniversityContent | null; name: string; size?: number; className?: string;
}) {
  const logo = content?.logo;
  if (!logo?.url) return null;
  const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
  return (
    <img
      className={cx('hg-uni__logo', className)}
      src={logo.url}
      // The mark *is* the university's name rendered as a mark, so repeating the name in the alt would
      // make a screen reader say it twice. The visible heading carries it.
      alt=""
      aria-hidden
      width={Math.round(size * ratio)}
      height={size}
      style={{ height: size, width: 'auto' }}
      loading="eager"
      decoding="async"
      data-name={name}
    />
  );
}

/* ------------------------------------------------------------------------------ identity composition */

/** One restrained tone per part of the country — a grid of identity tiles reads as a set, and two
 *  neighbouring institutions in different provinces do not look identical. Never a gradient per name. */
const REGION_TONE: Record<string, string> = {
  Seoul: 'seoul', Gyeonggi: 'capital', Incheon: 'capital',
  Busan: 'southeast', Gyeongnam: 'southeast', Ulsan: 'southeast',
  Daejeon: 'central', Chungbuk: 'central', Chungnam: 'central', Sejong: 'central',
  Daegu: 'east', Gyeongbuk: 'east',
  Gwangju: 'southwest', Jeonbuk: 'southwest', Jeonnam: 'southwest',
  Gangwon: 'north', Jeju: 'island',
};

/**
 * **Tiers D and E — the identity composition** (V23, REPORT §270 D1).
 *
 * V21 set the name on a beige field and, at 203 of 425 institutions, the directory read as half-empty.
 * This is the designed answer for an institution with no photograph and no verified film. It shows only
 * what the register says and nothing invented:
 *
 *   - its **name**, set large (the caller passes the script the caption below does *not* use);
 *   - its **mark**, on a white plate, where one is licensed (tier D);
 *   - **where it is** — Korea drawn faintly, its own 광역자치단체 in tangerine, from the KOSTAT boundaries
 *     the directory map already uses (`/media/region-mark/<Region>.svg`, `scripts/media/v23-region-marks.mjs`);
 *   - one tone per part of the country.
 *
 * It is never a picture of a campus, never another institution's picture and never a fragment of the name.
 */
export function UniversityIdentityArt({ name, nameLang, region, content, regionLabel, size = 'tile', className }: {
  name: string; nameLang?: string; region: string; content?: UniversityContent | null;
  /** Small caps line under the name (the localized region). Omitted on the hero, which states it already. */
  regionLabel?: string | null; size?: 'tile' | 'hero'; className?: string;
}) {
  const hasLogo = !!content?.logo?.url && resolveUniversityVisual(undefined, region, content).logo != null;
  return (
    <div className={cx('hg-uni-art', `hg-uni-art--${size}`, className)} data-tone={REGION_TONE[region] ?? 'seoul'} data-has-logo={hasLogo || undefined}>
      <img className="hg-uni-art__map" src={`/media/region-mark/${region}.svg`} alt="" aria-hidden width={82} height={87} loading="lazy" decoding="async" />
      {hasLogo && (
        <span className="hg-uni-art__plate"><UniversityLogo content={content} name={name} size={size === 'hero' ? 56 : 34} className="hg-uni-art__logo" /></span>
      )}
      {size === 'tile' && (
        <span className="hg-uni-art__text">
          <span className="hg-uni-art__name" lang={nameLang}>{name}</span>
          {regionLabel && <span className="hg-uni-art__region">{regionLabel}</span>}
        </span>
      )}
    </div>
  );
}

/**
 * The hero (§10).
 *
 * Tier A and B are immersive: a full-bleed image under a controlled two-stop gradient, with the mark,
 * the name, the place and one identity line sitting *on* it — one composition, not a picture with a
 * header underneath. Tier C and D are the **identity hero**: the same anatomy, the same rhythm and
 * the same scale on a quiet surface, with the institution's mark where there is one and nothing
 * where there is not. No decorative object is generated from the name (V21, brief §10) — the name is
 * the graphic, set in full in both scripts with the place under it.
 */
export function UniversityHero({ id, children, kicker, index }: {
  id: UniversityIdentity; kicker?: React.ReactNode; children?: React.ReactNode; index?: number;
}) {
  const { t } = useLocale(['marketing', 'common']);
  const visual = resolveUniversityVisual(id.slug, id.region, id.content, { index });
  /*
   * **The hero shows a campus photograph or no photograph at all** (V21 §3).
   *
   * This used to fall back to `visual.city`, so Daegu Cyber University — an online university with no
   * campus — led with Bulguksa, labelled "North Gyeongsang, where this university is". The label was
   * honest and the picture was still wrong: one temple stood in for every institution in the province,
   * which is the generic repeated fallback this pass is removing, and the same institution then had a
   * temple on its page and its own typeset name on its directory tile.
   *
   * The regional photograph keeps its proper home in "캠퍼스가 있는 곳", which is a section about the
   * region and says so. Here, an institution with no photograph of its own gets its identity set in
   * type, exactly as the tile does.
   */
  const photo = visual.campus ?? null;
  const isCampus = !!visual.campus;
  const regionLabel = t(`common:region.${id.region}`, { defaultValue: id.region });
  // V28 (UX_AUDIT MK-3): with no campus photograph, the institution's own film still leads — only a poster a person
  // judged a campus scene (the resolver's tier B), at the largest size that exists for that upload. Labelled as a film.
  const yt = id.content?.youtube;
  const still = !photo && visual.poster ? `https://i.ytimg.com/vi/${visual.poster.videoId}/${yt?.poster ?? 'hqdefault'}.jpg` : null;

  return (
    <header className={cx('hg-uni-hero', `hg-uni-hero--${photo || still ? 'photo' : 'type'}`)} data-tier={visual.tier}>
      {still && (
        <div className="hg-uni-hero__media">
          <img src={still} alt="" loading="eager" decoding="async" className="hg-uni-hero__still" />
          <div className="hg-uni-hero__scrim" aria-hidden />
        </div>
      )}
      {!photo && !still && (
        /* V23 — the identity composition is the hero's field when there is no photograph (§270 D1). The mark is
           drawn once, in the lockup below, so the art carries only place and tone here. */
        <UniversityIdentityArt name={id.name} region={id.region} content={null} size="hero" className="hg-uni-hero__art" />
      )}
      {photo ? (
        <div className="hg-uni-hero__media">
          <UniversityPhoto
            media={photo}
            sizes="100vw"
            priority
            alt={isCampus ? t(photo.alt_key, { name: id.name }) : t(photo.alt_key, { region: regionLabel })}
          />
          <div className="hg-uni-hero__scrim" aria-hidden />
        </div>
      ) : null}
      {/* The breadcrumb sits at the **top** of the hero and the lockup at the bottom, as two separate
          blocks rather than one tall column. They were one column until the measurements said
          otherwise: the clearance the floating header needs is ~160 px, and with `align-items: end`
          every pixel of it pushed the name up to 45 % of the hero's height — the part of the scrim
          that is around 0.3 and cannot carry white text over a bright photograph. */}
      {kicker && <div className="hg-uni-hero__top">{kicker}</div>}
      <div className="hg-uni-hero__inner">
        <UniversityLogo content={id.content} name={id.name} size={64} className="hg-uni-hero__logo" />
        <h1 className="hg-uni-hero__name">{id.name}</h1>
        {id.altName && <p className="hg-uni-hero__alt" lang={/[가-힣]/.test(id.altName) ? 'ko' : 'en'}>{id.altName}</p>}
        {children}
      </div>
      {/* Shown only when the picture is NOT this university. On a campus photograph there is nothing to
          explain, so nothing is written — and a city picture is never allowed to pass as a campus (§8).
          The wrapper is a <div>, not a <p>: it is a flex row that *contains* PhotoCredit's paragraph,
          and a <p> inside a <p> is closed by the parser before the inner one is reached. */}
      {photo && (
        <div className="hg-uni-hero__credit">
          {!isCampus && <span>{t('v14.uni.cityPhoto', { region: regionLabel })}</span>}
          <PhotoCredit media={photo} />
        </div>
      )}
      {still && (
        <div className="hg-uni-hero__credit"><span>{t('v20.dir.tierVideo')}{yt?.channel_title && <> · <span data-no-l10n>{yt.channel_title}</span></>}</span></div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------------------------ the sections */

/**
 * 교육 이념 (§25).
 *
 * Two shapes, and the difference matters. A **Hangyul-reviewed** record renders as Hangyul's own
 * student-facing reading, because a person has read the university's page and written it. A
 * **registry-asserted motto** renders as a short attributed quotation, because nobody has interpreted it
 * and pretending otherwise would be the fabrication §56 asks us to hunt for. A record still at
 * `SOURCE_CAPTURED` renders nothing at all.
 */
export function UniversityPhilosophy({ content, name }: { content?: UniversityContent | null; name: string }) {
  const { t, locale } = useLocale(['marketing', 'common']);
  const ko = locale === 'ko';
  const p = content?.education_philosophy;
  const reviewed = p?.verification_status === 'HANGYUL_REVIEWED' ? p : null;
  const motto = content?.motto;
  const mottoText = motto ? (ko ? motto.ko : motto.en) || motto.en || motto.ko : null;
  if (!reviewed && !mottoText) return null;

  const summary = reviewed ? (ko ? reviewed.summary_ko : reviewed.summary_en) || reviewed.summary_en || reviewed.summary_ko : null;
  return (
    <section className="hg-uni-sec hg-uni-phil" aria-labelledby="hg-uni-phil-h">
      <p className="hg-uni-sec__eyebrow">{t('v20.uni.philosophyEyebrow')}</p>
      <h2 className="hg-uni-sec__h" id="hg-uni-phil-h">{reviewed?.heading ?? t('v17.uni.missionTitle')}</h2>
      {reviewed ? (
        <>
          <p className="hg-uni-phil__read">{summary}</p>
          {reviewed.statement && <blockquote className="hg-uni-phil__quote"><p lang="ko">{reviewed.statement}</p></blockquote>}
        </>
      ) : (
        <blockquote className="hg-uni-phil__quote hg-uni-phil__quote--lead">
          <p lang={motto?.ko && ko ? 'ko' : undefined}>{mottoText}</p>
        </blockquote>
      )}
      {/* The institution's own page, named as what it is. This is the one place provenance is useful to a
          reader rather than to us (§43), so it is a link and never a "source_url: …" line. */}
      {(reviewed?.source_url ?? content?.philosophy_url) && (
        <a className="hg-uni-link" href={reviewed?.source_url ?? content!.philosophy_url} target="_blank" rel="noopener noreferrer">
          {t('v20.uni.philosophySource', { name })} <ArrowUpRight aria-hidden size={13} />
        </a>
      )}
    </section>
  );
}

/**
 * The official video, behind a **facade** (§17, §48).
 *
 * A YouTube iframe costs roughly a megabyte and a dozen third-party requests before anybody presses
 * play. The poster, the title and the play control are plain HTML; the iframe is created by the click
 * that asks for it. The channel is named under it so a reader can see whose film they are about to
 * watch, and a channel with no verified introduction video gets a link and no embed — never a guess.
 */
export function UniversityVideo({ content, name }: { content?: UniversityContent | null; name: string }) {
  const { t } = useLocale(['marketing', 'common']);
  const [playing, setPlaying] = useState(false);
  const yt = content?.youtube;
  if (!yt?.channel_url) return null;

  if (!yt.video_id) {
    return (
      <section className="hg-uni-sec hg-uni-video hg-uni-video--linkonly" aria-labelledby="hg-uni-video-h">
        <p className="hg-uni-sec__eyebrow">{t('v20.uni.videoEyebrow')}</p>
        <h2 className="hg-uni-sec__h" id="hg-uni-video-h">{t('v17.uni.videoTitle')}</h2>
        <a className="hg-uni-channel" href={yt.channel_url} target="_blank" rel="noopener noreferrer">
          <span className="hg-uni-channel__play" aria-hidden><Play /></span>
          <span className="hg-uni-channel__name">{yt.channel_title || t('v17.uni.channel', { name })}</span>
          <ArrowUpRight aria-hidden size={14} />
        </a>
      </section>
    );
  }

  return (
    <section className="hg-uni-sec hg-uni-video" aria-labelledby="hg-uni-video-h">
      <p className="hg-uni-sec__eyebrow">{t('v20.uni.videoEyebrow')}</p>
      {/* V27: the heading says what the film is — a film made for overseas students is named as one. */}
      <h2 className="hg-uni-sec__h" id="hg-uni-video-h">{yt.purpose && yt.purpose !== 'GENERAL_PROMO' ? t(`common:uni27.video.${yt.purpose}`) : t('v17.uni.videoTitle')}</h2>
      <div className="hg-uni-video__frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt.video_id}?autoplay=1`}
            title={yt.video_title || t('v17.uni.videoTitle')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button type="button" className="hg-uni-video__play" onClick={() => setPlaying(true)}>
            <img
              src={`https://i.ytimg.com/vi/${yt.video_id}/${yt.poster ?? 'hqdefault'}.jpg`}
              alt="" aria-hidden width={1280} height={720} loading="lazy" decoding="async"
              // maxres does not exist for every upload; hq always does, and a broken poster is worse
              // than a smaller one.
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${yt.video_id}/hqdefault.jpg`; }}
            />
            <span className="hg-uni-video__btn" aria-hidden><Play /></span>
            <span className="hg-sr-only">{t('v17.uni.playVideo', { name })}</span>
          </button>
        )}
      </div>
      <p className="hg-uni-video__meta">
        <span className="hg-uni-video__title">{yt.video_title}</span>
        {yt.channel_title && <span className="hg-uni-video__chan">{yt.channel_title}</span>}
      </p>
    </section>
  );
}

/**
 * The official destinations (§10 item 10, §27).
 *
 * Each row exists only when the institution's own site gave us the URL, so a page with one link shows
 * one link rather than four rows of "—". These are the links a student actually needs next, in the order
 * they need them: who to ask, how to apply, where to live, the university itself.
 */
export function UniversityOfficialLinks({ content, website, websiteInHero }: {
  content?: UniversityContent | null; website?: string | null;
  /** V25 (REPORT §312 D5): the hero already links the official site; a section that would hold only that row is omitted. */
  websiteInHero?: boolean;
}) {
  const { t } = useLocale(['marketing', 'common']);
  const rows: [string, string][] = [];
  // V27: the verified research links lead; the V20 site-read links fill what it lacks. One row per destination.
  const l = content?.intl?.links ?? {};
  const add = (label: string, href?: string | null) => { if (href && !rows.some(([, h]) => h === href)) rows.push([label, href]); };
  add(t('v20.uni.link.admissions'), l.international_admissions?.url ?? content?.international_admissions_url);
  add(t('v20.uni.link.office'), l.international_office?.url ?? content?.international_office_url);
  add(t('common:uni27.link.scholarship'), l.scholarship?.url);
  add(t('v20.uni.link.dormitory'), l.dormitory?.url ?? content?.dormitory_url);
  add(t('common:uni27.link.kli'), l.korean_language_institute?.url);
  if (website && !websiteInHero) rows.push([t('v12.uni.officialSite'), website]);
  if (!rows.length) return null;
  return (
    <section className="hg-uni-sec hg-uni-links" aria-labelledby="hg-uni-links-h">
      <p className="hg-uni-sec__eyebrow">{t('v20.uni.linksEyebrow')}</p>
      <h2 className="hg-uni-sec__h" id="hg-uni-links-h">{t('v20.uni.linksTitle')}</h2>
      <ul className="hg-uni-links__list">
        {rows.map(([label, href]) => (
          <li key={href}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <span>{label}</span>
              <ArrowUpRight aria-hidden size={15} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
