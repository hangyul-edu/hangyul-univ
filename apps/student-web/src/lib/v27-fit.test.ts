// V27 (REPORT §356, brief §45): the quick-fit answers survive the URL round trip into registration, GPA keeps its own
// scale, and the shared workflow vocabulary says one thing per document and one stage per case.
import { describe, expect, it } from 'vitest';
import { EMPTY_FIT_ANSWERS, fitComplete, fitGpa, fitParams, normaliseGpa, readFitAnswers, STUDY_LEVELS } from '@hangyul/types';
import { caseStage, requirementIssue } from '@hangyul/utils';

import { readFit, readQuick } from './quick';

describe('quick-fit answers', () => {
  it('offers doctorate and the integrated programme', () => {
    expect(STUDY_LEVELS).toContain('DOCTORATE');
    expect(STUDY_LEVELS).toContain('COMBINED');
  });

  it('round-trips every answer through the URL, and the registration reader sees the level', () => {
    const a = { ...EMPTY_FIT_ANSWERS, nationality: 'UZ', level: 'MASTER' as const, gpa: '3.60', gpaScale: '4.5',
      languages: [{ test: 'TOPIK' as const, score: 4 }, { test: 'IELTS_ACADEMIC' as const, score: 6.5 }] };
    const sp = fitParams(a);
    sp.set('lang', 'uz');
    const back = readFitAnswers(new URLSearchParams(sp.toString()));
    expect(back).toEqual({ ...a, noLanguage: false });
    expect(new URLSearchParams(sp.toString()).get('lang')).toBe('uz');
    expect(readQuick(new URLSearchParams(sp.toString())).degree).toBe('MASTER');
    expect(readFit(new URLSearchParams(sp.toString())).languages).toHaveLength(2);
  });

  it('keeps "no language result" as an answer, distinct from not answered', () => {
    const none = readFitAnswers(new URLSearchParams('nationality=VN&level=BACHELOR&gpa=8&gpa_scale=10&langs=none'));
    expect(none.noLanguage).toBe(true);
    expect(fitComplete(none)).toBe(true);
    expect(fitComplete({ ...none, noLanguage: false })).toBe(false);
  });

  it('rejects out-of-range and unknown tests from a hand-edited URL', () => {
    const r = readFitAnswers(new URLSearchParams('langs=TOPIK:9,FOO:3,TOEFL_IBT:200,IELTS_ACADEMIC:7'));
    expect(r.languages).toEqual([{ test: 'IELTS_ACADEMIC', score: 7 }]);
  });

  it('normalises GPA on its own scale, including a custom maximum, and refuses a value above it', () => {
    expect(normaliseGpa(3.6, 4.5)).toBe(80);
    expect(normaliseGpa(16, 20)).toBe(80);
    expect(normaliseGpa(5.25, 7)).toBe(75);
    expect(normaliseGpa(4.6, 4.5)).toBeNull();
    expect(fitGpa({ ...EMPTY_FIT_ANSWERS, gpa: '4.6', gpaScale: '4.5' })).toBeNull();
    expect(fitGpa({ ...EMPTY_FIT_ANSWERS, gpa: '85', gpaScale: '100' })).toEqual({ value: 85, scale_max: 100 });
  });

  it('does not require GPA for the Korean-language route', () => {
    expect(fitComplete({ ...EMPTY_FIT_ANSWERS, nationality: 'MN', level: 'LANGUAGE', noLanguage: true })).toBe(true);
  });
});

describe('V27 workflow vocabulary', () => {
  const tr = (legalization: string, extra: Record<string, unknown> = {}) => ({
    legalization, legalization_done: false, translation: false, notarization: false, country: 'VN', country_basis: 'document', ...extra,
  }) as never;

  it('names the one current issue of a document', () => {
    expect(requirementIssue({ status: 'MISSING', document_id: null, ready: false })).toEqual({ issue: 'UPLOAD', party: 'student' });
    expect(requirementIssue({ status: 'VERIFIED', document_id: 'd', ready: false, treatment: tr('APOSTILLE') }).issue).toBe('APOSTILLE');
    expect(requirementIssue({ status: 'VERIFIED', document_id: 'd', ready: false, treatment: tr('CONSULAR') }).issue).toBe('CONSULAR');
    expect(requirementIssue({ status: 'NEEDS_REVIEW', document_id: 'd', ready: false, treatment: tr('NONE') })).toEqual({ issue: 'IN_REVIEW', party: 'agency' });
    expect(requirementIssue({ status: 'VERIFIED', document_id: 'd', ready: false, treatment: tr('NONE', { translation: true }) }).issue).toBe('TRANSLATION');
    expect(requirementIssue({ status: 'VERIFIED', document_id: 'd', ready: true, treatment: tr('NONE') }).issue).toBe('ORIGINAL_CHECKED');
    expect(requirementIssue({ status: 'VERIFIED', document_id: 'd', ready: true, treatment: tr('APOSTILLE', { legalization_done: true }) }).issue).toBe('DONE');
  });

  it('maps statuses to seven stages without new states and takes the furthest active one', () => {
    expect(caseStage([])).toEqual({ stage: 'CONSULT', index: 0 });
    expect(caseStage(['DRAFT', 'UNIVERSITY_REVIEW']).stage).toBe('REVIEW');
    expect(caseStage(['REJECTED', 'WITHDRAWN']).stage).toBe('CONSULT');
    expect(caseStage(['VISA_SUBMITTED', 'OFFERED']).stage).toBe('VISA');
    expect(caseStage(['ENROLLED']).stage).toBe('ARRIVAL');
  });
});
