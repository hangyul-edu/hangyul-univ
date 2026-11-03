import { buildTransitionBody, decisionSchema } from './decision';
import { rulesDefaults, rulesPayload, rulesSchema } from './rules';

describe('decision form', () => {
  it('requires a date for interviews and a note for document requests', () => {
    expect(decisionSchema.safeParse({ to: 'INTERVIEW' }).success).toBe(false);
    expect(decisionSchema.safeParse({ to: 'ADDITIONAL_DOCUMENTS', note: '  ' }).success).toBe(false);
    expect(decisionSchema.safeParse({ to: 'ADDITIONAL_DOCUMENTS', note: 'Apostilled transcript' }).success).toBe(true);
    expect(decisionSchema.safeParse({ to: 'OFFERED' }).success).toBe(true);
  });

  it('requires a positive tuition amount and a due date', () => {
    expect(decisionSchema.safeParse({ to: 'TUITION_PENDING', tuition_amount_krw: '0', tuition_due: '2026-12-01' }).success).toBe(false);
    expect(decisionSchema.safeParse({ to: 'TUITION_PENDING', tuition_amount_krw: '4429000', tuition_due: '' }).success).toBe(false);
    expect(decisionSchema.safeParse({ to: 'TUITION_PENDING', tuition_amount_krw: '4429000', tuition_due: '2026-12-01' }).success).toBe(true);
  });

  it('sends only the fields relevant to the transition', () => {
    expect(buildTransitionBody({ to: 'OFFERED', offer_scholarship_note: ' 30% waiver ', tuition_amount_krw: '100', note: '' }))
      .toEqual({ to: 'OFFERED', offer_scholarship_note: '30% waiver' });
    expect(buildTransitionBody({ to: 'TUITION_PENDING', tuition_amount_krw: '4429000', tuition_due: '2026-12-01', note: 'Pay by transfer' }))
      .toEqual({ to: 'TUITION_PENDING', tuition_amount_krw: 4429000, tuition_due: '2026-12-01', note: 'Pay by transfer' });
    const iv = buildTransitionBody({ to: 'INTERVIEW', interview_at: '2026-10-10T10:00' });
    expect(iv.interview_at).toMatch(/^2026-10-10T\d\d:00:00\.000Z$/);
  });
});

describe('admission rules form', () => {
  it('validates score ranges and steps', () => {
    const base = rulesDefaults(null);
    expect(rulesSchema.safeParse({ ...base, min_topik_level: '7' }).success).toBe(false);
    expect(rulesSchema.safeParse({ ...base, min_topik_level: '3.5' }).success).toBe(false);
    expect(rulesSchema.safeParse({ ...base, min_ielts: '6.3' }).success).toBe(false);
    expect(rulesSchema.safeParse({ ...base, min_ielts: '6.5', min_gpa_percent: '72.5' }).success).toBe(true);
    expect(rulesSchema.safeParse({ ...base, source_url: 'admissions.example.ac.kr' }).success).toBe(false);
  });

  it('turns blanks into explicit nulls (clearing a minimum)', () => {
    const v = { ...rulesDefaults(null), min_topik_level: '3', notes: '  ', requires_interview: true };
    expect(rulesPayload(v)).toEqual({
      min_gpa_percent: null, min_topik_level: 3, min_ielts: null, min_toefl_ibt: null, min_prior_education: null, language_alternative: false, requires_interview: true, notes: null, source_url: null,
    });
  });
});
