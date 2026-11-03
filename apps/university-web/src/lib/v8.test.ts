import { describe, expect, it } from 'vitest';

import { readiness } from '../pages/ApplicationDetail';
import { effectiveIntake } from '../pages/Programs';
import { activeChips, applicantsLink, parseApplicantParams, writeApplicantParams } from './filters';
import { decisionNeed, summarizeBulk } from './v8';

const base = { eligibility: null, documents: { required: 3, verified: 3, shared: 3 }, open_document_requests: 0, returned_document_requests: 0 };

describe('decisionNeed — what a decision on this row needs now', () => {
  it('says nothing once decided', () => {
    expect(decisionNeed({ ...base, status: 'OFFERED' }).kind).toBe('decided');
    expect(decisionNeed({ ...base, status: 'ENROLLED', open_document_requests: 2 }).kind).toBe('decided');
  });
  it('orders: applicant owes documents → returned → below → check → unverified → interview → ready', () => {
    expect(decisionNeed({ ...base, status: 'ADDITIONAL_DOCUMENTS', open_document_requests: 2 })).toEqual({ kind: 'waiting_applicant', count: 2 });
    expect(decisionNeed({ ...base, status: 'ADDITIONAL_DOCUMENTS', returned_document_requests: 1 })).toEqual({ kind: 'returned', count: 1 });
    expect(decisionNeed({ ...base, status: 'UNIVERSITY_REVIEW', eligibility: { status: 'BELOW', below: ['topik'], unknown: [] } })).toEqual({ kind: 'below', items: ['topik'] });
    expect(decisionNeed({ ...base, status: 'UNIVERSITY_REVIEW', eligibility: { status: 'TO_CHECK', below: [], unknown: ['gpa'] } })).toEqual({ kind: 'check', items: ['gpa'] });
    expect(decisionNeed({ ...base, status: 'SUBMITTED', documents: { required: 4, verified: 1, shared: 4 } })).toEqual({ kind: 'unverified', count: 3 });
    expect(decisionNeed({ ...base, status: 'INTERVIEW' }).kind).toBe('interview');
    expect(decisionNeed({ ...base, status: 'UNIVERSITY_REVIEW', eligibility: { status: 'MEETS', below: [], unknown: [] } }).kind).toBe('ready');
  });
});

describe('summarizeBulk — per-item results', () => {
  it('separates changed, unchanged and failures by reason', () => {
    const s = summarizeBulk([
      { id: 'a', ok: true, result: 'checked' }, { id: 'b', ok: true, result: 'unchanged' },
      { id: 'c', ok: false, error: 'not_found' }, { id: 'd', ok: false, error: 'not_requestable' }, { id: 'e', ok: false, error: 'not_found' },
    ]);
    expect(s).toMatchObject({ succeeded: 2, changed: 1, unchanged: 1, failed: 3 });
    expect(s.failures).toEqual({ not_found: ['c', 'e'], not_requestable: ['d'] });
  });
});

describe('applicant params (V8 drill-down filters)', () => {
  it('round-trips intake, degree, reviewer, admin check, reached and the V22 stage (the board view is gone)', () => {
    const p = parseApplicantParams(new URLSearchParams('intake=2027-spring&degree=master&reviewer=me&admin_check=done&reached=offered&view=board&status=SUBMITTED'));
    expect(p).toMatchObject({ intake: '2027-SPRING', degree: 'MASTER', reviewer: 'me', admin_check: 'done', reached: 'OFFERED', status: ['SUBMITTED'] });
    expect(p).not.toHaveProperty('view');
    expect(parseApplicantParams(new URLSearchParams('stage=in_review&view=board')).stage).toBe('in_review');
    const again = parseApplicantParams(writeApplicantParams(p));
    expect(again).toMatchObject({ intake: '2027-SPRING', degree: 'MASTER', reviewer: 'me', admin_check: 'done', reached: 'OFFERED' });
  });
  it('accepts one intake id, drops malformed values', () => {
    const id = '7239ce74-08a1-4450-be50-f8f07a56cd41';
    expect(parseApplicantParams(new URLSearchParams(`intake=${id}`)).intake).toBe(id);
    const bad = parseApplicantParams(new URLSearchParams('intake=2027&degree=WIZARD&reviewer=x;drop&admin_check=maybe&reached=HIRED&view=grid'));
    expect(bad).toMatchObject({ intake: undefined, degree: undefined, reviewer: undefined, admin_check: undefined, reached: undefined, stage: undefined });
  });
  it('lists active filters as chips (status is the tab, not a chip)', () => {
    const p = parseApplicantParams(new URLSearchParams('status=OFFERED&intake=2027-SPRING&nationality=VN&flagged=true'));
    expect(activeChips(p)).toEqual(['intake', 'nationality', 'flagged']);
    expect(applicantsLink({ intake: '2027-SPRING', reached: 'ENROLLED' })).toBe('/applicants?intake=2027-SPRING&reached=ENROLLED');
  });
});

describe('review readiness', () => {
  it('is ready only with no open, missing or below items', () => {
    expect(readiness([{ verdict: 'meets' }, { verdict: 'doc', docStatus: 'VERIFIED' }], 0)).toEqual({ ready: true, open: 0, below: 0 });
    expect(readiness([{ verdict: 'meets' }, { verdict: 'doc', docStatus: 'UPLOADED' }], 0)).toMatchObject({ ready: false, open: 1 });
    expect(readiness([{ verdict: 'below' }, { verdict: 'none' }], 1)).toMatchObject({ ready: false, open: 1, below: 1 });
  });
});

describe('effectiveIntake', () => {
  const mk = (y: number, term: string, deadline: string, is_open = true) => ({ id: `${y}${term}`, year: y, term, application_deadline: deadline, is_open }) as never;
  const intakes = [mk(2026, 'FALL', '2026-05-31', false), mk(2027, 'SPRING', '2026-11-30'), mk(2027, 'FALL', '2027-05-31')];
  it('is the first intake whose deadline is after the rules took effect', () => {
    expect((effectiveIntake(intakes, '2026-07-01') as { id: string }).id).toBe('2027SPRING');
    expect((effectiveIntake(intakes, '2026-01-01') as { id: string }).id).toBe('2026FALL');
    expect(effectiveIntake(intakes, '2028-01-01')).toBeUndefined();
  });
});
