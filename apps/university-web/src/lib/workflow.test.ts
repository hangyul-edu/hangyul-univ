import type { Program } from '@hangyul/types';

import { parseApplicantParams } from './filters';
import { VISIBLE_STATUSES } from './permissions';
import { awaitingDecision, CLOSED_STATUSES, documentsText, STAGES, stageFilter, stageFor, stageOf, upcomingDates, withStage } from './workflow';

const t = ((k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k)) as never;

describe('V22 workflow stages', () => {
  it('covers every visible status exactly once (closed statuses are a count, not a stage)', () => {
    const seen = new Map<string, number>();
    STAGES.forEach((s) => s.status.forEach((st) => seen.set(`${st}|${s.admin_check ?? ''}`, (seen.get(`${st}|${s.admin_check ?? ''}`) ?? 0) + 1)));
    // SUBMITTED is split by the administrative check (done / pending): two disjoint halves of one status.
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    const covered = new Set([...STAGES.flatMap((s) => s.status), ...CLOSED_STATUSES]);
    expect([...covered].sort()).toEqual([...VISIBLE_STATUSES].sort());
    expect(STAGES.filter((s) => s.status.includes('SUBMITTED')).map((s) => s.admin_check).sort()).toEqual(['done', 'pending']);
  });

  it('turns a stage into the list filter the strip counts with', () => {
    expect(stageFilter('in_review')).toEqual({ status: ['UNIVERSITY_REVIEW', 'INTERVIEW'] });
    expect(stageFilter('documents_check')).toEqual({ status: ['SUBMITTED'], admin_check: 'pending' });
    expect(stageFilter(null)).toEqual({ status: [] });
  });

  it('applies the URL stage over any status the URL also carried', () => {
    const p = parseApplicantParams(new URLSearchParams('stage=admitted&status=REJECTED&intake=2027-SPRING'));
    expect(p.stage).toBe('admitted');
    expect(withStage(p).status).toEqual(['OFFERED', 'OFFER_ACCEPTED']);
    expect(withStage(p).intake).toBe('2027-SPRING');
    expect(parseApplicantParams(new URLSearchParams('stage=nope')).stage).toBeUndefined();
  });

  it('maps an explicit status filter back to its stage, independent of order', () => {
    expect(stageFor(['INTERVIEW', 'UNIVERSITY_REVIEW'])).toBe('in_review');
    expect(stageFor(['SUBMITTED'], 'pending')).toBe('documents_check');
    expect(stageFor(['SUBMITTED'])).toBeNull();
    expect(stageFor(['REJECTED'])).toBeNull();
    expect(stageFor([])).toBeNull();
  });

  it('places one application', () => {
    expect(stageOf({ status: 'ENROLLED' })).toBe('enrolled');
    expect(stageOf({ status: 'WITHDRAWN' })).toBe('closed');
    expect(stageOf({ status: 'SUBMITTED', admin_check: null })).toBe('documents_check');
    expect(stageOf({ status: 'SUBMITTED', admin_check: { checked_at: 'x' } })).toBe('received');
  });
});

describe('applicant list helpers', () => {
  it('describes documents as what was verified or requested, never a percentage', () => {
    expect(documentsText({ status: 'ENROLLED', open_document_requests: 0, returned_document_requests: 0, documents: { required: 8, verified: 8, shared: 8 } }, t)).toContain('"verified":8');
    expect(documentsText({ status: 'ADDITIONAL_DOCUMENTS', open_document_requests: 3, documents: { required: 7, verified: 7, shared: 7 } } as never, t)).toContain('requested');
  });
  it('shows eligibility flags only before a decision', () => {
    expect(awaitingDecision('UNIVERSITY_REVIEW')).toBe(true);
    expect(awaitingDecision('ENROLLED')).toBe(false);
    expect(awaitingDecision('OFFERED')).toBe(false);
  });
});

describe('upcomingDates', () => {
  it('groups one date shared by several programs and ignores past / far dates', () => {
    const intake = (d: string) => ({ year: 2027, term: 'SPRING', application_deadline: d, document_deadline: null, decision_date: null, tuition_deadline: null, semester_start: null });
    const programs = [
      { intakes: [intake('2026-10-20')] },
      { intakes: [intake('2026-10-20')] },
      { intakes: [intake('2026-09-01')] },
      { intakes: [intake('2027-09-01')] },
    ] as unknown as Program[];
    const out = upcomingDates(programs, new Date('2026-10-01T00:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-10-20', kind: 'application_deadline', intake: '2027-SPRING', programs: 2 });
  });
});
