import type { WritingFinding, WritingStatusLine } from '@hangyul/types';
import { describe, expect, it } from 'vitest';

import { canDecide, findingText, marginOrder, pendingSuggestions, reviewerName, statusSentence, studentFindings, suggestionApplies, usedByLine, type V6Comment } from './writing';

const t = (k: string, o?: Record<string, unknown>) => `${k}${o ? ` ${JSON.stringify(Object.fromEntries(Object.entries(o).filter(([key]) => key !== 'defaultValue')))}` : ''}`;
const fmt = (iso: string) => iso.slice(0, 10);
const line = (p: Partial<WritingStatusLine>): WritingStatusLine => ({ code: 'REVIEWING', reviewer: { name: 'Long', kind: 'AGENCY', org: 'Lotus' }, submitted_at: '2026-09-28T10:00:00Z', expected_by: '2026-09-30T10:00:00Z', round: 1, ...p });

describe('statusSentence', () => {
  it('names the reviewer, submission and expected time', () => {
    const s = statusSentence(t, line({}), fmt)!;
    expect(s.text).toContain('writing:sl.REVIEWING');
    expect(s.text).toContain('2026-09-30');
    expect(s.tone).toBe('info');
  });
  it('says "flagged" only when the server escalated', () => {
    expect(statusSentence(t, line({ code: 'LATE' }), fmt)!.text).toContain('writing:sl.LATE ');
    expect(statusSentence(t, line({ code: 'LATE_FLAGGED', flagged_to: 'Lotus', flagged_to_kind: 'AGENCY' }), fmt)!.text).toContain('LATE_FLAGGED');
    expect(statusSentence(t, line({ code: 'LATE_FLAGGED', flagged_to: 'Hangyul Univ', flagged_to_kind: 'HANGYUL' }), fmt)!.text).toContain('LATE_FLAGGED_HANGYUL');
  });
  // V22 (REPORT §246 A3): a staff reviewer reaches the student as the team — the localised team name, never a person.
  it('names the Hangyul team, not a person, when the server serves the team identity', () => {
    const team = { name: 'Hangyul Univ Team', kind: 'AGENCY' as const, org: 'Lotus Bridge Education', display: 'team' } as WritingStatusLine['reviewer'];
    expect(reviewerName(t, team)).toBe('writing:student.reviewerAgency {"name":"student:messages.team","org":"Lotus Bridge Education"}');
    expect(reviewerName(t, { name: 'Hangyul Univ Team', kind: 'HANGYUL', org: null })).toBe('student:messages.team');
    expect(reviewerName(t, { name: 'Long', kind: 'AGENCY', org: 'Lotus' })).toBe('writing:student.reviewerAgency {"name":"Long","org":"Lotus"}');
    expect(statusSentence(t, line({ reviewer: team }), fmt)!.text).not.toContain('Hangyul Univ Team');
  });

  it('is silent for drafts', () => {
    expect(statusSentence(t, line({ code: 'DRAFT' }), fmt)).toBeNull();
  });
});

const f = (p: Partial<WritingFinding>): WritingFinding => ({
  id: 'x', kind: 'FACT', code: 'FACT_GRAD_YEAR', severity: 'BLOCKER', params: { profile_expected: true, profile_year: 2027 }, text: 'fallback', quote: 'I graduated in 2024.',
  anchor_start: 0, anchor_end: 20, status: 'OPEN', version: 1, staff_only: false, resolved_note: null, auto_resolved: false, source: 'AUTOMATIC_CHECK', ...p,
});

describe('findings for students', () => {
  it('picks the expected-graduation wording', () => {
    expect(findingText(t, f({}))).toContain('writing:finding.FACT_GRAD_YEAR_expected');
  });
  it('falls back to the server text when a key is missing', () => {
    const miss = (k: string) => k;
    expect(findingText((k) => (k.startsWith('writing:') ? `{{x}}` : miss(k)), f({}))).toBe('fallback');
  });
  it('never shows staff-only or closed findings, and puts fact checks first', () => {
    const r = studentFindings([f({ id: 'a' }), f({ id: 'b', kind: 'SIMILARITY', staff_only: true }), f({ id: 'c', kind: 'LIMIT', code: 'OVER_LIMIT' }), f({ id: 'd', status: 'RESOLVED' })]);
    expect(r.facts.map((x) => x.id)).toEqual(['a']);
    expect(r.other.map((x) => x.id)).toEqual(['c']);
  });
});

describe('V6 student writing helpers', () => {
  const c = (p: Partial<V6Comment>): V6Comment => ({ id: 'x', version: 1, author: null, anchor_start: null, anchor_end: null, quote: null, body: 'b', suggestion: null,
    visibility: 'PARTICIPANTS', resolved: false, at: '2026-10-01T00:00:00Z', ...p });

  it('decides on suggestions only while the text is with the student', () => {
    expect(canDecide('CHANGES_REQUESTED')).toBe(true);
    expect(canDecide('STUDENT_REVISION')).toBe(true);
    expect(canDecide('AGENCY_REVIEW')).toBe(false);
    expect(canDecide('APPROVED')).toBe(false);
  });

  it('orders the margin like the text and lists pending suggestions', () => {
    const body = 'First line. Second line.';
    const list = [c({ id: 'g' }), c({ id: 's', quote: 'Second' }), c({ id: 'f', quote: 'First', anchor_start: 0 })];
    expect(marginOrder(body, list).map((x) => x.id)).toEqual(['f', 's', 'g']);
    const ss = [c({ id: 'p', suggestion: 'x' }), c({ id: 'a', suggestion: 'y', suggestion_state: 'ACCEPTED', resolved: true }), c({ id: 'n' })];
    expect(pendingSuggestions(ss).map((x) => x.id)).toEqual(['p']);
    expect(suggestionApplies(body, { quote: 'Second', suggestion: 'Next' })).toBe(true);
    expect(suggestionApplies(body, { quote: 'Gone', suggestion: 'Next' })).toBe(false);
  });

  it('says which version the application uses', () => {
    expect(usedByLine(t, { application_id: 'a', university: 'KNU', program: null, application_status: 'DRAFT', approved_version: 3, newer_draft: false })).toContain('writing:student6.usedBy');
    expect(usedByLine(t, { application_id: 'a', university: 'KNU', program: null, application_status: 'DRAFT', approved_version: 3, newer_draft: true })).toContain('usedByNewer');
    expect(usedByLine(t, { application_id: 'a', university: 'KNU', program: null, application_status: 'DRAFT', approved_version: null, newer_draft: false })).toContain('notApprovedYet');
  });

  it('formats the cross-application conflict with the other essay', () => {
    const f = { code: 'CROSS_APP_CONFLICT', params: { topic: 'TOPIK', claim: 'TOPIK 4', other: 'TOPIK 3', other_type: 'STUDY_PLAN', other_university: 'PNU' }, text: 'fallback' };
    const out = findingText(t, f as never);
    expect(out).toContain('"otherLabel":"common:essayType.STUDY_PLAN · PNU"');
    expect(out).toContain('"topicLabel":"writing:topic.TOPIK');
  });
});
