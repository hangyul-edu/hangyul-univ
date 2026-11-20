import { docTitle, errorText, i18next, loadNamespaces, orgName, uniName } from '@hangyul/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import { findingText } from './writing';

/** Owner pass 261119 (req 7): no English reaches a non-English screen through server params. */
describe('server-named values follow the reader', () => {
  afterEach(async () => { await i18next.changeLanguage('en'); });

  it('reads a university in Korean on a Korean screen when the server sent university_ko, official English elsewhere', async () => {
    await loadNamespaces(i18next, 'ko', ['common', 'student']);
    await i18next.changeLanguage('ko');
    const p = { university: 'Pusan National University', university_ko: '부산대학교', university_id: 'x' };
    expect(i18next.t('student:v4.ws.why.needed', p)).toContain('부산대학교');
    expect(uniName(p)).toBe('부산대학교');
    await i18next.changeLanguage('en');
    expect(i18next.t('student:v4.ws.why.needed', p)).toContain('Pusan National University');
    expect(uniName(p)).toBe('Pusan National University');
  });

  it('shows the operations organisation and the staff display name as the localized team identity', async () => {
    await loadNamespaces(i18next, 'ko', ['common']);
    await i18next.changeLanguage('ko');
    expect(orgName('Hangyul Univ Operations')).toBe('한귤 유니브 상담팀');
    expect(orgName('Hangyul Univ Operations', 'staff')).toBe('한귤 유니브 운영팀');
    expect(orgName('Hangyul Univ Team')).toBe('한귤 유니브 상담팀');
    expect(orgName('Lotus Bridge Education')).toBe('Lotus Bridge Education');
    expect(i18next.t('common:notify.agencyAssigned', { agency: 'Hangyul Univ Operations' })).not.toContain('Operations');
    expect(docTitle('Proposed housing contract')).toBe('검토할 임대차 계약서');
    expect(docTitle('My lease.pdf')).toBe('My lease.pdf');
  });

  it('says an API failure in the reader’s language, and keeps the English detail for English readers', async () => {
    await loadNamespaces(i18next, 'ko', ['common']);
    const err = Object.assign(new Error('Document not found'), { status: 404 });
    await i18next.changeLanguage('ko');
    expect(errorText(err)).toBe(i18next.t('common:apiError.notFound'));
    expect(errorText(new Error('local'))).toBe('local');
    await i18next.changeLanguage('en');
    expect(errorText(err)).toBe('Document not found');
  });

  it('builds the length finding from `words` as well as `count` (no English fallback sentence)', async () => {
    await loadNamespaces(i18next, 'ko', ['writing']);
    await i18next.changeLanguage('ko');
    const t = (k: string, o?: Record<string, unknown>) => i18next.t(k, o) as string;
    const s = findingText(t, { code: 'UNDER_LENGTH', params: { words: 84, limit: 1500 }, text: '84 words of 1500 — there is room to say more about your goals.' }, 'ko');
    expect(s).not.toContain('words of');
    expect(s).toContain('84');
  });
});
