/**
 * The student's home band: a licensed photograph of where they are heading — their leading application's campus when we
 * hold a licensed photo of it, otherwise that city, otherwise Seoul.
 *
 * ---------------------------------------------------------------------------------------------------------
 * **V16 recomposed it, and deleted its credit** (REPORT §131, §137).
 *
 * *Composition.* The band used to put the greeting on the right, over the skyline, and darken the empty
 * left. That was not a decision; it was two stylesheets disagreeing. `v7.css` set `align-items: flex-end`
 * on a row — meaning *bottom* — and `v9.css` later set `flex-direction: column` on the same element, which
 * silently turned "bottom" into "right". The composition is now stated once, here and in `v16.css`, as a
 * two-column grid: **words left, photograph right**, with the shade heaviest under the words and clear over
 * the focal subject. The band no longer depends on which stylesheet loads last.
 *
 * *The credit.* Every photograph that ships is CC0 with `attribution_required: false` (V14 media policy —
 * the two CC BY campus photographs were removed rather than captioned). A `사진: author · licence` line
 * floating over the student's home screen therefore stated an obligation that does not exist, in the most
 * expensive position on the page. `npm run qa:media` already forbids that caption in source; it could not
 * see this one because the word came from a locale bundle through a prop. Both the element and the prop are
 * gone, and the gate now checks the rendered DOM as well as the source.
 */
import type { ReactNode } from 'react';

import photos from '../lib/photos.json';

// V14: only attribution-free photography ships (brief Parts 2 and 35). Yonsei's and Kyung Hee's campus
// photographs were CC BY — requiring a visible credit the owner does not want — so they are gone rather than
// stripped of their attribution. A university with no licensed campus photograph falls through to its city.
const CAMPUS: Record<string, string> = { 'seoul-national-university': 'snu-main-gate' };
const CITY: Record<string, string> = { Seoul: 'seoul-han-river-golden-hour' };

export function pickPhoto(uni?: { slug?: string; city?: string | null } | null): string {
  return (uni?.slug && CAMPUS[uni.slug]) || (uni?.city && CITY[uni.city]) || 'seoul-jamsil-lotte-tower-night';
}

export function HomeBand({ slug, children }: { slug: string; children: ReactNode }) {
  const p = (photos as { slug: string; focal_point?: string }[]).find((x) => x.slug === slug);
  return (
    <header className="sh-band">
      {/*
        Art direction, not `cover` (brief Part 2). The focal point in the manifest is biased right — Lotte
        Tower at 66 %, the Han river skyline at 70 % — and `object-position` keeps it there as the band
        narrows, so the subject stays in the half the words leave alone instead of sliding under them.
      */}
      <img className="sh-band__img" src={`/media/${slug}-1200.jpg`} srcSet={`/media/${slug}-640.jpg 640w, /media/${slug}-1200.jpg 1200w`}
        sizes="(min-width: 1120px) 1120px, 100vw" alt="" style={{ objectPosition: p?.focal_point ?? '66% 50%' }} />
      <div className="sh-band__shade" aria-hidden />
      <div className="sh-band__text">{children}</div>
    </header>
  );
}
