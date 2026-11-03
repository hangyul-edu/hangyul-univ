import { docLabel, i18next } from '@hangyul/i18n';
import { countryName, formatDate, formatRelative, loadIntlFallback } from '@hangyul/utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { essayTitle, localizeParams, notifyParams } from './i18n';
import { checklistDetail } from './workspace';

const t = i18next.t.bind(i18next) as unknown as (k: string, o?: Record<string, unknown>) => string;

describe('V5 i18n: no English catalogue labels outside English', () => {
  // V9: CLDR fallback data loads per locale on demand (the apps register it as an i18n preloader); the test does the same.
  beforeAll(async () => { await loadIntlFallback('my'); });
  afterEach(async () => { await i18next.changeLanguage('en'); vi.restoreAllMocks(); });

  it('keeps the catalogue label in English and uses the translated category elsewhere', async () => {
    expect(docLabel(t, { label: 'Academic transcript', category: 'TRANSCRIPT' }, 'en')).toBe('Academic transcript');
    expect(docLabel(t, { label: 'Academic transcript', category: 'TRANSCRIPT' }, 'my')).toBe(t('common:docCategory.TRANSCRIPT'));
    expect(docLabel(t, { label: 'Something else', category: 'OTHER' }, 'my')).toBe('Something else');
  });

  it('translates label params, essay titles and notification params', () => {
    expect(localizeParams(t, { label: 'bank balance certificate', category: 'BANK_STATEMENT' })).toEqual({ label: 'bank balance certificate', category: 'BANK_STATEMENT' });
    expect(essayTitle(t, { title: 'Study plan — Pusan National University', essay_type: 'STUDY_PLAN' }, 'en')).toBe('Study plan — Pusan National University');
    expect(essayTitle(t, { title: 'My own title', essay_type: 'STUDY_PLAN' }, 'my')).toBe('My own title');
    expect(notifyParams(t, { document: 'Transcript', category: 'TRANSCRIPT', reason: 'Apostille required' }, 'en').document).toBe('Transcript');
  });

  it('explains checklist actions from codes, quoting a reviewer note', () => {
    const fmt = (d: string) => d;
    expect(checklistDetail(t, { action_code: 'FIX', action: 'x', action_params: { reason: 'Blurry scan' } }, fmt)).toContain('Blurry scan');
    expect(checklistDetail(t, { action_code: 'TOO_OLD', action: 'x', action_params: { university: 'PNU', days: 30, issued: '2026-01-02' } }, fmt)).toContain('30');
    expect(checklistDetail(t, { action_code: 'RENEW', action: 'English fallback', action_params: {} }, fmt)).toBe(t('checklist.action.RENEW'));
    expect(checklistDetail(t, { action_code: 'RENEW', action: 'English fallback' }, fmt)).toBe('English fallback');
  });

  it('formats Burmese dates, relative time and country names when the runtime Intl lacks Burmese', () => {
    // Chromium ships reduced ICU without Burmese; simulate it.
    vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf').mockImplementation((l) => ([] as string[]).concat(l as string).filter((x) => !x.startsWith('my')));
    vi.spyOn(Intl.RelativeTimeFormat, 'supportedLocalesOf').mockImplementation((l) => ([] as string[]).concat(l as string).filter((x) => !x.startsWith('my')));
    vi.spyOn(Intl.DisplayNames, 'supportedLocalesOf').mockImplementation((l) => ([] as string[]).concat(l as string).filter((x) => !x.startsWith('my')));
    const d = formatDate('2026-10-20', 'my');
    expect(d).not.toMatch(/[A-Za-z]/);
    expect(d).toContain('2026');
    expect(formatDate('2026-10-20T09:30:00', 'my', { dateStyle: 'medium', timeStyle: 'short' })).not.toMatch(/[A-Za-z]/);
    expect(formatDate('2026-10-20', 'my', { month: 'short' })).not.toMatch(/[A-Za-z]/);
    expect(formatRelative(new Date(Date.now() - 86_400_000).toISOString(), 'my')).not.toMatch(/[A-Za-z]/);
    expect(countryName('VN', 'my')).not.toMatch(/[A-Za-z]/);
    expect(formatDate('2026-10-20', 'en')).toMatch(/Oct/);
  });
});
