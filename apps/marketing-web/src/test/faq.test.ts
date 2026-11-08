/**
 * Homepage FAQ shape (2026-11-09 designer feedback).
 *
 * The employment-after-graduation question was removed from the canonical data in every locale — not hidden — so
 * the FAQ ends at q9. `Questions()` in pages/home/v11.tsx renders `v11.faq.q1…q9`; a locale missing one of those
 * would render a raw key, and a leftover q10 would be a dead translation.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/i18n/locales');
const bundles = readdirSync(LOCALES)
  .filter((d) => !d.startsWith('_'))
  .map((loc) => {
    try {
      return [loc, JSON.parse(readFileSync(join(LOCALES, loc, 'marketing.json'), 'utf8'))] as const;
    } catch {
      return null;
    }
  })
  .filter((x): x is readonly [string, any] => x !== null && x[1]?.v11?.faq);

describe('homepage FAQ', () => {
  it('has bundles to check', () => {
    expect(bundles.map(([l]) => l)).toEqual(expect.arrayContaining(['en', 'ko', 'ru']));
  });

  it.each(bundles)('%s: no employment question (q10) remains', (_loc, b) => {
    expect(Object.keys(b.v11.faq)).not.toContain('q10');
  });

  it('en and ko carry all nine questions and answers', () => {
    for (const [loc, b] of bundles.filter(([l]) => l === 'en' || l === 'ko')) {
      for (let i = 1; i <= 9; i++) {
        expect(b.v11.faq[`q${i}`]?.q, `${loc} q${i}.q`).toBeTruthy();
        expect(b.v11.faq[`q${i}`]?.a, `${loc} q${i}.a`).toBeTruthy();
      }
    }
  });

  it('English copy no longer carries the flagged wording', () => {
    const en = JSON.stringify(bundles.find(([l]) => l === 'en')![1].v11);
    expect(en).not.toMatch(/find a job in Korea/);
    expect(en).not.toMatch(/no minimum grade/);
    expect(en).not.toMatch(/3\.5 on a 4\.5/);
  });
});
