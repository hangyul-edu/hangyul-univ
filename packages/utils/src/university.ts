/**
 * **The canonical public university content model** (V20, brief §5, §19, §54).
 *
 * Before this module there were three descriptions of a Korean university in one product: the marketing
 * directory's `InstitutionCard`, the marketing detail page's own media resolver, and the student app's
 * catalogue `UniversityDetail` — three content systems that could disagree about what a university looks
 * like and what may be shown of it. §54 asks for one. This is it: one shape, one resolver, one media
 * registry, imported by every surface that draws a university.
 *
 * Three rules are enforced here rather than remembered:
 *
 *   1. **A university never shows another university's campus.** A photograph reaches a page only on that
 *      institution's own content record, written by the pipeline and rights-checked there; a client can
 *      draw the picture it is given and cannot choose one. A city photograph is reachable, but only as
 *      `kind: 'CITY'`, which every renderer is required to label as the city (§8, §19).
 *   2. **Only attribution-free media may be listed.** The owner's production state is no customer-visible
 *      photo credit, so a CC BY asset is not "shown with a smaller credit", it is not shown
 *      (`scripts/qa/v14-media-licence.mjs`, `scripts/qa/v20/university-gate.mjs`).
 *   3. **A field with no source does not exist.** Every value in `UniversityContent` is optional and
 *      carries its own provenance; a renderer composes around absence instead of printing a blank row.
 */

/* ------------------------------------------------------------------------------------ the content model */

import type { UniversityContent, UniversityMedia } from '@hangyul/types';

export type { ContentVerification, MediaAttribution, MediaKind, Provenance, ServableRights, UniversityContent, UniversityMedia } from '@hangyul/types';

/* -------------------------------------------------------------------------------- the media registry */

/**
 * Photographs of **specific institutions** do not live in this file.
 *
 * They live on the institution's own content record (`content.media.hero` / `.gallery`), produced by
 * `scripts/universities/apply-curated.mjs` from `curated/media.json` and rights-checked against
 * `credits.json` at build time. Keeping the mapping in one place that the API serves is what makes §8
 * — *a university page must never display another university's campus image* — a property of the data
 * rather than a thing every renderer has to remember. A client cannot assign a photograph at all; it can
 * only draw the one the record carries.
 *
 * The list is short, and `docs/MEDIA_LICENSE_AUDIT.md` records why: almost every good photograph of a
 * Korean campus on Commons is CC BY or CC BY-SA, and the owner's production state is no visible
 * attribution. Commissioned photography is the fix.
 */

const city = (asset: string, licence: string, alt: string, w: number, h: number, fx: number, fy: number): UniversityMedia => ({
  asset, university_id: null, kind: 'CITY', license_or_permission: licence, local_path: `media/${asset}`,
  media_source: 'Wikimedia Commons', rights_status: 'CC0_PUBLIC_DOMAIN', official_asset: false,
  attribution_requirement: null, focal_x: fx, focal_y: fy, alt_key: alt, width: w, height: h,
});

export const REGION_MEDIA: Record<string, UniversityMedia[]> = {
  Busan: [
    city('busan-gwangan-bridge-night', 'CC0', 'v20.media.alt.busanGwangan', 3840, 2293, 52, 58),
    city('busan-gamcheon-village', 'CC0', 'v20.media.alt.busanGamcheon', 3840, 2162, 50, 55),
  ],
  Daejeon: [city('daejeon-expo-bridge-night', 'CC0', 'v20.media.alt.daejeonExpo', 3407, 2121, 50, 55)],
  Ulsan: [city('ulsan-bridge-harbour', 'Public domain', 'v20.media.alt.ulsanBridge', 3840, 2160, 48, 52)],
  Gangwon: [city('sokcho-seoraksan-skyline', 'CC0', 'v20.media.alt.sokchoSeorak', 3783, 2234, 50, 55)],
  Jeonbuk: [city('jeonju-hanok-rooftops', 'CC0', 'v20.media.alt.jeonjuHanok', 3840, 2555, 50, 58)],
  Gyeongbuk: [city('gyeongju-bulguksa', 'CC0', 'v20.media.alt.gyeongjuBulguksa', 3840, 2534, 50, 52)],
  Seoul: [
    city('seoul-han-river-golden-hour', 'CC0 1.0', 'v14.media.alt.seoulRiver', 2400, 1800, 70, 45),
    city('seoul-cheonggyecheon-walk', 'CC0', 'v20.media.alt.seoulCheonggyecheon', 3840, 2560, 50, 55),
    city('seoul-yeouido-river-dusk', 'CC0', 'v20.media.alt.seoulYeouido', 3840, 2552, 50, 50),
  ],
};

/* ------------------------------------------------------------------------------------- the resolver */

