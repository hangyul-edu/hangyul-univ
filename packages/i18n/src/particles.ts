/**
 * V26 — Korean particles chosen from the word they follow (REPORT §331 RC-26).
 *
 * Korean particles change with the last sound of the preceding word: 서류**를** but 성적증명서**를**, 비자**가** but
 * 여권**이**. A translation string cannot know which word `{{doc}}` will be, so 20+ strings were written in the form
 * `{{doc}}을(를)` — correct but bureaucratic, the register of a government form, on screens meant to be calm.
 *
 * This resolves the pair after interpolation, from the actual word: `성적증명서을(를)` → `성적증명서를`. It runs for
 * Korean only and touches nothing else; a pair whose preceding word cannot be judged (an emoji, punctuation) is left
 * as written, so the worst case is the old text.
 */

type Pair = { re: RegExp; withFinal: string; without: string; rieulAsNone?: boolean };

// Each pattern: the preceding character (optionally followed by a closing quote/bracket), then the pair in either order.
const PREV = String.raw`([^\s(])([”"’')\]」』]?)`;
const pair = (a: string, b: string) => new RegExp(`${PREV}(?:${a}\\(${b}\\)|${b}\\(${a}\\))`, 'g');
const PAIRS: Pair[] = [
  { re: pair('을', '를'), withFinal: '을', without: '를' },
  { re: pair('이', '가'), withFinal: '이', without: '가' },
  { re: pair('은', '는'), withFinal: '은', without: '는' },
  { re: pair('과', '와'), withFinal: '과', without: '와' },
  { re: pair('이에요', '예요'), withFinal: '이에요', without: '예요' },
  // (으)로: a final ㄹ takes 로, like a vowel.
  { re: new RegExp(`${PREV}\\(으\\)로`, 'g'), withFinal: '으로', without: '로', rieulAsNone: true },
];

// How Latin letters and digits are read aloud in Korean, by whether the reading ends in a final consonant.
// Letters: L(엘) M(엠) N(엔) R(알) end in a consonant; the others end in a vowel. Digits: 0 영, 1 일, 3 삼, 6 육,
// 7 칠, 8 팔, 10 십 end in a consonant; 2 이, 4 사, 5 오, 9 구 do not. Words are judged by their final letter, which
// is right for acronyms (TOPIK → 케이 ✗, read 토픽 ✓ — acronyms read as words are the exception we accept).
const LATIN_FINAL = new Set(['l', 'm', 'n', 'r']);
const LATIN_RIEUL = new Set(['l', 'r']);
const DIGIT_FINAL = new Set(['0', '1', '3', '6', '7', '8']);
const DIGIT_RIEUL = new Set(['1', '7', '8']);

/** `true` = ends in a final consonant, `false` = ends in a vowel, `'rieul'` = ends in ㄹ, `null` = cannot tell. */
export function finalOf(ch: string): boolean | 'rieul' | null {
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return false;
    return jong === 8 ? 'rieul' : true;
  }
  const lower = ch.toLowerCase();
  if (/[a-z]/.test(lower)) return LATIN_RIEUL.has(lower) ? 'rieul' : LATIN_FINAL.has(lower);
  if (/[0-9]/.test(ch)) return DIGIT_RIEUL.has(ch) ? 'rieul' : DIGIT_FINAL.has(ch);
  return null;
}

/** Resolves every `X을(를)`-style pair in a Korean string. Non-Korean text passes through unchanged. */
export function resolveKoreanParticles(text: string): string {
  if (!text.includes('(')) return text;
  let out = text;
  for (const p of PAIRS) {
    // A closing quote or bracket is looked through to the word itself ("서류”을(를)" → 서류”를).
    out = out.replace(p.re, (whole, ch: string, close: string) => {
      const f = finalOf(ch);
      if (f === null) return whole;
      const hasFinal = f === 'rieul' ? !p.rieulAsNone : f;
      return `${ch}${close}${hasFinal ? p.withFinal : p.without}`;
    });
  }
  return out;
}

/** i18next post-processor: Korean only. */
export const koreanParticles = {
  type: 'postProcessor' as const,
  name: 'hgKoParticles',
  process(value: unknown, _key: unknown, _opts: unknown, translator: { language?: string }) {
    if (typeof value !== 'string' || !(translator?.language ?? '').startsWith('ko')) return value;
    return resolveKoreanParticles(value);
  },
};
