/** Icon system: Lucide (ISC license) for UI glyphs + official Hangyul brand marks (copied from the Hangyul BI kit). */
export * from 'lucide-react';

import appleTouch from '../assets/brand/apple-touch-icon.png';
import favicon32 from '../assets/brand/favicon-32.png';
import favicon64 from '../assets/brand/favicon-64.png';
import handTangerine from '../assets/brand/hand-tangerine.webp';
import logoCombined from '../assets/brand/logo-combined.png';
import logoCombined2x from '../assets/brand/logo-combined@2x.png';
import logoCombinedLight from '../assets/brand/logo-combined-light.png';
import logoCombinedLight2x from '../assets/brand/logo-combined-light@2x.png';
import symbol from '../assets/brand/symbol.webp';
import symbol96 from '../assets/brand/symbol-96.png';
import wordmarkEn from '../assets/brand/wordmark-en.png';
import wordmarkKo from '../assets/brand/wordmark-ko.png';

/**
 * V10: `logoCombined` (+ its @2x and light-on-dark variants) is the canonical Hangyul lockup — the mark from the
 * Hangyul BI kit, not a typeset reproduction. `logoCombinedLight` is the same lockup with the #282828 wordmark ink
 * repainted white for dark surfaces; the tangerine symbol is untouched.
 */
export const brandAssets = {
  symbol, symbol96, logoCombined, logoCombined2x, logoCombinedLight, logoCombinedLight2x,
  wordmarkEn, wordmarkKo, handTangerine, favicon32, favicon64, appleTouch,
};