/**
 * The four tiers, in resolution order (V21, brief §3).
 *
 * **`D_IDENTITY` is not a placeholder and it is not generated from the name.** V20's fourth tier set
 * two syllables chopped out of the institution's own title at 90 px — 꽃동 for 가톨릭꽃동네대학교 — and
 * the owner rejected it outright: it reads as machine output, several of the fragments are
 * meaningless (교육, 외국), and it was 368 of 425 pages. The concept is deleted, not tuned. What
 * replaces it is the institution's full name, properly typeset, on a restrained surface — which is
 * what a design studio would do with no photograph, and which no amount of string-chopping achieves.
 */
export type VisualTier = 'A_LICENSED_PHOTO' | 'B_OFFICIAL_VIDEO' | 'C_LOGO' | 'D_IDENTITY';

export interface ResolvedVisual {
  tier: VisualTier;
  /** A photograph of **this institution**. Present only at tier A. */
  campus: UniversityMedia | null;
  /** The official video's own poster, served by YouTube. Present only at tier B. */
  poster: { url: string; videoId: string } | null;
  /** The institution's mark, when it has one Hangyul may show. */
  logo: UniversityContent['logo'] | null;
  /**
   * A photograph of the **city**, for a surface that can label it as the city. Never on a result
   * tile: three Seoul photographs across 85 Seoul institutions is the repetition §3 forbids, and the
   * detail page is where a city picture can appear once with a caption that says what it is.
   */
  city: UniversityMedia | null;
}

/** True only for a logo we may serve with no visible credit. A trademark we may not redistribute is not shown. */
export function logoIsServable(logo: UniversityContent['logo'] | null | undefined): boolean {
  if (!logo?.url) return false;
  return logo.rights_status === 'CC0_PUBLIC_DOMAIN'
    || logo.rights_status === 'HANGYUL_OWNED'
    || logo.rights_status === 'OWNER_AUTHORISED'
    || logo.rights_status === 'COMMERCIAL_NO_ATTRIBUTION';
}

/**
 * One function, so the directory tile, the detail hero and the student app can never disagree about what
 * a university looks like — or, more importantly, about **what the picture is**.
 */
export function resolveUniversityVisual(
  slug: string | undefined,
  region: string | undefined,
  content: UniversityContent | null | undefined,
  opts: { index?: number } = {},
): ResolvedVisual {
  const campus = content?.media?.hero ?? null;
  const logo = logoIsServable(content?.logo) ? content!.logo! : null;
  // V25: a film's poster leads only when a person judged it a campus scene (REPORT §312 D2). Every other film-led
  // institution falls through to the identity composition; its film still plays on the detail page.
  const videoId = content?.youtube?.poster_review === 'CAMPUS_SCENE' ? (content.youtube.video_id ?? null) : null;
  // A city photograph is reachable at every tier below A, including the typographic one, and is always
  // the *region's* picture labelled as the region. Rotating by position stops a page of Seoul
  // institutions being twelve copies of the same river (§19).
  const pool = (region && REGION_MEDIA[region]) || [];
  const city = pool.length ? pool[(opts.index ?? hash(slug ?? '')) % pool.length] : null;

  if (campus) return { tier: 'A_LICENSED_PHOTO', campus, poster: null, logo, city: null };
  if (videoId) {
    return {
      tier: 'B_OFFICIAL_VIDEO', campus: null, logo, city,
      poster: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, videoId },
    };
  }
  if (logo) return { tier: 'C_LOGO', campus: null, poster: null, logo, city };
  // Tier D carries no image at all — the renderer sets the institution's full name. Nothing is
  // invented and nothing is cropped out of it.
  return { tier: 'D_IDENTITY', campus: null, poster: null, logo: null, city };
}

/** Everything verified of **this** university, for the gallery. Region photography is never part of it. */
export function galleryFor(content: UniversityContent | null | undefined): UniversityMedia[] {
  return content?.media?.gallery ?? [];
}

/** Stable, cheap, and only ever used to vary a fallback — never to derive a fact. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * The city a page should name, as an i18n key.
 *
 * Korea's seventeen 광역자치단체 are the registry's own regions and every institution has one, so the
 * region is always an honest answer. A handful of cities carry enough institutions that naming the city
 * rather than the province is both truer and more useful to a reader imagining their daily life (§28);
 * those are listed here and the rest fall back to the region.
 */
export const CITY_KEYS: Record<string, string[]> = {
  Gyeonggi: ['수원', '용인', '성남', '안양', '부천', '고양'],
  Chungnam: ['천안', '아산'],
  Chungbuk: ['청주'],
  Gyeongbuk: ['포항', '경주', '구미'],
  Gyeongnam: ['창원', '김해', '진주'],
  Jeonbuk: ['전주', '익산'],
  Jeonnam: ['순천', '여수', '목포'],
  Gangwon: ['춘천', '강릉', '원주'],
};

export function cityLabelKey(region: string | undefined, cityKo: string | undefined): string | null {
  if (!region) return null;
  const named = CITY_KEYS[region];
  if (named && cityKo) {
    const hit = named.find((c) => cityKo.includes(c));
    if (hit) return `v20.city.${region}.${hit}`;
  }
  return `v20.city.${region}`;
}
