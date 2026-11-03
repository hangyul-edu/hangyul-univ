import type { AdmissionsFunnel } from '@hangyul/types';

import { segmentCell } from '../components/FunnelComparison';
import { requirementLines } from '../lib/rules';
import { decisionPlan, eligibilityRows } from './ApplicationDetail';
import { funnelRate } from './Analytics';

const t = ((k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k)) as never;

describe('funnelRate', () => {
  const f = { steps: [{ key: 'OFFERED', count: 4, conversion: null }, { key: 'ENROLLED', count: 3, conversion: null }], rejected: 0, withdrawn: 0, total: 4, min_denominator: 5 } as AdmissionsFunnel;
  it('withholds rates below the minimum sample', () => {
    expect(funnelRate(f, 'ENROLLED', 'OFFERED')).toEqual({ numerator: 3, denominator: 4, value: null });
    expect(funnelRate(f, 'ENROLLED', 'OFFERED', 2).value).toBe(0.75);
  });
});

describe('eligibilityRows', () => {
  const req = { min_prior_education: null, min_gpa_percent: 70, min_topik_level: 3, min_ielts: 6, min_toefl_ibt: null, language_alternative: true, requires_interview: true, requires_portfolio: false, notes: null } as never;
  it('compares minimums with the applicant and treats alternative language tests as either-or', () => {
    const prof = { nationality: 'VN', residence_country: 'VN', education: [{ level: 'HIGH_SCHOOL', institution: 'X', country: 'VN', gpa_percent: 65, graduation_status: 'GRADUATED' }], languages: [{ test: 'IELTS', score: 6.5, is_planned: false, verified: true }] } as never;
    const rows = eligibilityRows(req, prof, t);
    expect(rows.find((r) => r.key === 'gpa')?.verdict).toBe('below');
    expect(rows.find((r) => r.key === 'ielts')?.verdict).toBe('meets');
    expect(rows.find((r) => r.key === 'topik')?.verdict).toBe('info');
    expect(rows.find((r) => r.key === 'interview')?.verdict).toBe('info');
  });
  it('says "not provided" instead of guessing', () => {
    const rows = eligibilityRows(req, { nationality: null, residence_country: null, education: [], languages: [] } as never, t);
    expect(rows.find((r) => r.key === 'gpa')?.verdict).toBe('missing');
  });
});

// ------------------------------------------------------------------ V4

describe('V4 decision plan', () => {
  it('has one primary action per state', () => {
    expect(decisionPlan('SUBMITTED', ['UNIVERSITY_REVIEW'], { openRequests: 0, canRequest: true }).primary).toBe('UNIVERSITY_REVIEW');
    const review = decisionPlan('UNIVERSITY_REVIEW', ['ADDITIONAL_DOCUMENTS', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED'], { openRequests: 0, canRequest: true });
    expect(review.primary).toBe('OFFERED');
    expect(review.secondary[0]).toBe('REQUEST');
    expect(review.secondary[review.secondary.length - 1]).toBe('REJECTED');
    expect(decisionPlan('ADDITIONAL_DOCUMENTS', ['UNIVERSITY_REVIEW'], { openRequests: 2, canRequest: true }).primary).toBeNull();
    expect(decisionPlan('ADDITIONAL_DOCUMENTS', ['UNIVERSITY_REVIEW'], { openRequests: 0, canRequest: true }).primary).toBe('UNIVERSITY_REVIEW');
    expect(decisionPlan('OFFERED', [], { openRequests: 0, canRequest: false })).toEqual({ primary: null, secondary: [] });
  });
});

describe('V4 requirements', () => {
  it('shows the applicant language score even when no minimum is published, plus financial proof', () => {
    const req = { min_prior_education: 'HIGH_SCHOOL', min_gpa_percent: null, min_topik_level: null, min_ielts: null, min_toefl_ibt: null, language_alternative: false, requires_interview: true, requires_portfolio: false, notes: null } as never;
    const prof = { nationality: 'IN', residence_country: 'IN', education: [{ level: 'HIGH_SCHOOL', institution: 'X', country: 'IN', gpa_percent: 76, graduation_status: 'GRADUATED' }], languages: [{ test: 'TOPIK', score: 5, is_planned: false, verified: false }] } as never;
    const checklist = [{ requirement_id: 'r', category: 'BANK_STATEMENT', label: 'Bank balance certificate', required: true, status: 'VERIFIED', ready: true }] as never;
    const rows = eligibilityRows(req, prof, t, { checklist });
    expect(rows.map((r) => r.key)).toEqual(['education', 'language', 'interview', 'financial']);
    expect(rows.find((r) => r.key === 'education')?.verdict).toBe('meets');
    expect(rows.find((r) => r.key === 'language')?.applicant).toContain('TOPIK 5');
    expect(rows.find((r) => r.key === 'financial')?.verdict).toBe('meets');
  });
  it('writes plain-language requirement lines', () => {
    const lines = requirementLines({ min_gpa_percent: 65, min_topik_level: 3, requires_interview: false } as never, t);
    expect(lines.some((l) => l.includes('v4.req.gpa'))).toBe(true);
    expect(lines.some((l) => l.includes('v4.req.topik'))).toBe(true);
  });
});

describe('V4 segment comparison', () => {
  it('uses one population and withholds small-sample rates', () => {
    const f = { steps: [{ key: 'SUBMITTED', count: 3 }, { key: 'OFFERED', count: 1 }], min_denominator: 5 } as never;
    expect(segmentCell(f, 'OFFERED')).toEqual({ count: 1, base: 3, rate: null });
    const g = { steps: [{ key: 'SUBMITTED', count: 10 }, { key: 'OFFERED', count: 4 }], min_denominator: 5 } as never;
    expect(segmentCell(g, 'OFFERED').rate).toBe(0.4);
  });
});
