/** Icon system: Lucide (ISC license) for UI glyphs + the Hangyul Univ brand assets (owner-supplied, see docs/BRAND_AND_MEDIA.md). */
export * from 'lucide-react';

import dimensions from '../assets/brand/hangyul-univ/dimensions.json';
import hBlack from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-black.png';
import hBlack2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-black@2x.png';
import hIvory from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-ivory.png';
import hIvory2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-ivory@2x.png';
import hOrange from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-orange.png';
import hOrange2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-horizontal-orange@2x.png';
import vBlack from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-black.png';
import vBlack2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-black@2x.png';
import vIvory from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-ivory.png';
import vIvory2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-ivory@2x.png';
import vOrange from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-orange.png';
import vOrange2x from '../assets/brand/hangyul-univ/hangyul-univ-logo-vertical-orange@2x.png';
import sBlack from '../assets/brand/hangyul-univ/hangyul-univ-symbol-black.png';
import sBlack2x from '../assets/brand/hangyul-univ/hangyul-univ-symbol-black@2x.png';
import sIvory from '../assets/brand/hangyul-univ/hangyul-univ-symbol-ivory.png';
import sIvory2x from '../assets/brand/hangyul-univ/hangyul-univ-symbol-ivory@2x.png';
import sOrange from '../assets/brand/hangyul-univ/hangyul-univ-symbol-orange.png';
import sOrange2x from '../assets/brand/hangyul-univ/hangyul-univ-symbol-orange@2x.png';
import handTangerine from '../assets/brand/hand-tangerine.webp';

/** Which ink to use: `black` on light surfaces, `ivory` on dark or orange surfaces, `orange` as a sparing accent on white/ivory. */
export type BrandLogoColor = 'black' | 'ivory' | 'orange';
export interface BrandImage { src: string; src2x: string; width: number; height: number }

const image = (src: string, src2x: string, d: { width: number; height: number }): BrandImage => ({ src, src2x, ...d });
const H = dimensions['logo-horizontal'];
const V = dimensions['logo-vertical'];
const S = dimensions.symbol;

/** The public marketing origin. Social cards must be absolute and must never point at a preview or local host. */
export const HANGYUL_UNIV_SITE_URL = 'https://univ.talkhangyul.com';

/**
 * The one Hangyul Univ brand definition. Every file is generated from the owner's masters in
 * `packages/icons/assets/brand/hangyul-univ/master/` by `npm run brand:build` — resized and trimmed, never redrawn.
 */
export const HANGYUL_UNIV_BRAND = {
  name: 'Hangyul Univ',
  logoHorizontal: {
    black: image(hBlack, hBlack2x, H), ivory: image(hIvory, hIvory2x, H), orange: image(hOrange, hOrange2x, H),
  } satisfies Record<BrandLogoColor, BrandImage>,
  logoVertical: {
    black: image(vBlack, vBlack2x, V), ivory: image(vIvory, vIvory2x, V), orange: image(vOrange, vOrange2x, V),
  } satisfies Record<BrandLogoColor, BrandImage>,
  /** The cap-and-leaf symbol alone, cropped from the horizontal lockup: collapsed rails, avatars, favicons. */
  symbol: {
    black: image(sBlack, sBlack2x, S), ivory: image(sIvory, sIvory2x, S), orange: image(sOrange, sOrange2x, S),
  } satisfies Record<BrandLogoColor, BrandImage>,
  social: {
    /** Versioned filename: replace the art → bump to `-v2` so link-preview caches refetch. */
    ogPath: '/og/hangyul-univ-og-v1.jpg',
    og: `${HANGYUL_UNIV_SITE_URL}/og/hangyul-univ-og-v1.jpg`,
    ogWidth: 1200,
    ogHeight: 630,
    /** 1024×500 store/profile banner. Not bundled into any app; lives in the brand folder for when a surface needs it. */
    bannerFile: 'packages/icons/assets/brand/hangyul-univ/hangyul-univ-banner-1024x500.jpg',
  },
} as const;

/** Non-logo brand illustration (the Hangyul hand-and-tangerine) used on the student login aside. */
export const brandAssets = { handTangerine };
