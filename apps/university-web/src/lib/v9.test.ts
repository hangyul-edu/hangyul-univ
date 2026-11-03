import { describe, expect, it } from 'vitest';

import { decisionPlanV9 } from '../pages/ApplicationDetail';
import { analyticsTab, canSelectAllMatching, handoverTargets, impactView, listFilters } from './v9';

describe('V9 select all matching', () => {
  it('is offered only when the whole page is selected and more rows match', () => {
    expect(canSelectAllMatching(20, 20, 57)).toBe(true);
    expect(canSelectAllMatching(19, 20, 57)).toBe(false);
    expect(canSelectAllMatching(20, 20, 20)).toBe(false);
    expect(canSelectAllMatching(0, 0, 0)).toBe(false);
  });
  it('sends exactly the list filters (no empty values, default sort)', () => {
    expect(listFilters({ status: [], q: '', intake: '2027-SPRING', eligibility: 'MEETS' })).toEqual({ intake: '2027-SPRING', eligibility: 'MEETS', sort: 'submitted' });
  });
});

describe('V9 impact view', () => {
  it('never shows a number when a counted profile lacks the data', () => {
    expect(impactView({ applies: true, dimensions: ['GPA'], definition: '', population: { total: 5, saved: 0, active_applications: 1, strong_or_competitive: 4 }, estimate: null, insufficient: { profiles: 2, of: 5, missing: { GPA: 2 } } }))
      .toEqual({ kind: 'insufficient', profiles: 2, of: 5, fields: ['GPA'] });
    expect(impactView({ applies: true, dimensions: ['LANGUAGE'], definition: '', population: { total: 5, saved: 0, active_applications: 0, strong_or_competitive: 5 }, estimate: { would_stop: 3, would_start: 0 }, insufficient: null }))
      .toEqual({ kind: 'estimate', stop: 3, start: 0, total: 5 });
    expect(impactView({ applies: false, dimensions: [], definition: '' }).kind).toBe('none');
    expect(impactView({ applies: true, dimensions: ['GPA'], definition: '', population: { total: 0, saved: 0, active_applications: 0, strong_or_competitive: 0 }, estimate: { would_stop: 0, would_start: 0 } }).kind).toBe('empty');
  });
});

describe('V9 hand-over targets', () => {
  it('excludes inactive members and the person leaving — never by role (V22)', () => {
    const team = [
      { user_id: 'a', full_name: 'A', role: 'UNIVERSITY_REVIEWER', title: null, is_active: true },
      { user_id: 'b', full_name: 'B', role: 'UNIVERSITY_ANALYST', title: null, is_active: true },
      { user_id: 'c', full_name: 'C', role: 'UNIVERSITY_ADMISSIONS', title: null, is_active: false },
      { user_id: 'd', full_name: 'D', role: 'UNIVERSITY_ADMISSIONS', title: null, is_active: true },
    ];
    expect(handoverTargets(team, 'a').map((m) => m.user_id)).toEqual(['b', 'd']);
  });
});

describe('V15 analytics tabs — one per question', () => {
  it('resolves a known question', () => {
    expect(analyticsTab('outcomes')).toBe('outcomes');
    expect(analyticsTab('agencies')).toBe('agencies');
    expect(analyticsTab('quality')).toBe('quality');
  });
  it('falls back to recruitment', () => {
    expect(analyticsTab('nope')).toBe('recruitment');
    expect(analyticsTab(null)).toBe('recruitment');
  });
  /**
   * V15 removed the `overview` tab: it held the funnel, which is now section 2 of the Overview page
   * itself. Existing links and bookmarks must still land somewhere sensible rather than on a default
   * that happens to be first, so the alias is asserted rather than left to the fallback.
   */
  it('keeps the V9 ?tab=overview bookmark working, on the question that now holds the funnel', () => {
    expect(analyticsTab('overview')).toBe('recruitment');
  });
});

describe('V9 decision plan: evidence first', () => {
  const acts = ['OFFERED', 'WAITLISTED', 'REJECTED', 'INTERVIEW', 'ADDITIONAL_DOCUMENTS'] as const;
  const base = { openRequests: 0, canRequest: true };
  it('no primary before the evidence was seen', () => {
    const p = decisionPlanV9('UNIVERSITY_REVIEW', [...acts], { ...base, evidence: { ready: true, open: 0, below: 0 }, seen: false });
    expect(p.primary).toBeNull();
    expect(p.secondary).toContain('OFFERED');
  });
  it('offer is primary only when every requirement is met', () => {
    expect(decisionPlanV9('UNIVERSITY_REVIEW', [...acts], { ...base, evidence: { ready: true, open: 0, below: 0 }, seen: true }).primary).toBe('OFFERED');
    expect(decisionPlanV9('UNIVERSITY_REVIEW', [...acts], { ...base, evidence: { ready: false, open: 2, below: 0 }, seen: true }).primary).toBe('REQUEST');
    expect(decisionPlanV9('UNIVERSITY_REVIEW', [...acts], { ...base, evidence: { ready: false, open: 1, below: 1 }, seen: true }).primary).toBeNull();
  });
  it('reject is always last', () => {
    const p = decisionPlanV9('UNIVERSITY_REVIEW', [...acts], { ...base, evidence: { ready: false, open: 1, below: 1 }, seen: true });
    expect(p.secondary[p.secondary.length - 1]).toBe('REJECTED');
  });
});
