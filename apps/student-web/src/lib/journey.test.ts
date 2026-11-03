import { describe, expect, it } from 'vitest';

import { PHASES, journeyPhases, phaseOfStage, showsRecommendations } from './journey';

describe('V22 journey mapping (REPORT §248 S1)', () => {
  it('tells the nine API stages as six phases', () => {
    expect(PHASES).toEqual(['discover', 'prepare', 'apply', 'admission', 'visa', 'arrival']);
    expect(phaseOfStage('EXPLORE')).toBe('discover');
    expect(phaseOfStage('PROFILE')).toBe('discover');
    expect(phaseOfStage('MATCH')).toBe('discover');
    expect(phaseOfStage('APPLY')).toBe('prepare');
    expect(phaseOfStage('DECISION')).toBe('apply');
    expect(phaseOfStage('ENROLL')).toBe('admission');
    expect(phaseOfStage('VISA')).toBe('visa');
    expect(phaseOfStage('ARRIVAL')).toBe('arrival');
    expect(phaseOfStage('STUDENT_LIFE')).toBe('arrival');
  });

  it('marks exactly one phase current, everything before it done and everything after it todo', () => {
    const p = journeyPhases('ENROLL');
    expect(p.map((x) => x.state)).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
    for (const s of ['EXPLORE', 'APPLY', 'DECISION', 'VISA', 'STUDENT_LIFE'] as const) {
      expect(journeyPhases(s).filter((x) => x.state === 'current')).toHaveLength(1);
    }
    expect(journeyPhases('EXPLORE')[0].state).toBe('current');
    expect(journeyPhases('STUDENT_LIFE')[5].state).toBe('current');
  });

  it('shows recommendations only in stage 01 with no applications (REPORT §248 S2)', () => {
    const app = {} as never;
    expect(showsRecommendations({ journey: { stage: 'EXPLORE', stages: [] }, applications: [] })).toBe(true);
    expect(showsRecommendations({ journey: { stage: 'MATCH', stages: [] }, applications: [] })).toBe(true);
    expect(showsRecommendations({ journey: { stage: 'MATCH', stages: [] }, applications: [app] })).toBe(false);
    expect(showsRecommendations({ journey: { stage: 'APPLY', stages: [] }, applications: [] })).toBe(false);
  });
});
