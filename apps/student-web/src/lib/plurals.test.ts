/**
 * "1 documents needed only in some cases" (student page pass, 2026-11): the count goes through i18next plural forms,
 * and every locale the student app offers carries exactly the forms its language needs — no bare key to fall back on.
 */
import { i18next } from '@hangyul/i18n';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['en', 'ko', 'ar', 'bn', 'fil', 'hi', 'id', 'ja', 'kk', 'ky', 'mn', 'my', 'ne', 'ru', 'th', 'tr', 'ur', 'uz', 'vi', 'zh-Hans', 'zh-Hant'];

describe('v27.ws.conditional is pluralised', () => {
  it('reads correctly in English for one and for several', () => {
    expect(i18next.t('student:v27.ws.conditional', { count: 1 })).toBe('1 document needed only in some cases');
    expect(i18next.t('student:v27.ws.conditional', { count: 3 })).toBe('3 documents needed only in some cases');
  });

  it.each(LOCALES)('%s has every plural form its language uses, and no unpluralised key', (locale) => {
    const file = resolve(__dirname, `../../../../packages/i18n/locales/${locale}/student.json`);
    const ws = JSON.parse(readFileSync(file, 'utf8')).v27.ws as Record<string, string>;
    const have = Object.keys(ws).filter((k) => k.startsWith('conditional')).sort();
    const need = new Intl.PluralRules(locale).resolvedOptions().pluralCategories.map((c) => `conditional_${c}`).sort();
    expect(have).toEqual(need);
    for (const k of have) expect(ws[k]).toContain('{{count}}');
  });
});
