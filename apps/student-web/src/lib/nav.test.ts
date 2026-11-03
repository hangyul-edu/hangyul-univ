import { describe, expect, it } from 'vitest';

import { KOREA_STAGES, NAV_SLOTS, SLOT_PATH, TASKS_REDIRECT, budgetRedirect, navStage } from './nav';

describe('journey stage', () => {
  it('maps journey stages to navigation stages', () => {
    expect(navStage('EXPLORE')).toBe('explore');
    expect(navStage('MATCH')).toBe('explore');
    expect(navStage('APPLY')).toBe('apply');
    expect(navStage('DECISION')).toBe('apply');
    expect(navStage('ENROLL')).toBe('admitted');
    expect(navStage('VISA')).toBe('admitted');
    expect(navStage('VISA', 'ISSUED')).toBe('arrival');
    expect(navStage('ARRIVAL')).toBe('arrival');
    expect(navStage(undefined)).toBe('apply');
  });
});

describe('V11 primary navigation', () => {
  // The rail no longer depends on the stage: that is the whole change (REPORT §76.2). V8 rotated five slots as
  // the student progressed, so the same tab position meant Compare, then Documents, then Visa.
  it('is the same four destinations at every stage', () => {
    expect(NAV_SLOTS).toEqual(['home', 'universities', 'applications', 'messages']);
  });

  it('answers each of the student’s four questions exactly once', () => {
    const paths = NAV_SLOTS.map((s) => SLOT_PATH[s]);
    expect(paths).toEqual(['/', '/explore', '/applications', '/messages']);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps the Korea steps out of the menu until they can be acted on', () => {
    expect(KOREA_STAGES).toEqual(['admitted', 'arrival']);
    expect(KOREA_STAGES).not.toContain(navStage('EXPLORE'));
    expect(KOREA_STAGES).not.toContain(navStage('APPLY'));
    expect(KOREA_STAGES).toContain(navStage('VISA', 'ISSUED'));
  });
});

describe('V22 retired destinations keep a route (REPORT §248 S4)', () => {
  it('sends /tasks to the home with the full list revealed', () => {
    expect(TASKS_REDIRECT).toBe('/?show=tasks');
  });

  it('sends /budget to the budget section of Compare, carrying the chosen programs', () => {
    expect(budgetRedirect('')).toBe('/compare#budget');
    expect(budgetRedirect('?programs=a,b')).toBe('/compare?ids=a,b#budget');
    expect(budgetRedirect('?ids=a')).toBe('/compare?ids=a#budget');
  });
});
