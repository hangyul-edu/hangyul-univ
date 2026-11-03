import type { VisaRouteDoc, VisaRoutePlan } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { amountsLine, docAction, groupDocs, nowDoc, railPhase, trackStage } from './visaroute';

const doc = (key: string, status: VisaRouteDoc['status'], extra: Partial<VisaRouteDoc> = {}): VisaRouteDoc => ({
  key, name_en: key, category: null, requirement: 'REQUIRED', applies: 'yes', condition_code: null, condition_en: null, provided_by: 'student', who: 'you',
  validity_days: null, validity_en: null, legalization: null, translation_en: null, notes_en: null, slow: false, status, reason: { code: status, params: {} },
  reused: false, document: null, timing: null, ...extra,
});

describe('visa route presentation', () => {
  it('places the student on the rail', () => {
    const base = { inputs: { admitted: true, application_status: 'VISA_PREPARATION' }, display_status: 'PREPARING' } as unknown as VisaRoutePlan;
    expect(railPhase({ ...base, case: { display_status: 'PREPARING' } as VisaRoutePlan['case'] })).toBe('visaDocs');
    expect(railPhase({ ...base, case: { display_status: 'SUBMITTED' } as VisaRoutePlan['case'] })).toBe('apply');
    expect(railPhase({ ...base, case: { display_status: 'NEEDS_ATTENTION' } as VisaRoutePlan['case'] })).toBe('decision');
    expect(railPhase({ ...base, inputs: { ...base.inputs, admitted: false, application_status: 'READY' }, case: null })).toBe('admission');
    expect(railPhase({ ...base, inputs: { ...base.inputs, admitted: false, application_status: 'TUITION_PAID' }, case: null })).toBe('admissionDocs');
  });

  it('groups documents by who acts', () => {
    const g = groupDocs([
      doc('passport', 'READY', { reused: true }), doc('tb_test', 'NEW_FOR_VISA'), doc('business_registration', 'WAITING_UNIVERSITY', { who: 'university' }),
      doc('language_certificate', 'READY', { applies: 'maybe' }), doc('other_scholarship_certificate', 'NOT_NEEDED', { applies: 'no' }), doc('bank_balance_certificate', 'GET_LATER'),
    ]);
    expect(g.needsYou.map((d) => d.key)).toEqual(['tb_test']);
    expect(g.waiting.map((d) => d.key)).toEqual(['business_registration', 'bank_balance_certificate']);
    expect(g.ready.map((d) => d.key)).toEqual(['passport']);
    expect(g.maybe.map((d) => d.key)).toEqual(['language_certificate']);
    expect(g.notNeeded.map((d) => d.key)).toEqual(['other_scholarship_certificate']);
  });

  it('offers the right action per document', () => {
    expect(docAction(doc('business_registration', 'WAITING_UNIVERSITY'))).toBe('markReceived');
    expect(docAction(doc('admission_certificate', 'WAITING_UNIVERSITY', { category: 'ADMISSION_LETTER' }))).toBe('upload');
    expect(docAction(doc('application_form', 'FORM'))).toBe('form');
    expect(docAction(doc('bank_balance_certificate', 'NEW_FOR_VISA', { document: { id: 'x' } as VisaRouteDoc['document'] }))).toBe('uploadNew');
    expect(docAction(doc('passport', 'READY'))).toBeNull();
  });

  it('finds the document for "what needs you now"', () => {
    const plan = { next: { key: 'document', params: { doc: 'tb_test' }, who: 'authority' }, documents: [doc('tb_test', 'NEW_FOR_VISA')] } as unknown as VisaRoutePlan;
    expect(nowDoc(plan)?.key).toBe('tb_test');
    expect(nowDoc({ ...plan, next: { key: 'form', params: {}, who: 'you' } })).toBeNull();
  });

  it('knows the tracking stage and keeps stated amounts verbatim', () => {
    expect(trackStage({ case: null })).toBe('none');
    expect(trackStage({ case: { status: 'ADDITIONAL_DOCUMENTS' } as VisaRoutePlan['case'] })).toBe('request');
    expect(trackStage({ case: { status: 'READY_TO_APPLY' } as VisaRoutePlan['case'] })).toBe('before');
    expect(amountsLine(['KRW 20,000,000', 'KRW 16,000,000', 'KRW 20,000,000'])).toBe('KRW 20,000,000 · KRW 16,000,000');
  });
});
