import { HANGYUL_UNIV_BRAND } from '@hangyul/icons';
import type { CSSProperties } from 'react';

/**
 * V22 (REPORT §246 A3): the Hangyul team's avatar is the brand mark, small and restrained — white disc, hairline
 * ring, the Hangyul Univ cap-and-leaf symbol inside. It replaces the initials avatar wherever a staff member used to be shown.
 */
export function TeamAvatar({ size = 36 }: { size?: number }) {
  return (
    <span className="hg-avatar v22-team-avatar" style={{ '--s': `${size}px` } as CSSProperties} aria-hidden>
      <img src={HANGYUL_UNIV_BRAND.symbol.orange.src} srcSet={`${HANGYUL_UNIV_BRAND.symbol.orange.src} 1x, ${HANGYUL_UNIV_BRAND.symbol.orange.src2x} 2x`} alt="" width={Math.round(size * 0.58)} height={Math.round(size * 0.52)} />
    </span>
  );
}
