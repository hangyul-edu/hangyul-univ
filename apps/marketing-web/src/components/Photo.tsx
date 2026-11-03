/**
 * Photography on a customer surface (V14, brief Parts 2, 38 and 57).
 *
 * Every slug this can render is **attribution-free** — Hangyul-owned or CC0/public domain — so nothing it
 * draws carries a visible credit, a "사진 출처" line or a source link. The rights metadata it reads is still
 * complete and still required: `credits.json` records the licence, the author, the source URL and the date
 * acquired for every asset, because internal provenance is how we can prove compliance later. What changed is
 * that none of it reaches the page.
 *
 * `rights_status` is the field that matters: `HANGYUL_OWNED` or `CC0_PUBLIC_DOMAIN` may ship;
 * `ATTRIBUTION_REQUIRED` and `UNKNOWN` may not, and `scripts/qa/v14-media-licence.mjs` enforces that.
 *
 * Every file exists at 640 / 1200 / 2400 px on the long side under /media/<slug>-<w>.jpg. A slug that also
 * declares `formats` has the same three widths in AVIF and WebP beside the JPEG (scripts/media/encode_modern.py),
 * and is served through a `<picture>` so a modern browser takes the smaller file. A slug without `formats`
 * renders exactly as before — adding a format is opt-in per asset.
 */
import { cx } from '@hangyul/utils';
import type { CSSProperties } from 'react';

import credits from '../media/credits.json';

export interface PhotoCredit {
  slug: string; title: string; subject: string; place: string; orientation: string; width: number; height: number;
  focal_point?: string; license: string; license_url: string; author: string; author_url?: string; source_url: string; retrieved: string;
  /** Internal rights classification. Only the first two may be served; see the module note. */
  rights_status: 'HANGYUL_OWNED' | 'CC0_PUBLIC_DOMAIN' | 'ATTRIBUTION_REQUIRED' | 'UNKNOWN';
  attribution_required: boolean;
  /** V10: supplied by Hangyul rather than licensed from a third party — no external licence or source link exists. */
  owner?: boolean; license_note?: string;
  /** Extra encodings on disk beside the JPEG, best first. See the module note. */
  formats?: string[];
}
export const PHOTO_CREDITS = credits as PhotoCredit[];
const bySlug = new Map(PHOTO_CREDITS.map((c) => [c.slug, c]));

const srcset = (s: string, ext = 'jpg') =>
  `/media/${s}-640.${ext} 640w, /media/${s}-1200.${ext} 1200w, /media/${s}-2400.${ext} 2400w`;

export function Photo({ slug, portrait, alt, className, sizes = '100vw', priority, position, style }: {
  slug: string; portrait?: string; alt: string; className?: string; sizes?: string; priority?: boolean; position?: string; style?: CSSProperties;
}) {
  const c = bySlug.get(slug);
  const src = (w: number) => `/media/${slug}-${w}.jpg`;
  if (portrait) {
    const pc = bySlug.get(portrait);
    return (
      // `--art` is load-bearing: the portrait override in v6.css is scoped to it, so a `<picture>` that exists
      // only to offer AVIF/WebP does not get its `object-position` replaced on a phone.
      <picture className={cx('mk-picture', 'mk-picture--art', className)}>
        <source media="(max-width: 699px) and (orientation: portrait)" srcSet={srcset(portrait)} sizes="100vw" />
        <Photo slug={slug} alt={alt} sizes={sizes} priority={priority} position={position} style={{ ['--mk-portrait-pos' as string]: pc?.focal_point ?? '50% 50%', ...style }} />
      </picture>
    );
  }
  const img = (
    <img
      className={cx('mk-photo', className)}
      src={src(1200)}
      srcSet={srcset(slug)}
      sizes={sizes}
      alt={alt}
      width={c?.width}
      height={c?.height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={{ objectPosition: position ?? c?.focal_point ?? '50% 50%', ...style }}
    />
  );
  if (!c?.formats?.length) return img;
  return (
    <picture className={cx('mk-picture', className)}>
      {c.formats.map((ext) => (
        <source key={ext} type={`image/${ext}`} srcSet={srcset(slug, ext)} sizes={sizes} />
      ))}
      {img}
    </picture>
  );
}
